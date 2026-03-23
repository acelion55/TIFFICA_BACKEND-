const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('./user');
const auth = require('./authmiddle');

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmailOtp(email, otp) {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:16px;background:#fff8f0;border:1px solid #fde8cc">
      <h2 style="color:#f97316;margin:0 0 8px">Your Tiffica OTP</h2>
      <p style="color:#555;margin:0 0 24px">Use the code below to log in. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:36px;font-weight:900;letter-spacing:10px;color:#1a1a1a;background:#fff;border:2px dashed #f97316;border-radius:12px;padding:16px;text-align:center">${otp}</div>
      <p style="color:#aaa;font-size:12px;margin-top:24px">If you didn't request this, please ignore this email.</p>
    </div>`;
  await transporter.sendMail({
    from: `"Tiffica" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Tiffica Login OTP',
    html,
  });
}

// Send email OTP
router.post('/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'No account found with this email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendEmailOtp(email, otp);
    } catch (mailErr) {
      console.warn('⚠️  Email send failed, OTP logged:', otp, mailErr.message);
    }

    res.json({ msg: 'OTP sent to email' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login with email OTP
router.post('/login-email-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email, otp, otpExpiry: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ msg: 'Invalid or expired OTP' });

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const payload = { userId: user.id };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      name,
      email,
      phone,
      password,
    });

    await user.save();

    const payload = {
      userId: user.id,
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login with password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const payload = {
      userId: user.id,
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Send OTP for login
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // In a real application, you would send the OTP via SMS
    console.log(`Login OTP for ${phone}: ${otp}`);

    res.json({ msg: 'OTP sent to phone' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login with OTP
router.post('/login-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({
      phone,
      otp,
      otpExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const payload = {
      userId: user.id,
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Forgot password - send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiry = otpExpiry;
    await user.save();

    // In a real application, you would send the OTP via email
    console.log(`Password reset OTP for ${email}: ${otp}`);

    res.json({ msg: 'Password reset OTP sent' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Reset password with OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordOtpExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    user.password = password;
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpiry = null;
    await user.save();

    res.json({ msg: 'Password reset successful' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get user profile (protected route)
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, phone, addresses } = req.body;
        const updatedFields = {};

        if (name) updatedFields.name = name;
        if (phone) updatedFields.phone = phone;
        if (addresses) updatedFields.addresses = addresses;

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: updatedFields },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error('Error updating profile:', err.message);
        res.status(500).send('Server error');
    }
});


// Save user's current location
router.put('/location', auth, async (req, res) => {
  try {
    const { latitude, longitude, locationName } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ msg: 'latitude and longitude required' });
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { currentLocation: { latitude, longitude, locationName: locationName || '' } } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'Location saved', user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;