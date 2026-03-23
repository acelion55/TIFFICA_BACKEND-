const express = require('express');
const router = express.Router();
const { Subscription } = require('./subscription');
const MenuItem = require('./menuitems');
const User = require('./user');
const auth = require('./authmiddle');
const subscriptionPlansRouter = require('./subscriptionplans');

// Mount subscription plans routes
router.use('/plans', subscriptionPlansRouter);

// Get all subscriptions (for dashboard)
router.get('/', async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('user', 'name email phone addresses address')
      .sort({ createdAt: -1 });
    res.json({ success: true, subscriptions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new subscription (simple wallet top-up)
router.post('/', auth, async (req, res) => {
  try {
    const { planName, amount } = req.body;

    console.log('🛒 Creating subscription:', { planName, amount, userId: req.userId });

    if (!planName || !amount) {
      return res.status(400).json({ error: 'Plan name and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // First check if user exists
    let user = await User.findById(req.userId);
    if (!user) {
      console.error('❌ User not found before creating subscription:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`📊 User found: ${user.name}, wallet before: ₹${user.walletBalance || 0}`);

    // Create subscription record with user snapshot
    const subscription = new Subscription({
      user: req.userId,
      planName,
      amount,
      userSnapshot: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.addresses?.[0]?.fullAddress || user.address?.street || 'N/A'
      }
    });

    try {
      await subscription.save();
      console.log('✅ Subscription saved:', subscription._id);
    } catch (saveError) {
      console.error('❌ Error saving subscription:', saveError.message);
      return res.status(400).json({ error: 'Failed to save subscription', details: saveError.message });
    }

    // Update wallet
    console.log(`💳 Updating wallet for user ${req.userId}. Adding ₹${amount}`);
    
    user = await User.findByIdAndUpdate(
      req.userId,
      { $inc: { walletBalance: amount } },
      { new: true }
    );

    if (!user) {
      console.error('❌ User not found after wallet update');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`📊 User wallet after: ₹${user.walletBalance || 0}`);
    console.log(`✅ Successfully added ₹${amount} to wallet. New balance: ₹${user.walletBalance}`);

    res.status(201).json({
      success: true,
      message: `₹${amount} added to your wallet`,
      subscription: {
        _id: subscription._id,
        planName: subscription.planName,
        amount: subscription.amount,
        createdAt: subscription.createdAt
      },
      walletBalance: user.walletBalance
    });
  } catch (error) {
    console.error('❌ Error creating subscription:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get user subscription history
router.get('/my-subscriptions', auth, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ user: req.userId })
      .sort('-createdAt');

    res.json({ 
      success: true,
      subscriptions 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching subscriptions' });
  }
});

// Get subscription by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ 
      success: true,
      subscription 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching subscription' });
  }
});

// Update subscription (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('📝 [UPDATE-SUBSCRIPTION] Request received for ID:', req.params.id);
    
    const { planName, amount, userSnapshot } = req.body;

    if (!planName || !amount) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: 'Plan name and amount are required' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: 'Amount must be greater than 0' 
      });
    }

    const subscription = await Subscription.findByIdAndUpdate(
      req.params.id,
      {
        planName,
        amount,
        userSnapshot: {
          name: userSnapshot?.name || '',
          email: userSnapshot?.email || '',
          phone: userSnapshot?.phone || '',
          address: userSnapshot?.address || ''
        }
      },
      { new: true, runValidators: true }
    );

    if (!subscription) {
      console.log('❌ [UPDATE-SUBSCRIPTION] Subscription not found');
      return res.status(404).json({ error: 'Subscription not found' });
    }

    console.log('✅ [UPDATE-SUBSCRIPTION] Updated successfully');
    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription
    });

  } catch (error) {
    console.error('❌ [UPDATE-SUBSCRIPTION] Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to update subscription',
      details: error.message 
    });
  }
});

module.exports = router;