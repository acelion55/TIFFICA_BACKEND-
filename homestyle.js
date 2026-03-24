const mongoose = require('mongoose');

const homestyleSchema = new mongoose.Schema({
  bestseller: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    discount: { type: String, required: true },
    image: { type: String, default: '' }
  }],
  categories: [{
    id: { type: String, required: true },
    name: { type: String, required: true }
  }],
  videoLinks: [{ type: String }],
  substituteVideoLinks: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Homestyle', homestyleSchema);
