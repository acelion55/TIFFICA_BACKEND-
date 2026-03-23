
require('dotenv').config();
console.log('🔍 STARTUP LOG 1: Dotenv loaded');
console.log('MONGODB_URI:', process.env.MONGODB_URI);

const express = require('express');
console.log('🔍 STARTUP LOG 2: Express loaded');

const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
console.log('🔍 STARTUP LOG 3: App created');

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
console.log('🔍 STARTUP LOG 4: CORS added');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
console.log('🔍 STARTUP LOG 5: JSON middleware added');

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});
console.log('🔍 STARTUP LOG 6: Logging middleware added');

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

console.log('🔍 STARTUP LOG 7: Routes about to be registered');

// Routes
console.log('🔍 STARTUP LOG 8: Registering /api/auth');
app.use('/api/auth', require('./userauth'));

console.log('🔍 STARTUP LOG 9: Registering /api/menu');
app.use('/api/menu', require('./menu'));
console.log('🔍 STARTUP LOG 10: Registered /api/menu');

console.log('🔍 STARTUP LOG 11: Registering /api/orders');
app.use('/api/orders', require('./orders'));
app.use('/api/subscriptions', require('./subscriptions'));
app.use('/api/subscription-orders', require('./subscriptionorders'));
app.use('/api/subscription-cards', require('./subscriptioncards_routes'));
app.use('/api/cloudkitchens', require('./cloudkitchen_routes'));
app.use('/api/homestyles', require('./homestyles'));
app.use('/api/pagestyles', require('./pagestyles_routes'));
app.use('/api/scheduleconfigs', require('./scheduleconfigs'));
app.use('/api/admin', require('./admin'));
app.use('/api/complaints', require('./complaints'));
app.use('/api/legalpages', require('./legalpages'));
app.use('/api/payments', require('./payments'));
app.use('/api/upload', require('./upload'));
console.log('🔍 STARTUP LOG 12: All routes registered');

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

console.log('🔍 STARTUP LOG 13: About to add 404 handler');

// 404 handler (BEFORE error handler)
app.use((req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.url);
  res.status(404).json({ error: 'Route not found' });
});

console.log('🔍 STARTUP LOG 14: 404 handler added');

// Error handling middleware (AFTER routes)
app.use((err, req, res, next) => {
  console.error('\n❌❌❌ SERVER ERROR CAUGHT:');
  console.error('Error Name:', err.name);
  console.error('Error Message:', err.message);
  console.error('Error Code:', err.code);
  console.error('Error Stack:');
  console.error(err.stack);
  console.error('❌❌❌\n');

  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong!',
    details: isDev ? err.message : 'Internal Server Error',
    ...(isDev && { stack: err.stack })
  });
});

console.log('🔍 STARTUP LOG 15: Error handler added');

const PORT = process.env.PORT || 5001;
console.log('🔍 STARTUP LOG 16: About to listen on port', PORT);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on ${PORT}`);
});

console.log('🔍 STARTUP LOG 17: listen() called');
