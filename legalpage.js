const mongoose = require('mongoose');

const legalPageSchema = new mongoose.Schema({
  pageType: {
    type: String,
    enum: ['terms', 'privacy'],
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('LegalPage', legalPageSchema);
