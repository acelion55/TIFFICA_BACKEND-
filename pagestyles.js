const mongoose = require('mongoose');

const pageStyleSchema = new mongoose.Schema({
  pageNumber: {
    type: Number,
    required: true,
    enum: [1, 2, 3, 4],
    unique: true
  },
  pageName: {
    type: String,
    required: true,
    enum: ['Page 1', 'Page 2', 'Page 3', 'Page 4']
  },
  tagline: {
    type: String,
    required: true,
    default: 'Welcome'
  },
  subTagline: {
    type: String,
    required: true,
    default: 'Discover amazing meals'
  },
  videoLinks: [{
    type: String,
    required: true
  }],
  substituteVideoLinks: [{
    type: String,
    required: false
  }],
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
  backgroundColor: {
    type: String,
    default: '#FFFFFF'
  },
  textColor: {
    type: String,
    default: '#000000'
  },
  accentColor: {
    type: String,
    default: '#FF6B35'
  },
  bannerImage: {
    type: String,
    required: false,
    default: ''
  },
  bannerTitle: {
    type: String,
    required: false,
    default: ''
  },
  bannerDescription: {
    type: String,
    required: false,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
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

module.exports = mongoose.model('PageStyle', pageStyleSchema);
