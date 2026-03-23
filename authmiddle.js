const jwt = require('jsonwebtoken');
const User = require('./user');

const auth = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called');
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    console.log('🔑 Token found, verifying...');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified, user ID:', decoded.userId);
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError.message);
      return res.status(401).json({ error: 'Invalid or expired token', details: jwtError.message });
    }
    
    let user;
    try {
      user = await User.findById(decoded.userId).select('-password');
      console.log('✅ User query completed');
    } catch (userError) {
      console.error('❌ User lookup failed:', userError.message);
      return res.status(500).json({ error: 'Database error during authentication', details: userError.message });
    }

    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('✅ User found:', user.name);
    req.user = user;
    req.userId = decoded.userId;
    
    console.log('✅ Auth passed, calling next()');
    if (typeof next !== 'function') {
      console.error('❌ CRITICAL: next is not a function!');
      console.error('   typeof next:', typeof next);
      console.error('   next value:', next);
      return res.status(500).json({ error: 'Internal server error: middleware error' });
    }
    
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    console.error('   Error Type:', error.constructor.name);
    console.error('   Stack:', error.stack);
    res.status(401).json({ error: 'Invalid authentication token', details: error.message });
  }
};

module.exports = auth;