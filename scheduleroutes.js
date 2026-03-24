const express = require('express');
const router = express.Router();
const auth = require('./authmiddle');
const User = require('./user');
const UserSchedule = require('./userschedule');
const Order = require('./order');
const MenuItem = require('./menuitems');

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

// POST /api/schedule/save  — save or update a meal slot
// Body: { date, mealType, menuItemId, deliveryAddress, mealPrice }
router.post('/save', auth, async (req, res) => {
  try {
    const { date, mealType, menuItemId, deliveryAddress, deliveryTime, mealPrice, deductAmount } = req.body;
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

    if (!schedule) {
      schedule = new UserSchedule({ user: req.userId, date, meals: [] });
    }

    // Check 3hr lock for existing meal on this slot
    const existingMeal = schedule.meals.find(m => m.mealType === mealType);
    const isNewMeal = !existingMeal;

    if (existingMeal?.lockedAt) {
      const hoursSinceLock = (Date.now() - new Date(existingMeal.lockedAt).getTime()) / 3600000;
      if (hoursSinceLock > 3) {
        return res.status(400).json({ error: 'Cannot change meal — 3 hour edit window has passed' });
      }
    }

    // Deduct wallet only when needed (new lock)
    if (isNewMeal && deductAmount > 0) {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check wallet balance
      if (user.walletBalance < deductAmount) {
        return res.status(400).json({ 
          error: 'Insufficient wallet balance',
          required: deductAmount,
          available: user.walletBalance
        });
      }

      // Deduct from wallet
      user.walletBalance -= deductAmount;
      await user.save();
    }

    // If mealPrice not provided, load from menuItem
    let effectiveMealPrice = mealPrice;
    if (!effectiveMealPrice && menuItemId) {
      const menuItemDoc = await MenuItem.findById(menuItemId).select('price').lean();
      if (menuItemDoc) effectiveMealPrice = menuItemDoc.price || 0;
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

    if (existingMeal) {
      Object.assign(existingMeal, mealData);
    } else {
      schedule.meals.push(mealData);
    }

    await schedule.save();
    await schedule.populate('meals.menuItem', 'name price image mealType category description');

    // Get updated user to return wallet balance
    const user = await User.findById(req.userId);
    const walletBalance = user?.walletBalance || 0;

    res.json({ 
      success: true, 
      schedule,
      walletBalance,
      message: isNewMeal ? `✅ Menu locked! ₹${mealPrice} deducted from wallet` : 'Meal updated'
    });
  } catch (err) {
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

    console.log('SCHEDULE REMOVE:', { date, mealType, mealPrice, deliveryTime, hoursToDelivery, refundAmount });

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

    // Check 3hr lock window
    if (meal?.lockedAt) {
      const hoursSinceLock = (Date.now() - new Date(meal.lockedAt).getTime()) / 3600000;
      if (hoursSinceLock > 3) {
        return res.status(400).json({ error: 'Cannot update meal — 3 hour edit window has passed' });
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
