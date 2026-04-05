const mongoose = require('mongoose');
const MenuItem = require('./menuitems');
require('dotenv').config();

async function updatePrices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all items
    const items = await MenuItem.find({});
    console.log(`Found ${items.length} items`);
    
    let updated = 0;
    for (const item of items) {
      // If originalPrice is not set, set it
      if (!item.originalPrice) {
        // For items with discount, calculate originalPrice
        if (item.discount > 0) {
          item.originalPrice = Math.round(item.price / (1 - item.discount / 100));
        } else {
          // For testing, add 20% discount to some items
          item.originalPrice = Math.round(item.price * 1.25);
          item.discount = 20;
        }
        await item.save();
        updated++;
        console.log(`Updated: ${item.name} - Price: ₹${item.price}, Original: ₹${item.originalPrice}`);
      }
    }

    console.log(`\n✅ Updated ${updated} items with originalPrice`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updatePrices();
