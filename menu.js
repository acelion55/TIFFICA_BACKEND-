const express = require('express');
const router = express.Router();
const MenuItem = require('./menuitems');
const CloudKitchen = require('./cloudkitchen');
const auth = require('./authmiddle');
const User = require('./user'); 

// Get menu items by user's current location (5km radius)
router.get('/by-location', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user || !user.currentLocation || !user.currentLocation.latitude || !user.currentLocation.longitude) {
      return res.status(400).json({ error: 'User location not set' });
    }

    const { latitude, longitude } = user.currentLocation;
    const maxDistance = 5000; // 5km in meters

    // Find nearby cloud kitchens
    const nearbyKitchens = await CloudKitchen.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      }
    });

    if (nearbyKitchens.length === 0) {
      return res.json({
        success: true,
        message: 'No cloud kitchens found within 5km',
        items: []
      });
    }

    const kitchenIds = nearbyKitchens.map(k => k._id);

    // Get menu items from nearby kitchens with kitchen details
    const items = await MenuItem.find({
      cloudKitchen: { $in: kitchenIds },
      isAvailable: true
    }).populate('cloudKitchen', 'name location');

    res.json({
      success: true,
      userLocation: {
        latitude,
        longitude,
        locationName: user.currentLocation.locationName
      },
      nearbyKitchensCount: nearbyKitchens.length,
      itemsCount: items.length,
      items: items.map(item => ({
        _id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        discount: item.discount || 0,
        image: item.image,
        category: item.category,
        mealType: item.mealType,
        rating: item.rating,
        availableQuantity: item.availableQuantity,
        availableUntil: item.availableUntil,
        cloudKitchen: item.cloudKitchen ? {
          _id: item.cloudKitchen._id,
          name: item.cloudKitchen.name,
          location: item.cloudKitchen.location
        } : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching items by location' });
  }
});

// Main Menu Route with Filtering logic
router.get('/', async (req, res) => {
  const { category, admin, random } = req.query; 
  let query = admin ? {} : { isAvailable: true }; 

  try {
    if (category) {
      if (category === '1') {
        // Special Category
        query.isSpecial = true;
      } 
      else if (category === '5') {
        // Under 79 (Price logic)
        query.price = { $lt: 79 };
      } 
      else {
        // ID ko Database string mein badlo
        const categoryMap = {
          '2': 'Lunch',
          '3': 'Dinner',
          '4': 'Breakfast'
        };
        
        const dbValue = categoryMap[category];
        if (dbValue) {
          // Schema mein 'mealType' field hai, wahi use karo
          query.mealType = { $regex: new RegExp(`^${dbValue}$`, 'i') };
        }
      }
    }

    let items;
    if (random === 'true') {
      // Use aggregation for random results
      items = await MenuItem.aggregate([
        { $match: query },
        { $sample: { size: 20 } } // Get up to 20 random items
      ]);
    } else {
      items = await MenuItem.find(query).sort({ createdAt: -1 });
    }
    
    res.json({ 
      items: items.map(item => ({
        _id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        discount: item.discount || 0,
        image: item.image,
        category: item.category,
        mealType: item.mealType,
        isVeg: item.isVeg,
        rating: item.rating
      }))
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search functionality (isise search bar chalega)
router.get('/search/:query', async (req, res) => {
  try {
    const { query: searchQuery } = req.params;

    const menuItems = await MenuItem.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { ingredients: { $regex: searchQuery, $options: 'i' } }
      ],
      isAvailable: true
    });

    res.json({ menuItems });
  } catch (error) {
    res.status(500).json({ error: 'Server error searching menu' });
  }
});

// Search with location filter (5km radius)
router.get('/search/:query/by-location', auth, async (req, res) => {
  try {
    const { query: searchQuery } = req.params;
    const user = await User.findById(req.userId);
    
    if (!user || !user.currentLocation || !user.currentLocation.latitude || !user.currentLocation.longitude) {
      // If no location, return all search results
      const menuItems = await MenuItem.find({
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { ingredients: { $regex: searchQuery, $options: 'i' } }
        ],
        isAvailable: true
      });
      return res.json({ menuItems });
    }

    const { latitude, longitude } = user.currentLocation;
    const maxDistance = 5000;

    const nearbyKitchens = await CloudKitchen.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: maxDistance
        }
      }
    });

    if (nearbyKitchens.length === 0) {
      return res.json({ menuItems: [] });
    }

    const kitchenIds = nearbyKitchens.map(k => k._id);
    const menuItems = await MenuItem.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { ingredients: { $regex: searchQuery, $options: 'i' } }
      ],
      cloudKitchen: { $in: kitchenIds },
      isAvailable: true
    }).populate('cloudKitchen', 'name location');

    res.json({ menuItems });
  } catch (error) {
    res.status(500).json({ error: 'Server error searching menu' });
  }
});

