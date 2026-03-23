import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config.js';

console.log('🔗 API Client initialized with:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Increased from 10000ms to 30000ms for better reliability
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track retry attempts to prevent infinite loops
let retryAttempts = {};

// Response interceptor with retry logic
api.interceptors.response.use(
  (response) => {
    // Clear retry count on success
    const key = `${response.config.method}_${response.config.url}`;
    retryAttempts[key] = 0;
    return response;
  },
  async (error) => {
    const config = error.config;
    const key = `${config.method}_${config.url}`;
    const currentAttempt = retryAttempts[key] || 0;
    const maxRetries = 3;
    
    // Log network error details for debugging
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Request timeout:', error.message);
    } else if (error.message === 'Network Error') {
      console.error('🌐 Network Error - Check API URL:', API_URL);
      console.error('   Details:', error.config?.url, error.code);
    } else if (error.response) {
      console.error(`❌ API Error ${error.response.status}:`, error.response.statusText);
    }
    
    // Retry on network errors and timeouts (but not on auth errors)
    if (
      !error.response &&
      (error.code === 'ECONNABORTED' || error.message === 'Network Error') &&
      currentAttempt < maxRetries &&
      config.method?.toLowerCase() === 'get' // Only retry GET requests
    ) {
      retryAttempts[key] = currentAttempt + 1;
      console.log(`🔄 Retrying request (attempt ${currentAttempt + 1}/${maxRetries})...`);
      
      // Exponential backoff: wait before retrying
      const delay = Math.min(1000 * Math.pow(2, currentAttempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return api(config);
    }
    
    if (error.response?.status === 401) {
      console.log('🔓 Clearing auth tokens due to 401');
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
    
    retryAttempts[key] = 0;
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  sendOtp: (email) => api.post('/auth/send-otp', { email }),
  loginWithOtp: (email, otp) => api.post('/auth/login-otp', { email, otp }),
  loginWithPassword: (email, password) => api.post('/auth/login-password', { email, password }),
  loginWithGoogle: (data) => api.post('/auth/google-login', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  updateLocation: (data) => api.put('/auth/location', data),

  // ✅ Address APIs
  addAddress: (data) => api.post('/auth/addaddress', data),
  getAddresses: () => api.get('/auth/addresses'),
  updateAddress: (addressId, data) => api.put(`/auth/address/${addressId}`, data),
  deleteAddress: (addressId) => api.delete(`/auth/address/${addressId}`),
  setDefaultAddress: (addressId) => api.patch(`/auth/address/${addressId}/set-default`),

  // ✅ Wallet APIs
  getWalletBalance: () => {
    console.log('🔄 Fetching wallet balance from /auth/wallet/balance');
    return api.get('/auth/wallet/balance');
  },
};

// Menu APIs
export const menuAPI = {
  getAll: (params) => api.get('/menu', { params }),
  getSpecials: () => api.get('/menu/specials'),
  getUpcoming: () => api.get('/menu/upcoming'),
  getById: (id) => api.get(`/menu/${id}`),
  search: (query) => api.get(`/menu/search/${query}`),
  getMealsByType: (mealType) => api.get(`/menu/mealtype/${mealType}`),
  // Collection APIs
  getDal: () => api.get('/menu/category/dal'),
  getSabji: () => api.get('/menu/category/sabji'),
  getRaita: () => api.get('/menu/category/raita'),
  getRoti: () => api.get('/menu/category/roti'),
  getByCategory: (category) => api.get(`/menu/category/${category}`),
};

// Cloud Kitchen APIs
export const cloudKitchenAPI = {
  getNearby: (latitude, longitude, maxDistance = 5000) => 
    api.get('/cloudkitchens/nearby', { params: { latitude, longitude, maxDistance } }),
  getAll: () => api.get('/cloudkitchens'),
  getById: (id) => api.get(`/cloudkitchens/${id}`),
};

// Order APIs
export const orderAPI = {
  create: (data) => api.post('/orders', data),
  getMyOrders: (params) => api.get('/orders/my-orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  reorder: (id, data) => api.post(`/orders/${id}/reorder`, data),
  cancel: (id) => api.patch(`/orders/${id}/cancel`),
  addReview: (id, data) => api.patch(`/orders/${id}/review`, data),
};

// Payment APIs (Razorpay)
export const paymentAPI = {
  createLink: (data) => api.post('/payments/create-link', data),
};

// Subscription APIs
export const subscriptionAPI = {
  create: (data) => api.post('/subscriptions', data),
  getMy: () => api.get('/subscriptions/my-subscriptions'),
  getById: (id) => api.get(`/subscriptions/${id}`),
  getPlans: () => api.get('/subscriptions/plans'),
  createPlan: (data) => api.post('/subscriptions/plans', data),
  updatePlan: (id, data) => api.put(`/subscriptions/plans/${id}`, data),
  deletePlan: (id) => api.delete(`/subscriptions/plans/${id}`),
};

// Subscription page text & plan cards (from subscriptiontexts collection)
export const subscriptionTextAPI = {
  get: () => api.get('/subscriptiontexts'),
};

// Subscription Order APIs (Meal Locking)
export const subscriptionOrderAPI = {
  lockMeal: (data) => api.post('/subscription-orders/lock', data),
  getMyLocks: (params) => api.get('/subscription-orders/my-locks', { params }),
  getLockForDateAndMealType: (date, mealType) => 
    api.get(`/subscription-orders/date/${date}/mealtype/${mealType}`),
  unlockMeal: (id) => api.delete(`/subscription-orders/${id}`),
  confirmMeals: (data) => api.post('/subscription-orders/confirm', data),
};

// Help & Support APIs
export const helpSupportAPI = {
  get: () => api.get('/helpsupport'),
};

// Complaint APIs
export const complaintAPI = {
  create: (data) => api.post('/complaints', data),
};

// Subscription Plan APIs (Admin)
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (search) => api.get('/admin/users', { params: { search } }),
  createUser: (data) => api.post('/admin/users', data),
  getCloudKitchens: () => api.get('/admin/cloudkitchens'),
  createCloudKitchen: (data) => api.post('/admin/cloudkitchens', data),
  deleteCloudKitchen: (id) => api.delete(`/admin/cloudkitchens/${id}`),
  getMenuItems: () => api.get('/admin/menu'),
  createMenuItem: (data) => api.post('/admin/menu', data),
  updateMenuItem: (id, data) => api.put(`/admin/menu/${id}`, data),
  deleteMenuItem: (id) => api.delete(`/admin/menu/${id}`),
  getSalesData: (days) => api.get('/admin/sales', { params: { days } }),
  getOrders: () => api.get('/admin/orders'),
  updateOrderStatus: (id, status) => api.patch(`/admin/orders/${id}/status`, { status }),
  getSubscriptions: () => api.get('/admin/subscriptions'),
  getSubscriptionPlans: () => api.get('/admin/subscription-plans'),
  createSubscriptionPlan: (data) => api.post('/admin/subscription-plans', data),
  updateSubscriptionPlan: (id, data) => api.put(`/admin/subscription-plans/${id}`, data),
  deleteSubscriptionPlan: (id) => api.delete(`/admin/subscription-plans/${id}`),
  getPageStyles: () => api.get('/pagestyles'),
  getPageStyleByNumber: (pageNumber) => api.get(`/pagestyles/page/${pageNumber}`),
  getPageStyleById: (id) => api.get(`/pagestyles/${id}`),
  createPageStyle: (data) => api.post('/pagestyles', data),
  updatePageStyle: (id, data) => api.put(`/pagestyles/${id}`, data),
  updatePageStyleByNumber: (pageNumber, data) => api.put(`/pagestyles/page/${pageNumber}`, data),
  deletePageStyle: (id) => api.delete(`/pagestyles/${id}`),
};

// Subscription Cards APIs (Admin)
export const subscriptionCardsAPI = {
  getAll: () => api.get('/subscription-cards'),
  getById: (id) => api.get(`/subscription-cards/${id}`),
  updateCard: (id, data) => api.put(`/subscription-cards/${id}`, data),
  updateAll: (cardsData) => api.put('/subscription-cards', { cards: cardsData }),
};

export default api;