const mongoose = require('mongoose');

const homestyleSchema = new mongoose.Schema({
  tagline: {
    type: String,
    required: true,
    default: 'Good Morning'
  },
  subTagline: {
    type: String,
    required: true,
    default: "Rise And Shine! It's Breakfast Time"
  },
  bestseller: [{
    id: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    discount: {
      type: String,
      required: true
    },
    image: {
      type: String,
      required: false,
      default: ''
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
  videoLinks: [{
    type: String,
    required: true
  }],
  substituteVideoLinks: [{
    type: String,
    required: false
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

module.exports = mongoose.model('Homestyle', homestyleSchema);
