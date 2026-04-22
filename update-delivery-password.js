require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./user');

async function updatePassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const phone = '4444444444';
    const newPassword = 'delivery123';

    const user = await User.findOne({ phone });
    
    if (!user) {
      console.log('❌ User not found with phone:', phone);
      process.exit(1);
    }

    console.log('✅ User found:', user.name);
    console.log('   Role:', user.role);

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    console.log('✅ Password updated successfully!');
    console.log('   Phone:', phone);
    console.log('   New Password:', newPassword);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

updatePassword();
