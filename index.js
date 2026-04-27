const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/paymentRoutes'); // 👈 add this

const activityRoutes = require('./routes/activityRoutes');


const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/activity', activityRoutes);

// 📁 uploads folder serve karne ke liye
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// 🔐 AUTH ROUTES
app.use('/api/auth', authRoutes);

// 💸 PAYMENT ROUTES
app.use('/api/payment', paymentRoutes);


// ✅ TEST ROUTE
app.get('/api/test', (req, res) => {
  res.json({ message: "API working 🚀" });
});



// ✅ ROOT ROUTE
app.get('/', (req, res) => {
  res.send("Backend chal raha hai 🚀");
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT} 🚀`);
});