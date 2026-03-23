const express = require('express');
const router = express.Router();
const auth = require('./authmiddle');
const User = require('./user');
const MenuItem = require('./menuitems');
const Order = require('./order');
const Subscription = require('./subscription');
const CloudKitchen = require('./cloudkitchen');
const bcrypt = require('bcryptjs');

// Middleware to check admin access
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

// Get Admin Stats
router.get('/stats', auth, checkAdmin, async (req, res) => {
  try {
    const [usersCount, ordersCount, menuItemsCount, subscriptionsCount] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      MenuItem.countDocuments(),
      Subscription.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: {
        users: usersCount,
        orders: ordersCount,
        menuItems: menuItemsCount,
        subscriptions: subscriptionsCount,
      }
    });
  } catch (error) {
    console.error('❌ Admin Stats Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get All Users with search
router.get('/users', auth, checkAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('❌ Get Users Error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create User
router.post('/users', auth, checkAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, walletBalance } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or phone already exists' });
    }

    const user = new User({
      name,
      email,
      phone,
      password: password || '123456',
      walletBalance: walletBalance || 0
    });

    await user.save();

    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    console.error('❌ Create User Error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get All Cloud Kitchens
router.get('/cloudkitchens', auth, checkAdmin, async (req, res) => {
  try {
    const kitchens = await CloudKitchen.find().sort({ createdAt: -1 });
    res.json({ success: true, kitchens });
  } catch (error) {
    console.error('❌ Get Cloud Kitchens Error:', error);
    res.status(500).json({ error: 'Failed to fetch cloud kitchens' });
  }
});

// Create Cloud Kitchen
router.post('/cloudkitchens', auth, checkAdmin, async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body;

    if (!name || !latitude || !longitude) {
      return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    }

    const kitchen = new CloudKitchen({
      name,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      }
    });

    await kitchen.save();

    res.json({
      success: true,
      message: 'Cloud kitchen created successfully',
      kitchen
    });
  } catch (error) {
    console.error('❌ Create Cloud Kitchen Error:', error);
    res.status(500).json({ error: 'Failed to create cloud kitchen' });
  }
});

// Delete Cloud Kitchen
router.delete('/cloudkitchens/:id', auth, checkAdmin, async (req, res) => {
  try {
    const kitchen = await CloudKitchen.findByIdAndDelete(req.params.id);
    if (!kitchen) {
      return res.status(404).json({ error: 'Cloud kitchen not found' });
    }
    res.json({ success: true, message: 'Cloud kitchen deleted successfully' });
  } catch (error) {
    console.error('❌ Delete Cloud Kitchen Error:', error);
    res.status(500).json({ error: 'Failed to delete cloud kitchen' });
  }
});

// Get All Menu Items
router.get('/menu', auth, checkAdmin, async (req, res) => {
  try {
    const items = await MenuItem.find()
      .populate('cloudKitchen', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (error) {
    console.error('❌ Get Menu Items Error:', error);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// Create Menu Item
router.post('/menu', auth, checkAdmin, async (req, res) => {
  try {
    const { name, description, price, image, category, mealType, cloudKitchen, isSpecial, isTodaySpecial, ingredients } = req.body;

    if (!name || !description || !price || !image || !category) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    const menuItem = new MenuItem({
      name,
      description,
      price,
      image,
      category,
      mealType,
      cloudKitchen: cloudKitchen || null,
      isSpecial: isSpecial || false,
      isTodaySpecial: isTodaySpecial || false,
      ingredients: ingredients || []
    });

    await menuItem.save();
    await menuItem.populate('cloudKitchen', 'name');

    res.json({
      success: true,
      message: 'Menu item created successfully',
      item: menuItem
    });
  } catch (error) {
    console.error('❌ Create Menu Item Error:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// Delete Menu Item
router.delete('/menu/:id', auth, checkAdmin, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('❌ Delete Menu Item Error:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// Update Menu Item
router.put('/menu/:id', auth, checkAdmin, async (req, res) => {
  try {
    const { name, description, price, image, category, mealType, cloudKitchen, isSpecial, isTodaySpecial, ingredients } = req.body;

    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        image,
        category,
        mealType,
        cloudKitchen: cloudKitchen || null,
        isSpecial: isSpecial || false,
        isTodaySpecial: isTodaySpecial || false,
        ingredients: ingredients || []
      },
      { new: true }
    ).populate('cloudKitchen', 'name');

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      item
    });
  } catch (error) {
    console.error('❌ Update Menu Item Error:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// Get Sales Analytics
router.get('/sales', auth, checkAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysCount = parseInt(days);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);

    // Get orders grouped by date
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Fill missing dates with zero sales
    const filledData = [];
    for (let i = 0; i < daysCount; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (daysCount - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      
      const existingData = salesData.find(d => d._id === dateStr);
      filledData.push({
        date: dateStr,
        totalSales: existingData?.totalSales || 0,
        orderCount: existingData?.orderCount || 0
      });
    }

    // Calculate totals
    const totalSales = filledData.reduce((sum, day) => sum + day.totalSales, 0);
    const totalOrders = filledData.reduce((sum, day) => sum + day.orderCount, 0);

    res.json({
      success: true,
      days: daysCount,
      salesData: filledData,
      summary: {
        totalSales,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0
      }
    });
  } catch (error) {
    console.error('❌ Sales Analytics Error:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Get All Orders
router.get('/orders', auth, checkAdmin, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('❌ Get Orders Error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Update Order Status
router.patch('/orders/:id/status', auth, checkAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      order
    });
  } catch (error) {
    console.error('❌ Update Order Status Error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Get All Subscriptions
router.get('/subscriptions', auth, checkAdmin, async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('❌ Get Subscriptions Error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

module.exports = router;
