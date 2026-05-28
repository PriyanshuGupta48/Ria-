const express = require('express');
const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  calculateCouponPricing,
  normalizeCouponCode,
  summarizeCoupon,
} = require('../utils/couponPricing');

const router = express.Router();

const loadCartSnapshot = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');

  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { cart: null, cartItems: [], subtotalAmount: 0 };
  }

  const cartItems = cart.items.filter((item) => item.product);
  const subtotalAmount = cartItems.reduce((sum, item) => sum + (Number(item.product.price || 0) * Number(item.quantity || 0)), 0);

  return {
    cart,
    cartItems,
    subtotalAmount,
  };
};

const getUserCouponState = async (userId, couponCode = '') => {
  const [userOrderCount, hasUsedCouponBefore] = await Promise.all([
    Order.countDocuments({ user: userId }),
    couponCode ? Order.exists({ user: userId, couponCode }) : Promise.resolve(false),
  ]);

  return {
    userOrderCount,
    hasUsedCouponBefore: Boolean(hasUsedCouponBefore),
  };
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
};

const parseNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseArrayField = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry || '').trim()).filter(Boolean);
      }
    } catch (error) {
      return trimmed.split(',').map((entry) => String(entry || '').trim()).filter(Boolean);
    }
  }

  return [];
};

const buildCouponPayload = (body = {}) => ({
  code: normalizeCouponCode(body.code),
  discountType: String(body.discountType || 'percentage').trim(),
  discountValue: Number(body.discountValue || 0),
  minOrderAmount: Number(body.minOrderAmount || 0),
  maxDiscount: parseNullableNumber(body.maxDiscount),
  expiryDate: body.expiryDate,
  usageLimit: parseNullableNumber(body.usageLimit),
  activeStatus: parseBoolean(body.activeStatus),
  firstOrderOnly: parseBoolean(body.firstOrderOnly),
  oneTimePerUser: parseBoolean(body.oneTimePerUser),
  freeDelivery: parseBoolean(body.freeDelivery),
  applicableProducts: parseArrayField(body.applicableProducts),
  applicableCategories: parseArrayField(body.applicableCategories),
});

const ensureCouponAvailability = async ({ coupon, cartItems, subtotalAmount, userId }) => {
  const userState = await getUserCouponState(userId, coupon.code);
  return calculateCouponPricing({
    coupon,
    cartItems,
    subtotalAmount,
    userOrderCount: userState.userOrderCount,
    hasUsedCouponBefore: userState.hasUsedCouponBefore,
  });
};

router.post('/apply-coupon', authMiddleware, async (req, res) => {
  try {
    const couponCode = normalizeCouponCode(req.body.code);
    if (!couponCode) {
      return res.status(400).json({ message: 'Enter a coupon code' });
    }

    const coupon = await Coupon.findOne({ code: couponCode });
    if (!coupon) {
      return res.status(400).json({ message: 'Invalid coupon' });
    }

    const cartSnapshot = await loadCartSnapshot(req.user.userId);
    if (cartSnapshot.subtotalAmount <= 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    const pricing = await ensureCouponAvailability({
      coupon,
      cartItems: cartSnapshot.cartItems,
      subtotalAmount: cartSnapshot.subtotalAmount,
      userId: req.user.userId,
    });

    if (!pricing.eligible) {
      return res.status(400).json({ message: pricing.reason || 'Coupon is not applicable' });
    }

    return res.json({
      message: `Coupon ${coupon.code} applied successfully`,
      coupon: summarizeCoupon(coupon),
      subtotalAmount: cartSnapshot.subtotalAmount,
      discountAmount: pricing.discountAmount,
      freeDelivery: pricing.freeDelivery,
      eligibleSubtotal: pricing.eligibleSubtotal,
      finalSubtotal: Math.max(0, cartSnapshot.subtotalAmount - pricing.discountAmount),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to apply coupon',
      error: String(error?.message || error),
    });
  }
});

router.post('/remove-coupon', authMiddleware, async (req, res) => {
  return res.json({ message: 'Coupon removed successfully' });
});

router.get('/available-coupons', authMiddleware, async (req, res) => {
  try {
    const cartSnapshot = await loadCartSnapshot(req.user.userId);
    const userState = await getUserCouponState(req.user.userId, '');
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });

    const offers = [];

    for (const coupon of coupons) {
      const hasUsedCouponBefore = Boolean(await Order.exists({ user: req.user.userId, couponCode: coupon.code }));
      const pricing = calculateCouponPricing({
        coupon,
        cartItems: cartSnapshot.cartItems,
        subtotalAmount: cartSnapshot.subtotalAmount,
        userOrderCount: userState.userOrderCount,
        hasUsedCouponBefore,
      });

      offers.push({
        ...summarizeCoupon(coupon),
        isApplicable: pricing.eligible,
        eligibilityReason: pricing.eligible ? '' : pricing.reason,
        previewDiscount: pricing.eligible ? pricing.discountAmount : 0,
        previewFinalAmount: pricing.eligible ? Math.max(0, cartSnapshot.subtotalAmount - pricing.discountAmount) : cartSnapshot.subtotalAmount,
      });
    }

    return res.json({
      offers,
      subtotalAmount: cartSnapshot.subtotalAmount,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load available coupons',
      error: String(error?.message || error),
    });
  }
});

