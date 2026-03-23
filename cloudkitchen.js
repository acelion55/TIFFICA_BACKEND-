const mongoose = require('mongoose');

const cloudKitchenSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
        validate: {
          validator: (v) => Array.isArray(v) && v.length === 2,
          message: 'coordinates must be [lng, lat]',
        },
      },
    },
  },
  {
    timestamps: true,
    collection: 'cloudkitchen', // reuse same collection as dashboard
  }
);

cloudKitchenSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('CloudKitchen', cloudKitchenSchema);

