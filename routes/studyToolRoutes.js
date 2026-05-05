const express = require('express');
const router = express.Router();
const axios = require('axios');

// ✅ pdf-parse import fix
// pdf-parse v1 exports a direct function, v2 exports PDFParse class.
const pdfParseModule = require('pdf-parse');

async function parsePdfBuffer(buffer) {
  // ✅ Old pdf-parse versions
  if (typeof pdfParseModule === 'function') {
    return pdfParseModule(buffer);
  }

  if (typeof pdfParseModule.default === 'function') {
    return pdfParseModule.default(buffer);
  }

  if (typeof pdfParseModule.pdfParse === 'function') {
    return pdfParseModule.pdfParse(buffer);
  }

  if (typeof pdfParseModule.parse === 'function') {
    return pdfParseModule.parse(buffer);
  }

  // ✅ New pdf-parse versions
  if (typeof pdfParseModule.PDFParse === 'function') {
    const parser = new pdfParseModule.PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return {
        text: result?.text || '',
        numpages: result?.total || result?.pages?.length || 0,
        info: result?.info || {},
      };
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  }

  console.log('❌ pdf-parse module keys:', Object.keys(pdfParseModule || {}));
  throw new Error('pdf-parse package ka supported parser function/class nahi mila.');
}

const StudyTool = require('../models/StudyTool');
const Course = require('../models/Course');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ✅ Helper: safe JSON parse
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('AI response was not valid JSON');
  }
}

// ✅ Helper: Extract text from PDF URL
async function extractTextFromPdfUrl(pdfUrl) {
  if (!pdfUrl) {
    throw new Error('PDF URL missing');
  }

  try {
    console.log('🔗 PDF URL:', pdfUrl);

    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        Accept: 'application/pdf,*/*',
        'User-Agent': 'Mozilla/5.0 REHANVERSE-AI-PDF-Extractor',
      },
      // ✅ Isse axios non-200 response pe direct throw nahi karega,
      // hum khud status/content-type log karke clean error denge.
      validateStatus: () => true,
    });

    console.log('📥 PDF download status:', response.status);
    console.log('📥 PDF content-type:', response.headers['content-type']);
    console.log(
      '📥 PDF content-length:',
      response.data?.byteLength || response.data?.length
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `PDF download failed. Status: ${response.status}. Supabase URL public/access issue ho sakta hai.`
      );
    }

    const contentType = response.headers['content-type'] || '';

    if (
      !contentType.includes('pdf') &&
      !contentType.includes('octet-stream') &&
      !contentType.includes('application/octet-stream')
    ) {
      throw new Error(
        `PDF URL actual PDF return nahi kar raha. Content-Type: ${contentType}`
      );
    }

    const buffer = Buffer.from(response.data);

    if (!buffer || buffer.length < 1000) {
      throw new Error('Downloaded PDF file empty ya invalid lag rahi hai.');
    }

    const parsed = await parsePdfBuffer(buffer);
    const text = parsed.text?.trim();

    console.log('📝 Extracted text length:', text?.length || 0);

    if (!text || text.length < 80) {
      throw new Error(
        'PDF download ho gayi, but text extract nahi hua. PDF protected/scanned/encoded ho sakti hai.'
      );
    }

    return text;
  } catch (error) {
    console.log('❌ extractTextFromPdfUrl error:', error.message);
    throw error;
  }
}

// ✅ Helper: Generate important questions using Groq
async function generateImportantQuestionsWithAI({ courseTitle, sourceText }) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing in environment variables');
  }

  // Groq context limit safe rakhne ke liye. Baad mein chunking add kar sakte hain.
  const safeText = sourceText.slice(0, 24000);

  const prompt = `
You are an expert Indian university exam assistant.

Generate important exam questions from the following course material.

Course Title: ${courseTitle}

Material:
${safeText}

Return ONLY valid JSON in this exact format:

{
  "shortQuestions": [
    {
      "question": "string",
      "answerHint": "string"
    }
  ],
  "longQuestions": [
    {
      "question": "string",
      "answerHint": "string"
    }
  ],
  "mcqs": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "string",
      "explanation": "string"
    }
  ],
  "mostExpectedQuestions": [
    {
      "question": "string",
      "reason": "string"
    }
  ]
}

Rules:
- Generate 10 short questions.
- Generate 10 long questions.
- Generate 15 MCQs.
- Generate 5 most expected questions.
- Keep language simple and exam-focused.
- Do not add markdown.
- Do not add text outside JSON.
`;

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You generate clean JSON only. Never add markdown, explanation, or extra text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 3500,
    }),
  });

  const groqData = await groqResponse.json();

  if (!groqResponse.ok) {
    console.error('Groq Error:', groqData);
    throw new Error(groqData?.error?.message || 'AI generation failed');
  }

  const aiText = groqData?.choices?.[0]?.message?.content;

  if (!aiText) {
    throw new Error('No AI response received');
  }

  return extractJson(aiText);
}

