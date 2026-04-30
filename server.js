const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ✅ APP INIT
const app = express();

// ✅ ROUTES IMPORT
const activityRoutes = require('./routes/activityRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const liveClassRoutes = require('./routes/liveClassRoutes');

// ✅ MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/activity', activityRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/enroll', require('./routes/enrollRoutes'));
app.use('/api/upload', uploadRoutes);
app.use('/api/live-classes', liveClassRoutes);

// ✅ 🔥 HEALTH CHECK (IMPORTANT FOR RENDER + PING)
app.get('/', (req, res) => {
  res.status(200).send('Server is alive 🚀');
});

// ✅ DB CONNECT
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Database connected!'))
  .catch((err) => console.log('❌ DB Error:', err));

// ✅ SERVER START
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});