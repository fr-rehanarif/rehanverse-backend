const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/enroll', require('./routes/enrollRoutes'));

const uploadRoutes = require('./routes/uploadRoutes');
app.use('/api/upload' , uploadRoutes );

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Database connected!'))
  .catch((err) => console.log('❌ DB Error:', err));

const path = require('path');
app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

