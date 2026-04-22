const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Locations
  pickupLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
    address: String,
    restaurantName: String,
    contactPhone: String
  },
  
  dropLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
    address: String,
    customerName: String,
    contactPhone: String,
    instructions: String
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'assigned', 'accepted', 'reached_restaurant', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Timestamps for each status
  timestamps: {
    assigned: Date,
    accepted: Date,
    reachedRestaurant: Date,
    pickedUp: Date,
    outForDelivery: Date,
    delivered: Date,
    cancelled: Date
  },
  
  // Distance & Earnings
  distance: { type: Number, default: 0 }, // in km
  estimatedEarning: { type: Number, default: 0 },
  actualEarning: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  
  // Delivery details
  estimatedTime: { type: Number, default: 30 }, // in minutes
  actualDeliveryTime: { type: Number },
  
  // OTP for verification
  deliveryOTP: { type: String },
  
  // Rating & Feedback
  rating: { type: Number, min: 1, max: 5 },
  feedback: { type: String },
  
  // Rejection tracking
  rejectedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  rejectionReason: String,
  
  // Payment
  paymentMethod: { type: String, enum: ['cash', 'online'], default: 'online' },
  isPaid: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
deliverySchema.index({ orderId: 1 });
deliverySchema.index({ deliveryPartner: 1, status: 1 });
deliverySchema.index({ status: 1, createdAt: -1 });
deliverySchema.index({ 'pickupLocation': '2dsphere' });

module.exports = mongoose.model('Delivery', deliverySchema);
