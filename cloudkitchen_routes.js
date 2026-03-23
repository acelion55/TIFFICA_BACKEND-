const express = require('express');
const router = express.Router();
const CloudKitchen = require('./cloudkitchen');

// Get nearby cloud kitchens
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 5000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const kitchens = await CloudKitchen.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      },
    }).limit(10);

    // Calculate distance for each kitchen
    const kitchensWithDistance = kitchens.map((kitchen) => {
      const [kLng, kLat] = kitchen.location.coordinates;
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        kLat,
        kLng
      );
      return {
        ...kitchen.toObject(),
        distance,
      };
    });

    res.json({
      success: true,
      kitchens: kitchensWithDistance,
      count: kitchensWithDistance.length,
    });
  } catch (error) {
    console.error('Error fetching nearby kitchens:', error);
    res.status(500).json({ error: 'Failed to fetch nearby kitchens' });
  }
});

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = router;
