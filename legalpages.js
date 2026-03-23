const express = require('express');
const router = express.Router();
const LegalPage = require('./legalpage');
const User = require('./user');
const auth = require('./authmiddle');

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

// Get legal page by type (Public)
router.get('/:pageType', async (req, res) => {
  try {
    const { pageType } = req.params;
    
    if (!['terms', 'privacy'].includes(pageType)) {
      return res.status(400).json({ error: 'Invalid page type' });
    }

    let page = await LegalPage.findOne({ pageType });

    // Create default if not exists
    if (!page) {
      const defaultContent = pageType === 'terms' 
        ? 'Terms and Conditions\n\nWelcome to our service. By using our app, you agree to these terms.\n\n1. Service Usage\nYou must be 18 years or older to use this service.\n\n2. User Responsibilities\nYou are responsible for maintaining the confidentiality of your account.\n\n3. Payment Terms\nAll payments are processed securely through our payment gateway.\n\n4. Cancellation Policy\nYou can cancel your subscription at any time.\n\n5. Liability\nWe are not liable for any indirect damages arising from the use of our service.'
        : 'Privacy Policy\n\nYour privacy is important to us. This policy explains how we collect and use your data.\n\n1. Information We Collect\nWe collect information you provide when creating an account, including name, email, and phone number.\n\n2. How We Use Your Information\nWe use your information to provide and improve our services.\n\n3. Data Security\nWe implement security measures to protect your personal information.\n\n4. Third-Party Services\nWe may use third-party services for payment processing and analytics.\n\n5. Your Rights\nYou have the right to access, update, or delete your personal information.\n\n6. Contact Us\nFor privacy concerns, contact us at support@tiffica.com';

      page = new LegalPage({
        pageType,
        title: pageType === 'terms' ? 'Terms and Conditions' : 'Privacy Policy',
        content: defaultContent
      });
      await page.save();
    }

    res.json({
      success: true,
      data: page
    });
  } catch (error) {
    console.error('❌ Error fetching legal page:', error);
    res.status(500).json({ error: 'Server error fetching page' });
  }
});

// Get all legal pages (Admin)
router.get('/', async (req, res) => {
  try {
    const pages = await LegalPage.find().sort({ pageType: 1 });
    res.json({
      success: true,
      data: pages
    });
  } catch (error) {
    console.error('❌ Error fetching legal pages:', error);
    res.status(500).json({ error: 'Server error fetching pages' });
  }
});

// Update legal page (Admin only)
router.put('/:pageType', auth, checkAdmin, async (req, res) => {
  try {
    const { pageType } = req.params;
    const { title, content } = req.body;

    if (!['terms', 'privacy'].includes(pageType)) {
      return res.status(400).json({ error: 'Invalid page type' });
    }

    if (!title || !content) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: 'Title and content are required' 
      });
    }

    let page = await LegalPage.findOne({ pageType });

    if (page) {
      page.title = title;
      page.content = content;
      page.lastUpdated = new Date();
      page.updatedBy = req.userId;
      await page.save();
    } else {
      page = new LegalPage({
        pageType,
        title,
        content,
        updatedBy: req.userId
      });
      await page.save();
    }

    console.log('✅ Legal page updated:', pageType);

    res.json({
      success: true,
      message: 'Page updated successfully',
      data: page
    });
  } catch (error) {
    console.error('❌ Error updating legal page:', error);
    res.status(500).json({ error: 'Server error updating page' });
  }
});

module.exports = router;
