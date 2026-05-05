const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ✅ APP INIT
const app = express();

// ✅ ENV CHECKS
console.log('ENV CHECK:', process.env.SUPABASE_URL ? 'Loaded' : 'Missing');
console.log('MONGO CHECK:', process.env.MONGO_URI ? 'Loaded' : 'Missing');
console.log('EMAIL USER CHECK:', process.env.EMAIL_USER ? 'Loaded' : 'Missing');
console.log('EMAIL PASS CHECK:', process.env.EMAIL_PASS ? 'Loaded' : 'Missing');
console.log('GROQ CHECK:', process.env.GROQ_API_KEY ? 'Loaded' : 'Missing');

// ✅ ROUTES IMPORT
const activityRoutes = require('./routes/activityRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const couponRoutes = require('./routes/couponRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const liveClassRoutes = require('./routes/liveClassRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const progressRoutes = require('./routes/progressRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const authRoutes = require('./routes/authRoutes');
const studyToolRoutes = require('./routes/studyToolRoutes');

// ✅ MIDDLEWARE
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Request logger for debugging
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  next();
});

// 📁 uploads folder ensure karo
const uploadsPath = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// ✅ STATIC FILES
app.use('/uploads', express.static(uploadsPath));

// ✅ API ROUTES
app.use('/api/pdf', pdfRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/coupon', couponRoutes);
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/activity', activityRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', authRoutes);
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/enroll', require('./routes/enrollRoutes'));
app.use('/api/upload', uploadRoutes);
app.use('/api/live-classes', liveClassRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/study-tools', studyToolRoutes);

// ✅ TEST ROUTE
app.get('/api/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API working 🚀',
  });
});

// ✅ HEALTH CHECK
app.get('/', (req, res) => {
  res.status(200).send('Server is alive 🚀');
});

// ✅ DB CONNECT
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Database connected!'))
  .catch((err) => console.log('❌ DB Error:', err.message));

// ✅ SERVER START
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});