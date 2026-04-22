const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: 'No token' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, 'secret123');

    req.user = {
      id: decoded.id,
      role: decoded.role
    };

    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};