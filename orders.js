const express = require('express');
const router = express.Router();
const Order = require('./order');
const MenuItem = require('./menuitems');
const auth = require('./authmiddle');
const User = require('./user');
const CloudKitchen = require('./cloudkitchen');
const axios = require('axios');

// Middleware to handle root path
router.use((req, res, next) => {
  if (req.url === '') req.url = '/';
  next();
});

// =================== DISTANCE HELPERS ===================
// Fallback: Haversine distance (km) between two [lat, lng] points
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Preferred: road distance using OpenStreetMap OSRM routing API
// Docs: https://router.project-osrm.org
async function routingDistanceKm(lat1, lon1, lat2, lon2) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false&alternatives=false&steps=false`;
    const res = await axios.get(url);

    const route = res.data && Array.isArray(res.data.routes) && res.data.routes[0];
    if (!route || typeof route.distance !== 'number') {
      throw new Error('Invalid OSRM response');
    }

    // OSRM distance is in meters
    const km = route.distance / 1000;
    return km;
  } catch (err) {
    return haversineKm(lat1, lon1, lat2, lon2);
  }
}

// Get all orders (for dashboard)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email phone')
      .populate('items.menuItem', 'name price category')
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new order
router.post('/', auth, async (req, res) => {
  try {
    console.log('📦 ORDER REQUEST RECEIVED');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User ID:', req.userId);
    
    const { items, deliveryAddress, deliveryFee, discount, paymentMethod, scheduledFor, specialInstructions, paymentId } = req.body;

    if (!items || items.length === 0) {
      console.log('❌ No items in order');
      return res.status(400).json({ error: 'No items in order' });
    }

    // 1) Load user with default address coordinates
    const user = await User.findById(req.userId);
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('✅ User found:', user.name);

    const defaultAddress =
      (user.addresses || []).find((a) => a.isDefault && a.location && Array.isArray(a.location.coordinates)) ||
      null;

    if (!defaultAddress) {
      console.log('❌ No default address');
      return res.status(400).json({
        error: 'Please set a default address with location to place an order',
      });
    }

    console.log('✅ Default address found');
    const [userLng, userLat] = defaultAddress.location.coordinates;

    // 2) Load all cloud kitchens from shared collection
    const kitchens = await CloudKitchen.find({});
    if (!kitchens.length) {
      console.log('❌ No kitchens found');
      return res.status(400).json({
        error: 'No kitchens configured yet. Please try again later.',
      });
    }

    console.log('✅ Found', kitchens.length, 'kitchens');

    let hasKitchenInRange = false;
    let nearestKm = Infinity;

    // Use OpenStreetMap routing distance (road distance) to each kitchen
    for (const k of kitchens) {
      const coords = k.location?.coordinates || [];
      const kLng = coords[0];
      const kLat = coords[1];
      if (!Number.isFinite(kLat) || !Number.isFinite(kLng)) continue;

      const distKm = await routingDistanceKm(userLat, userLng, kLat, kLng);

      if (distKm < nearestKm) nearestKm = distKm;
      if (distKm <= 5) hasKitchenInRange = true;
    }

    if (!hasKitchenInRange) {
      const rounded = Number.isFinite(nearestKm) ? nearestKm.toFixed(2) : 'unknown';
      console.log('❌ No kitchen in range. Nearest:', rounded, 'km');
      return res.status(400).json({
        error: `The kitchen is not in your area. Nearest kitchen is about ${rounded} km away. Minimum 5 km coverage is required to place an order.`,
      });
    }
    const usedDistanceKm = Number.isFinite(nearestKm) ? Number(nearestKm.toFixed(2)) : null;
    console.log('✅ Kitchen in range. Distance:', usedDistanceKm, 'km');

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];

    console.log('Processing', items.length, 'items...');
    for (const item of items) {
      console.log('Looking for menu item:', item.menuItemId);
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable) {
        console.log('❌ Menu item not available:', item.menuItemId);
        return res.status(400).json({ error: `Menu item ${item.menuItemId} not available` });
      }

      console.log('✅ Found menu item:', menuItem.name, 'Price:', menuItem.price);
      const itemTotal = menuItem.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        menuItem: menuItem._id,
        quantity: item.quantity,
        price: menuItem.price
      });
    }

    console.log('✅ Total amount calculated:', totalAmount);
    const finalAmount = totalAmount + (deliveryFee || 0) - (discount || 0);
    console.log('✅ Final amount:', finalAmount);

    const orderData = {
      user: req.userId,
      items: orderItems,
      totalAmount,
      deliveryAddress: deliveryAddress || defaultAddress,
      deliveryFee: deliveryFee || 0,
      discount: discount || 0,
      finalAmount,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: paymentId ? 'paid' : 'pending',
      scheduledFor,
      specialInstructions
    };

    console.log('Creating order with data:', JSON.stringify(orderData, null, 2));
    const order = new Order(orderData);

    console.log('Saving order...');
    await order.save();
    console.log('✅ Order saved! ID:', order._id);

    await order.populate('items.menuItem');
    console.log('✅ Order populated');

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order,
      deliveryDistanceKm: usedDistanceKm,
    });
  } catch (error) {
    console.error('❌ ORDER CREATION ERROR:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Server error creating order', details: error.message });
  }
});

// Get user orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    
    let filter = { user: req.userId };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('items.menuItem')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.json({ 
      orders,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching orders' });
  }
});

// Get order by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id,
      user: req.userId 
    }).populate('items.menuItem');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching order' });
  }
});

// Reorder (create new order from existing order)
router.post('/:id/reorder', auth, async (req, res) => {
  try {
    const oldOrder = await Order.findOne({ 
      _id: req.params.id,
      user: req.userId 
    }).populate('items.menuItem');

    if (!oldOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if all items are still available
    for (const item of oldOrder.items) {
      if (!item.menuItem.isAvailable) {
        return res.status(400).json({ 
          error: `Menu item ${item.menuItem.name} is no longer available` 
        });
      }
    }

    const newOrder = new Order({
      user: req.userId,
      items: oldOrder.items.map(item => ({
        menuItem: item.menuItem._id,
        quantity: item.quantity,
        price: item.menuItem.price // Use current price
      })),
      totalAmount: oldOrder.items.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0),
      deliveryAddress: req.body.deliveryAddress || oldOrder.deliveryAddress,
      deliveryFee: req.body.deliveryFee || oldOrder.deliveryFee,
      discount: req.body.discount || 0,
      finalAmount: 0, // Will be calculated
      paymentMethod: req.body.paymentMethod || oldOrder.paymentMethod,
      specialInstructions: req.body.specialInstructions
    });

    newOrder.finalAmount = newOrder.totalAmount + newOrder.deliveryFee - newOrder.discount;
    await newOrder.save();
    await newOrder.populate('items.menuItem');

    res.status(201).json({
      message: 'Order reordered successfully',
      order: newOrder
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error reordering' });
  }
});

// Cancel order
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id,
      user: req.userId 
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'delivered' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot cancel this order' });
    }

    order.status = 'cancelled';
    await order.save();

    res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    res.status(500).json({ error: 'Server error cancelling order' });
  }
});

// Add rating and review
router.patch('/:id/review', auth, async (req, res) => {
  try {
    const { rating, review } = req.body;

    const order = await Order.findOne({ 
      _id: req.params.id,
      user: req.userId 
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Can only review delivered orders' });
    }

    order.rating = rating;
    order.review = review;
    await order.save();

    res.json({ message: 'Review added successfully', order });
  } catch (error) {
    res.status(500).json({ error: 'Server error adding review' });
  }
});

module.exports = router;