// ✅ ADMIN: Generate Important Questions from pasted text
router.post('/generate-important-questions', protect, adminOnly, async (req, res) => {
  try {
    const { courseId, sourceText, sourcePdf } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    if (!sourceText || sourceText.trim().length < 50) {
      return res.status(400).json({
        message: 'sourceText is required and should be at least 50 characters',
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const parsedContent = await generateImportantQuestionsWithAI({
      courseTitle: course.title,
      sourceText: sourceText.trim(),
    });

    const studyTool = await StudyTool.create({
      course: courseId,
      type: 'important_questions',
      title: `Important Questions - ${course.title}`,
      content: parsedContent,
      sourcePdf: sourcePdf || {},
      status: 'draft',
      generatedBy: req.user?._id,
    });

    res.status(201).json({
      message: 'Important questions generated successfully',
      studyTool,
    });
  } catch (error) {
    console.error('Generate Important Questions Error:', error);
    res.status(500).json({
      message: 'Server error while generating important questions',
      error: error.message,
    });
  }
});

// ✅ ADMIN: Generate Important Questions directly from selected/all course PDFs
router.post('/generate-important-questions-from-pdf', protect, adminOnly, async (req, res) => {
  try {
    const { courseId, pdfIndex = 0, pdfIndexes, allPdfs = false } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (!course.pdfs || course.pdfs.length === 0) {
      return res.status(400).json({
        message: 'Is course mein koi PDF uploaded nahi hai',
      });
    }

    let pdfsToUse = [];

    // ✅ Frontend se selected indexes aayenge: pdfIndexes: [0, 2, 4]
    if (Array.isArray(pdfIndexes) && pdfIndexes.length > 0) {
      pdfsToUse = pdfIndexes
        .map((index) => course.pdfs[Number(index)])
        .filter((pdf) => pdf?.url);
    } else if (allPdfs) {
      pdfsToUse = course.pdfs.filter((pdf) => pdf?.url);
    } else {
      pdfsToUse = [course.pdfs[Number(pdfIndex)] || course.pdfs[0]].filter((pdf) => pdf?.url);
    }

    if (pdfsToUse.length === 0) {
      return res.status(400).json({
        message: 'Selected PDF URLs missing hain',
      });
    }

    let combinedText = '';
    const usedPdfs = [];
    const failedPdfs = [];

    // ✅ Selected PDFs ka text combine karo
    for (const pdf of pdfsToUse) {
      try {
        console.log('📄 Extracting text from PDF:', pdf.title || pdf.url);

        const pdfText = await extractTextFromPdfUrl(pdf.url);

        combinedText += `\n\n===== PDF: ${pdf.title || pdf.filename || 'Untitled PDF'} =====\n\n`;
        combinedText += pdfText;

        usedPdfs.push({
          title: pdf.title || '',
          url: pdf.url || '',
          filename: pdf.filename || '',
          extractedCharacters: pdfText.length,
        });

        console.log('✅ PDF text extracted:', pdf.title || pdf.filename, pdfText.length);
      } catch (pdfErr) {
        console.log('❌ PDF extract failed:', pdf.title || pdf.filename, pdfErr.message);

        failedPdfs.push({
          title: pdf.title || '',
          filename: pdf.filename || '',
          error: pdfErr.message,
        });
      }
    }

    if (!combinedText.trim() || combinedText.trim().length < 80) {
      return res.status(400).json({
        message:
          'Selected PDFs se text extract nahi ho paya. PDFs scanned/image based ho sakti hain ya URL accessible nahi hai.',
        failedPdfs,
      });
    }

    const parsedContent = await generateImportantQuestionsWithAI({
      courseTitle: course.title,
      sourceText: combinedText,
    });

    const studyTool = await StudyTool.create({
      course: courseId,
      type: 'important_questions',
      title: `Important Questions - ${course.title}`,
      content: parsedContent,
      sourcePdf: {
        title:
          usedPdfs.length > 1
            ? `${usedPdfs.length} PDFs combined`
            : usedPdfs[0]?.title || '',
        url: usedPdfs[0]?.url || '',
        filename:
          usedPdfs.length > 1
            ? usedPdfs.map((p) => p.filename || p.title).filter(Boolean).join(', ')
            : usedPdfs[0]?.filename || '',
      },
      status: 'draft',
      generatedBy: req.user?._id,
    });

    res.status(201).json({
      message:
        usedPdfs.length > 1
          ? 'Important questions generated from selected PDFs successfully'
          : 'Important questions generated from selected PDF successfully',
      studyTool,
      extractedCharacters: combinedText.length,
      usedPdfCount: usedPdfs.length,
      usedPdfs,
      failedPdfs,
    });
  } catch (error) {
    console.error('Generate Important Questions From PDF Error:', error);
    res.status(500).json({
      message: error.message || 'Server error while generating important questions from PDF',
    });
  }
});

// ✅ ADMIN: Get all study tools for a course, draft + published
router.get('/admin/course/:courseId', protect, adminOnly, async (req, res) => {
  try {
    const tools = await StudyTool.find({ course: req.params.courseId })
      .sort({ createdAt: -1 })
      .populate('course', 'title')
      .populate('generatedBy', 'name email');

    res.json(tools);
  } catch (error) {
    console.error('Admin Get Study Tools Error:', error);
    res.status(500).json({ message: 'Server error while fetching study tools' });
  }
});

// ✅ STUDENT: Get only published study tools for enrolled/free course
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const isAdmin = req.user?.role === 'admin';

    const isEnrolled =
      req.user?.enrolledCourses?.some(
        (id) => id.toString() === course._id.toString()
      ) || false;

    if (!course.isFree && !isEnrolled && !isAdmin) {
      return res.status(403).json({
        message: 'You must enroll in this course to access study tools',
      });
    }

    const tools = await StudyTool.find({
      course: req.params.courseId,
      status: 'published',
    }).sort({ createdAt: -1 });

    res.json(tools);
  } catch (error) {
    console.error('Student Get Study Tools Error:', error);
    res.status(500).json({ message: 'Server error while fetching study tools' });
  }
});

