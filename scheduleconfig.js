const mongoose = require('mongoose');

const scheduleConfigSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: 'Meal Schedule'
  },
  subtitle: {
    type: String,
    required: true,
    default: 'Plan your meals ahead'
  },
  mealTypes: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    emoji: {
      type: String,
      default: '🍽'
    }
  }],
  categories: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  }],
  itemCategories: [{
    type: String,
    required: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ScheduleConfig', scheduleConfigSchema);
