const mongoose = require('mongoose');

const subscriptionOrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  mealType: {
    type: String,
    enum: ['Breakfast', 'Lunch', 'Dinner'],
    required: true
  },
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  address: {
    houseNo: { type: String, required: true },
    landmark: { type: String, default: '' },
    area: { type: String, required: true },
    fullAddress: { type: String, default: '' },
    addressType: { type: String, default: 'Home' },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number]
    }
  },
  status: {
    type: String,
    enum: ['locked', 'unlocked', 'confirmed', 'cancelled'],
    default: 'locked'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

subscriptionOrderSchema.index({ user: 1, date: 1, mealType: 1 }, { unique: true });

module.exports = mongoose.model('SubscriptionOrder', subscriptionOrderSchema);
