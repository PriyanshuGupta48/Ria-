const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  calculateCouponPricing,
  normalizeCouponCode,
  summarizeCoupon,
} = require('../utils/couponPricing');

const router = express.Router();
const otpStore = new Map();

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 45 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_RESEND_ATTEMPTS = 2;
const OTP_MAX_VERIFY_ATTEMPTS = 3;
const OTP_VERIFIED_TOKEN_TTL_MS = 15 * 60 * 1000;
const OTP_SESSION_TTL_MS = 15 * 60 * 1000;
const MSG91_SEND_OTP_URL = 'https://control.msg91.com/api/v5/otp';
const MSG91_VERIFY_OTP_URL = 'https://control.msg91.com/api/v5/otp/verify';

const FIXED_SHIPPING_THRESHOLD = 999;
const FIXED_SHIPPING_CHARGE = 70;
const RAZORPAY_CURRENCY = String(process.env.RAZORPAY_CURRENCY || 'INR').trim().toUpperCase();

const getRazorpayCredentials = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  return { keyId, keySecret };
};

const getRazorpayClient = () => {
  const { keyId, keySecret } = getRazorpayCredentials();

  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend environment variables.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

const verifyRazorpaySignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const { keySecret } = getRazorpayCredentials();

  if (!keySecret) {
    throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_SECRET in backend environment variables.');
  }

  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');

  return expectedSignature === razorpaySignature;
};

const readNumberCandidate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (!cleaned) {
      return null;
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const findNumberByKeys = (input, keysToFind = []) => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const wanted = new Set(keysToFind.map((key) => String(key).toLowerCase()));
  const queue = [input];

  while (queue.length > 0) {
    const current = queue.shift();

    if (Array.isArray(current)) {
      for (const value of current) {
        queue.push(value);
      }
      continue;
    }

    if (current && typeof current === 'object') {
      for (const [key, value] of Object.entries(current)) {
        const normalizedKey = String(key).toLowerCase();
        if (wanted.has(normalizedKey)) {
          const num = readNumberCandidate(value);
          if (num !== null) {
            return num;
          }
        }

        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }
  }

  return null;
};

const getMonthBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
};

const buildOtpSessionKey = (userId, contactNumber) => `${userId}:${contactNumber}`;

const createOtpState = (now = Date.now()) => ({
  createdAt: now,
  sessionExpiresAt: now + OTP_SESSION_TTL_MS,
  otpExpiresAt: now + OTP_EXPIRY_MS,
  nextResendAt: now + OTP_RESEND_COOLDOWN_MS,
  resendAttempts: 0,
  verifyAttempts: 0,
  verified: false,
  verificationToken: '',
  verificationExpiresAt: 0,
});

const getOtpState = (key) => {
  const state = otpStore.get(key);
  if (!state) {
    return null;
  }

  if (state.sessionExpiresAt && state.sessionExpiresAt < Date.now()) {
    otpStore.delete(key);
    return null;
  }

  if (state.verified && state.verificationExpiresAt && state.verificationExpiresAt < Date.now()) {
    otpStore.delete(key);
    return null;
  }

  return state;
};

const parseJsonText = (text) => {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
};

const isMsg91Success = (payload = {}) => {
  const type = String(payload?.type || '').toLowerCase();
  if (type === 'success') {
    return true;
  }

  return payload?.success === true || payload?.status === true;
};

