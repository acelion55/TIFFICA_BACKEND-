const express = require('express');
const router = express.Router();
const SubscriptionText = require('./subscriptiontext');
const auth = require('./authmiddle');

// GET subscription text (single config document)
router.get('/', async (req, res) => {
  try {
    let config = await SubscriptionText.findOne().sort({ updatedAt: -1 });

    if (!config) {
      // Create default config if doesn't exist
      config = new SubscriptionText({
        headerTitle: 'Subscriptions',
        headerSubtitle: 'Save more with meal subscriptions',
        plans: [
          {
            name: 'Daily Delight',
            description: 'Perfect for lunch lovers',
            mealsPerDay: 14,
            mealTimes: ['lunch'],
            pricePerDay: 1400,
            savings: '10%',
            popular: false
          },
          {
            name: 'Power Combo',
            description: 'Lunch & Dinner covered',
            mealsPerDay: 40,
            mealTimes: ['lunch', 'dinner'],
            pricePerDay: 3000,
            savings: '15%',
            popular: false
          },
          {
            name: 'Full Day Feast',
            description: 'All meals, all day',
            mealsPerDay: 60,
            mealTimes: ['breakfast', 'lunch', 'dinner'],
            pricePerDay: 5500,
            savings: '20%',
            popular: true
          }
        ]
      });
      await config.save();
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('❌ Error fetching subscription text:', error.message);
    res.status(500).json({
      error: 'Server error fetching subscription text',
      details: error.message,
    });
  }
});

// POST - Update subscription plans
router.post('/', auth, async (req, res) => {
  try {
    console.log('📝 [UPDATE-PLANS] Request received');
    
    const { plans } = req.body;

    if (!plans || !Array.isArray(plans)) {
      return res.status(400).json({
        error: 'Validation error',
        details: 'Plans must be an array'
      });
    }

    let config = await SubscriptionText.findOne();

    if (!config) {
      config = new SubscriptionText({ plans });
    } else {
      config.plans = plans;
      config.updatedAt = new Date();
    }

    await config.save();

    console.log('✅ [UPDATE-PLANS] Plans updated successfully');
    res.json({
      success: true,
      message: 'Subscription plans updated successfully',
      data: config
    });

  } catch (error) {
    console.error('❌ [UPDATE-PLANS] Error:', error.message);
    res.status(500).json({
      error: 'Failed to update subscription plans',
      details: error.message
    });
  }
});

module.exports = router;