// Get items by meal type (Breakfast, Lunch, Dinner)
router.get('/mealtype/:mealType', async (req, res) => {
  try {
    const { mealType } = req.params;
    
    console.log('🍽️ Menu by mealType request:', mealType);
    
    // Validate meal type
    const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const capitalizedMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
    
    if (!validMealTypes.includes(capitalizedMealType)) {
      console.log('❌ Invalid meal type:', mealType);
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    const items = await MenuItem.find({
      mealType: capitalizedMealType,
      isAvailable: true
    }).sort({ createdAt: -1 });

    console.log('🍽️ Found items:', items.length);
    if (items.length === 0) {
      console.log('🍽️ No items found. Checking all menu items...');
      const allItems = await MenuItem.find({});
      console.log('🍽️ Total items in DB:', allItems.length);
      console.log('🍽️ Meal types in DB:', [...new Set(allItems.map(i => i.mealType))]);
    }

    res.json({ 
      success: true,
      mealType: capitalizedMealType,
      items: items.map(item => ({
        _id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        discount: item.discount || 0,
        image: item.image,
        category: item.category,
        mealType: item.mealType,
        isVeg: item.isVeg,
        rating: item.rating
      }))
    });
  } catch (error) {
    console.error('❌ Menu by mealType error:', error);
    res.status(500).json({ error: 'Server error fetching meal items' });
  }
});

// Get items by meal type with location (5km radius)
router.get('/mealtype/:mealType/by-location', auth, async (req, res) => {
  try {
    const { mealType } = req.params;
    
    console.log('🍽️ Menu by mealType with location request:', mealType);
    console.log('🍽️ User ID:', req.userId);
    
    // Validate meal type
    const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const capitalizedMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
    
    if (!validMealTypes.includes(capitalizedMealType)) {
      console.log('❌ Invalid meal type:', mealType);
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    const user = await User.findById(req.userId);
    
    console.log('🍽️ User location:', user?.currentLocation);
    
    if (!user || !user.currentLocation || !user.currentLocation.latitude || !user.currentLocation.longitude) {
      console.log('🍽️ No location set, returning all items');
      // If no location, return all items
      const items = await MenuItem.find({
        mealType: capitalizedMealType,
        isAvailable: true
      }).sort({ createdAt: -1 });
      
      console.log('🍽️ Found items (no location):', items.length);
      
      return res.json({
        success: true,
        mealType: capitalizedMealType,
        items: items.map(item => ({
          _id: item._id,
          name: item.name,
          description: item.description,
          price: item.price,
          originalPrice: item.originalPrice,
          discount: item.discount || 0,
          image: item.image,
          category: item.category,
          mealType: item.mealType,
          isVeg: item.isVeg,
          rating: item.rating
        }))
      });
    }

    const { latitude, longitude } = user.currentLocation;
    const maxDistance = 5000; // 5km in meters

    console.log('🍽️ Searching near:', latitude, longitude);

    // Find nearby cloud kitchens
    const nearbyKitchens = await CloudKitchen.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      }
    });

    console.log('🍽️ Nearby kitchens:', nearbyKitchens.length);

    if (nearbyKitchens.length === 0) {
      console.log('🍽️ No nearby kitchens, returning empty');
      return res.json({
        success: true,
        message: 'No cloud kitchens found within 5km',
        mealType: capitalizedMealType,
        items: []
      });
    }

    const kitchenIds = nearbyKitchens.map(k => k._id);

    // Get meal items from nearby kitchens OR items without kitchen assignment
    const items = await MenuItem.find({
      mealType: capitalizedMealType,
      isAvailable: true,
      $or: [
        { cloudKitchen: { $in: kitchenIds } },
        { cloudKitchen: null },
        { cloudKitchen: { $exists: false } }
      ]
    }).populate('cloudKitchen', 'name location').sort({ createdAt: -1 });

    console.log('🍽️ Found items (with location):', items.length);
    
    if (items.length === 0) {
      console.log('🍽️ No items found with location filter. Checking all items...');
      const allItems = await MenuItem.find({ isAvailable: true });
      console.log('🍽️ Total available items in DB:', allItems.length);
      console.log('🍽️ Meal types in DB:', [...new Set(allItems.map(i => i.mealType))]);
      console.log('🍽️ Sample items:', allItems.slice(0, 3).map(i => ({ name: i.name, mealType: i.mealType, kitchen: i.cloudKitchen })));
      
      // Check items for this specific meal type
      const mealTypeItems = await MenuItem.find({ mealType: capitalizedMealType, isAvailable: true });
      console.log(`🍽️ Total ${capitalizedMealType} items in DB:`, mealTypeItems.length);
      if (mealTypeItems.length > 0) {
        console.log('🍽️ Sample Dinner items:', mealTypeItems.slice(0, 3).map(i => ({ 
          name: i.name, 
          kitchen: i.cloudKitchen,
          hasKitchen: !!i.cloudKitchen 
        })));
      }
    }

    res.json({
      success: true,
      mealType: capitalizedMealType,
      userLocation: {
        latitude,
        longitude,
        locationName: user.currentLocation.locationName
      },
      nearbyKitchensCount: nearbyKitchens.length,
      itemsCount: items.length,
      items: items.map(item => ({
        _id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        discount: item.discount || 0,
        image: item.image,
        category: item.category,
        mealType: item.mealType,
        isVeg: item.isVeg,
        rating: item.rating,
        cloudKitchen: item.cloudKitchen ? {
          _id: item.cloudKitchen._id,
          name: item.cloudKitchen.name,
          location: item.cloudKitchen.location
        } : null
      }))
    });
  } catch (error) {
    console.error('❌ Menu by mealType with location error:', error);
    res.status(500).json({ error: 'Server error fetching meal items' });
  }
});

