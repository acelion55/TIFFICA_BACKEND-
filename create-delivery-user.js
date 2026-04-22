require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./user');

async function createDeliveryUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if delivery user exists
    const existing = await User.findOne({ phone: '9999999999' });
    if (existing) {
      console.log('⚠️  Delivery user already exists');
      console.log('Phone: 9999999999');
      console.log('Password: delivery123');
      process.exit(0);
    }

    // Create delivery user
    const deliveryUser = new User({
      name: 'Test Delivery Partner',
      phone: '9999999999',
      email: 'delivery@test.com',
      password: 'delivery123',
      role: 'delivery'
    });

    await deliveryUser.save();
    console.log('✅ Delivery user created successfully!');
    console.log('Phone: 9999999999');
    console.log('Password: delivery123');
    console.log('Role: delivery');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createDeliveryUser();
