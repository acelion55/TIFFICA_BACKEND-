const express = require('express');
const router = express.Router();
const { SubscriptionPlan } = require('./subscription');
const auth = require('./authmiddle');

// Get all subscription plans
router.get('/', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('❌ Error fetching plans:', error);
    res.status(500).json({ error: 'Server error fetching plans' });
  }
});

// Get single plan
router.get('/:id', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json({
      success: true,
      plan
    });
  } catch (error) {
    console.error('❌ Error fetching plan:', error);
    res.status(500).json({ error: 'Server error fetching plan' });
  }
});

// Create subscription plan (Admin only)
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, mealsPerDay, mealTimes, pricePerDay, savings, popular } = req.body;

    if (!name || !description || !mealsPerDay || !mealTimes || !pricePerDay) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plan = new SubscriptionPlan({
      name,
      description,
      mealsPerDay,
      mealTimes,
      pricePerDay,
      savings: savings || '0%',
      popular: popular || false
    });

    await plan.save();

    console.log('✅ Subscription plan created:', plan._id);

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      plan
    });
  } catch (error) {
    console.error('❌ Error creating plan:', error);
    res.status(500).json({ error: 'Server error creating plan' });
  }
});

// Update subscription plan (Admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, mealsPerDay, mealTimes, pricePerDay, savings, popular } = req.body;

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        mealsPerDay,
        mealTimes,
        pricePerDay,
        savings,
        popular,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    console.log('✅ Subscription plan updated:', plan._id);

    res.json({
      success: true,
      message: 'Subscription plan updated successfully',
      plan
    });
  } catch (error) {
    console.error('❌ Error updating plan:', error);
    res.status(500).json({ error: 'Server error updating plan' });
  }
});

// Delete subscription plan (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    console.log('✅ Subscription plan deleted:', plan._id);

    res.json({
      success: true,
      message: 'Subscription plan deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting plan:', error);
    res.status(500).json({ error: 'Server error deleting plan' });
  }
});

module.exports = router;
