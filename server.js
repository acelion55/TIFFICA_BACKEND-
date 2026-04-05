require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// Routes
app.use('/api/auth', require('./userauth'));
app.use('/api/menu', require('./menu'));
app.use('/api/orders', require('./orders'));
app.use('/api/subscriptions', require('./subscriptions'));
app.use('/api/subscription-orders', require('./subscriptionorders'));
app.use('/api/subscription-cards', require('./subscriptioncards_routes'));
app.use('/api/cloudkitchens', require('./cloudkitchen_routes'));
app.use('/api/homestyles', require('./homestyles'));
app.use('/api/pagestyles', require('./pagestyles_routes'));
app.use('/api/scheduleconfigs', require('./scheduleconfigs'));
app.use('/api/schedule', require('./scheduleroutes'));
app.use('/api/admin', require('./admin'));
app.use('/api/complaints', require('./complaints'));
app.use('/api/legalpages', require('./legalpages'));
app.use('/api/payments', require('./payments'));
app.use('/api/upload', require('./upload'));
app.use('/api/notifications', require('./notifications'));
app.use('/api/kitchen-owner', require('./kitchenowner'));
app.use('/api/coupons', require('./coupons'));

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'TIFFICA Meal Delivery API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      menu: '/api/menu',
      orders: '/api/orders',
      subscriptions: '/api/subscriptions'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Tiffin App API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong!',
    details: isDev ? err.message : 'Internal Server Error',
    ...(isDev && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on ${PORT}`);
});
