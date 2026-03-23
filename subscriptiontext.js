const mongoose = require('mongoose');

const planCardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'daily' },
  mealsPerDay: { type: Number, required: true },
  mealTimes: [{ type: String }],
  pricePerDay: { type: Number, required: true },
  savings: { type: String, default: '0%' },
  description: { type: String, default: '' },
  popular: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { _id: true });

const subscriptionTextSchema = new mongoose.Schema({
  headerTitle: { type: String, default: 'Subscriptions' },
  headerSubtitle: { type: String, default: 'Save more with meal subscriptions' },
  sectionTitleAvailablePlans: { type: String, default: 'Available Plans' },
  sectionTitleMySubscriptions: { type: String, default: 'My Subscriptions' },
  tabActive: { type: String, default: 'Active' },
  tabPaused: { type: String, default: 'Paused' },
  tabAll: { type: String, default: 'All' },
  emptyEmoji: { type: String, default: '📅' },
  emptyTitle: { type: String, default: 'No subscriptions yet' },
  emptySubtitle: { type: String, default: 'Subscribe to a plan and save on every meal!' },
  popularBadgeText: { type: String, default: '⭐ MOST POPULAR' },
  savingsPrefix: { type: String, default: 'Save ' },
  priceLabel: { type: String, default: 'Per Day' },
  selectButtonText: { type: String, default: 'Select Plan →' },
  purchasedLabel: { type: String, default: '✓ PURCHASED' },
  purchasedDatePrefix: { type: String, default: 'Purchased: ' },
  amountLabel: { type: String, default: 'Amount' },
  plans: [planCardSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SubscriptionText', subscriptionTextSchema);
