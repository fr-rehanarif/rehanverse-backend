const express = require('express');
const app = express();

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send("Backend chal raha hai 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});