// ✅ ADMIN: Publish study tool
router.patch('/:id/publish', protect, adminOnly, async (req, res) => {
  try {
    const tool = await StudyTool.findByIdAndUpdate(
      req.params.id,
      { status: 'published' },
      { new: true }
    );

    if (!tool) {
      return res.status(404).json({ message: 'Study tool not found' });
    }

    res.json({
      message: 'Study tool published successfully',
      studyTool: tool,
    });
  } catch (error) {
    console.error('Publish Study Tool Error:', error);
    res.status(500).json({ message: 'Server error while publishing study tool' });
  }
});

// ✅ ADMIN: Unpublish study tool
router.patch('/:id/unpublish', protect, adminOnly, async (req, res) => {
  try {
    const tool = await StudyTool.findByIdAndUpdate(
      req.params.id,
      { status: 'draft' },
      { new: true }
    );

    if (!tool) {
      return res.status(404).json({ message: 'Study tool not found' });
    }

    res.json({
      message: 'Study tool moved to draft successfully',
      studyTool: tool,
    });
  } catch (error) {
    console.error('Unpublish Study Tool Error:', error);
    res.status(500).json({ message: 'Server error while unpublishing study tool' });
  }
});

// ✅ ADMIN: Delete study tool
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const tool = await StudyTool.findByIdAndDelete(req.params.id);

    if (!tool) {
      return res.status(404).json({ message: 'Study tool not found' });
    }

    res.json({ message: 'Study tool deleted successfully' });
  } catch (error) {
    console.error('Delete Study Tool Error:', error);
    res.status(500).json({ message: 'Server error while deleting study tool' });
  }
});

module.exports = router;
