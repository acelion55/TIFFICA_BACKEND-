const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscription: { type: Object, required: true }, // { endpoint, keys: { p256dh, auth } }
  createdAt:    { type: Date, default: Date.now },
});

pushSubscriptionSchema.index({ user: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
