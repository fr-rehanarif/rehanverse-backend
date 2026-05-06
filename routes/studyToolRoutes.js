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

// ✅ Helper: wait/sleep for Groq free-tier TPM limit
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ✅ Helper: split long PDF text into balanced chunks
function createBalancedChunks(text, chunkSize = 2800, maxChunks = 5) {
  const cleanText = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/={3,}/g, '\n')
    .trim();

  if (!cleanText) return [];

  const chunks = [];

  for (let i = 0; i < cleanText.length; i += chunkSize) {
    const chunk = cleanText.slice(i, i + chunkSize).trim();
    if (chunk.length > 250) chunks.push(chunk);
  }

  if (chunks.length <= maxChunks) return chunks;

  // ✅ Pick chunks from start/middle/end instead of only first pages
  const selected = [];
  const lastIndex = chunks.length - 1;

  for (let i = 0; i < maxChunks; i++) {
    const index = Math.round((i * lastIndex) / (maxChunks - 1));
    selected.push(chunks[index]);
  }

  return selected;
}

// ✅ Helper: safe array
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

// ✅ Helper: merge + dedupe generated questions
function mergeGeneratedQuestionSets(items) {
  const seen = new Set();

  const uniqueByQuestion = (arr) => {
    const output = [];

    for (const item of safeArray(arr)) {
      const question = String(item?.question || '').trim();
      const key = question.toLowerCase();

      if (!question || seen.has(key)) continue;

      seen.add(key);
      output.push(item);
    }

    return output;
  };

  return {
    shortQuestions: uniqueByQuestion(items.flatMap((x) => safeArray(x.shortQuestions))).slice(0, 10),
    longQuestions: uniqueByQuestion(items.flatMap((x) => safeArray(x.longQuestions))).slice(0, 10),
    mcqs: uniqueByQuestion(items.flatMap((x) => safeArray(x.mcqs))).slice(0, 15),
    mostExpectedQuestions: uniqueByQuestion(items.flatMap((x) => safeArray(x.mostExpectedQuestions))).slice(0, 5),
  };
}

// ✅ Helper: merge + dedupe generated quiz questions
function mergeGeneratedQuizSets(items) {
  const seen = new Set();
  const output = [];

  for (const set of safeArray(items)) {
    const questions = safeArray(set.quizQuestions || set.questions || set.mcqs);

    for (const item of questions) {
      const question = String(item?.question || '').trim();
      const key = question.toLowerCase();

      if (!question || seen.has(key)) continue;

      const options = safeArray(item.options).slice(0, 4);

      if (options.length < 4) continue;

      seen.add(key);
      output.push({
        question,
        options,
        correctAnswer: String(item.correctAnswer || item.answer || '').trim(),
        explanation: String(item.explanation || item.answerHint || '').trim(),
      });
    }
  }

  return {
    quizQuestions: output.slice(0, 20),
  };
}

// ✅ Helper: Call Groq and return parsed JSON
async function callGroqJson(prompt, maxTokens = 650) {
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
      temperature: 0.25,
      max_tokens: maxTokens,
    }),
  });

  const groqData = await groqResponse.json();

  if (!groqResponse.ok) {
    console.error('Groq Error:', groqData);
    const msg = groqData?.error?.message || 'AI generation failed';
    const err = new Error(msg);
    err.code = groqData?.error?.code;
    err.type = groqData?.error?.type;
    throw err;
  }

  const aiText = groqData?.choices?.[0]?.message?.content;

  if (!aiText) {
    throw new Error('No AI response received');
  }

  return extractJson(aiText);
}

// ✅ Helper: Generate important questions using Groq with chunking + merge
async function generateImportantQuestionsWithAI({ courseTitle, sourceText }) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing in environment variables');
  }

  const chunks = createBalancedChunks(sourceText, 2800, 5);

  if (chunks.length === 0) {
    throw new Error('AI generation ke liye readable PDF text nahi mila.');
  }

  console.log(`🧠 AI chunking started. Total chunks used: ${chunks.length}`);

  const generatedParts = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const prompt = `
You are an expert Indian university exam assistant.

Generate important exam questions from this PDF chunk.

Course Title: ${courseTitle}
Chunk: ${i + 1} of ${chunks.length}

Material:
${chunk}

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
- Generate 1 short question.
- Generate 1 long question.
- Generate 2 MCQs.
- Generate 1 most expected question.
- Keep language simple and exam-focused.
- Avoid duplicate questions.
- Do not add markdown.
- Do not add text outside JSON.
`;

    try {
      console.log(`🤖 Groq generating chunk ${i + 1}/${chunks.length}...`);
      const result = await callGroqJson(prompt, 650);
      generatedParts.push(result);
    } catch (err) {
      // ✅ If Groq TPM hits, wait and retry once
      if (err.code === 'rate_limit_exceeded' || err.type === 'tokens') {
        console.log(`⏳ Groq rate limit on chunk ${i + 1}. Waiting 20s then retrying...`);
        await sleep(20000);
        const retryResult = await callGroqJson(prompt, 650);
        generatedParts.push(retryResult);
      } else {
        throw err;
      }
    }

    // ✅ Free-tier friendly throttling
    if (i < chunks.length - 1) {
      await sleep(65000);
    }
  }

  const merged = mergeGeneratedQuestionSets(generatedParts);

  console.log('✅ AI chunking finished:', {
    short: merged.shortQuestions.length,
    long: merged.longQuestions.length,
    mcqs: merged.mcqs.length,
    expected: merged.mostExpectedQuestions.length,
  });

  return merged;
}

