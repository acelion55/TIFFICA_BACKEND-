const express = require('express');
const router = express.Router();
const { adminAuth } = require('./authmiddle');
const auth = require('./authmiddle');
const Coupon = require('./coupon');
const User = require('./user');
const Order = require('./order');
const Notification = require('./notification');

// Get all coupons
router.get('/', adminAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find()
      .populate('userSpecific', 'name email phone')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// Get user performance data
router.get('/user-performance', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = endDateObj;
      }
    }
    
    const users = await User.find().select('name email phone walletBalance createdAt');
    
    const userPerformance = await Promise.all(users.map(async (user) => {
      const orderFilter = { user: user._id, status: { $ne: 'cancelled' }, ...dateFilter };
      const orders = await Order.find(orderFilter);
      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        walletBalance: user.walletBalance,
        totalOrders,
        totalSpent,
        avgOrderValue,
        memberSince: user.createdAt
      };
    }));

    // Sort by total spent
    userPerformance.sort((a, b) => b.totalSpent - a.totalSpent);

    res.json({ success: true, users: userPerformance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user performance' });
  }
});

// Create coupon
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      code, description, discountType, discountValue,
      minOrderAmount, maxDiscount, usageLimit, userSpecific,
      validFrom, validUntil, performanceBased, performanceCriteria,
      availableForAreas, couponImage, showAsPopup
    } = req.body;

    if (!code || !description || !discountType || !discountValue || !validUntil) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscount: maxDiscount || null,
      usageLimit: usageLimit || null,
      userSpecific: userSpecific || null,
      availableForAreas: availableForAreas || [],
      couponImage: couponImage || null,
      showAsPopup: showAsPopup !== false,
      validFrom: validFrom || Date.now(),
      validUntil,
      performanceBased: performanceBased || false,
      performanceCriteria: performanceCriteria || {},
      createdBy: req.userId
    });

    await coupon.save();
    await coupon.populate('userSpecific', 'name email phone');
    
    // Create notification for coupon
    if (userSpecific) {
      await Notification.create({
        title: '🎉 New Coupon for You!',
        message: `You've received a ${discountType === 'percentage' ? discountValue + '%' : '₹' + discountValue} discount coupon. Use code: ${code.toUpperCase()}`,
        type: 'coupon',
        targetAll: false,
        targetUser: userSpecific,
        couponId: coupon._id,
      });
    } else {
      await Notification.create({
        title: '🎉 New Coupon Available!',
        message: `Get ${discountType === 'percentage' ? discountValue + '%' : '₹' + discountValue} off on your next order. Use code: ${code.toUpperCase()}`,
        type: 'coupon',
        targetAll: true,
        couponId: coupon._id,
      });
    }
    
    // If showAsPopup is true, reset popupShownTo so it shows to all eligible users
    if (showAsPopup) {
      coupon.popupShownTo = [];
      await coupon.save();
    }
    
    res.json({ success: true, message: 'Coupon created successfully', coupon });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

// Update coupon
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const {
      description, discountType, discountValue,
      minOrderAmount, maxDiscount, usageLimit,
      validFrom, validUntil, isActive
    } = req.body;

    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        description,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscount,
        usageLimit,
        validFrom,
        validUntil,
        isActive
      },
      { new: true }
    ).populate('userSpecific', 'name email phone');

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    res.json({ success: true, message: 'Coupon updated successfully', coupon });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

// Delete coupon
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

// Toggle coupon status
router.patch('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    
    res.json({ success: true, message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`, coupon });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle coupon status' });
  }
});

// Get active popup coupons for user (based on location)
router.get('/user/popup', auth, async (req, res) => {
  try {
    const { area } = req.query;
    const userId = req.userId;

    const now = new Date();
    const query = {
      isActive: true,
      showAsPopup: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      popupShownTo: { $ne: userId }
    };

    // Filter by area if provided
    if (area) {
      query.$or = [
        { availableForAreas: { $size: 0 } }, // Available for all areas
        { availableForAreas: area }
      ];
    }

    // Also check for user-specific coupons
    const userQuery = { ...query };
    delete userQuery.popupShownTo;
    userQuery.$or = [
      { userSpecific: null }, // General coupons
      { userSpecific: userId } // User-specific coupons
    ];
    userQuery.popupShownTo = { $ne: userId };

    const coupons = await Coupon.find(userQuery)
      .select('code description discountType discountValue minOrderAmount couponImage availableForAreas userSpecific')
      .limit(1)
      .sort({ createdAt: -1 });

    if (coupons.length > 0) {
      // Mark as shown to this user
      await Coupon.findByIdAndUpdate(coupons[0]._id, {
        $addToSet: { popupShownTo: userId }
      });
    }

    res.json({ success: true, coupon: coupons[0] || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch popup coupon' });
  }
});

module.exports = router;
