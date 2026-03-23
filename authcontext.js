import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from './api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('userData');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async (email, password) => {
    try {
      console.log('🔐 Attempting password login...');
      const response = await authAPI.loginWithPassword(email, password);
      console.log('✅ Password login response:', response.data);

      const { token: newToken, user: userData } = response.data;

      await AsyncStorage.setItem('authToken', newToken);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('❌ Password login error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  const loginWithOtp = async (email, otp) => {
    try {
      console.log('🔐 Attempting login with OTP...');

      const response = await authAPI.loginWithOtp(email, otp);
      console.log('✅ Login response:', response.data);

      const { token: newToken, user: userData } = response.data;

      await AsyncStorage.setItem('authToken', newToken);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('❌ Login error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  const loginWithGoogle = async (googleUser) => {
    try {
      console.log('🔐 Attempting Google login...');
      const response = await authAPI.loginWithGoogle({
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.id,
      });
      
      const { token: newToken, user: userData } = response.data;
      await AsyncStorage.setItem('authToken', newToken);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      setToken(newToken);
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Google login error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || 'Google login failed',
      };
    }
  };

  const register = async (data) => {
    try {
      const response = await authAPI.register(data);
      const { token: newToken, user: userData } = response.data;

      await AsyncStorage.setItem('authToken', newToken);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('❌ Registration error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateUser = async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      const updatedUser = response.data.user;

      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Update failed',
      };
    }
  };

  const updateUserLocation = async (locationData) => {
    try {
      const response = await authAPI.updateLocation(locationData);
      const updatedUser = response.data.user;

      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);

      return { success: true };
    } catch (error) {
      console.error('Location update error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Location update failed',
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginWithOtp,
        loginWithPassword,
        loginWithGoogle,
        register,
        logout,
        updateUser,
        updateUserLocation,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthProvider;