const express = require('express');
const router = express.Router();
const auth = require('./authmiddle');
const User = require('./user');
const MenuItem = require('./menuitems');
const Order = require('./order');
const { Subscription } = require('./subscription');
const CloudKitchen = require('./cloudkitchen');
const UserSchedule = require('./userschedule');

// ── Live users tracking (in-memory) ──────────────────────
const liveUsers = new Map(); // userId -> { name, email, lastSeen }
const LIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ── checkAdmin middleware — MUST be defined before routes ─
const checkAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.email !== 'admin@gmail.com') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization failed' });
  }
};

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
router.get('/live-users', auth, checkAdmin, async (req, res) => {
  const now = Date.now();
  const active = [];
  liveUsers.forEach((v, k) => {
    if (now - v.lastSeen < LIVE_TIMEOUT) active.push({ id: k, ...v });
    else liveUsers.delete(k);
  });
  res.json({ success: true, count: active.length, users: active });
});

// ── Stats ─────────────────────────────────────────────────
router.get('/stats', auth, checkAdmin, async (req, res) => {
  try {
    const [usersCount, ordersCount, menuItemsCount, subscriptionsCount] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      MenuItem.countDocuments(),
      Subscription.countDocuments(),
    ]);
    res.json({ success: true, stats: { users: usersCount, orders: ordersCount, menuItems: menuItemsCount, subscriptions: subscriptionsCount } });
  } catch (error) {
    console.error('❌ Admin Stats Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Today's Dashboard ─────────────────────────────────────
router.get('/today', auth, checkAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];

    const [todayOrders, scheduledOrders] = await Promise.all([
      Order.find({ createdAt: { $gte: today, $lt: tomorrow } })
        .populate('user', 'name email phone')
        .populate('items.menuItem', 'name price')
        .sort({ createdAt: -1 }),
      UserSchedule.find({ date: todayStr })
        .populate('user', 'name email phone')
        .populate('meals.menuItem', 'name price image mealType'),
    ]);

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
router.get('/users', auth, checkAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }] };
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', auth, checkAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, walletBalance } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) return res.status(400).json({ error: 'User with this email or phone already exists' });
    const user = new User({ name, email, phone, password: password || '123456', walletBalance: walletBalance || 0 });
    await user.save();
    res.json({ success: true, message: 'User created successfully', user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, walletBalance: user.walletBalance } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── Cloud Kitchens ────────────────────────────────────────
router.get('/cloudkitchens', auth, checkAdmin, async (req, res) => {
  try {
    const kitchens = await CloudKitchen.find().sort({ createdAt: -1 });
    res.json({ success: true, kitchens });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cloud kitchens' });
  }
});

router.post('/cloudkitchens', auth, checkAdmin, async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body;
    if (!name || !latitude || !longitude) return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    const kitchen = new CloudKitchen({ name, location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] } });
    await kitchen.save();
    res.json({ success: true, message: 'Cloud kitchen created successfully', kitchen });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cloud kitchen' });
  }
});

router.put('/cloudkitchens/:id', auth, checkAdmin, async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body;
    if (!name || !latitude || !longitude) return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    const kitchen = await CloudKitchen.findByIdAndUpdate(
      req.params.id,
      { name, location: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] } },
      { new: true }
    );
    if (!kitchen) return res.status(404).json({ error: 'Cloud kitchen not found' });
    res.json({ success: true, message: 'Cloud kitchen updated successfully', kitchen });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cloud kitchen' });
  }
});

router.delete('/cloudkitchens/:id', auth, checkAdmin, async (req, res) => {
  try {
    const kitchen = await CloudKitchen.findByIdAndDelete(req.params.id);
    if (!kitchen) return res.status(404).json({ error: 'Cloud kitchen not found' });
    res.json({ success: true, message: 'Cloud kitchen deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cloud kitchen' });
  }
});

// ── Menu Items ────────────────────────────────────────────
router.get('/menu', auth, checkAdmin, async (req, res) => {
  try {
    const items = await MenuItem.find().populate('cloudKitchen', 'name').sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

router.post('/menu', auth, checkAdmin, async (req, res) => {
  try {
    const { name, description, price, image, category, mealType, cloudKitchen, isSpecial, isTodaySpecial, ingredients } = req.body;
    if (!name || !description || !price || !image || !category) return res.status(400).json({ error: 'Please provide all required fields' });
    const menuItem = new MenuItem({ name, description, price, image, category, mealType, cloudKitchen: cloudKitchen || null, isSpecial: isSpecial || false, isTodaySpecial: isTodaySpecial || false, ingredients: ingredients || [] });
    await menuItem.save();
    await menuItem.populate('cloudKitchen', 'name');
    res.json({ success: true, message: 'Menu item created successfully', item: menuItem });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

router.delete('/menu/:id', auth, checkAdmin, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

router.put('/menu/:id', auth, checkAdmin, async (req, res) => {
  try {
    const { name, description, price, image, category, mealType, cloudKitchen, isSpecial, isTodaySpecial, ingredients } = req.body;
    const item = await MenuItem.findByIdAndUpdate(req.params.id, { name, description, price, image, category, mealType, cloudKitchen: cloudKitchen || null, isSpecial: isSpecial || false, isTodaySpecial: isTodaySpecial || false, ingredients: ingredients || [] }, { new: true }).populate('cloudKitchen', 'name');
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ success: true, message: 'Menu item updated successfully', item });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// ── Orders ────────────────────────────────────────────────
router.get('/orders', auth, checkAdmin, async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email phone').sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.patch('/orders/:id/status', auth, checkAdmin, async (req, res) => {
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

router.delete('/orders/:id', auth, checkAdmin, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// ── Subscriptions ─────────────────────────────────────────
router.get('/subscriptions', auth, checkAdmin, async (req, res) => {
  try {
    const subscriptions = await Subscription.find().populate('user', 'name email phone').sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, subscriptions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

router.delete('/subscriptions/:id', auth, checkAdmin, async (req, res) => {
  try {
    const sub = await Subscription.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true, message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// ── Sales Analytics ───────────────────────────────────────
router.get('/sales', auth, checkAdmin, async (req, res) => {
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
