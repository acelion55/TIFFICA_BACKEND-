const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./deliveryauth');
const Delivery = require('./delivery');
const User = require('./user');
const Order = require('./order');

// GET /api/delivery/available - Get available delivery requests
router.get('/available', authMiddleware, async (req, res) => {
  try {
    const partner = await User.findById(req.partnerId);
    
    if (!partner || !partner.isOnline) {
      return res.json({ success: true, deliveries: [] });
    }
    
    // Find pending deliveries near partner's location
    const deliveries = await Delivery.find({
      status: 'pending',
      rejectedBy: { $ne: req.partnerId }
    })
    .populate('orderId', 'items totalAmount')
    .sort({ createdAt: -1 })
    .limit(20);
    
    // Calculate distance from partner's current location
    const deliveriesWithDistance = deliveries.map(delivery => {
      const partnerLat = partner.currentLocation?.latitude || 26.9124;
      const partnerLng = partner.currentLocation?.longitude || 75.7873;
      
      const distance = calculateDistance(
        partnerLat,
        partnerLng,
        delivery.pickupLocation.coordinates[1],
        delivery.pickupLocation.coordinates[0]
      );
      
      return {
        ...delivery.toObject(),
        distanceFromPartner: distance.toFixed(2)
      };
    });
    
    res.json({ success: true, deliveries: deliveriesWithDistance });
  } catch (err) {
    console.error('❌ Get available deliveries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/delivery/my-deliveries - Get partner's current and past deliveries
router.get('/my-deliveries', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    const query = { deliveryPartner: req.partnerId };
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      query.status = { $in: statuses };
    }
    
    const deliveries = await Delivery.find(query)
      .populate('orderId', 'items totalAmount orderNumber')
      .populate({
        path: 'orderId',
        populate: {
          path: 'items.menuItem',
          select: 'name price image'
        }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, deliveries });
  } catch (err) {
    console.error('❌ Get my deliveries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/delivery/:id - Get delivery details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('orderId', 'items totalAmount orderNumber')
      .populate('deliveryPartner', 'name phone profilePhoto rating');
    
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    res.json({ success: true, delivery });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery/:id/accept - Accept delivery request
router.post('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    if (delivery.status !== 'pending' && delivery.status !== 'assigned') {
      return res.status(400).json({ error: 'Delivery already accepted by another partner' });
    }
    
    const partner = await User.findById(req.partnerId);
    if (!partner.isOnline) {
      return res.status(400).json({ error: 'You must be online to accept deliveries' });
    }
    
    delivery.deliveryPartner = req.partnerId;
    delivery.status = 'accepted';
    delivery.timestamps.accepted = new Date();
    await delivery.save();
    
    console.log(`✅ Delivery ${delivery._id} accepted by ${partner.name}`);
    
    res.json({ 
      success: true, 
      delivery,
      message: 'Delivery accepted successfully'
    });
  } catch (err) {
    console.error('❌ Accept delivery error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery/:id/reject - Reject delivery request
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    delivery.rejectedBy.push(req.partnerId);
    if (reason) delivery.rejectionReason = reason;
    await delivery.save();
    
    console.log(`❌ Delivery ${delivery._id} rejected by partner ${req.partnerId}`);
    
    res.json({ success: true, message: 'Delivery rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery/:id/update-status - Update delivery status
router.post('/:id/update-status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    if (delivery.deliveryPartner.toString() !== req.partnerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const validStatuses = ['accepted', 'reached_restaurant', 'picked_up', 'out_for_delivery', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    delivery.status = status;
    
    // Update timestamps
    const timestampMap = {
      'reached_restaurant': 'reachedRestaurant',
      'picked_up': 'pickedUp',
      'out_for_delivery': 'outForDelivery',
      'delivered': 'delivered'
    };
    
    if (timestampMap[status]) {
      delivery.timestamps[timestampMap[status]] = new Date();
    }
    
    // If delivered, update earnings
    if (status === 'delivered') {
      const partner = await User.findById(req.partnerId);
      
      delivery.actualEarning = delivery.estimatedEarning;
      delivery.isPaid = false;
      
      // Update user wallet
      partner.walletBalance = (partner.walletBalance || 0) + delivery.actualEarning;
      await partner.save();
      
      // Update order status
      await Order.findByIdAndUpdate(delivery.orderId, { status: 'delivered' });
    }
    
    await delivery.save();
    
    console.log(`📦 Delivery ${delivery._id} status updated to: ${status}`);
    
    res.json({ 
      success: true, 
      delivery,
      message: `Status updated to ${status.replace('_', ' ')}`
    });
  } catch (err) {
    console.error('❌ Update status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/delivery/earnings/summary - Get earnings summary
router.get('/earnings/summary', authMiddleware, async (req, res) => {
  try {
    if (!req.partnerId) {
      return res.status(401).json({ error: 'Partner ID not found' });
    }
    
    const partner = await User.findById(req.partnerId);
    
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    
    // Get today's deliveries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayDeliveries = await Delivery.find({
      deliveryPartner: req.partnerId,
      status: 'delivered',
      'timestamps.delivered': { $gte: today }
    });
    
    // Get this week's deliveries
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    const weekDeliveries = await Delivery.find({
      deliveryPartner: req.partnerId,
      status: 'delivered',
      'timestamps.delivered': { $gte: weekStart }
    });
    
    // Get this month's deliveries
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthDeliveries = await Delivery.find({
      deliveryPartner: req.partnerId,
      status: 'delivered',
      'timestamps.delivered': { $gte: monthStart }
    });
    
    const todayEarnings = todayDeliveries.reduce((sum, d) => sum + (d.actualEarning || 0), 0);
    const weekEarnings = weekDeliveries.reduce((sum, d) => sum + (d.actualEarning || 0), 0);
    const monthEarnings = monthDeliveries.reduce((sum, d) => sum + (d.actualEarning || 0), 0);
    
    res.json({
      success: true,
      earnings: {
        today: {
          amount: todayEarnings,
          deliveries: todayDeliveries.length
        },
        week: {
          amount: weekEarnings,
          deliveries: weekDeliveries.length
        },
        month: {
          amount: monthEarnings,
          deliveries: monthDeliveries.length
        },
        total: todayEarnings + weekEarnings + monthEarnings,
        walletBalance: partner.walletBalance || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery/earnings/withdraw - Request withdrawal
router.post('/earnings/withdraw', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }
    
    const partner = await User.findById(req.partnerId);
    
    if ((partner.walletBalance || 0) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct from wallet
    partner.walletBalance = (partner.walletBalance || 0) - amount;
    await partner.save();
    
    console.log(`💰 Withdrawal request: ₹${amount} by ${partner.name}`);
    
    res.json({ 
      success: true, 
      message: 'Withdrawal request submitted',
      newBalance: partner.walletBalance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = router;
