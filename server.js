const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ✅ APP PEHLE BANAAO
const app = express();

// ✅ ROUTES IMPORT BAAD ME
const pdfRoutes = require('./routes/pdfRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// ✅ MIDDLEWARE
app.use(cors());
app.use(express.json());

// 📁 uploads folder ensure karo
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// ✅ STATIC (images etc ke liye)
app.use('/uploads', express.static(uploadsPath));

// ✅ ROUTES USE KARO (app ke baad)
app.use('/api/pdf', pdfRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/enroll', require('./routes/enrollRoutes'));
app.use('/api/upload', uploadRoutes);

// ✅ DB CONNECT
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Database connected!'))
  .catch((err) => console.log('❌ DB Error:', err));

// ✅ SERVER START
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});