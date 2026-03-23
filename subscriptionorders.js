const express = require('express');
const router = express.Router();
const SubscriptionOrder = require('./subscriptionorder');
const MenuItem = require('./menuitems');
const User = require('./user');
const auth = require('./authmiddle');
const asyncHandler = require('./asynchandler');

// Get all subscription orders (for dashboard)
router.get('/', async (req, res) => {
  try {
    const subscriptionOrders = await SubscriptionOrder.find()
      .populate('user', 'name email phone')
      .populate('items.menuItem', 'name price category')
      .sort({ date: -1 });
    res.json({ success: true, subscriptionOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lock meal items for a specific date and meal type
router.post('/lock', auth, asyncHandler(async (req, res) => {
  try {
    console.log('\n\n=== 🔒 LOCK ENDPOINT CALLED ===');
    console.log('Request received at:', new Date().toISOString());
    
    const { date, mealType, items, addressId } = req.body;

    console.log('🔒 Lock Request:', { date, mealType, itemsCount: items?.length, addressId });

    // Validate inputs
    if (!date || !mealType || !items || items.length === 0) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Date, mealType, and items are required' });
    }

    if (!addressId) {
      console.log('❌ Missing addressId');
      return res.status(400).json({ error: 'Delivery address is required' });
    }

    if (!['Breakfast', 'Lunch', 'Dinner'].includes(mealType)) {
      console.log('❌ Invalid mealType:', mealType);
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    // Validate req.userId exists
    if (!req.userId) {
      console.log('❌ No userId in request');
      console.log('   req.user:', req.user);
      console.log('   req.userId:', req.userId);
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('✅ Basic validation passed');
    console.log('   UserId:', req.userId);

    // Get user info
    const user = await User.findById(req.userId);
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User found:', user.name);
    console.log('   Current wallet balance:', user.walletBalance);

    // Parse date correctly - convert to start of day
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0); // Set to midnight UTC
    
    console.log('📅 Parsed Date:', dateObj.toISOString());

    // Calculate total and validate items
    let totalAmount = 0;
    const orderItems = [];

    console.log('📋 Items to process:', JSON.stringify(items));

    for (const item of items) {
      console.log(`📦 Processing item: ${item.menuItemId} x${item.quantity}`);
      
      if (!item.menuItemId) {
        console.error('❌ menuItemId is missing from item:', item);
        return res.status(400).json({ error: 'Menu item ID is required for each item' });
      }

      const menuItem = await MenuItem.findById(item.menuItemId).lean();
      console.log(`   Found item: ${menuItem ? menuItem.name : 'NOT FOUND'}`);
      
      if (!menuItem) {
        console.error(`❌ Menu item not found in database with ID: ${item.menuItemId}`);
        const allItems = await MenuItem.find().select('_id name').limit(3).lean();
        console.error('Sample items in DB:', allItems);
        return res.status(400).json({ error: `Menu item not found: ${item.menuItemId}` });
      }
      
      if (!menuItem.isAvailable) {
        console.error(`❌ Menu item not available: ${menuItem.name}`);
        return res.status(400).json({ error: `Menu item ${menuItem.name} is not available` });
      }

      const itemTotal = menuItem.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        menuItem: menuItem._id,
        quantity: item.quantity,
        price: menuItem.price
      });

      console.log(`   ✅ Added to order: ${menuItem.name} x${item.quantity} = ₹${itemTotal}`);
    }

    console.log(`💰 Total Amount: ₹${totalAmount}`);

    // Fetch address from user's addresses array
    const selectedAddress = user.addresses.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      console.log('❌ Address not found in user accounts');
      return res.status(400).json({ error: 'Selected address not found' });
    }
    console.log('📍 Address found:', selectedAddress.area);

    // Check if wallet has sufficient balance
    if (user.walletBalance < totalAmount) {
      console.log('❌ Insufficient wallet balance');
      return res.status(400).json({ 
        error: 'Insufficient wallet balance',
        required: totalAmount,
        available: user.walletBalance
      });
    }

    // Check if already locked for this date and meal type
    let existingOrder = await SubscriptionOrder.findOne({
      user: req.userId,
      date: dateObj,
      mealType: mealType
    });

    if (existingOrder) {
      console.log('🔄 Updating existing lock:', existingOrder._id);
      
      // Calculate difference in amount for wallet adjustment
      const amountDifference = totalAmount - existingOrder.totalAmount;
      
      if (amountDifference > 0 && user.walletBalance < amountDifference) {
        console.log('❌ Insufficient wallet balance for update');
        return res.status(400).json({ 
          error: 'Insufficient wallet balance for this change',
          needed: amountDifference,
          available: user.walletBalance
        });
      }

      try {
        // Update wallet if amount changed
        if (amountDifference !== 0) {
          user.walletBalance -= amountDifference;
          await user.save();
          console.log(`💰 Wallet updated: -₹${amountDifference}, New balance: ₹${user.walletBalance}`);
        }

        // Update existing order
        existingOrder = await SubscriptionOrder.findByIdAndUpdate(
          existingOrder._id,
          {
            items: orderItems,
            totalAmount: totalAmount,
            address: selectedAddress,
            status: 'locked',
            updatedAt: new Date()
          },
          { new: true }
        ).populate('items.menuItem');

        console.log('✅ Updated order with items populated');
        return res.status(200).json({
          message: 'Meal items updated and locked successfully',
          subscriptionOrder: existingOrder,
          walletBalance: user.walletBalance
        });
      } catch (populateError) {
        console.error('❌ Error updating order:', populateError.message);
        throw populateError;
      }
    }

    // Deduct from wallet first
    user.walletBalance -= totalAmount;
    await user.save();
    console.log(`💰 Wallet deducted: -₹${totalAmount}, New balance: ₹${user.walletBalance}`);

    // Create new subscription order
    const subscriptionOrder = new SubscriptionOrder({
      user: req.userId,
      userName: user.name,
      date: dateObj,
      mealType: mealType,
      items: orderItems,
      totalAmount: totalAmount,
      address: selectedAddress,
      status: 'locked'
    });

    console.log('💾 Saving new subscription order...');
    try {
      await subscriptionOrder.save();
      console.log('💾 Order saved, now populating items...');
      await subscriptionOrder.populate('items.menuItem');
      console.log('✅ Items populated successfully');
    } catch (saveError) {
      console.error('❌ Error saving subscription order:', saveError.message);
      if (saveError.code === 11000) {
        console.error('🔑 Duplicate key error - unique index violation');
      }
      throw saveError;
    }

    console.log('✅ Meal locked successfully');

    res.status(201).json({
      message: 'Meal items locked successfully',
      subscriptionOrder,
      walletBalance: user.walletBalance
    });
  } catch (error) {
    console.error('\n❌ ERROR LOCKING MEAL:');
    console.error('Error Type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Name:', error.name);
    console.error('Stack:', error.stack);
    
    let statusCode = 500;
    let errorMessage = 'Server error locking meal items';

    if (error.code === 11000) {
      statusCode = 409;
      errorMessage = 'Meal already locked for this date and type';
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = `Validation error: ${error.message}`;
    } else if (error.name === 'CastError') {
      statusCode = 400;
      errorMessage = `Invalid format: ${error.message}`;
    } else if (error.message && error.message.includes('next')) {
      console.error('⚠️  Middleware error detected - check auth middleware');
      statusCode = 500;
      errorMessage = 'Middleware error - check server logs';
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message,
      code: error.code
    });
  }
}));

// Get locked meals for a user in a date range
router.get('/my-locks', auth, asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let filter = { user: req.userId };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      filter.date = {
        $gte: start,
        $lte: end
      };
    }

    const subscriptionOrders = await SubscriptionOrder.find(filter)
      .populate('items.menuItem')
      .sort('date mealType');

    res.json({ 
      subscriptionOrders,
      count: subscriptionOrders.length
    });
  } catch (error) {
    console.error('Error fetching locked meals:', error.message);
    res.status(500).json({ error: 'Server error fetching locked meals' });
  }
}));

