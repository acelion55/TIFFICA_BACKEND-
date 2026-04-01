const express = require('express');
const router = express.Router();
const User = require('./user');
const Order = require('./order');
const auth = require('./authmiddle');

// Middleware to check kitchen owner role
const kitchenOwnerAuth = async (req, res, next) => {
  if (req.user.role !== 'kitchen-owner') {
    return res.status(403).json({ error: 'Access denied. Kitchen owner only.' });
  }
  next();
};

// Get all orders for kitchen owner
router.get('/orders', auth, kitchenOwnerAuth, async (req, res) => {
  try {
    const { status, date } = req.query;
    
    console.log('🔍 Kitchen Owner:', req.user.name, 'Assigned Kitchen:', req.user.assignedKitchen);
    
    // Check if kitchen owner has assigned kitchen
    if (!req.user.assignedKitchen) {
      console.log('⚠️ No assigned kitchen for this kitchen owner');
      return res.json({ success: true, orders: [] });
    }

    // Get all menu items from assigned kitchen OR items with no kitchen assigned
    const MenuItem = require('./menuitems');
    const kitchenMenuItems = await MenuItem.find({
      $or: [
        { cloudKitchen: req.user.assignedKitchen },
        { cloudKitchen: null },
        { cloudKitchen: { $exists: false } }
      ]
    }).select('_id name cloudKitchen');
    
    console.log('📋 Found menu items:', kitchenMenuItems.length);
    kitchenMenuItems.forEach(item => {
      console.log('  -', item.name, '| Kitchen:', item.cloudKitchen);
    });
    
    const menuItemIds = kitchenMenuItems.map(item => item._id);

    // Filter orders that contain items from this kitchen
    let filter = {
      'items.menuItem': { $in: menuItemIds }
    };
    
    if (status) filter.status = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.createdAt = { $gte: startDate, $lt: endDate };
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email phone')
      .populate('items.menuItem', 'name price category image cloudKitchen')
      .sort({ createdAt: -1 });

    console.log('📦 Found orders:', orders.length);

    res.json({ success: true, orders });
  } catch (error) {
    console.error('❌ Kitchen owner orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Update order status
router.patch('/orders/:id/status', auth, kitchenOwnerAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    ).populate('user', 'name email phone').populate('items.menuItem', 'name price');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, message: 'Order status updated', order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Get kitchen owner dashboard stats
router.get('/dashboard', auth, kitchenOwnerAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if kitchen owner has assigned kitchen
    if (!req.user.assignedKitchen) {
      return res.json({
        success: true,
        stats: {
          totalOrders: 0,
          todayOrders: 0,
          pendingOrders: 0,
          totalRevenue: 0
        },
        user: req.user
      });
    }

    // Get all menu items from assigned kitchen OR items with no kitchen assigned
    const MenuItem = require('./menuitems');
    const kitchenMenuItems = await MenuItem.find({
      $or: [
        { cloudKitchen: req.user.assignedKitchen },
        { cloudKitchen: null },
        { cloudKitchen: { $exists: false } }
      ]
    }).select('_id');
    const menuItemIds = kitchenMenuItems.map(item => item._id);

    const filter = { 'items.menuItem': { $in: menuItemIds } };

    const [totalOrders, todayOrders, pendingOrders, totalRevenue] = await Promise.all([
      Order.countDocuments(filter),
      Order.countDocuments({ ...filter, createdAt: { $gte: today, $lt: tomorrow } }),
      Order.countDocuments({ ...filter, status: { $in: ['pending', 'confirmed', 'preparing'] } }),
      Order.aggregate([
        { $match: { ...filter, status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        todayOrders,
        pendingOrders,
        totalRevenue: totalRevenue[0]?.total || 0
      },
      user: req.user
    });
  } catch (error) {
    console.error('Kitchen owner dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
