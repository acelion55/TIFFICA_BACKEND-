require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./user');
const DeliveryPartner = require('./deliverypartner');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');
    
    // Check users with delivery role
    console.log('📋 Checking Users with role "delivery":');
    const deliveryUsers = await User.find({ role: 'delivery' });
    console.log(`Found ${deliveryUsers.length} users with delivery role\n`);
    
    if (deliveryUsers.length > 0) {
      deliveryUsers.forEach((user, i) => {
        console.log(`${i + 1}. User:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log('');
      });
    }
    
    // Check delivery partners
    console.log('📋 Checking DeliveryPartner collection:');
    const partners = await DeliveryPartner.find({});
    console.log(`Found ${partners.length} delivery partners\n`);
    
    if (partners.length > 0) {
      partners.forEach((partner, i) => {
        console.log(`${i + 1}. Partner:`);
        console.log(`   ID: ${partner._id}`);
        console.log(`   Name: ${partner.name}`);
        console.log(`   Phone: ${partner.phone}`);
        console.log(`   Email: ${partner.email || 'N/A'}`);
        console.log(`   Is Online: ${partner.isOnline}`);
        console.log(`   Is Blocked: ${partner.isBlocked}`);
        console.log('');
      });
    }
    
    // Check if there are any users that need syncing
    console.log('🔄 Checking for users that need syncing...');
    for (const user of deliveryUsers) {
      const existingPartner = await DeliveryPartner.findOne({ phone: user.phone });
      if (!existingPartner) {
        console.log(`⚠️  User ${user.name} (${user.phone}) needs to be synced to DeliveryPartner collection`);
      } else {
        console.log(`✅ User ${user.name} (${user.phone}) already synced`);
      }
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
