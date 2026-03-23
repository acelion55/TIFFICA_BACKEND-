const express = require('express');
const router = express.Router();
const SubscriptionCard = require('./subscriptioncard');
const User = require('./user');
const auth = require('./authmiddle');
const asyncHandler = require('./asynchandler');

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

// GET all subscription cards
router.get('/', asyncHandler(async (req, res) => {
  const cards = await SubscriptionCard.find().sort({ cardId: 1 });
  
  // If no cards exist, create defaults
  if (cards.length === 0) {
    const defaultCards = [
      {
        cardId: 1,
        title: 'Basic Plan',
        price: '₹99',
        description: 'Perfect for starters',
        icon: 'star',
        color: '#5B5FED',
        growth: '+5%'
      },
      {
        cardId: 2,
        title: 'Premium Plan',
        price: '₹199',
        description: 'Most popular choice',
        icon: 'flame',
        color: '#FF6B9D',
        growth: '+85%'
      },
      {
        cardId: 3,
        title: 'Elite Plan',
        price: '₹299',
        description: 'For power users',
        icon: 'crown',
        color: '#4ECDC4',
        growth: '+34%'
      }
    ];
    
    await SubscriptionCard.insertMany(defaultCards);
    return res.json({
      success: true,
      data: defaultCards,
      message: 'Default cards created'
    });
  }
  
  res.json({
    success: true,
    data: cards
  });
}));

// GET single card
router.get('/:id', asyncHandler(async (req, res) => {
  const card = await SubscriptionCard.findById(req.params.id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }
  res.json({
    success: true,
    data: card
  });
}));

// UPDATE card (Admin only)
router.put('/:id', auth, checkAdmin, asyncHandler(async (req, res) => {
  const { title, price, description, icon, color, growth, savings } = req.body;

  if (!title || !price || !description) {
    return res.status(400).json({
      error: 'Validation error',
      details: 'Title, price, and description are required'
    });
  }

  const card = await SubscriptionCard.findByIdAndUpdate(
    req.params.id,
    { title, price, description, icon, color, growth, savings },
    { new: true, runValidators: true }
  );

  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  res.json({
    success: true,
    message: 'Card updated successfully',
    data: card
  });
}));

// UPDATE all cards (Admin only) - Bulk update
router.put('/', auth, checkAdmin, asyncHandler(async (req, res) => {
  const { cards } = req.body;

  if (!Array.isArray(cards)) {
    return res.status(400).json({
      error: 'Validation error',
      details: 'Cards must be an array'
    });
  }

  const updatedCards = [];
  
  for (const cardData of cards) {
    const { id, title, price, description, icon, color, growth, savings } = cardData;
    
    if (!id || !title || !price || !description) {
      return res.status(400).json({
        error: 'Validation error',
        details: 'Each card must have id, title, price, and description'
      });
    }

    const updated = await SubscriptionCard.findByIdAndUpdate(
      id,
      { title, price, description, icon, color, growth, savings },
      { new: true, runValidators: true }
    );
    
    if (updated) {
      updatedCards.push(updated);
    }
  }

  res.json({
    success: true,
    message: 'All cards updated successfully',
    data: updatedCards
  });
}));

module.exports = router;
