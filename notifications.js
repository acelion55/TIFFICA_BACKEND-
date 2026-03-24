const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const Notification = require('./notification');
const PushSubscription = require('./pushsubscription');
const auth = require('./authmiddle');

if (process.env.VAPID_EMAIL && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ── Public: get VAPID public key ─────────────────────────
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ── User: save push subscription ────────────────────────
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    // Upsert — replace old subscription for this user
    await PushSubscription.findOneAndUpdate(
      { user: req.userId },
      { user: req.userId, subscription },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: create notification + send push to all ────────
router.post('/admin', auth, async (req, res) => {
  try {
    const { title, message, type, targetAll, targetUser } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title and message required' });

    const notif = await Notification.create({
      title, message, type: type || 'info',
      targetAll: targetAll !== false,
      targetUser: targetUser || null,
    });

    // Send push notifications asynchronously
    const payload = JSON.stringify({ title, body: message, type: type || 'info', notifId: notif._id });
    let subs;
    if (targetAll !== false) {
      subs = await PushSubscription.find();
    } else if (targetUser) {
      subs = await PushSubscription.find({ user: targetUser });
    } else {
      subs = [];
    }

    const sends = subs.map(s =>
      webpush.sendNotification(s.subscription, payload).catch(async err => {
        // Remove stale subscriptions (410 Gone)
        if (err.statusCode === 410) await PushSubscription.findByIdAndDelete(s._id);
      })
    );
    Promise.all(sends); // fire and forget

    res.json({ success: true, notification: notif, pushed: subs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: list all notifications ───────────────────────
router.get('/admin', auth, async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: delete notification ──────────────────────────
router.delete('/admin/:id', auth, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User: get their notifications ───────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [{ targetAll: true }, { targetUser: req.userId }],
    }).sort({ createdAt: -1 }).limit(50);

    const withRead = notifications.map(n => ({
      ...n.toObject(),
      isRead: n.readBy.some(id => id.toString() === req.userId),
    }));

    res.json({ success: true, notifications: withRead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User: mark as read ───────────────────────────────────
router.put('/:id/read', auth, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.userId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
