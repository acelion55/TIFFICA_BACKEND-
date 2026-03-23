const express = require('express');
const router = express.Router();
const PageStyle = require('./pagestyles');
const auth = require('./authmiddle');
const User = require('./user');

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

// Get all page styles
router.get('/', async (req, res) => {
  try {
    const pageStyles = await PageStyle.find().sort({ pageNumber: 1 });

    res.json({ 
      success: true,
      data: pageStyles
    });
  } catch (error) {
    console.error('❌ Error fetching page styles:', error.message);
    res.status(500).json({ 
      error: 'Server error fetching page styles',
      details: error.message 
    });
  }
});

// Get specific page style by page number
router.get('/page/:pageNumber', async (req, res) => {
  try {
    const pageNumber = parseInt(req.params.pageNumber);
    
    if (![1, 2, 3, 4].includes(pageNumber)) {
      return res.status(400).json({ error: 'Invalid page number. Must be 1, 2, 3, or 4' });
    }

    const pageStyle = await PageStyle.findOne({ pageNumber });
    
    if (!pageStyle) {
      return res.status(404).json({ error: `Page ${pageNumber} style not found` });
    }

    res.json({ 
      success: true,
      data: pageStyle
    });
  } catch (error) {
    console.error('❌ Error fetching page style:', error.message);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Get page style by ID
router.get('/:id', async (req, res) => {
  try {
    const pageStyle = await PageStyle.findById(req.params.id);
    
    if (!pageStyle) {
      return res.status(404).json({ error: 'Page style not found' });
    }

    res.json({ 
      success: true,
      data: pageStyle
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Create page style (Admin only)
router.post('/', auth, checkAdmin, async (req, res) => {
  try {
    console.log('📝 POST /api/pagestyles - Request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      pageNumber, 
      pageName,
      tagline, 
      subTagline,
      backgroundColor,
      textColor,
      accentColor,
      videoLinks, 
      substituteVideoLinks, 
      bestseller, 
      categories,
      bannerImage,
      bannerTitle,
      bannerDescription,
      isActive
    } = req.body;
    
    // Validate required fields
    if (!pageNumber || ![1, 2, 3, 4].includes(pageNumber)) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: 'Page number must be 1, 2, 3, or 4'
      });
    }

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
    
    // Check if page already exists
    const existingPage = await PageStyle.findOne({ pageNumber });
    if (existingPage) {
      return res.status(400).json({ 
        error: 'Page already exists',
        details: `Page ${pageNumber} already has a style configuration`
      });
    }
    
    // Validate bestseller items
    if (bestseller && bestseller.length > 0) {
      for (let item of bestseller) {
        if (!item.id || !item.title || !item.discount || !item.image) {
          return res.status(400).json({ 
            error: 'Validation error',
            details: 'All bestseller items must have id, title, discount, and image'
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
    
    const pageStyle = new PageStyle({
      pageNumber,
      pageName: pageName || `Page ${pageNumber}`,
      tagline, 
      subTagline,
      backgroundColor: backgroundColor || '#FFFFFF',
      textColor: textColor || '#000000',
      accentColor: accentColor || '#FF6B35',
      videoLinks: videoLinks || [],
      substituteVideoLinks: substituteVideoLinks || [],
      bestseller: bestseller || [],
      categories: categories || [],
      bannerImage: bannerImage || '',
      bannerTitle: bannerTitle || '',
      bannerDescription: bannerDescription || '',
      isActive: isActive !== undefined ? isActive : true
    });

    await pageStyle.save();

    console.log('✅ Page style created successfully:', pageStyle._id);
    res.status(201).json({ 
      success: true,
      message: `Page ${pageNumber} style created successfully`,
      data: pageStyle
    });
  } catch (error) {
    console.error('❌ Error creating page style:', error);
    
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

// Update page style (Admin only)
router.put('/:id', auth, checkAdmin, async (req, res) => {
  try {
    console.log('📝 PUT /api/pagestyles/:id - Request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      tagline, 
      subTagline,
      backgroundColor,
      textColor,
      accentColor,
      videoLinks, 
      substituteVideoLinks, 
      bestseller, 
      categories,
      bannerImage,
      bannerTitle,
      bannerDescription,
      isActive
    } = req.body;
    
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
    
    // Validate bestseller items
    if (bestseller && bestseller.length > 0) {
      for (let item of bestseller) {
        if (!item.id || !item.title || !item.discount || !item.image) {
          return res.status(400).json({ 
            error: 'Validation error',
            details: 'All bestseller items must have id, title, discount, and image'
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

    const pageStyle = await PageStyle.findByIdAndUpdate(
      req.params.id,
      { 
        tagline, 
        subTagline,
        backgroundColor: backgroundColor || '#FFFFFF',
        textColor: textColor || '#000000',
        accentColor: accentColor || '#FF6B35',
        videoLinks: videoLinks || [],
        substituteVideoLinks: substituteVideoLinks || [],
        bestseller: bestseller || [],
        categories: categories || [],
        bannerImage: bannerImage || '',
        bannerTitle: bannerTitle || '',
        bannerDescription: bannerDescription || '',
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!pageStyle) {
      return res.status(404).json({ error: 'Page style not found' });
    }

    console.log('✅ Page style updated successfully:', pageStyle._id);
    res.json({ 
      success: true,
      message: 'Page style updated successfully',
      data: pageStyle
    });
  } catch (error) {
    console.error('❌ Error updating page style:', error);
    
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

// Update page style by page number (Admin only)
router.put('/page/:pageNumber', auth, checkAdmin, async (req, res) => {
  try {
    const pageNumber = parseInt(req.params.pageNumber);
    
    if (![1, 2, 3, 4].includes(pageNumber)) {
      return res.status(400).json({ error: 'Invalid page number. Must be 1, 2, 3, or 4' });
    }

    const { 
      tagline, 
      subTagline,
      backgroundColor,
      textColor,
      accentColor,
      videoLinks, 
      substituteVideoLinks, 
      bestseller, 
      categories,
      bannerImage,
      bannerTitle,
      bannerDescription,
      isActive
    } = req.body;
    
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

    const pageStyle = await PageStyle.findOneAndUpdate(
      { pageNumber },
      { 
        tagline, 
        subTagline,
        backgroundColor: backgroundColor || '#FFFFFF',
        textColor: textColor || '#000000',
        accentColor: accentColor || '#FF6B35',
        videoLinks: videoLinks || [],
        substituteVideoLinks: substituteVideoLinks || [],
        bestseller: bestseller || [],
        categories: categories || [],
        bannerImage: bannerImage || '',
        bannerTitle: bannerTitle || '',
        bannerDescription: bannerDescription || '',
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!pageStyle) {
      return res.status(404).json({ error: `Page ${pageNumber} style not found` });
    }

    console.log('✅ Page style updated successfully:', pageStyle._id);
    res.json({ 
      success: true,
      message: `Page ${pageNumber} style updated successfully`,
      data: pageStyle
    });
  } catch (error) {
    console.error('❌ Error updating page style:', error);
    
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

// Delete page style (Admin only)
router.delete('/:id', auth, checkAdmin, async (req, res) => {
  try {
    const pageStyle = await PageStyle.findByIdAndDelete(req.params.id);
    
    if (!pageStyle) {
      return res.status(404).json({ error: 'Page style not found' });
    }

    console.log('✅ Page style deleted successfully:', pageStyle._id);
    res.json({ 
      success: true,
      message: 'Page style deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting page style:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

module.exports = router;
