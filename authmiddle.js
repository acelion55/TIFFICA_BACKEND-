const jwt = require('jsonwebtoken');
const User = require('./user');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    let user;
    try {
      user = await User.findById(decoded.userId).select('-password');
    } catch (userError) {
      return res.status(500).json({ error: 'Database error during authentication' });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    req.userId = decoded.userId;
    req.userRole = user.role || 'user';
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Admin-only middleware
const adminAuth = async (req, res, next) => {
  try {
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = auth;
module.exports.adminAuth = adminAuth;