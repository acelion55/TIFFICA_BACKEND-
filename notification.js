const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true },
  message:   { type: String, required: true, trim: true },
  type:      { type: String, enum: ['info', 'offer', 'order', 'alert', 'coupon'], default: 'info' },
  targetAll: { type: Boolean, default: true },
  targetUser:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  couponId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
  readBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);
