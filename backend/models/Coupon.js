const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: 0,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    activeStatus: {
      type: Boolean,
      default: true,
    },
    firstOrderOnly: {
      type: Boolean,
      default: false,
    },
    oneTimePerUser: {
      type: Boolean,
      default: false,
    },
    freeDelivery: {
      type: Boolean,
      default: false,
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    applicableCategories: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.pre('save', function normalizeCouponCode(next) {
  if (this.code) {
    this.code = String(this.code).trim().toUpperCase();
  }

  next();
});

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);