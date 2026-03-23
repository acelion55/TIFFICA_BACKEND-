const express = require('express');
const router = express.Router();

const videoUrl = 'https://videos.pexels.com/video-files/2759484/2759484-hd_1920_1080_25fps.mp4';

const homeContent = {
  tagline: 'Tiffica',
  subTagline: 'Fresh, home-cooked meals, delivered to your door.',
  videoLinks: [videoUrl],
  bestseller: [
    { id: 1, title: 'Classic Thali', discount: '10% OFF', image: 'https://images.unsplash.com/photo-1565557623262-b9a3f2f8e1a2?w=400&h=500&fit=crop' },
    { id: 2, title: 'Paneer Butter Masala', discount: '15% OFF', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=500&fit=crop' },
    { id: 3, title: 'Chicken Biryani', discount: '20% OFF', image: 'https://images.unsplash.com/photo-1589302168068-964604d93617?w=400&h=500&fit=crop' }
  ],
  categories: [
    { id: '1', name: 'North Indian' },
    { id: '2', name: 'South Indian' },
    { id: '3', name: 'Chinese' },
    { id: '4', name: 'Italian' }
  ]
};

router.get('/content', (req, res) => {
  res.json({ data: homeContent });
});

module.exports = router;
