const express = require('express');
const router = express.Router();

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

// ✅ ADMIN: Generate Important Questions using AI
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

    if (!GROQ_API_KEY) {
      return res.status(500).json({ message: 'GROQ_API_KEY missing in environment variables' });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const prompt = `
You are an expert Indian university exam assistant.

Generate important exam questions from the following course material.

Course Title: ${course.title}

Material:
${sourceText}

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
            content:
              'You generate clean JSON only. Never add markdown, explanation, or extra text.',
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
      return res.status(500).json({
        message: 'AI generation failed',
        error: groqData?.error?.message || 'Unknown Groq error',
      });
    }

    const aiText = groqData?.choices?.[0]?.message?.content;

    if (!aiText) {
      return res.status(500).json({ message: 'No AI response received' });
    }

    const parsedContent = extractJson(aiText);

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