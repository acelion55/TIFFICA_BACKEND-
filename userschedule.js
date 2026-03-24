const mongoose = require('mongoose');

const userScheduleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 'yyyy-MM-dd'
  meals: [{
    mealType: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner'], required: true },
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    deliveryTime: { type: String, default: '00:00' },
    deliveryAddress: {
      houseNo: String,
      area: String,
      fullAddress: String,
      addressType: String,
    },
    savedAt: { type: Date, default: Date.now },
    lockedAt: { type: Date, default: null }, // set when saved — used for 3hr lock check
  }],
}, { timestamps: true });

// Compound unique index: one schedule doc per user per date
userScheduleSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('UserSchedule', userScheduleSchema);
