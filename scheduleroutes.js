const express = require('express');
const router = express.Router();
const auth = require('./authmiddle');
const User = require('./user');
const UserSchedule = require('./userschedule');
const Order = require('./order');
const MenuItem = require('./menuitems');
const CloudKitchen = require('./cloudkitchen');
const nodemailer = require('nodemailer');

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send meal lock notification email
async function sendMealLockNotification(schedule, user, meal, menuItem) {
  try {
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#f97316;margin:0 0 16px">🔒 Meal Locked</h2>
        <p style="color:#374151;margin:0 0 16px"><strong>Customer:</strong> ${user.name} (${user.phone})</p>
        <p style="color:#374151;margin:0 0 16px"><strong>Date:</strong> ${schedule.date}</p>
        <p style="color:#374151;margin:0 0 16px"><strong>Meal Type:</strong> ${meal.mealType}</p>
        <p style="color:#374151;margin:0 0 16px"><strong>Delivery Time:</strong> ${meal.deliveryTime}</p>
        <h3 style="color:#111827;margin:24px 0 12px">Item:</h3>
        <p style="color:#374151;margin:0 0 8px"><strong>${menuItem.name}</strong></p>
        <p style="color:#111827;font-size:18px;font-weight:bold;margin:16px 0">Price: ₹${meal.mealPrice}</p>
        ${meal.deliveryAddress?.fullAddress ? `<p style="color:#374151;margin:16px 0"><strong>Delivery Address:</strong> ${meal.deliveryAddress.fullAddress}</p>` : ''}
      </div>`;

    await transporter.sendMail({
      from: `"Tiffica Meals" <${process.env.EMAIL_USER}>`,
      to: 'harshvardhan53394@gmail.com, gehlotutkarsh88@gmail.com',
      subject: `Meal Locked - ${meal.mealType} on ${schedule.date}`,
      html,
    });
    console.log('✅ Meal lock notification email sent');
  } catch (err) {
    console.error('❌ Failed to send meal lock notification email:', err.message);
  }
}

// GET /api/schedule/menu/:mealType  — get menu items by meal type and user location
router.get('/menu/:mealType', auth, async (req, res) => {
  try {
    const { mealType } = req.params;
    const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const capitalizedMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
    
    if (!validMealTypes.includes(capitalizedMealType)) {
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    const user = await User.findById(req.userId);
    
    // If user has location, filter by nearby kitchens
    if (user?.currentLocation?.latitude && user?.currentLocation?.longitude) {
      const { latitude, longitude } = user.currentLocation;
      const maxDistance = 5000; // 5km

      const nearbyKitchens = await CloudKitchen.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: maxDistance
          }
        }
      });

      const kitchenIds = nearbyKitchens.map(k => k._id);

      const items = await MenuItem.find({
        mealType: capitalizedMealType,
        isAvailable: true,
        $or: [
          { cloudKitchen: { $in: kitchenIds } },
          { cloudKitchen: null },
          { cloudKitchen: { $exists: false } }
        ]
      }).populate('cloudKitchen', 'name location').sort({ createdAt: -1 });

      return res.json({
        success: true,
        mealType: capitalizedMealType,
        userLocation: {
          latitude,
          longitude,
          locationName: user.currentLocation.locationName
        },
        nearbyKitchensCount: nearbyKitchens.length,
        items
      });
    }

    // No location - return all items
    const items = await MenuItem.find({
      mealType: capitalizedMealType,
      isAvailable: true
    }).populate('cloudKitchen', 'name location').sort({ createdAt: -1 });

    res.json({
      success: true,
      mealType: capitalizedMealType,
      items
    });
  } catch (err) {
    
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule?date=yyyy-MM-dd  — get user's schedule for a date
router.get('/', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });

    const schedule = await UserSchedule.findOne({ user: req.userId, date })
      .populate('meals.menuItem', 'name price image mealType category description');

    res.json({ success: true, schedule: schedule || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/check-lock?date=yyyy-MM-dd&mealType=Breakfast  — check if meal is within 3 hours
router.get('/check-lock', auth, async (req, res) => {
  try {
    const { date, mealType } = req.query;
    if (!date || !mealType) return res.status(400).json({ error: 'date and mealType required' });

    const schedule = await UserSchedule.findOne({ user: req.userId, date });
    if (!schedule) {
      return res.json({ success: true, withinThreeHours: false, canEdit: true });
    }

    const meal = schedule.meals.find(m => m.mealType === mealType);
    if (!meal) {
      return res.json({ success: true, withinThreeHours: false, canEdit: true });
    }

    const deliveryTimeStr = meal.deliveryTime || (mealType === 'Breakfast' ? '08:00' : mealType === 'Lunch' ? '13:00' : '19:30');
    const [hours, minutes] = deliveryTimeStr.split(':').map(Number);
    const deliveryDateTime = new Date(date);
    deliveryDateTime.setHours(hours, minutes, 0, 0);
    
    const hoursUntilDelivery = (deliveryDateTime.getTime() - Date.now()) / 3600000;
    
    if (hoursUntilDelivery < 0) {
      return res.json({ success: true, withinThreeHours: false, canEdit: false, message: 'Delivery time has passed' });
    }
    
    const withinThreeHours = hoursUntilDelivery <= 3;
    const oldPrice = meal.mealPrice || 0;
    const refundPercentage = withinThreeHours ? 60 : 100;
    
    res.json({ 
      success: true, 
      withinThreeHours,
      canEdit: true,
      hoursUntilDelivery: hoursUntilDelivery.toFixed(1),
      oldPrice,
      refundPercentage,
      refundAmount: Math.floor(oldPrice * refundPercentage / 100)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/month?month=yyyy-MM  — get all scheduled dates in a month
router.get('/month', auth, async (req, res) => {
  try {
    const { month } = req.query; // e.g. '2025-07'
    if (!month) return res.status(400).json({ error: 'month required' });

    const schedules = await UserSchedule.find({
      user: req.userId,
      date: { $regex: `^${month}` }
    }).select('date meals');

    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/history  — get past scheduled meals for reorder page
router.get('/history', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log('📅 Fetching schedule history for user:', req.userId);
    console.log('📅 Today date:', todayStr);

    // Fetch all schedules with meals (for testing, include future dates too)
    const schedules = await UserSchedule.find({
      user: req.userId,
      'meals.0': { $exists: true }
    })
    .populate('meals.menuItem', 'name price image mealType category description')
    .sort({ date: -1 })
    .limit(50);

    console.log('📅 Found schedules:', schedules.length);
    if (schedules.length > 0) {
      console.log('📅 Sample schedule dates:', schedules.map(s => s.date).slice(0, 5));
      console.log('📅 First schedule meals count:', schedules[0].meals.length);
    } else {
      console.log('📅 No schedules found. Checking all schedules for this user...');
      const allUserSchedules = await UserSchedule.find({ user: req.userId });
      console.log('📅 Total schedules for user:', allUserSchedules.length);
      if (allUserSchedules.length > 0) {
        console.log('📅 All schedule dates:', allUserSchedules.map(s => ({ date: s.date, mealsCount: s.meals.length })));
      }
    }

    res.json({ success: true, schedules });
  } catch (err) {
    console.error('❌ Schedule history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedule/save  — save or update a meal slot
// Body: { date, mealType, menuItemId, deliveryAddress, mealPrice }
router.post('/save', auth, async (req, res) => {
  try {
    const { date, mealType, menuItemId, deliveryAddress, deliveryTime, mealPrice, deductAmount } = req.body;
    console.log('🔍 SAVE REQUEST:', { date, mealType, menuItemId, mealPrice, deductAmount, userId: req.userId });
    
    if (!date || !mealType || !menuItemId) {
      return res.status(400).json({ error: 'date, mealType, menuItemId required' });
    }

    // Check past date — only allow today or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduleDate = new Date(date);
    scheduleDate.setHours(0, 0, 0, 0);

    // Past date: only allow if user has a locked order on that date (view only)
    if (scheduleDate < today) {
      // Check if there's an existing locked schedule
      const existing = await UserSchedule.findOne({ user: req.userId, date });
      if (!existing) {
        return res.status(400).json({ error: 'Cannot schedule meals for past dates' });
      }
      // Past date with existing schedule — check 3hr lock
      const meal = existing.meals.find(m => m.mealType === mealType);
      if (meal?.lockedAt) {
        const hoursSinceLock = (Date.now() - new Date(meal.lockedAt).getTime()) / 3600000;
        if (hoursSinceLock > 3) {
          return res.status(400).json({ error: 'Cannot change meal — 3 hour edit window has passed' });
        }
      }
    }

    // Find or create schedule doc for this date
    let schedule = await UserSchedule.findOne({ user: req.userId, date });
    console.log('🔍 Existing schedule:', schedule ? 'Found' : 'Not found');

    if (!schedule) {
      schedule = new UserSchedule({ user: req.userId, date, meals: [] });
      console.log('🔍 Created new schedule');
    }

    // Check 3hr lock for existing meal on this slot
    const existingMeal = schedule.meals.find(m => m.mealType === mealType);
    const isNewMeal = !existingMeal;
    console.log('🔍 Is new meal:', isNewMeal, 'Existing meal:', existingMeal ? 'Yes' : 'No');

    // Check if meal is within 3 hours of delivery time (for warning, but still allow)
    let withinThreeHours = false;
    if (existingMeal?.lockedAt) {
      const deliveryTimeStr = existingMeal.deliveryTime || (mealType === 'Breakfast' ? '08:00' : mealType === 'Lunch' ? '13:00' : '19:30');
      const [hours, minutes] = deliveryTimeStr.split(':').map(Number);
      const deliveryDateTime = new Date(date);
      deliveryDateTime.setHours(hours, minutes, 0, 0);
      
      const hoursUntilDelivery = (deliveryDateTime.getTime() - Date.now()) / 3600000;
      
      // If delivery time has passed, cannot edit
      if (hoursUntilDelivery < 0) {
        return res.status(400).json({ error: 'Cannot change meal — delivery time has passed' });
      }
      
      // Check if within 3 hours (for refund calculation)
      if (hoursUntilDelivery <= 3 && hoursUntilDelivery >= 0) {
        withinThreeHours = true;
      }
    }

    // If mealPrice not provided, load from menuItem
    let effectiveMealPrice = mealPrice;
    if (!effectiveMealPrice && menuItemId) {
      const menuItemDoc = await MenuItem.findById(menuItemId).select('price').lean();
      if (menuItemDoc) effectiveMealPrice = menuItemDoc.price || 0;
      console.log('🔍 Loaded price from MenuItem:', effectiveMealPrice);
    }
    console.log('🔍 Effective meal price:', effectiveMealPrice);

    // Handle wallet deduction/refund when changing meals
    if (!isNewMeal && existingMeal) {
      // User is changing an existing meal
      const oldMealPrice = existingMeal.mealPrice || 0;
      const newMealPrice = effectiveMealPrice || 0;
      
      if (withinThreeHours) {
        // Within 3 hours: refund 60% of old meal, deduct 100% of new meal
        const refundAmount = Math.floor(oldMealPrice * 0.6);
        const netDeduction = newMealPrice - refundAmount;
        
        const user = await User.findById(req.userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        if (netDeduction > 0 && user.walletBalance < netDeduction) {
          return res.status(400).json({ 
            error: 'Insufficient wallet balance',
            required: netDeduction,
            available: user.walletBalance
          });
        }
        
        user.walletBalance -= netDeduction;
        await user.save();
      } else {
        // More than 3 hours: full refund of old meal, deduct new meal
        const netDeduction = newMealPrice - oldMealPrice;
        
        const user = await User.findById(req.userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        if (netDeduction > 0 && user.walletBalance < netDeduction) {
          return res.status(400).json({ 
            error: 'Insufficient wallet balance',
            required: netDeduction,
            available: user.walletBalance
          });
        }
        
        user.walletBalance -= netDeduction;
        await user.save();
      }
    } else if (isNewMeal) {
      // New meal: deduct full amount
      const amountToDeduct = deductAmount !== undefined ? deductAmount : effectiveMealPrice;
      console.log('🔍 New meal - Amount to deduct:', amountToDeduct);
      
      if (amountToDeduct > 0) {
        const user = await User.findById(req.userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        console.log('🔍 User wallet balance before:', user.walletBalance);
        
        // Check wallet balance
        if (user.walletBalance < amountToDeduct) {
          return res.status(400).json({ 
            error: 'Insufficient wallet balance',
            required: amountToDeduct,
            available: user.walletBalance
          });
        }

        // Deduct from wallet
        user.walletBalance -= amountToDeduct;
        await user.save();
        console.log('🔍 User wallet balance after:', user.walletBalance);
      }
    }

    // Upsert the meal slot
    const mealData = {
      mealType,
      menuItem: menuItemId,
      deliveryTime: deliveryTime || (mealType === 'Breakfast' ? '08:00' : mealType === 'Lunch' ? '13:00' : '19:30'),
      deliveryAddress: deliveryAddress || {},
      savedAt: new Date(),
      lockedAt: existingMeal?.lockedAt || new Date(), // set lockedAt only on first save
      mealPrice: effectiveMealPrice || 0, // store price for refund calculation
    };
    console.log('🔍 Meal data to save:', mealData);

    if (existingMeal) {
      Object.assign(existingMeal, mealData);
      console.log('🔍 Updated existing meal');
    } else {
      schedule.meals.push(mealData);
      console.log('🔍 Added new meal to schedule');
    }

    console.log('🔍 Schedule before save:', JSON.stringify(schedule, null, 2));
    await schedule.save();
    console.log('✅ Schedule saved successfully');
    await schedule.populate('meals.menuItem', 'name price image mealType category description');

    // Send email notification for new meal lock
    if (isNewMeal) {
      const menuItem = await MenuItem.findById(menuItemId);
      if (menuItem) {
        sendMealLockNotification(schedule, await User.findById(req.userId), mealData, menuItem).catch(err => 
          console.error('Email notification failed:', err)
        );
      }
    }

    // Get updated user to return wallet balance
    const user = await User.findById(req.userId);
    const walletBalance = user?.walletBalance || 0;

    res.json({ 
      success: true, 
      schedule,
      walletBalance,
      message: isNewMeal ? `✅ Menu locked! ₹${effectiveMealPrice} deducted from wallet` : 'Meal updated'
    });
  } catch (err) {
    console.error('❌ Error saving schedule:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedule/remove  — remove a meal slot
// Body: { date, mealType }
router.delete('/remove', auth, async (req, res) => {
  try {
    const { date, mealType } = req.body;
    if (!date || !mealType) return res.status(400).json({ error: 'date and mealType required' });

    const schedule = await UserSchedule.findOne({ user: req.userId, date });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const meal = schedule.meals.find(m => m.mealType === mealType);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    // Get price from schedule meal field or from referenced MenuItem if missing
    let mealPrice = meal.mealPrice || 0;
    if (!mealPrice && meal.menuItem) {
      const menuItem = await require('./menuitems').findById(meal.menuItem).select('price').lean();
      if (menuItem) mealPrice = menuItem.price || 0;
    }

    const deliveryTime = meal.deliveryTime || (mealType === 'Breakfast' ? '08:00' : mealType === 'Lunch' ? '13:00' : '19:30');

    const [hours, minutes] = deliveryTime.split(':').map(Number);
    const deliveryDate = new Date(date);
    deliveryDate.setHours(hours, minutes, 0, 0);

    const msToDelivery = deliveryDate.getTime() - Date.now();
    const hoursToDelivery = msToDelivery / 3600000;

    let refundAmount = 0;
    if (hoursToDelivery > 3) {
      refundAmount = mealPrice; // full refund
    } else if (hoursToDelivery > 0) {
      refundAmount = Math.floor(mealPrice * 0.6); // 60% refund
    } else {
      refundAmount = 0; // no refund after delivery time
    }

    

    if (refundAmount > 0) {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.walletBalance += refundAmount;
      await user.save();
    }

    // Remove the meal
    schedule.meals = schedule.meals.filter(m => m.mealType !== mealType);
    await schedule.save();

    // Get updated user wallet balance
    const user = await User.findById(req.userId);
    const walletBalance = user?.walletBalance || 0;

    res.json({ 
      success: true, 
      message: refundAmount ? `✅ Meal removed and ${refundAmount} refunded to wallet` : 'Meal removed',
      walletBalance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/schedule/update-time  — update delivery time for a meal
// Body: { date, mealType, deliveryTime }
router.patch('/update-time', auth, async (req, res) => {
  try {
    const { date, mealType, deliveryTime } = req.body;
    if (!date || !mealType || !deliveryTime) {
      return res.status(400).json({ error: 'date, mealType, and deliveryTime required' });
    }

    const schedule = await UserSchedule.findOne({ user: req.userId, date });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const meal = schedule.meals.find(m => m.mealType === mealType);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    // Check 3hr lock window based on delivery time
    if (meal?.lockedAt) {
      const deliveryTimeStr = meal.deliveryTime || (mealType === 'Breakfast' ? '08:00' : mealType === 'Lunch' ? '13:00' : '19:30');
      const [hours, minutes] = deliveryTimeStr.split(':').map(Number);
      const deliveryDateTime = new Date(date);
      deliveryDateTime.setHours(hours, minutes, 0, 0);
      
      const hoursUntilDelivery = (deliveryDateTime.getTime() - Date.now()) / 3600000;
      
      // Only lock if within 3 hours of delivery time
      if (hoursUntilDelivery <= 3 && hoursUntilDelivery >= 0) {
        return res.status(400).json({ error: 'Cannot update meal — within 3 hours of delivery time' });
      }
      
      // If delivery time has passed, cannot edit
      if (hoursUntilDelivery < 0) {
        return res.status(400).json({ error: 'Cannot update meal — delivery time has passed' });
      }
    }

    // Update the delivery time
    meal.deliveryTime = deliveryTime;
    meal.updatedAt = new Date();
    
    await schedule.save();

    res.json({ 
      success: true, 
      message: `Delivery time updated to ${deliveryTime}`,
      schedule
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
