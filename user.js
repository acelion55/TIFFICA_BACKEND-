const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: false,
    minlength: 6,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null for OTP-only users
        return v.length >= 6;
      },
      message: 'Password must be at least 6 characters'
    }
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  resetPasswordOtp: {
    type: String,
    default: null
  },
  resetPasswordOtpExpiry: {
    type: Date,
    default: null
  },
  resetPasswordAttempts: {
    type: Number,
    default: 0
  },
  // Current location
  currentLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    locationName: { type: String, default: null },
    updatedAt: { type: Date, default: null }
  },
  addresses: [{
    houseNo: { type: String, required: true },
    landmark: { type: String, default: '' },
    area: { type: String, required: true },
    fullAddress: { type: String, default: '' },
    addressType: {
      type: String,
      enum: ['Home', 'Work', 'Hotel', 'Other'],
      default: 'Home'
    },
    location: {
      type: { 
        type: String, 
        enum: ['Point'], // Sirf 'Point' allowed hai
        default: 'Point', // Ye hona zaroori hai
        required: true 
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: function(v) {
            return v.length === 2; // Pakka karein ki do hi values hon
          },
          message: 'Coordinates must have longitude and latitude'
        }
      }
    },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  // Old address field (backward compatibility)
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    landmark: String
  },
 
  isPremium: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'kitchen-owner', 'delivery'],
    default: 'user'
  },
  assignedKitchen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CloudKitchen',
    default: null
  },
  premiumExpiryDate: {
    type: Date
  },
  walletBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add geospatial index for current location
userSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });

// ✅ FIXED: Hash password before saving (Mongoose 6+ compatible)
userSchema.pre('save', async function () {
  // Only hash if password is modified and exists
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);