// Get locked meal for specific date and mealType
router.get('/date/:date/mealtype/:mealType', auth, asyncHandler(async (req, res) => {
  try {
    const { date, mealType } = req.params;

    if (!['Breakfast', 'Lunch', 'Dinner'].includes(mealType)) {
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    // Parse date consistently - convert to start of day
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const subscriptionOrder = await SubscriptionOrder.findOne({
      user: req.userId,
      date: dateObj,
      mealType: mealType
    }).populate('items.menuItem');

    if (!subscriptionOrder) {
      return res.status(404).json({ error: 'No locked meal found for this date and mealType' });
    }

    res.json({ subscriptionOrder });
  } catch (error) {
    console.error('Error fetching locked meal:', error.message);
    res.status(500).json({ error: 'Server error fetching locked meal' });
  }
}));

// Unlock (delete) a locked meal
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  try {
    const subscriptionOrder = await SubscriptionOrder.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!subscriptionOrder) {
      return res.status(404).json({ error: 'Subscription order not found' });
    }

    console.log('🔓 Unlocking meal:', subscriptionOrder._id);
    console.log('   Amount to refund: ₹', subscriptionOrder.totalAmount);

    // Refund wallet
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.walletBalance += subscriptionOrder.totalAmount;
    await user.save();
    console.log(`💰 Wallet refunded: +₹${subscriptionOrder.totalAmount}, New balance: ₹${user.walletBalance}`);

    // Delete the order
    await SubscriptionOrder.deleteOne({ _id: req.params.id });

    res.json({ 
      message: 'Meal unlocked successfully',
      walletBalance: user.walletBalance,
      refundAmount: subscriptionOrder.totalAmount
    });
  } catch (error) {
    console.error('Error unlocking meal:', error);
    res.status(500).json({ error: 'Server error unlocking meal' });
  }
}));

// Confirm locked meals (convert to actual orders)
router.post('/confirm', auth, asyncHandler(async (req, res) => {
  try {
    const { dates } = req.body;

    if (!dates || dates.length === 0) {
      return res.status(400).json({ error: 'At least one date is required' });
    }

    // Parse all dates consistently - convert to start of day
    const parsedDates = dates.map(d => {
      const dateObj = new Date(d);
      dateObj.setHours(0, 0, 0, 0);
      return dateObj;
    });

    const subscriptionOrders = await SubscriptionOrder.find({
      user: req.userId,
      date: { $in: parsedDates },
      status: 'locked'
    }).populate('items.menuItem');

    // Update status to confirmed
    const updateResult = await SubscriptionOrder.updateMany(
      {
        user: req.userId,
        date: { $in: parsedDates },
        status: 'locked'
      },
      { status: 'confirmed' }
    );

    res.json({
      message: 'Meals confirmed successfully',
      confirmedCount: updateResult.modifiedCount,
      subscriptionOrders
    });
  } catch (error) {
    console.error('Error confirming meals:', error.message);
    res.status(500).json({ error: 'Server error confirming meals' });
  }
}));

module.exports = router;
