const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Veg', 'Non-Veg', 'Egg', 'Vegan', 'dal', 'roti', 'sabji', 'raita', 'Dal', 'Roti', 'Sabji', 'Raita']
    },
    mealType: {
        type: String,
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
    },
    cloudKitchen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CloudKitchen',
        required: false
    },
    isSpecial: {
        type: Boolean,
        default: false
    },
    isTodaySpecial: {
        type: Boolean,
        default: false
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    ingredients: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