const sendMsg91Otp = async (contactNumber) => {
  const authKey = String(process.env.MSG91_AUTH_KEY || '').trim();
  const templateId = String(process.env.MSG91_TEMPLATE_ID || '').trim();

  if (!authKey) {
    throw new Error('MSG91_AUTH_KEY is missing. Configure it in backend environment variables.');
  }

  if (!templateId) {
    throw new Error('MSG91_TEMPLATE_ID is missing. Configure it in backend environment variables.');
  }

  const params = new URLSearchParams({
    authkey: authKey,
    mobile: `91${contactNumber}`,
    template_id: templateId,
  });

  const response = await fetch(`${MSG91_SEND_OTP_URL}?${params.toString()}`, {
    method: 'POST',
    headers: {
      authkey: authKey,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  const body = parseJsonText(text);

  if (!response.ok || !isMsg91Success(body)) {
    const details = String(body?.message || body?.error || body?.type || 'MSG91 send OTP failed');
    throw new Error(details);
  }

  return body;
};

const verifyMsg91Otp = async (contactNumber, otp) => {
  const authKey = String(process.env.MSG91_AUTH_KEY || '').trim();

  if (!authKey) {
    throw new Error('MSG91_AUTH_KEY is missing. Configure it in backend environment variables.');
  }

  const params = new URLSearchParams({
    authkey: authKey,
    mobile: `91${contactNumber}`,
    otp,
  });

  const response = await fetch(`${MSG91_VERIFY_OTP_URL}?${params.toString()}`, {
    method: 'POST',
    headers: {
      authkey: authKey,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  const body = parseJsonText(text);
  return response.ok && isMsg91Success(body);
};

const normalizeAddress = (rawAddress = {}) => ({
  fullName: String(rawAddress.fullName || '').trim(),
  phoneNumber: String(rawAddress.phoneNumber || '').trim(),
  email: String(rawAddress.email || '').trim().toLowerCase(),
  houseNo: String(rawAddress.houseNo || rawAddress.flatNo || '').trim(),
  laneNo: String(rawAddress.laneNo || rawAddress.street || '').trim(),
  landmark: String(rawAddress.landmark || '').trim(),
  city: String(rawAddress.city || '').trim(),
  pinCode: String(rawAddress.pinCode || '').trim(),
  state: String(rawAddress.state || '').trim(),
  country: String(rawAddress.country || 'India').trim(),
});

const validateAddress = (address) => {
  // Require the full customer address for order storage and label creation.
  const requiredFields = ['fullName', 'phoneNumber', 'houseNo', 'laneNo', 'city', 'pinCode', 'state'];
  for (const field of requiredFields) {
    if (!address[field]) {
      return `Address field '${field}' is required`;
    }
  }

  if (!/^\d{10}$/.test(address.phoneNumber)) {
    return 'Phone number must be a valid 10 digit mobile number';
  }

  if (!/^\d{6}$/.test(address.pinCode)) {
    return 'Pin code must be a valid 6 digit code';
  }

  return '';
};

const buildFixedShippingQuote = (subtotalAmount) => {
  const deliveryCharge = subtotalAmount > FIXED_SHIPPING_THRESHOLD ? 0 : FIXED_SHIPPING_CHARGE;

  return {
    deliveryPartner: 'Fixed Shipping',
    deliveryCharge,
    subtotal: subtotalAmount,
    payableAmount: subtotalAmount + deliveryCharge,
    quoteSource: 'fixed-shipping',
    freeDelivery: deliveryCharge === 0,
    deliveryMessage: deliveryCharge === 0
      ? 'Free delivery on orders above ₹999'
      : 'Flat delivery charge of ₹70 applies',
  };
};

const getCartWithValidation = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');

  if (!cart || !cart.items || cart.items.length === 0) {
    return { error: 'Your cart is empty' };
  }

  const validItems = cart.items.filter((item) => item.product);
  if (validItems.length === 0) {
    return { error: 'No valid products in cart' };
  }

  const orderItems = validItems.map((item) => ({
    product: item.product._id,
    quantity: item.quantity,
    unitPrice: item.product.price,
  }));

  const subtotalAmount = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return {
    cart,
    orderItems,
    subtotalAmount,
  };
};

const incrementProductSalesForOrder = async (order) => {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return;
  }

  const productQuantities = new Map();

  order.items.forEach((item) => {
    const productId = String(item?.product?._id || item?.product || '');
    const quantity = Number(item?.quantity || 0);

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    productQuantities.set(productId, (productQuantities.get(productId) || 0) + quantity);
  });

  const operations = [...productQuantities.entries()].map(([productId, quantity]) => ({
    updateOne: {
      filter: { _id: productId },
      update: { $inc: { totalSold: quantity } },
    },
  }));

  if (operations.length > 0) {
    await Product.bulkWrite(operations, { ordered: false });
  }
};

const buildCheckoutPricing = async ({
  userId,
  address = null,
  customerName = '',
  contactNumber = '',
  couponCode = '',
}) => {
  const cartResult = await getCartWithValidation(userId);
  if (cartResult.error) {
    return { error: cartResult.error, status: 400 };
  }

  const normalizedCouponCode = normalizeCouponCode(couponCode);
  let coupon = null;
  let couponPricing = {
    eligible: true,
    reason: '',
    discountAmount: 0,
    freeDelivery: false,
    eligibleSubtotal: cartResult.subtotalAmount,
  };

  if (normalizedCouponCode) {
    coupon = await Coupon.findOne({ code: normalizedCouponCode });
    if (!coupon) {
      return { error: 'Invalid coupon', status: 400 };
    }

    const [userOrderCount, hasUsedCouponBefore] = await Promise.all([
      Order.countDocuments({ user: userId }),
      Order.exists({ user: userId, couponCode: coupon.code }),
    ]);

    couponPricing = calculateCouponPricing({
      coupon,
      cartItems: cartResult.cart.items,
      subtotalAmount: cartResult.subtotalAmount,
      userOrderCount,
      hasUsedCouponBefore: Boolean(hasUsedCouponBefore),
    });

    if (!couponPricing.eligible) {
      return { error: couponPricing.reason || 'Coupon is not applicable', status: 400 };
    }
  }

  const discountAmount = Number(couponPricing.discountAmount || 0);
  const discountedSubtotal = Math.max(0, Number(cartResult.subtotalAmount || 0) - discountAmount);
  const quote = buildFixedShippingQuote(discountedSubtotal);
  const deliveryCharge = couponPricing.freeDelivery ? 0 : Number(quote.deliveryCharge || 0);
  const finalAmount = Math.max(0, discountedSubtotal + deliveryCharge);

  return {
    cartResult,
    coupon,
    couponSummary: coupon ? summarizeCoupon(coupon) : null,
    discountAmount,
    discountedSubtotal,
    deliveryCharge,
    deliveryPartner: quote.deliveryPartner,
    payableAmount: finalAmount,
    quoteSource: couponPricing.freeDelivery ? 'coupon-free-delivery' : quote.quoteSource,
    quote,
  };
};

router.post('/send-otp', authMiddleware, async (req, res) => {
  try {
    const contactNumber = String(req.body.contactNumber || '').trim();

    if (!/^\d{10}$/.test(contactNumber)) {
      return res.status(400).json({ message: 'Contact number must be a valid 10 digit mobile number' });
    }

    const key = buildOtpSessionKey(req.user.userId, contactNumber);
    const now = Date.now();
    const existingState = getOtpState(key);

    if (!existingState) {
      await sendMsg91Otp(contactNumber);
      otpStore.set(key, createOtpState(now));

      return res.json({
        message: 'OTP sent successfully',
        meta: {
          otpLength: OTP_LENGTH,
          otpExpirySeconds: OTP_EXPIRY_MS / 1000,
          maxResendAttempts: OTP_MAX_RESEND_ATTEMPTS,
          resendCooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
          maxVerifyAttempts: OTP_MAX_VERIFY_ATTEMPTS,
          remainingResends: OTP_MAX_RESEND_ATTEMPTS,
        },
      });
    }

    if (existingState.verified && existingState.verificationExpiresAt > now) {
      return res.status(400).json({ message: 'Contact number already verified for this checkout session.' });
    }

    if (existingState.resendAttempts >= OTP_MAX_RESEND_ATTEMPTS && existingState.otpExpiresAt < now) {
      await sendMsg91Otp(contactNumber);
      otpStore.set(key, createOtpState(now));
      return res.json({
        message: 'OTP sent successfully',
        meta: {
          otpLength: OTP_LENGTH,
          otpExpirySeconds: OTP_EXPIRY_MS / 1000,
          maxResendAttempts: OTP_MAX_RESEND_ATTEMPTS,
          resendCooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
          maxVerifyAttempts: OTP_MAX_VERIFY_ATTEMPTS,
          remainingResends: OTP_MAX_RESEND_ATTEMPTS,
        },
      });
    }

    if (existingState.resendAttempts >= OTP_MAX_RESEND_ATTEMPTS) {
      return res.status(429).json({
        message: 'Maximum resend attempts reached. Start checkout again to request a fresh OTP.',
      });
    }

    if (existingState.nextResendAt > now) {
      const retryAfterSeconds = Math.ceil((existingState.nextResendAt - now) / 1000);
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds}s before resending OTP.`,
        retryAfterSeconds,
      });
    }

    await sendMsg91Otp(contactNumber);

    const updatedState = {
      ...existingState,
      otpExpiresAt: now + OTP_EXPIRY_MS,
      nextResendAt: now + OTP_RESEND_COOLDOWN_MS,
      resendAttempts: existingState.resendAttempts + 1,
      verifyAttempts: 0,
      verified: false,
      verificationToken: '',
      verificationExpiresAt: 0,
    };

    otpStore.set(key, updatedState);

    return res.json({
      message: 'OTP resent successfully',
      meta: {
        remainingResends: Math.max(0, OTP_MAX_RESEND_ATTEMPTS - updatedState.resendAttempts),
        otpExpirySeconds: OTP_EXPIRY_MS / 1000,
        resendCooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
});

router.post('/verify-otp', authMiddleware, async (req, res) => {
  try {
    const contactNumber = String(req.body.contactNumber || '').trim();
    const otp = String(req.body.otp || '').trim();
    const key = buildOtpSessionKey(req.user.userId, contactNumber);
    const otpEntry = getOtpState(key);

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Valid 6 digit OTP is required' });
    }

    if (!otpEntry) {
      return res.status(400).json({ message: 'OTP session not found. Send OTP first.' });
    }

    if (otpEntry.otpExpiresAt < Date.now()) {
      return res.status(400).json({ message: 'OTP expired or not found. Please resend OTP.' });
    }

    if (otpEntry.verifyAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({ message: 'Maximum OTP verify attempts reached. Please resend OTP.' });
    }

    const verificationSuccessful = await verifyMsg91Otp(contactNumber, otp);

    if (!verificationSuccessful) {
      const nextAttemptCount = otpEntry.verifyAttempts + 1;
      otpStore.set(key, {
        ...otpEntry,
        verifyAttempts: nextAttemptCount,
      });

      const remainingAttempts = Math.max(0, OTP_MAX_VERIFY_ATTEMPTS - nextAttemptCount);
      return res.status(400).json({
        message: remainingAttempts > 0
          ? `OTP verification failed. ${remainingAttempts} attempt(s) left.`
          : 'OTP verification failed. Maximum verify attempts reached, please resend OTP.',
      });
    }

    const verificationToken = crypto.randomBytes(18).toString('hex');
    otpStore.set(key, {
      ...otpEntry,
      verified: true,
      verifyAttempts: otpEntry.verifyAttempts,
      verificationToken,
      verificationExpiresAt: Date.now() + OTP_VERIFIED_TOKEN_TTL_MS,
    });

    return res.json({
      message: 'OTP verified',
      verificationToken,
      meta: {
        verificationExpiresInSeconds: OTP_VERIFIED_TOKEN_TTL_MS / 1000,
      },
    });
  } catch (error) {
    const message = String(error?.message || 'Failed to verify OTP');
    const isConfigError = /MSG91_AUTH_KEY|MSG91_TEMPLATE_ID/i.test(message);
    return res.status(isConfigError ? 400 : 500).json({
      message: isConfigError ? message : 'Failed to verify OTP',
      error: message,
    });
  }
});

router.post('/quote', authMiddleware, async (req, res) => {
  try {
    const address = normalizeAddress(req.body.address || {});
    const addressError = validateAddress(address);
    if (addressError) {
      return res.status(400).json({ message: addressError });
    }

    const pricing = await buildCheckoutPricing({
      userId: req.user.userId,
      address,
      customerName: String(req.body.customerName || '').trim(),
      contactNumber: String(req.body.contactNumber || '').trim(),
      couponCode: req.body.couponCode,
    });

    if (pricing.error) {
      return res.status(pricing.status || 400).json({ message: pricing.error });
    }

    return res.json({
      subtotal: pricing.cartResult.subtotalAmount,
      discountAmount: pricing.discountAmount,
      deliveryCharge: pricing.deliveryCharge,
      deliveryPartner: pricing.deliveryPartner,
      payableAmount: pricing.payableAmount,
      quoteSource: pricing.quoteSource,
      estimatedDeliveryDays: pricing.quote?.estimatedDeliveryDays || null,
      warning: pricing.quote?.warning,
      coupon: pricing.couponSummary,
    });
  } catch (error) {
    const message = String(error?.message || 'Failed to generate quote');
    return res.status(500).json({
      message: 'Failed to generate quote',
      error: message,
    });
  }
});

router.post('/payment/create-order', authMiddleware, async (req, res) => {
  try {
    const { customerName, contactNumber, address, paymentMethod, couponCode } = req.body;
    const cleanCustomerName = String(customerName || '').trim();
    const cleanContact = String(contactNumber || '').trim();

    if (!cleanCustomerName) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!/^\d{10}$/.test(cleanContact)) {
      return res.status(400).json({ message: 'A valid contact number is required' });
    }

    const shippingAddress = normalizeAddress(address || {});
    const addressError = validateAddress(shippingAddress);
    if (addressError) {
      return res.status(400).json({ message: addressError });
    }

    const customerEmail = String(req.body.email || req.user.email || shippingAddress.email || '').trim().toLowerCase();
    const customerAddress = {
      fullName: cleanCustomerName,
      phoneNumber: cleanContact,
      email: customerEmail,
      houseNo: shippingAddress.houseNo,
      street: shippingAddress.laneNo,
      landmark: shippingAddress.landmark,
      city: shippingAddress.city,
      state: shippingAddress.state,
      pinCode: shippingAddress.pinCode,
      country: shippingAddress.country,
    };

    const allowedPaymentMethods = ['UPI', 'Card', 'NetBanking'];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Please choose a valid payment gateway option' });
    }

    const pricing = await buildCheckoutPricing({
      userId: req.user.userId,
      address: shippingAddress,
      customerName: cleanCustomerName,
      contactNumber: cleanContact,
      couponCode,
    });

    if (pricing.error) {
      return res.status(pricing.status || 400).json({ message: pricing.error });
    }

    const payableAmount = Number(pricing.payableAmount || 0);
    const amountInPaise = Math.round(payableAmount * 100);

    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({ message: 'Calculated payable amount is invalid for payment.' });
    }

    const razorpay = getRazorpayClient();
    const { keyId } = getRazorpayCredentials();
    const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: RAZORPAY_CURRENCY,
      receipt,
      notes: {
        userId: String(req.user.userId),
        customerName: cleanCustomerName,
        contactNumber: cleanContact,
        couponCode: pricing.couponSummary?.code || '',
        customerEmail,
      },
    });

    return res.json({
      message: 'Razorpay order created successfully',
      keyId,
      razorpayOrder,
      amountBreakdown: {
        subtotal: pricing.cartResult.subtotalAmount,
        discountAmount: pricing.discountAmount,
        deliveryCharge: pricing.deliveryCharge,
        payableAmount,
        deliveryPartner: pricing.deliveryPartner,
        deliveryMessage: pricing.quote?.deliveryMessage || '',
        coupon: pricing.couponSummary,
      },
      customerAddress,
    });
  } catch (error) {
    const message = String(error?.message || 'Failed to create payment order');
    const isConfigError = /RAZORPAY_KEY_ID|RAZORPAY_KEY_SECRET|Razorpay is not configured/i.test(message);
    return res.status(isConfigError ? 400 : 500).json({
      message: isConfigError ? message : 'Failed to create payment order',
      error: message,
    });
  }
});

router.post('/payment/verify', authMiddleware, async (req, res) => {
  try {
    const {
      customerName,
      contactNumber,
      address,
      paymentMethod,
      couponCode,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body;

    const cleanCustomerName = String(customerName || '').trim();
    const cleanContact = String(contactNumber || '').trim();
    const cleanRazorpayOrderId = String(razorpayOrderId || '').trim();
    const cleanRazorpayPaymentId = String(razorpayPaymentId || '').trim();
    const cleanRazorpaySignature = String(razorpaySignature || '').trim();

    if (!cleanCustomerName) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!/^\d{10}$/.test(cleanContact)) {
      return res.status(400).json({ message: 'A valid contact number is required' });
    }

    const shippingAddress = normalizeAddress(address || {});
    const addressError = validateAddress(shippingAddress);
    if (addressError) {
      return res.status(400).json({ message: addressError });
    }

    const allowedPaymentMethods = ['UPI', 'Card', 'NetBanking'];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Please choose a valid payment gateway option' });
    }

    if (!cleanRazorpayOrderId || !cleanRazorpayPaymentId || !cleanRazorpaySignature) {
      return res.status(400).json({ message: 'Razorpay payment details are incomplete' });
    }

    const existingOrder = await Order.findOne({
      user: req.user.userId,
      paymentReference: cleanRazorpayPaymentId,
    })
      .populate('user', 'email')
      .populate('items.product', 'name image images');

    if (existingOrder) {
      return res.json({
        message: 'Payment already verified and order already created',
        order: existingOrder,
        duplicate: true,
      });
    }

    const signatureOk = verifyRazorpaySignature({
      razorpayOrderId: cleanRazorpayOrderId,
      razorpayPaymentId: cleanRazorpayPaymentId,
      razorpaySignature: cleanRazorpaySignature,
    });

    if (!signatureOk) {
      return res.status(400).json({ message: 'Payment verification failed due to invalid signature' });
    }

    const pricing = await buildCheckoutPricing({
      userId: req.user.userId,
      address: shippingAddress,
      customerName: cleanCustomerName,
      contactNumber: cleanContact,
      couponCode,
    });

    if (pricing.error) {
      return res.status(pricing.status || 400).json({ message: pricing.error });
    }

    const { cart, orderItems, subtotalAmount } = pricing.cartResult;
    const customerEmail = String(req.body.email || req.user.email || shippingAddress.email || '').trim().toLowerCase();
    const customerAddress = {
      fullName: cleanCustomerName,
      phoneNumber: cleanContact,
      email: customerEmail,
      houseNo: shippingAddress.houseNo,
      street: shippingAddress.laneNo,
      landmark: shippingAddress.landmark,
      city: shippingAddress.city,
      state: shippingAddress.state,
      pinCode: shippingAddress.pinCode,
      country: shippingAddress.country,
    };

    const order = await Order.create({
      user: req.user.userId,
      items: orderItems,
      orderItems,
      subtotalAmount,
      originalAmount: subtotalAmount,
      discountAmount: pricing.discountAmount,
      couponCode: pricing.couponSummary?.code || '',
      finalPaidAmount: pricing.payableAmount,
      finalAmount: pricing.payableAmount,
      deliveryCharge: pricing.deliveryCharge,
      deliveryPartner: pricing.deliveryPartner,
      totalAmount: pricing.payableAmount,
      status: 'pending',
      contactNumber: cleanContact,
      customerAddress,
      shippingAddress,
      paymentMethod,
      paymentStatus: 'paid',
      paymentReference: cleanRazorpayPaymentId,
      customerName: cleanCustomerName,
      statusTimeline: {
        pendingAt: new Date(),
      },
    });

    if (pricing.coupon) {
      pricing.coupon.usedCount = Number(pricing.coupon.usedCount || 0) + 1;
      await pricing.coupon.save();
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'email')
      .populate('items.product', 'name image images');

    return res.status(201).json({
      message: 'Payment verified and order placed successfully',
      order: populatedOrder,
    });
  } catch (error) {
    const message = String(error?.message || 'Failed to verify payment');
    return res.status(500).json({
      message: 'Failed to verify payment',
      error: message,
    });
  }
});

router.post('/place', authMiddleware, async (req, res) => {
  try {
    const { customerName, contactNumber, address, paymentMethod, couponCode } = req.body;
    const cleanCustomerName = String(customerName || '').trim();
    const cleanContact = String(contactNumber || '').trim();

    if (!cleanCustomerName) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!/^\d{10}$/.test(cleanContact)) {
      return res.status(400).json({ message: 'A valid contact number is required' });
    }

    const shippingAddress = normalizeAddress(address || {});
    const addressError = validateAddress(shippingAddress);
    if (addressError) {
      return res.status(400).json({ message: addressError });
    }

    const allowedPaymentMethods = ['UPI', 'Card', 'NetBanking'];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Please choose a valid payment gateway option' });
    }

    const pricing = await buildCheckoutPricing({
      userId: req.user.userId,
      address: shippingAddress,
      customerName: cleanCustomerName,
      contactNumber: cleanContact,
      couponCode,
    });

    if (pricing.error) {
      return res.status(pricing.status || 400).json({ message: pricing.error });
    }

    const { cart, orderItems, subtotalAmount } = pricing.cartResult;
    const paymentReference = `PAY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const order = await Order.create({
      user: req.user.userId,
      items: orderItems,
      orderItems,
      subtotalAmount,
      originalAmount: subtotalAmount,
      discountAmount: pricing.discountAmount,
      couponCode: pricing.couponSummary?.code || '',
      finalPaidAmount: pricing.payableAmount,
      finalAmount: pricing.payableAmount,
      deliveryCharge: pricing.deliveryCharge,
      deliveryPartner: pricing.deliveryPartner,
      customerAddress,
      totalAmount: pricing.payableAmount,
      status: 'pending',
      contactNumber: cleanContact,
      shippingAddress,
      paymentMethod,
      paymentStatus: 'paid',
      paymentReference,
      customerName: cleanCustomerName,
      statusTimeline: {
        pendingAt: new Date(),
      },
    });

    if (pricing.coupon) {
      pricing.coupon.usedCount = Number(pricing.coupon.usedCount || 0) + 1;
      await pricing.coupon.save();
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'email')
      .populate('items.product', 'name image images');

    res.status(201).json({
      message: 'Order placed successfully',
      order: populatedOrder,
    });
  } catch (error) {
    const message = String(error?.message || 'Failed to place order');
    res.status(500).json({
      message: 'Failed to update order',
    });
  }
});

router.get('/my', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('items.product', 'name image images category');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

router.get('/my/:orderId', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user.userId })
      .populate('items.product', 'name image images category price');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch order details', error: error.message });
  }
});

router.get('/admin/insights', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { start, end } = getMonthBounds();

    const [
      totalProducts,
      totalOrders,
      pendingOrders,
      acceptedOrders,
      monthlyOrders,
      monthlyRevenueRows,
      monthlyNewProducts,
      categoryBreakdown,
    ] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: { $in: ['accepted', 'shipped', 'delivered'] } }),
      Order.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Order.aggregate([
        {
          $match: {
            status: { $in: ['accepted', 'shipped', 'delivered'] },
            createdAt: { $gte: start, $lt: end },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
          },
        },
      ]),
      Product.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Product.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      totalProducts,
      totalOrders,
      pendingOrders,
      acceptedOrders,
      monthlyOrders,
      monthlyRevenue: monthlyRevenueRows?.[0]?.total || 0,
      monthlyNewProducts,
      categoryBreakdown: categoryBreakdown.map((entry) => ({
        category: entry._id,
        count: entry.count,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch insights', error: error.message });
  }
});

