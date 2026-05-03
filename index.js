require('dotenv').config();

console.log('ENV CHECK:', process.env.SUPABASE_URL ? 'Loaded' : 'Missing');
console.log('GROQ CHECK:', process.env.GROQ_API_KEY ? 'Loaded' : 'Missing');
console.log('MONGO CHECK:', process.env.MONGO_URI ? 'Loaded' : 'Missing');

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();

// ✅ Routes import
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const activityRoutes = require('./routes/activityRoutes');
const userRoutes = require('./routes/userRoutes');
const assistantRoutes = require('./routes/assistantRoutes');

// Optional routes — agar files exist hain to use honge
let pdfRoutes;
let couponRoutes;
let uploadRoutes;
let liveClassRoutes;
let notificationRoutes;
let progressRoutes;
let reviewRoutes;
let courseRoutes;
let enrollRoutes;

try { pdfRoutes = require('./routes/pdfRoutes'); } catch (e) {}
try { couponRoutes = require('./routes/couponRoutes'); } catch (e) {}
try { uploadRoutes = require('./routes/uploadRoutes'); } catch (e) {}
try { liveClassRoutes = require('./routes/liveClassRoutes'); } catch (e) {}
try { notificationRoutes = require('./routes/notificationRoutes'); } catch (e) {}
try { progressRoutes = require('./routes/progressRoutes'); } catch (e) {}
try { reviewRoutes = require('./routes/reviewRoutes'); } catch (e) {}
try { courseRoutes = require('./routes/courseRoutes'); } catch (e) {}
try { enrollRoutes = require('./routes/enrollRoutes'); } catch (e) {}

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ uploads folder ensure
const uploadsPath = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// ✅ Static uploads
app.use('/uploads', express.static(uploadsPath));

// ✅ Main API routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/assistant', assistantRoutes);

// ✅ Optional API routes
if (pdfRoutes) app.use('/api/pdf', pdfRoutes);
if (couponRoutes) app.use('/api/coupon', couponRoutes);
if (uploadRoutes) app.use('/api/upload', uploadRoutes);
if (liveClassRoutes) app.use('/api/live-classes', liveClassRoutes);
if (notificationRoutes) app.use('/api/notifications', notificationRoutes);
if (progressRoutes) app.use('/api/progress', progressRoutes);
if (reviewRoutes) app.use('/api/reviews', reviewRoutes);
if (courseRoutes) app.use('/api/courses', courseRoutes);
if (enrollRoutes) app.use('/api/enroll', enrollRoutes);

// ✅ Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API working 🚀' });
});

// ✅ Health route
app.get('/', (req, res) => {
  res.send('Backend chal raha hai 🚀');
});

// ✅ DB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Database connected!');
  })
  .catch((err) => {
    console.log('❌ DB Error:', err.message);
  });

// ✅ Server start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});