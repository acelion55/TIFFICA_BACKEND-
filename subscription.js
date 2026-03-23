const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  mealsPerDay: {
    type: Number,
    required: true
  },
  mealTimes: [{
    type: String,
    enum: ['breakfast', 'lunch', 'dinner']
  }],
  pricePerDay: {
    type: Number,
    required: true
  },
  savings: {
    type: String,
    default: '0%'
  },
  popular: {
    type: Boolean,
    default: false
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

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  // Snapshot of user details at time of subscription
  userSnapshot: {
    name: String,
    email: String,
    phone: String,
    address: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = {
  SubscriptionPlan: mongoose.model('SubscriptionPlan', subscriptionPlanSchema),
  Subscription: mongoose.model('Subscription', subscriptionSchema)
};
