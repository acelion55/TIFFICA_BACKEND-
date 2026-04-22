const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./user');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify delivery partner token (supports both delivery-auth and regular auth tokens)
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user with delivery role
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'delivery') {
      return res.status(401).json({ error: 'Not authorized as delivery partner' });
    }
    
    req.partnerId = user._id;
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// GET /api/delivery-auth/me - Get current partner profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.partnerId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, partner: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/delivery-auth/profile - Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const user = await User.findById(req.partnerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (name) user.name = name;
    if (email) user.email = email;
    
    await user.save();
    
    res.json({ success: true, partner: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery-auth/toggle-online - Toggle online/offline status
router.post('/toggle-online', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.partnerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Toggle isOnline status (you may need to add this field to User model)
    user.isOnline = !user.isOnline;
    await user.save();
    
    console.log(`🔄 Partner ${user.name} is now ${user.isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    res.json({ 
      success: true, 
      isOnline: user.isOnline,
      message: `You are now ${user.isOnline ? 'online' : 'offline'}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery-auth/update-location - Update current location
router.post('/update-location', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }
    
    const user = await User.findById(req.partnerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.currentLocation = {
      latitude,
      longitude,
      locationName: address || user.currentLocation?.locationName,
      updatedAt: new Date()
    };
    
    await user.save();
    
    res.json({ success: true, message: 'Location updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, authMiddleware };
