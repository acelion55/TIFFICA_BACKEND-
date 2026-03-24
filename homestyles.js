const express = require('express');
const router = express.Router();
const Homestyle = require('./homestyle');

// Strip tagline/subTagline from DB on startup
Homestyle.updateMany({}, { $unset: { tagline: '', subTagline: '' } }).catch(() => {});

// Get homestyle data
router.get('/', async (req, res) => {
  try {
    const homestyle = await Homestyle.findOne();
    if (!homestyle) return res.status(404).json({ error: 'Homestyle configuration not found' });
    res.json({ success: true, data: homestyle });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get homestyle by ID
router.get('/:id', async (req, res) => {
  try {
    const homestyle = await Homestyle.findById(req.params.id);
    if (!homestyle) return res.status(404).json({ error: 'Homestyle configuration not found' });
    res.json({ success: true, data: homestyle });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Create or update homestyle
router.post('/', async (req, res) => {
  try {
    const { videoLinks, substituteVideoLinks, bestseller, categories } = req.body;
    if (!videoLinks || videoLinks.length === 0)
      return res.status(400).json({ error: 'At least one video link is required' });

    let homestyle = await Homestyle.findOne();
    const update = {
      videoLinks: videoLinks || [],
      substituteVideoLinks: substituteVideoLinks || [],
      bestseller: bestseller || [],
      categories: categories || [],
      updatedAt: new Date()
    };

    if (homestyle) {
      homestyle = await Homestyle.findByIdAndUpdate(homestyle._id, update, { new: true });
    } else {
      homestyle = await Homestyle.create(update);
    }
    res.json({ success: true, message: 'Homestyle saved successfully', data: homestyle });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const { videoLinks, substituteVideoLinks, bestseller, categories } = req.body;
    if (!videoLinks || videoLinks.length === 0)
      return res.status(400).json({ error: 'At least one video link is required' });

    let homestyle = await Homestyle.findOne();
    const update = {
      videoLinks: videoLinks || [],
      substituteVideoLinks: substituteVideoLinks || [],
      bestseller: bestseller || [],
      categories: categories || [],
      updatedAt: new Date()
    };

    if (homestyle) {
      homestyle = await Homestyle.findByIdAndUpdate(homestyle._id, update, { new: true });
    } else {
      homestyle = await Homestyle.create(update);
    }
    res.json({ success: true, message: 'Homestyle updated successfully', data: homestyle });
  } catch (error) {
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
