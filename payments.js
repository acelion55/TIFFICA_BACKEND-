const express = require('express');
const axios   = require('axios');
const crypto  = require('crypto');
const auth    = require('./authmiddle');
const User    = require('./user');

const router = express.Router();

// ── Create Razorpay order ──────────────────────────────────
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: 'Amount must be > 0' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const keyId     = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret)
      return res.status(500).json({ error: 'Payment config missing' });

    const payload = {
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`,
      notes:    { userId: user._id.toString(), description: description || 'Tiffica payment' },
    };

    const rpRes = await axios.post(
      'https://api.razorpay.com/v1/orders',
      payload,
      { auth: { username: keyId, password: keySecret } }
    );

    return res.json({ success: true, order: rpRes.data });
  } catch (err) {
    console.error('❌ Razorpay create-order:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to create order', details: err.response?.data });
  }
});

// ── Create Razorpay payment link ──────────────────────────
router.post('/create-link', auth, async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: 'Amount must be > 0' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const keyId     = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret)
      return res.status(500).json({ error: 'Payment config missing' });

    const payload = {
      amount:      Math.round(amount * 100),
      currency:    'INR',
      description: description || 'Tiffica payment',
      customer: {
        name:    user.name    || 'Customer',
        email:   user.email   || undefined,
        contact: user.phone   || undefined,
      },
      notes: { userId: user._id.toString() },
    };

    const rpRes = await axios.post(
      'https://api.razorpay.com/v1/payment_links',
      payload,
      { auth: { username: keyId, password: keySecret } }
    );

    const link = rpRes.data;
    return res.json({
      success:   true,
      id:        link.id,
      short_url: link.short_url,
      amount:    link.amount,
    });
  } catch (err) {
    console.error('❌ Razorpay create-link:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to create payment link', details: err.response?.data });
  }
});

// ── Credit wallet after successful payment ────────────────
router.post('/wallet-credit', auth, async (req, res) => {
  try {
    const { amount, paymentId } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: 'Invalid amount' });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $inc: { walletBalance: amount } },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });

    console.log(`✅ Wallet credited ₹${amount} for user ${req.userId}, paymentId: ${paymentId}`);
    return res.json({ success: true, walletBalance: user.walletBalance, user });
  } catch (err) {
    console.error('❌ Wallet credit error:', err.message);
    return res.status(500).json({ error: 'Failed to credit wallet' });
  }
});

// ── Verify Razorpay signature (webhook / manual verify) ───
router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body   = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expected !== razorpay_signature)
      return res.status(400).json({ error: 'Invalid signature' });

    return res.json({ success: true, verified: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
