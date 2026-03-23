const express = require('express');
const axios = require('axios');
const auth = require('./authmiddle');
const User = require('./user');

const router = express.Router();

// Create Razorpay payment link (web-based checkout)
router.post('/create-link', auth, async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount is required and must be > 0' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('❌ RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing in .env');
      return res.status(500).json({ error: 'Payment configuration missing on server' });
    }

    const payload = {
      amount: Math.round(amount * 100), // rupees → paise
      currency: 'INR',
      description: description || 'Tiffica food order payment',
      customer: {
        name: user.name || 'Customer',
        email: user.email || undefined,
        contact: user.phone || user.mobile || undefined,
      },
      notes: {
        userId: user._id.toString(),
      },
    };

    const rpResponse = await axios.post(
      'https://api.razorpay.com/v1/payment_links',
      payload,
      {
        auth: {
          username: keyId,
          password: keySecret,
        },
      }
    );

    const link = rpResponse.data;

    return res.json({
      success: true,
      id: link.id,
      status: link.status,
      amount: link.amount,
      currency: link.currency,
      short_url: link.short_url,
    });
  } catch (err) {
    const rpError = err.response?.data || err.message || err;
    console.error('❌ Razorpay create-link error:', rpError);

    return res.status(500).json({
      error: 'Failed to create payment link',
      details: rpError,
    });
  }
});

module.exports = router;