// Get items by category (dal, sabji, raita, roti)
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    // Validate category - allow both lowercase and capitalized versions
    const validCategories = ['dal', 'sabji', 'raita', 'roti'];
    const lowercaseCategory = category.toLowerCase();
    
    if (!validCategories.includes(lowercaseCategory)) {
      return res.status(400).json({ error: 'Invalid category. Valid categories are: dal, sabji, raita, roti' });
    }

    // Case-insensitive query - find items with category matching dal/Dal, sabji/Sabji, etc.
    const items = await MenuItem.find({
      category: { $regex: `^${lowercaseCategory}$`, $options: 'i' },
      isAvailable: true
    }).sort({ createdAt: -1 });

    res.json({ 
      success: true,
      category: lowercaseCategory,
      count: items.length,
      items 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching category items' });
  }
});

// Get random menu items for home display
router.get('/random/:count', async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 3;
    
    const randomItems = await MenuItem.aggregate([
      { $match: { isAvailable: true } },
      { $sample: { size: count } }
    ]);

    res.json({ 
      success: true,
      count: randomItems.length,
      items: randomItems 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching random items' });
  }
});

// Get random menu items with default count
router.get('/random', async (req, res) => {
  try {
    const randomItems = await MenuItem.aggregate([
      { $match: { isAvailable: true } },
      { $sample: { size: 3 } }
    ]);

    res.json({ 
      success: true,
      count: randomItems.length,
      items: randomItems 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching random items' });
  }
});

// Get today's special meals (isTodaySpecial: true)
router.get('/today-special', async (req, res) => {
  try {
    const todaySpecialItems = await MenuItem.find({
      isTodaySpecial: true,
      isAvailable: true
    }).sort({ createdAt: -1 });

    res.json({ 
      success: true,
      count: todaySpecialItems.length,
      items: todaySpecialItems.map(item => ({
        _id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        discount: item.discount || 0,
        image: item.image,
        category: item.category,
        mealType: item.mealType,
        isVeg: item.isVeg,
        rating: item.rating
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching today special items' });
  }
});

// Get today's special meals by user's location (5km radius)
router.get('/today-special/by-location', auth, async (req, res) => {
  try {
    const User = require('./user');
    const user = await User.findById(req.userId);
    
    if (!user || !user.currentLocation || !user.currentLocation.latitude || !user.currentLocation.longitude) {
      // If no location, return all today's special
      const todaySpecialItems = await MenuItem.find({
        isTodaySpecial: true,
        isAvailable: true
      }).populate('cloudKitchen', 'name location').sort({ createdAt: -1 });
      
      return res.json({
        success: true,
        count: todaySpecialItems.length,
        items: todaySpecialItems.map(item => ({
          _id: item._id,
          name: item.name,
          description: item.description,
          price: item.price,
          originalPrice: item.originalPrice,
          discount: item.discount || 0,
          image: item.image,
          category: item.category,
          mealType: item.mealType,
          isVeg: item.isVeg,
          rating: item.rating
        }))
      });
    }

    const { latitude, longitude } = user.currentLocation;
    const maxDistance = 5000; // 5km in meters

    // Find nearby cloud kitchens
    const nearbyKitchens = await CloudKitchen.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      }
    });

    if (nearbyKitchens.length === 0) {
      return res.json({
        success: true,
        message: 'No cloud kitchens found within 5km',
        items: []
      });
    }

    const kitchenIds = nearbyKitchens.map(k => k._id);

    // Get today's special items from nearby kitchens
    const items = await MenuItem.find({
      isTodaySpecial: true,
      cloudKitchen: { $in: kitchenIds },
      isAvailable: true
    }).populate('cloudKitchen', 'name location').sort({ createdAt: -1 });

    res.json({
      success: true,
      userLocation: {
        latitude,
        longitude,
        locationName: user.currentLocation.locationName
      },
      nearbyKitchensCount: nearbyKitchens.length,
      itemsCount: items.length,
      items: items.map(item => ({
        _id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        discount: item.discount || 0,
        image: item.image,
        category: item.category,
        mealType: item.mealType,
        isVeg: item.isVeg,
        rating: item.rating,
        cloudKitchen: item.cloudKitchen ? {
          _id: item.cloudKitchen._id,
          name: item.cloudKitchen.name,
          location: item.cloudKitchen.location
        } : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching today special items' });
  }
});

module.exports = router;