router.get('/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate('user', 'email')
      .populate('items.product', 'name image images category price');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

router.put('/admin/:orderId/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, adminNote = '', expectedShippingDate } = req.body;
    const validStatuses = ['pending', 'accepted', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.orderId).populate('items.product', 'name image images category price');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const shouldRecordSales = status === 'delivered' && !order.salesRecordedAt;

    if (status === 'accepted') {
      if (!expectedShippingDate) {
        return res.status(400).json({ message: 'Expected shipping date is required before accepting an order' });
      }

      const shippingDate = new Date(expectedShippingDate);

      if (Number.isNaN(shippingDate.getTime())) {
        return res.status(400).json({ message: 'Invalid expected shipping date format' });
      }

      order.expectedShippingDate = shippingDate;
    }

    order.status = status;
    order.adminNote = typeof adminNote === 'string' ? adminNote : '';

    if (!order.statusTimeline) {
      order.statusTimeline = {};
    }

    if (!order.statusTimeline.pendingAt) {
      order.statusTimeline.pendingAt = order.createdAt || new Date();
    }

    const timelineFieldMap = {
      pending: 'pendingAt',
      accepted: 'acceptedAt',
      shipped: 'shippedAt',
      delivered: 'deliveredAt',
      cancelled: 'cancelledAt',
    };

    const timelineField = timelineFieldMap[status];
    if (timelineField && !order.statusTimeline[timelineField]) {
      order.statusTimeline[timelineField] = new Date();
    }

    await order.save();

    if (shouldRecordSales) {
      await incrementProductSalesForOrder(order);
      order.salesRecordedAt = new Date();
      await order.save();
    }

    const updated = await Order.findById(order._id)
      .populate('user', 'email')
      .populate('items.product', 'name image images category price');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update order', error: error.message });
  }
});

module.exports = router;