// ✅ Helper: Generate quiz questions using Groq with chunking + merge
async function generateQuizWithAI({ courseTitle, sourceText }) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing in environment variables');
  }

  const chunks = createBalancedChunks(sourceText, 2600, 5);

  if (chunks.length === 0) {
    throw new Error('Quiz generation ke liye readable PDF text nahi mila.');
  }

  console.log(`🧠 AI quiz chunking started. Total chunks used: ${chunks.length}`);

  const generatedParts = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const prompt = `
You are an expert Indian university exam quiz creator.

Generate exam-focused quiz questions from this PDF chunk.

Course Title: ${courseTitle}
Chunk: ${i + 1} of ${chunks.length}

Material:
${chunk}

Return ONLY valid JSON in this exact format:
{
  "quizQuestions": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "string",
      "explanation": "string"
    }
  ]
}

Rules:
- Generate 3 quiz questions from this chunk.
- Options must be clear and exam-focused.
- correctAnswer must exactly match one option text, not just A/B/C/D.
- explanation should be short and useful.
- Avoid duplicate questions.
- Keep language simple.
- Do not add markdown.
- Do not add text outside JSON.
`;

    try {
      console.log(`🧠 Groq generating quiz chunk ${i + 1}/${chunks.length}...`);
      const result = await callGroqJson(prompt, 750);
      generatedParts.push(result);
    } catch (err) {
      if (err.code === 'rate_limit_exceeded' || err.type === 'tokens') {
        console.log(`⏳ Groq quiz rate limit on chunk ${i + 1}. Waiting 20s then retrying...`);
        await sleep(20000);
        const retryResult = await callGroqJson(prompt, 750);
        generatedParts.push(retryResult);
      } else {
        throw err;
      }
    }

    if (i < chunks.length - 1) {
      await sleep(65000);
    }
  }

  const merged = mergeGeneratedQuizSets(generatedParts);

  console.log('✅ AI quiz chunking finished:', {
    quizQuestions: merged.quizQuestions.length,
  });

  return merged;
}

// ✅ ADMIN: Generate Important Questions from pasted text
router.post('/generate-important-questions', protect, adminOnly, async (req, res) => {
  try {
    const { courseId, sourceText, sourcePdf, customTitle = '' } = req.body;

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
      title: customTitle?.trim() || `Important Questions - ${course.title}`,
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
    const { courseId, pdfIndex = 0, pdfIndexes, allPdfs = false, customTitle = '' } = req.body;

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
      title: customTitle?.trim() || `Important Questions - ${course.title}`,
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

// ✅ ADMIN: Generate Quiz from pasted text
router.post('/generate-quiz', protect, adminOnly, async (req, res) => {
  try {
    const { courseId, sourceText, sourcePdf, customTitle = '' } = req.body;

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

    const parsedContent = await generateQuizWithAI({
      courseTitle: course.title,
      sourceText: sourceText.trim(),
    });

    const studyTool = await StudyTool.create({
      course: courseId,
      type: 'quiz',
      title: customTitle?.trim() || `Quiz Practice - ${course.title}`,
      content: parsedContent,
      sourcePdf: sourcePdf || {},
      status: 'draft',
      generatedBy: req.user?._id,
    });

    res.status(201).json({
      message: 'Quiz generated successfully',
      studyTool,
    });
  } catch (error) {
    console.error('Generate Quiz Error:', error);
    res.status(500).json({
      message: 'Server error while generating quiz',
      error: error.message,
    });
  }
});

// ✅ ADMIN: Generate Quiz directly from selected/all course PDFs
router.post('/generate-quiz-from-pdf', protect, adminOnly, async (req, res) => {
  try {
    const { courseId, pdfIndex = 0, pdfIndexes, allPdfs = false, customTitle = '' } = req.body;

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

    for (const pdf of pdfsToUse) {
      try {
        console.log('📄 Extracting text from PDF for quiz:', pdf.title || pdf.url);

        const pdfText = await extractTextFromPdfUrl(pdf.url);

        combinedText += `\n\n===== PDF: ${pdf.title || pdf.filename || 'Untitled PDF'} =====\n\n`;
        combinedText += pdfText;

        usedPdfs.push({
          title: pdf.title || '',
          url: pdf.url || '',
          filename: pdf.filename || '',
          extractedCharacters: pdfText.length,
        });

        console.log('✅ PDF text extracted for quiz:', pdf.title || pdf.filename, pdfText.length);
      } catch (pdfErr) {
        console.log('❌ Quiz PDF extract failed:', pdf.title || pdf.filename, pdfErr.message);

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
          'Selected PDFs se quiz ke liye text extract nahi ho paya. PDFs scanned/image based ho sakti hain ya URL accessible nahi hai.',
        failedPdfs,
      });
    }

    const parsedContent = await generateQuizWithAI({
      courseTitle: course.title,
      sourceText: combinedText,
    });

    const studyTool = await StudyTool.create({
      course: courseId,
      type: 'quiz',
      title: customTitle?.trim() || `Quiz Practice - ${course.title}`,
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
          ? 'Quiz generated from selected PDFs successfully'
          : 'Quiz generated from selected PDF successfully',
      studyTool,
      extractedCharacters: combinedText.length,
      usedPdfCount: usedPdfs.length,
      usedPdfs,
      failedPdfs,
    });
  } catch (error) {
    console.error('Generate Quiz From PDF Error:', error);
    res.status(500).json({
      message: error.message || 'Server error while generating quiz from PDF',
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