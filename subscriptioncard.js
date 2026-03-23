const mongoose = require('mongoose');

const subscriptionCardSchema = new mongoose.Schema(
  {
    cardId: {
      type: Number,
      required: true,
      unique: true
    },
    title: {
      type: String,
      required: true
    },
    price: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: 'star'
    },
    color: {
      type: String,
      required: true
    },
    growth: {
      type: String,
      default: '+0%'
    },
    savings: {
      type: String,
      default: 'Save 5%'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionCard', subscriptionCardSchema);
