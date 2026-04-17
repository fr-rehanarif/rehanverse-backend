const express = require('express');
const app = express();

app.use(express.json());

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
  console.log("Server started");
});