const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['Gifts', 'Keychains', 'Decorations', 'Accessories', 'Apparel']
  },
  weight: {
    type: Number,
    required: true,
    min: 1,
    default: 500
  },
  length: {
    type: Number,
    required: true,
    min: 1,
    default: 10
  },
  breadth: {
    type: Number,
    required: true,
    min: 1,
    default: 10
  },
  height: {
    type: Number,
    required: true,
    min: 1,
    default: 10
  },
  image: {
    type: String,
    required: true
  },
  images: {
    type: [String],
    default: []
  },
  description: {
    type: String,
    default: ''
  },
  details: {
    size: {
      type: String,
      default: ''
    },
    color: {
      type: String,
      default: ''
    },
    washable: {
      type: String,
      default: ''
    },
    material: {
      type: String,
      default: ''
    },
    pattern: {
      type: String,
      default: ''
    },
    careInstructions: {
      type: String,
      default: ''
    },
    origin: {
      type: String,
      default: ''
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);