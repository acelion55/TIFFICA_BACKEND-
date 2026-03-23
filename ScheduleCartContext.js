import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscriptionOrderAPI } from './api';
import { useAuth } from './authcontext';

const ScheduleCartContext = createContext();

export const ScheduleCartProvider = ({ children }) => {
  const [scheduleCart, setScheduleCart] = useState({});
  const [lockedMeals, setLockedMeals] = useState({});
  const [mealAddresses, setMealAddresses] = useState({}); // Store address for each meal
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load cart from local storage on mount
  useEffect(() => {
    loadCartFromStorage();
  }, []);

  // Load locked meals only when user is authenticated
  useEffect(() => {
    if (user) {
      loadLockedMeals();
    } else {
      setLockedMeals({});
    }
  }, [user]);

  const loadCartFromStorage = async () => {
    try {
      const savedCart = await AsyncStorage.getItem('scheduleCart');
      if (savedCart) {
        setScheduleCart(JSON.parse(savedCart));
        console.log('✅ Schedule cart loaded from storage');
      }
    } catch (error) {
      console.error('❌ Error loading schedule cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCartToStorage = async () => {
    try {
      await AsyncStorage.setItem('scheduleCart', JSON.stringify(scheduleCart));
      console.log('✅ Schedule cart saved to storage');
    } catch (error) {
      console.error('❌ Error saving schedule cart:', error);
    }
  };

  // Load locked meals from server with caching and retry
  const loadLockedMeals = async () => {
    try {
      const today = new Date();
      const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days back so next day still shows
      const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead
      
      const response = await subscriptionOrderAPI.getMyLocks({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      if (response.data && response.data.subscriptionOrders) {
        const locked = {};
        response.data.subscriptionOrders.forEach((order) => {
          const key = `${order.date.split('T')[0]}_${order.mealType.toLowerCase()}`;
          locked[key] = order;
        });
        setLockedMeals(locked);
        
        // Cache locked meals for offline use
        await AsyncStorage.setItem('cachedLockedMeals', JSON.stringify({
          data: locked,
          timestamp: new Date().toISOString()
        }));
        console.log('✅ Locked meals loaded from server and cached', locked);
      }
    } catch (error) {
      // Attempt to load from cache on network error
      try {
        const cachedData = await AsyncStorage.getItem('cachedLockedMeals');
        if (cachedData) {
          const { data: cached } = JSON.parse(cachedData);
          setLockedMeals(cached);
          console.log('⚠️ Using cached locked meals due to network error', cached);
          return;
        }
      } catch (cacheError) {
        console.log('ℹ️ No cached locked meals available');
      }

      // Gracefully handle errors - might be no locked meals yet
      if (error.response?.status === 404 || error.response?.status === 400) {
        console.log('ℹ️ No locked meals found yet (first time)');
      } else if (error.response?.status === 401) {
        console.log('ℹ️ User not authenticated yet, skipping locked meals');
      } else {
        console.error('❌ Error loading locked meals:', error.message);
      }
      setLockedMeals({});
    }
  };

  // Create unique key for date + meal type combination
  const getCartKey = (date, mealType) => {
    return `${date}_${mealType.toLowerCase()}`;
  };

  // Add item to specific date and meal type
  const addToMealCart = (date, mealType, item) => {
    const key = getCartKey(date, mealType);
    setScheduleCart((prevCart) => {
      const mealCart = prevCart[key] || [];
      const existingItem = mealCart.find((cartItem) => cartItem._id === item._id);

      const updatedMealCart = existingItem
        ? mealCart.map((cartItem) =>
            cartItem._id === item._id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          )
        : [...mealCart, { ...item, quantity: 1 }];

      return {
        ...prevCart,
        [key]: updatedMealCart,
      };
    });
  };

  // Remove item from specific meal
  const removeFromMealCart = (date, mealType, itemId) => {
    const key = getCartKey(date, mealType);
    setScheduleCart((prevCart) => ({
      ...prevCart,
      [key]: (prevCart[key] || []).filter((item) => item._id !== itemId),
    }));
  };

  // Update quantity
  const updateMealCartQuantity = (date, mealType, itemId, quantity) => {
    const key = getCartKey(date, mealType);
    if (quantity < 1) {
      removeFromMealCart(date, mealType, itemId);
      return;
    }
    setScheduleCart((prevCart) => ({
      ...prevCart,
      [key]: (prevCart[key] || []).map((item) =>
        item._id === itemId ? { ...item, quantity } : item
      ),
    }));
  };

  // Get cart for specific date and meal
  const getMealCart = (date, mealType) => {
    const key = getCartKey(date, mealType);
    return scheduleCart[key] || [];
  };

  // Get total items in specific meal cart
  const getMealCartTotal = (date, mealType) => {
    const cart = getMealCart(date, mealType);
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  // Get total price for specific meal cart
  const getMealCartPrice = (date, mealType) => {
    const cart = getMealCart(date, mealType);
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  // Clear specific meal cart
  const clearMealCart = (date, mealType) => {
    const key = getCartKey(date, mealType);
    setScheduleCart((prevCart) => {
      const newCart = { ...prevCart };
      delete newCart[key];
      return newCart;
    });
  };

  // Clear all carts
  const clearAllCarts = async () => {
    setScheduleCart({});
    try {
      await AsyncStorage.removeItem('scheduleCart');
    } catch (error) {
      console.error('❌ Error clearing carts:', error);
    }
  };

  // Set address for a specific meal
  const setMealAddress = (date, mealType, addressId) => {
    const key = getCartKey(date, mealType);
    setMealAddresses((prev) => ({
      ...prev,
      [key]: addressId
    }));
  };

  // Get address for a specific meal
  const getMealAddress = (date, mealType) => {
    const key = getCartKey(date, mealType);
    return mealAddresses[key] || null;
  };

  // Lock meal items for a specific date and meal type
  const lockMeal = async (date, mealType) => {
    try {
      const key = getCartKey(date, mealType);
      const cartItems = scheduleCart[key] || [];
      const addressId = mealAddresses[key];

      if (cartItems.length === 0) {
        throw new Error('Cart is empty. Please add items before locking.');
      }

      if (!addressId) {
        throw new Error('Please select a delivery address before locking.');
      }

      // Prepare items for API
      const items = cartItems.map((item) => ({
        menuItemId: item._id,
        quantity: item.quantity
      }));

      console.log('🔒 Locking Meal - Request Data:');
      console.log('   Date:', date);
      console.log('   ISO Date:', new Date(date).toISOString());
      console.log('   Meal Type:', mealType);
      console.log('   Address:', addressId);
      console.log('   Items:', JSON.stringify(items, null, 2));

      // Call API to lock meal
      const response = await subscriptionOrderAPI.lockMeal({
        date: new Date(date).toISOString(),
        mealType,
        items,
        addressId
      });

      console.log('✅ Lock Response:', response.data);

      // Update locked meals state
      setLockedMeals((prevLocked) => ({
        ...prevLocked,
        [key]: response.data.subscriptionOrder
      }));

      // Clear cart after locking
      clearMealCart(date, mealType);

      console.log(`✅ Meal locked: ${mealType} on ${date}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error locking meal:');
      console.error('   Type:', error.response?.status, error.response?.statusText);
      console.error('   Message:', error.message);
      console.error('   Response Data:', error.response?.data);
      console.error('   Full Error:', error);
      throw error;
    }
  };

  // Unlock a locked meal
  const unlockMeal = async (date, mealType) => {
    try {
      const key = getCartKey(date, mealType);
      const lockedMeal = lockedMeals[key];

      if (!lockedMeal) {
        throw new Error('No locked meal found for this date and meal type');
      }

      // Call API to unlock meal
      await subscriptionOrderAPI.unlockMeal(lockedMeal._id);

      // Remove from locked meals state
      setLockedMeals((prevLocked) => {
        const newLocked = { ...prevLocked };
        delete newLocked[key];
        return newLocked;
      });

      // Add items back to cart
      lockedMeal.items.forEach((item) => {
        addToMealCart(date, mealType, {
          _id: item.menuItem._id,
          name: item.menuItem.name,
          price: item.price,
          image: item.menuItem.image,
          quantity: item.quantity
        });
      });

      console.log(`✅ Meal unlocked: ${mealType} on ${date}`);
    } catch (error) {
      console.error('❌ Error unlocking meal:', error);
      throw error;
    }
  };

  // Check if meal is locked
  const isMealLocked = (date, mealType) => {
    const key = getCartKey(date, mealType);
    return !!lockedMeals[key];
  };

  // Get locked meal details
  const getLockedMeal = (date, mealType) => {
    const key = getCartKey(date, mealType);
    return lockedMeals[key] || null;
  };

  return (
    <ScheduleCartContext.Provider
      value={{
        scheduleCart,
        addToMealCart,
        removeFromMealCart,
        updateMealCartQuantity,
        getMealCart,
        getMealCartTotal,
        getMealCartPrice,
        clearMealCart,
        clearAllCarts,
        lockMeal,
        unlockMeal,
        isMealLocked,
        getLockedMeal,
        lockedMeals,
        setMealAddress,
        getMealAddress,
        mealAddresses,
        loading,
      }}
    >
      {children}
    </ScheduleCartContext.Provider>
  );
};

export const useScheduleCart = () => {
  const context = useContext(ScheduleCartContext);
  if (!context) {
    throw new Error('useScheduleCart must be used within ScheduleCartProvider');
  }
  return context;
};
