const express = require('express');
const router = express.Router();
const ScheduleConfig = require('./scheduleconfig');

// Get schedule config
router.get('/', async (req, res) => {
  try {
    const config = await ScheduleConfig.findOne();
    
    if (!config) {
      return res.status(404).json({ 
        error: 'Schedule configuration not found',
        message: 'Please seed the database first'
      });
    }

    res.json({ 
      success: true,
      data: config
    });
  } catch (error) {
    console.error('❌ Error fetching schedule config:', error.message);
    res.status(500).json({ 
      error: 'Server error fetching schedule config',
      details: error.message 
    });
  }
});

// Get config by ID
router.get('/:id', async (req, res) => {
  try {
    const config = await ScheduleConfig.findById(req.params.id);
    
    if (!config) {
      return res.status(404).json({ error: 'Schedule configuration not found' });
    }

    res.json({ 
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Update config
router.put('/:id', async (req, res) => {
  try {
    const { title, subtitle, mealTypes, categories, itemCategories } = req.body;
    
    const config = await ScheduleConfig.findByIdAndUpdate(
      req.params.id,
      { 
        title, 
        subtitle, 
        mealTypes,
        categories,
        itemCategories,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({ error: 'Schedule configuration not found' });
    }

    res.json({ 
      success: true,
      message: 'Schedule config updated successfully',
      data: config
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

module.exports = router;
