const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  maxDiscount: {
    type: Number,
    default: null
  },
  usageLimit: {
    type: Number,
    default: null // null means unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  userSpecific: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null means available for all users
  },
  availableForAreas: {
    type: [String],
    default: [] // empty array means available for all areas
  },
  couponImage: {
    type: String,
    default: null // URL of coupon promotional image
  },
  showAsPopup: {
    type: Boolean,
    default: true // Show as popup to users
  },
  popupShownTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  performanceBased: {
    type: Boolean,
    default: false
  },
  performanceCriteria: {
    minOrders: Number,
    minSpent: Number,
    reason: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

couponSchema.index({ code: 1 });
couponSchema.index({ validUntil: 1 });
couponSchema.index({ userSpecific: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
