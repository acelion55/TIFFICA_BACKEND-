const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  profilePhoto: { type: String, default: '' },
  password: { type: String },
  
  // Vehicle details
  vehicleType: { type: String, enum: ['bike', 'cycle', 'scooter', 'car'], default: 'bike' },
  vehicleNumber: { type: String },
  licenseNumber: { type: String },
  licensePhoto: { type: String },
  
  // Status
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  
  // Location
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    address: String,
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Earnings
  walletBalance: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  todayEarnings: { type: Number, default: 0 },
  
  // Stats
  totalDeliveries: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0 },
  totalRatings: { type: Number, default: 0 },
  
  // Settings
  language: { type: String, default: 'en' },
  darkMode: { type: Boolean, default: false },
  notificationsEnabled: { type: Boolean, default: true },
  
  // FCM token for push notifications
  fcmToken: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for geospatial queries
deliveryPartnerSchema.index({ 'currentLocation': '2dsphere' });
deliveryPartnerSchema.index({ phone: 1 });
deliveryPartnerSchema.index({ isOnline: 1, isAvailable: 1 });

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
