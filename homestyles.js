const express = require('express');
const router = express.Router();
const Homestyle = require('./homestyle');

// Get homestyle data
router.get('/', async (req, res) => {
  try {
    const homestyle = await Homestyle.findOne();
    
    if (!homestyle) {
      return res.status(404).json({ 
        error: 'Homestyle configuration not found',
        message: 'Please seed the database first'
      });
    }

    res.json({ 
      success: true,
      data: homestyle
    });
  } catch (error) {
    console.error('❌ Error fetching homestyle:', error.message);
    res.status(500).json({ 
      error: 'Server error fetching homestyle data',
      details: error.message 
    });
  }
});

// Get homestyle by ID
router.get('/:id', async (req, res) => {
  try {
    const homestyle = await Homestyle.findById(req.params.id);
    
    if (!homestyle) {
      return res.status(404).json({ error: 'Homestyle configuration not found' });
    }

    res.json({ 
      success: true,
      data: homestyle
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Create or update homestyle (POST/PUT without ID)
router.post('/', async (req, res) => {
  try {
    console.log('📝 POST /api/homestyles - Request body:', JSON.stringify(req.body, null, 2));
    
    const { tagline, subTagline, videoLinks, substituteVideoLinks, bestseller, categories } = req.body;
    
    // Validate required fields
    if (!tagline || !subTagline) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: 'Tagline and subTagline are required'
      });
    }
    
    if (!videoLinks || videoLinks.length === 0) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: 'At least one video link is required'
      });
    }
    
    // Validate bestseller items - image is optional
    if (bestseller && bestseller.length > 0) {
      for (let item of bestseller) {
        if (!item.id || !item.title || !item.discount) {
          return res.status(400).json({ 
            error: 'Validation error',
            details: 'All bestseller items must have id, title, and discount'
          });
        }
      }
    }
    
    // Validate categories
    if (categories && categories.length > 0) {
      for (let cat of categories) {
        if (!cat.id || !cat.name) {
          return res.status(400).json({ 
            error: 'Validation error',
            details: 'All categories must have id and name'
          });
        }
      }
    }
    
    // Check if homestyle already exists
    let homestyle = await Homestyle.findOne();
    
    if (homestyle) {
      console.log('📝 Updating existing homestyle with ID:', homestyle._id);
      // Update existing
      homestyle = await Homestyle.findByIdAndUpdate(
        homestyle._id,
        { 
          tagline, 
          subTagline, 
          videoLinks: videoLinks || [],
          substituteVideoLinks: substituteVideoLinks || [],
          bestseller: bestseller || [],
          categories: categories || [],
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );
    } else {
      console.log('📝 Creating new homestyle');
      // Create new
      homestyle = new Homestyle({
        tagline, 
        subTagline, 
        videoLinks: videoLinks || [],
        substituteVideoLinks: substituteVideoLinks || [],
        bestseller: bestseller || [],
        categories: categories || []
      });
      await homestyle.save();
    }

    console.log('✅ Homestyle saved successfully:', homestyle._id);
    res.json({ 
      success: true,
      message: 'Homestyle saved successfully',
      data: homestyle
    });
  } catch (error) {
    console.error('❌ Error saving homestyle:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation error',
        details: validationErrors.join(', ')
      });
    }
    
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Update homestyle (PUT without ID)
router.put('/', async (req, res) => {
  try {
    console.log('📝 PUT /api/homestyles - Request body:', JSON.stringify(req.body, null, 2));
    
    const { tagline, subTagline, videoLinks, substituteVideoLinks, bestseller, categories } = req.body;
    
    // Validate required fields
    if (!tagline || !subTagline) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: 'Tagline and subTagline are required'
      });
    }
    
    if (!videoLinks || videoLinks.length === 0) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: 'At least one video link is required'
      });
    }
    
    // Find existing or create new
    let homestyle = await Homestyle.findOne();
    
    if (homestyle) {
      console.log('📝 Updating existing homestyle with ID:', homestyle._id);
      homestyle = await Homestyle.findByIdAndUpdate(
        homestyle._id,
        { 
          tagline, 
          subTagline, 
          videoLinks: videoLinks || [],
          substituteVideoLinks: substituteVideoLinks || [],
          bestseller: bestseller || [],
          categories: categories || [],
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );
    } else {
      console.log('📝 Creating new homestyle');
      homestyle = new Homestyle({
        tagline, 
        subTagline, 
        videoLinks: videoLinks || [],
        substituteVideoLinks: substituteVideoLinks || [],
        bestseller: bestseller || [],
        categories: categories || []
      });
      await homestyle.save();
    }

    console.log('✅ Homestyle updated successfully:', homestyle._id);
    res.json({ 
      success: true,
      message: 'Homestyle updated successfully',
      data: homestyle
    });
  } catch (error) {
    console.error('❌ Error updating homestyle:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation error',
        details: validationErrors.join(', ')
      });
    }
    
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

module.exports = router;