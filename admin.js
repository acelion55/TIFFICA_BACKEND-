const express = require('express');
const router = express.Router();
const { adminAuth } = require('./authmiddle');
const auth = require('./authmiddle');
const User = require('./user');
const MenuItem = require('./menuitems');
const Order = require('./order');
const { Subscription } = require('./subscription');
const CloudKitchen = require('./cloudkitchen');
const UserSchedule = require('./userschedule');

// Kitchen owner or admin auth middleware
const kitchenOrAdminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {});
    if (req.user.role === 'admin' || req.user.role === 'kitchen-owner') {
      next();
    } else {
      res.status(403).json({ error: 'Access denied. Admin or Kitchen Owner only.' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ── Live users tracking (in-memory) ──────────────────────
const liveUsers = new Map(); // userId -> { name, email, lastSeen }
const LIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ── Ping — any logged-in user calls this every 60s ────────
router.post('/ping', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name email');
    if (user) {
      liveUsers.set(req.userId.toString(), {
        name: user.name,
        email: user.email,
        lastSeen: Date.now()
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Live users count (admin only) ─────────────────────────
router.get('/live-users', adminAuth, async (req, res) => {
  const now = Date.now();
  const active = [];
  liveUsers.forEach((v, k) => {
    if (now - v.lastSeen < LIVE_TIMEOUT) active.push({ id: k, ...v });
    else liveUsers.delete(k);
  });
  res.json({ success: true, count: active.length, users: active });
});

// ── Stats ─────────────────────────────────────────────────
router.get('/stats', kitchenOrAdminAuth, async (req, res) => {
  try {
    let menuQuery = {};
    let orderQuery = {};
    
    // Kitchen owner stats filtered by their kitchen
    if (req.user.role === 'kitchen-owner' && req.user.assignedKitchen) {
      menuQuery.cloudKitchen = req.user.assignedKitchen;
      
      // For orders, we need to count orders with items from their kitchen
      const menuItems = await MenuItem.find(menuQuery).select('_id');
      const menuItemIds = menuItems.map(item => item._id);
      
      const orders = await Order.find().populate('items.menuItem');
      const filteredOrders = orders.filter(order => 
        order.items.some(item => 
          item.menuItem && menuItemIds.some(id => id.equals(item.menuItem._id))
        )
      );
      
      const [usersCount, menuItemsCount, subscriptionsCount] = await Promise.all([
        User.countDocuments(),
        MenuItem.countDocuments(menuQuery),
        Subscription.countDocuments(),
      ]);
      
      res.json({ 
        success: true, 
        stats: { 
          users: usersCount, 
          orders: filteredOrders.length, 
          menuItems: menuItemsCount, 
          subscriptions: subscriptionsCount 
        } 
      });
    } else {
      const [usersCount, ordersCount, menuItemsCount, subscriptionsCount] = await Promise.all([
        User.countDocuments(),
        Order.countDocuments(),
        MenuItem.countDocuments(),
        Subscription.countDocuments(),
      ]);
      res.json({ success: true, stats: { users: usersCount, orders: ordersCount, menuItems: menuItemsCount, subscriptions: subscriptionsCount } });
    }
  } catch (error) {
    console.error('❌ Admin Stats Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Today's Dashboard ─────────────────────────────────────
router.get('/today', kitchenOrAdminAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];

    let [todayOrders, scheduledOrders] = await Promise.all([
      Order.find({ createdAt: { $gte: today, $lt: tomorrow } })
        .populate('user', 'name email phone')
        .populate('items.menuItem', 'name price cloudKitchen')
        .sort({ createdAt: -1 }),
      UserSchedule.find({ date: todayStr })
        .populate('user', 'name email phone')
        .populate('meals.menuItem', 'name price image mealType cloudKitchen'),
    ]);

    // Filter for kitchen owner
    if (req.user.role === 'kitchen-owner' && req.user.assignedKitchen) {
      const kitchenId = req.user.assignedKitchen.toString();
      
      todayOrders = todayOrders.filter(order => 
        order.items && order.items.some(item => 
          item.menuItem && 
          item.menuItem.cloudKitchen && 
          item.menuItem.cloudKitchen.toString() === kitchenId
        )
      );
      
      scheduledOrders = scheduledOrders.filter(schedule => 
        schedule.meals && schedule.meals.some(meal => 
          meal.menuItem && 
          meal.menuItem.cloudKitchen && 
          meal.menuItem.cloudKitchen.toString() === kitchenId
        )
      );
    }

    const instantOrders = todayOrders.filter(o => !o.scheduledFor);
    const revenue = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totalAmount || 0), 0);

    // live users
    const now = Date.now();
    const liveCount = [...liveUsers.values()].filter(v => now - v.lastSeen < LIVE_TIMEOUT).length;

    res.json({
      success: true,
      date: todayStr,
      liveUsers: liveCount,
      summary: {
        totalOrders: todayOrders.length,
        scheduledMeals: scheduledOrders.reduce((s, d) => s + d.meals.length, 0),
        instantOrders: instantOrders.length,
        revenue,
        pending: todayOrders.filter(o => o.status === 'pending').length,
        delivered: todayOrders.filter(o => o.status === 'delivered').length,
        cancelled: todayOrders.filter(o => o.status === 'cancelled').length,
      },
      todayOrders,
      scheduledOrders,
      instantOrders,
    });
  } catch (err) {
    console.error('❌ Today dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Users ─────────────────────────────────────────────────
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }] };
    }
    const users = await User.find(query).select('-password').populate('assignedKitchen', 'name').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', adminAuth, async (req, res) => {
  try {
    const { name, email, phone, password, walletBalance, role, assignedKitchen } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) return res.status(400).json({ error: 'User with this email or phone already exists' });
    const userData = { name, email, phone, password: password || '123456', walletBalance: walletBalance || 0, role: role || 'user' };
    if (role === 'kitchen-owner' && assignedKitchen) {
      userData.assignedKitchen = assignedKitchen;
    }
    const user = new User(userData);
    await user.save();
    res.json({ success: true, message: 'User created successfully', user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, walletBalance: user.walletBalance, role: user.role, assignedKitchen: user.assignedKitchen } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, phone, password, walletBalance, role, assignedKitchen } = req.body;
    const updateData = { name, email, phone, walletBalance, role };
    
    // Only update password if provided
    if (password && password.trim() !== '') {
      updateData.password = password;
    }
    
    // Update assignedKitchen for kitchen-owner
    if (role === 'kitchen-owner') {
      updateData.assignedKitchen = assignedKitchen || null;
    } else {
      updateData.assignedKitchen = null;
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── Cloud Kitchens ────────────────────────────────────────
router.get('/cloudkitchens', adminAuth, async (req, res) => {
  try {
    const kitchens = await CloudKitchen.find().sort({ createdAt: -1 });
    res.json({ success: true, kitchens });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cloud kitchens' });
  }
});

router.post('/cloudkitchens', adminAuth, async (req, res) => {
  try {
    const { name, latitude, longitude, ownerId } = req.body;
    if (!name || !latitude || !longitude) return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    const kitchen = new CloudKitchen({ name, location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] } });
    await kitchen.save();
    
    // Assign kitchen to owner if provided
    if (ownerId) {
      await User.findByIdAndUpdate(ownerId, { assignedKitchen: kitchen._id });
    }
    
    res.json({ success: true, message: 'Cloud kitchen created successfully', kitchen });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cloud kitchen' });
  }
});

router.put('/cloudkitchens/:id', adminAuth, async (req, res) => {
  try {
    const { name, latitude, longitude, ownerId } = req.body;
    if (!name || !latitude || !longitude) return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    const kitchen = await CloudKitchen.findByIdAndUpdate(
      req.params.id,
      { name, location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] } },
      { new: true }
    );
    if (!kitchen) return res.status(404).json({ error: 'Cloud kitchen not found' });
    
    // Update kitchen assignment
    // First remove this kitchen from any other owner
    await User.updateMany({ assignedKitchen: req.params.id }, { assignedKitchen: null });
    
    // Then assign to new owner if provided
    if (ownerId) {
      await User.findByIdAndUpdate(ownerId, { assignedKitchen: kitchen._id });
    }
    
    res.json({ success: true, message: 'Cloud kitchen updated successfully', kitchen });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cloud kitchen' });
  }
});

router.delete('/cloudkitchens/:id', adminAuth, async (req, res) => {
  try {
    const kitchen = await CloudKitchen.findByIdAndDelete(req.params.id);
    if (!kitchen) return res.status(404).json({ error: 'Cloud kitchen not found' });
    res.json({ success: true, message: 'Cloud kitchen deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cloud kitchen' });
  }
});

// ── Menu Items ────────────────────────────────────────────
router.get('/menu', kitchenOrAdminAuth, async (req, res) => {
  try {
    let query = {};
    
    // Kitchen owner can only see their kitchen's menu
    if (req.user.role === 'kitchen-owner' && req.user.assignedKitchen) {
      query.cloudKitchen = req.user.assignedKitchen;
    }
    
    const items = await MenuItem.find(query).populate('cloudKitchen', 'name').sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

router.post('/menu', kitchenOrAdminAuth, async (req, res) => {
  try {
    const { name, description, price, image, category, mealType, cloudKitchen, isSpecial, isTodaySpecial, ingredients } = req.body;
    if (!name || !description || !price || !image || !category) return res.status(400).json({ error: 'Please provide all required fields' });
    
    // Kitchen owner can only add items to their kitchen
    let kitchenId = cloudKitchen;
    if (req.user.role === 'kitchen-owner') {
      if (!req.user.assignedKitchen) {
        return res.status(403).json({ error: 'No kitchen assigned to you' });
      }
      kitchenId = req.user.assignedKitchen;
    }
    
    const menuItem = new MenuItem({ name, description, price, image, category, mealType, cloudKitchen: kitchenId || null, isSpecial: isSpecial || false, isTodaySpecial: isTodaySpecial || false, ingredients: ingredients || [] });
    await menuItem.save();
    await menuItem.populate('cloudKitchen', 'name');
    res.json({ success: true, message: 'Menu item created successfully', item: menuItem });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

router.delete('/menu/:id', kitchenOrAdminAuth, async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Kitchen owner can only delete their kitchen's items
    if (req.user.role === 'kitchen-owner' && req.user.assignedKitchen) {
      query.cloudKitchen = req.user.assignedKitchen;
    }
    
    const item = await MenuItem.findOneAndDelete(query);
    if (!item) return res.status(404).json({ error: 'Menu item not found or access denied' });
    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

router.put('/menu/:id', kitchenOrAdminAuth, async (req, res) => {
  try {
    const { name, description, price, image, category, mealType, cloudKitchen, isSpecial, isTodaySpecial, ingredients } = req.body;
    
    let query = { _id: req.params.id };
    let updateData = { name, description, price, image, category, mealType, isSpecial: isSpecial || false, isTodaySpecial: isTodaySpecial || false, ingredients: ingredients || [] };
    
    // Kitchen owner restrictions
    if (req.user.role === 'kitchen-owner') {
      if (!req.user.assignedKitchen) {
        return res.status(403).json({ error: 'No kitchen assigned to you' });
      }
      query.cloudKitchen = req.user.assignedKitchen;
      updateData.cloudKitchen = req.user.assignedKitchen; // Force their kitchen
    } else {
      updateData.cloudKitchen = cloudKitchen || null;
    }
    
    const item = await MenuItem.findOneAndUpdate(query, updateData, { new: true }).populate('cloudKitchen', 'name');
    if (!item) return res.status(404).json({ error: 'Menu item not found or access denied' });
    res.json({ success: true, message: 'Menu item updated successfully', item });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// ── Orders ────────────────────────────────────────────────
router.get('/orders', kitchenOrAdminAuth, async (req, res) => {
  try {
    let orders;
    
    // Kitchen owner can only see orders with items from their kitchen
    if (req.user.role === 'kitchen-owner' && req.user.assignedKitchen) {
      // Get all menu items from this kitchen
      const menuItems = await MenuItem.find({ cloudKitchen: req.user.assignedKitchen }).select('_id');
      const menuItemIds = menuItems.map(item => item._id.toString());
      
      // Get all orders
      const allOrders = await Order.find()
        .populate('user', 'name email phone')
        .populate('items.menuItem')
        .sort({ createdAt: -1 })
        .limit(500);
      
      // Filter orders that have at least one item from their kitchen
      orders = allOrders.filter(order => 
        order.items && order.items.some(item => 
          item.menuItem && 
          item.menuItem.cloudKitchen && 
          item.menuItem.cloudKitchen.toString() === req.user.assignedKitchen.toString()
        )
      );
    } else {
      orders = await Order.find()
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(500);
    }
    
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.patch('/orders/:id/status', kitchenOrAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('user', 'name email phone');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, message: 'Order status updated', order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

router.delete('/orders/:id', adminAuth, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// ── Subscriptions ─────────────────────────────────────────
router.get('/subscriptions', adminAuth, async (req, res) => {
  try {
    const subscriptions = await Subscription.find().populate('user', 'name email phone').sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, subscriptions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

router.delete('/subscriptions/:id', adminAuth, async (req, res) => {
  try {
    const sub = await Subscription.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true, message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// ── Sales Analytics ───────────────────────────────────────
router.get('/sales', adminAuth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysCount = parseInt(days);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);
    const salesData = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalSales: { $sum: '$totalAmount' }, orderCount: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const filledData = [];
    for (let i = 0; i < daysCount; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (daysCount - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      const existingData = salesData.find(d => d._id === dateStr);
      filledData.push({ date: dateStr, totalSales: existingData?.totalSales || 0, orderCount: existingData?.orderCount || 0 });
    }
    const totalSales = filledData.reduce((sum, day) => sum + day.totalSales, 0);
    const totalOrders = filledData.reduce((sum, day) => sum + day.orderCount, 0);
    res.json({ success: true, days: daysCount, salesData: filledData, summary: { totalSales, totalOrders, averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0 } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

module.exports = router;
