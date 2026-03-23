import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './authcontext';
import { authAPI } from './api';

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load wallet balance from user data
  useEffect(() => {
    if (user) {
      loadWalletBalance();
    }
  }, [user]);

  const loadWalletBalance = async (retryCount = 0) => {
    try {
      setLoading(true);
      // Get wallet balance from user profile (most reliable)
      console.log('💳 Loading wallet balance...');
      const response = await authAPI.getProfile();
      const walletAmount = response.data?.user?.walletBalance || 0;
      console.log('✅ Wallet loaded:', walletAmount);
      setWalletBalance(walletAmount);
      
      // Update stored user data with latest wallet balance
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.walletBalance = walletAmount;
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
      }
      
      // Cache the successful balance fetch
      await AsyncStorage.setItem('cachedWalletBalance', JSON.stringify({
        balance: walletAmount,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ Error loading wallet balance:', error.message);
      
      // Check if it's an authentication error
      if (error.response?.status === 401) {
        console.log('ℹ️ User not authenticated yet, using cached wallet');
      } else if (retryCount < 2) {
        // Retry once on network errors
        console.log(`🔄 Retrying wallet load (attempt ${retryCount + 2}/3)...`);
        setTimeout(() => loadWalletBalance(retryCount + 1), 1500);
        return;
      }
      
      // If profile fails, try to get from AsyncStorage as fallback
      try {
        // First try recent cache
        const cachedBalance = await AsyncStorage.getItem('cachedWalletBalance');
        if (cachedBalance) {
          const { balance: cachedAmt } = JSON.parse(cachedBalance);
          console.log('⚠️ Using recently cached wallet balance:', cachedAmt);
          setWalletBalance(cachedAmt);
        } else {
          // Fallback to user data
          const storedUser = await AsyncStorage.getItem('userData');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            const fallbackBalance = userData.walletBalance || 0;
            console.log('⚠️ Using stored user wallet balance:', fallbackBalance);
            setWalletBalance(fallbackBalance);
          }
        }
      } catch (storageError) {
        console.error('❌ Storage fallback failed:', storageError.message);
        setWalletBalance(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const addToWallet = async (amount) => {
    try {
      // Update wallet locally
      const newBalance = walletBalance + amount;
      setWalletBalance(newBalance);

      // Update in AsyncStorage
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.walletBalance = newBalance;
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
      }

      return { success: true, balance: newBalance };
    } catch (error) {
      console.error('Error adding to wallet:', error);
      return { success: false, error };
    }
  };

  const removeFromWallet = async (amount) => {
    try {
      if (walletBalance < amount) {
        return { success: false, error: 'Insufficient wallet balance' };
      }

      const newBalance = walletBalance - amount;
      setWalletBalance(newBalance);

      // Update in AsyncStorage
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.walletBalance = newBalance;
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
      }

      return { success: true, balance: newBalance };
    } catch (error) {
      console.error('Error removing from wallet:', error);
      return { success: false, error };
    }
  };

  const refreshWallet = async () => {
    await loadWalletBalance();
  };

  return (
    <WalletContext.Provider value={{
      walletBalance,
      loading,
      addToWallet,
      removeFromWallet,
      refreshWallet
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