router.get('/admin/coupons', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res.json(coupons.map((coupon) => ({
      ...summarizeCoupon(coupon),
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    })));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load coupons', error: String(error?.message || error) });
  }
});

router.post('/admin/create-coupon', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const payload = buildCouponPayload(req.body);

    if (!payload.code) {
      return res.status(400).json({ message: 'Coupon code is required' });
    }

    if (!payload.discountType || !['percentage', 'fixed'].includes(payload.discountType)) {
      return res.status(400).json({ message: 'Discount type must be percentage or fixed' });
    }

    if (!payload.discountValue || payload.discountValue <= 0) {
      return res.status(400).json({ message: 'Discount value must be greater than 0' });
    }

    if (!payload.expiryDate) {
      return res.status(400).json({ message: 'Expiry date is required' });
    }

    const parsedExpiry = new Date(payload.expiryDate);
    if (Number.isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({ message: 'Expiry date is invalid' });
    }

    const existingCoupon = await Coupon.findOne({ code: payload.code });
    if (existingCoupon) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      ...payload,
      expiryDate: parsedExpiry,
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      message: 'Coupon created successfully',
      coupon: summarizeCoupon(coupon),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create coupon', error: String(error?.message || error) });
  }
});

router.put('/admin/update-coupon/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const payload = buildCouponPayload(req.body);
    const couponId = String(req.params.id || '').trim();
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    if (payload.code) {
      const duplicateCoupon = await Coupon.findOne({ code: payload.code, _id: { $ne: couponId } });
      if (duplicateCoupon) {
        return res.status(409).json({ message: 'Coupon code already exists' });
      }
      coupon.code = payload.code;
    }

    coupon.discountType = payload.discountType;
    coupon.discountValue = payload.discountValue;
    coupon.minOrderAmount = payload.minOrderAmount;
    coupon.maxDiscount = payload.maxDiscount;
    coupon.expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : coupon.expiryDate;
    coupon.usageLimit = payload.usageLimit;
    coupon.activeStatus = payload.activeStatus;
    coupon.firstOrderOnly = payload.firstOrderOnly;
    coupon.oneTimePerUser = payload.oneTimePerUser;
    coupon.freeDelivery = payload.freeDelivery;
    coupon.applicableProducts = payload.applicableProducts;
    coupon.applicableCategories = payload.applicableCategories;

    await coupon.save();

    return res.json({
      message: 'Coupon updated successfully',
      coupon: summarizeCoupon(coupon),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update coupon', error: String(error?.message || error) });
  }
});

router.delete('/admin/delete-coupon/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    return res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete coupon', error: String(error?.message || error) });
  }
});

module.exports = router;