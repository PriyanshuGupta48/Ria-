const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
const otpStore = new Map();

const DELHIVERY_PARTNER_NAME = 'Delhivery One';
const DEFAULT_PRODUCT_WEIGHT_GRAMS = 500;
const PACKAGING_WEIGHT_GRAMS = 100;
const DEFAULT_LENGTH_CM = 10;
const DEFAULT_BREADTH_CM = 10;
const DEFAULT_HEIGHT_CM = 10;

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

const normalizeAddress = (rawAddress = {}) => ({
  houseNo: String(rawAddress.houseNo || '').trim(),
  laneNo: String(rawAddress.laneNo || '').trim(),
  landmark: String(rawAddress.landmark || '').trim(),
  city: String(rawAddress.city || '').trim(),
  pinCode: String(rawAddress.pinCode || '').trim(),
  state: String(rawAddress.state || '').trim(),
  country: String(rawAddress.country || 'India').trim(),
});

const validateAddress = (address) => {
  const requiredFields = ['houseNo', 'laneNo', 'landmark', 'city', 'pinCode', 'state'];
  for (const field of requiredFields) {
    if (!address[field]) {
      return `Address field '${field}' is required`;
    }
  }

  if (!/^\d{6}$/.test(address.pinCode)) {
    return 'Pin code must be a valid 6 digit code';
  }

  return '';
};

const buildFallbackDeliveryQuote = (subtotal) => {
  const deliveryCharge = subtotal >= 1500 ? 39 : 69;

  return {
    deliveryPartner: DELHIVERY_PARTNER_NAME,
    deliveryCharge,
    subtotal,
    payableAmount: subtotal + deliveryCharge,
    quoteSource: 'fallback',
  };
};

const buildCompactApiError = (responseBody, responseText) => {
  const rawMessage = responseBody?.message || responseBody?.error || responseBody?.raw || responseText || 'Unknown API error';
  const cleaned = String(rawMessage)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, 220);
};

const findDateByKeys = (input, keysToFind = []) => {
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
        if (wanted.has(normalizedKey) && (typeof value === 'string' || value instanceof Date)) {
          const parsedDate = new Date(value);
          if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate;
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

const findStringByKeys = (input, keysToFind = []) => {
  if (!input || typeof input !== 'object') {
    return '';
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
        if (wanted.has(normalizedKey) && value !== undefined && value !== null) {
          const candidate = String(value).trim();
          if (candidate) {
            return candidate;
          }
        }

        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }
  }

  return '';
};

const fetchDelhiveryTrackingDetails = async ({ awbNumber = '', referenceId = '' }) => {
  const apiToken = String(process.env.DELHIVERY_ONE_API_TOKEN || '').trim();
  if (!apiToken) {
    return { awbNumber: String(awbNumber || '').trim(), trackingLink: '' };
  }

  const authScheme = String(process.env.DELHIVERY_ONE_AUTH_SCHEME || 'Token').trim();
  const cleanAwb = String(awbNumber || '').trim();
  const cleanReferenceId = String(referenceId || '').trim();

  if (!cleanAwb && !cleanReferenceId) {
    return { awbNumber: '', trackingLink: '' };
  }

  const trackingUrl = cleanAwb
    ? `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(cleanAwb)}`
    : `https://track.delhivery.com/api/v1/packages/json/?ref_ids=${encodeURIComponent(cleanReferenceId)}`;

  try {
    const response = await fetch(trackingUrl, {
      method: 'GET',
      headers: {
        Authorization: `${authScheme} ${apiToken}`,
      },
    });

    if (!response.ok) {
      return { awbNumber: cleanAwb, trackingLink: '' };
    }

    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (error) {
        body = {};
      }
    }

    const resolvedAwb = findStringByKeys(body, [
      'waybill',
      'awb',
      'waybill_no',
      'waybillno',
    ]) || cleanAwb;

    const courierExpectedDeliveryDate = findDateByKeys(body, [
      'expected_delivery_date',
      'expected_delivery',
      'promise_delivery_date',
      'promised_delivery_date',
      'etd',
      'eta',
    ]);

    const trackingLink = resolvedAwb
      ? `https://www.delhivery.com/track/package/${encodeURIComponent(resolvedAwb)}`
      : '';

    return {
      awbNumber: resolvedAwb,
      courierExpectedDeliveryDate,
      trackingLink,
    };
  } catch (error) {
    return {
      awbNumber: cleanAwb,
      trackingLink: cleanAwb ? `https://www.delhivery.com/track/package/${encodeURIComponent(cleanAwb)}` : '',
    };
  }
};

const syncOrderTrackingFromDelhivery = async (order) => {
  if (!order || !['shipped', 'delivered'].includes(order.status)) {
    return false;
  }

  if (order.awbNumber && order.courierExpectedDeliveryDate && order.trackingLink) {
    return false;
  }

  const referenceCandidates = [
    String(order.awbNumber || '').trim(),
    String(order.paymentReference || '').trim(),
    String(order._id || '').trim(),
  ].filter(Boolean);

  let changed = false;

  for (const candidate of referenceCandidates) {
    const details = await fetchDelhiveryTrackingDetails({
      awbNumber: order.awbNumber ? candidate : '',
      referenceId: order.awbNumber ? '' : candidate,
    });

    if (details.awbNumber && details.awbNumber !== order.awbNumber) {
      order.awbNumber = details.awbNumber;
      changed = true;
    }

    if (details.trackingLink && details.trackingLink !== order.trackingLink) {
      order.trackingLink = details.trackingLink;
      changed = true;
    }

    if (details.courierExpectedDeliveryDate && (!order.courierExpectedDeliveryDate || details.courierExpectedDeliveryDate.getTime() !== new Date(order.courierExpectedDeliveryDate).getTime())) {
      order.courierExpectedDeliveryDate = details.courierExpectedDeliveryDate;
      changed = true;
    }

    if (order.awbNumber && order.courierExpectedDeliveryDate) {
      break;
    }
  }

  if (!order.trackingLink && order.awbNumber) {
    order.trackingLink = `https://www.delhivery.com/track/package/${encodeURIComponent(order.awbNumber)}`;
    changed = true;
  }

  return changed;
};

const resolveProductWeightGrams = (product) => {
  const rawWeight = Number(product?.weight);
  if (Number.isFinite(rawWeight) && rawWeight > 0) {
    return Math.round(rawWeight);
  }

  return DEFAULT_PRODUCT_WEIGHT_GRAMS;
};

const resolveProductDimensionCm = (value, fallback) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }

  return fallback;
};

const buildDelhiveryPayload = ({ address, packageMetrics }) => {
  const originPinCode = String(process.env.DELHIVERY_ORIGIN_PINCODE || '').trim();
  const parsedChargeableWeightGrams = Number(packageMetrics?.chargeableWeightGrams);
  const finalChargeableWeightGrams = Number.isFinite(parsedChargeableWeightGrams) && parsedChargeableWeightGrams > 0
    ? Math.round(parsedChargeableWeightGrams)
    : DEFAULT_PRODUCT_WEIGHT_GRAMS;
  const finalLengthCm = resolveProductDimensionCm(packageMetrics?.lengthCm, DEFAULT_LENGTH_CM);
  const finalBreadthCm = resolveProductDimensionCm(packageMetrics?.breadthCm, DEFAULT_BREADTH_CM);
  const finalHeightCm = resolveProductDimensionCm(packageMetrics?.heightCm, DEFAULT_HEIGHT_CM);

  const payload = {
    md: 'E',
    delivery_type: 'Express',
    ss: 'Delivered',
    d_pin: address.pinCode,
    o_pin: originPinCode,
    cgm: finalChargeableWeightGrams,
    pt: 'Pre-paid',
    payment_mode: 'Wallet',
    l: finalLengthCm,
    b: finalBreadthCm,
    h: finalHeightCm,
    length: finalLengthCm,
    breadth: finalBreadthCm,
    height: finalHeightCm,
    ipkg_type: 'box',
  };

  if (!originPinCode) {
    delete payload.o_pin;
  }

  return payload;
};

const getDeliveryQuote = async (address, subtotalAmount, packageMetrics) => {
  const quoteUrl = String(process.env.DELHIVERY_ONE_QUOTE_URL || 'https://staging-express.delhivery.com/api/kinko/v1/invoice/charges/.json').trim();
  const apiToken = String(process.env.DELHIVERY_ONE_API_TOKEN || '').trim();
  const authScheme = String(process.env.DELHIVERY_ONE_AUTH_SCHEME || 'Token').trim();
  const allowFallback = String(process.env.DELHIVERY_ALLOW_FALLBACK || 'true').trim().toLowerCase() !== 'false';
  const quoteMethod = 'GET';
  const originPinCode = String(process.env.DELHIVERY_ORIGIN_PINCODE || '').trim();

  if (!quoteUrl || !apiToken) {
    if (allowFallback) {
      return {
        ...buildFallbackDeliveryQuote(subtotalAmount),
        warning: 'Delhivery One credentials are missing. Using fallback quote in local mode.',
      };
    }

    throw new Error('Delhivery One is not configured. Set DELHIVERY_ONE_API_TOKEN and DELHIVERY_ORIGIN_PINCODE.');
  }

  if (!originPinCode) {
    throw new Error('Set DELHIVERY_ORIGIN_PINCODE to your registered pickup pincode in backend/.env');
  }

  const payload = buildDelhiveryPayload({ address, packageMetrics });
  const headers = {
    Authorization: `${authScheme} ${apiToken}`,
    'Content-Type': 'application/json',
  };

  let requestUrl = quoteUrl;
  const params = new URLSearchParams(
    Object.entries(payload).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {})
  );

  if (quoteMethod === 'GET') {
    requestUrl = `${quoteUrl}${quoteUrl.includes('?') ? '&' : '?'}${params.toString()}`;
  }

  const requestConfig = {
    method: quoteMethod,
    headers,
  };

  let response;
  try {
    console.log('[DELHIVERY API] Request:', {
      url: requestUrl,
      method: quoteMethod,
      headers: { Authorization: `${authScheme} ${apiToken.substring(0, 10)}...` },
    });
    response = await fetch(requestUrl, requestConfig);
  } catch (error) {
    console.error('[DELHIVERY API] Network error:', error.message);
    if (allowFallback) {
      return {
        ...buildFallbackDeliveryQuote(subtotalAmount),
        warning: 'Unable to reach Delhivery One API. Using fallback quote in local mode.',
      };
    }
    throw new Error(`Delhivery One request failed: ${error.message}`);
  }

  const responseText = await response.text();
  let responseBody = {};

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch (error) {
      responseBody = { raw: responseText };
    }
  }

  console.log('[DELHIVERY API] Response:', {
    status: response.status,
    statusText: response.statusText,
    body: responseBody,
  });

  if (!response.ok) {
    const apiError = buildCompactApiError(responseBody, responseText);
    if (allowFallback) {
      return {
        ...buildFallbackDeliveryQuote(subtotalAmount),
        warning: `Delhivery quote unavailable: ${apiError}. Using fallback quote in local mode.`,
      };
    }
    throw new Error(`Delhivery One API error: ${apiError}`);
  }

  const deliveryCharge = findNumberByKeys(responseBody, [
    'delivery_charge',
    'shipping_charge',
    'shipping_cost',
    'freight_charge',
    'freight_charges',
    'freight_charge',
    'total_freight',
    'freight',
    'invoice_charge',
    'charges',
    'total_charges',
    'total_amount',
    'gross_amount',
    'charge_dl',
    'net_amount',
    'amount',
    'price',
  ]);

  if (deliveryCharge === null) {
    if (allowFallback) {
      return {
        ...buildFallbackDeliveryQuote(subtotalAmount),
        warning: 'Delhivery quote unavailable. Using fallback quote in local mode.',
      };
    }
    throw new Error('Delhivery One response did not include a shipping charge');
  }

  const estimatedDeliveryDays = findNumberByKeys(responseBody, [
    'estimated_days',
    'delivery_days',
    'etd_days',
    'eta_days',
  ]);

  return {
    deliveryPartner: DELHIVERY_PARTNER_NAME,
    deliveryCharge,
    subtotal: subtotalAmount,
    payableAmount: subtotalAmount + deliveryCharge,
    quoteSource: 'delhivery_one',
    estimatedDeliveryDays: estimatedDeliveryDays !== null ? Math.ceil(estimatedDeliveryDays) : null,
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
  const totalProductWeightGrams = validItems.reduce((sum, item) => {
    const itemWeight = resolveProductWeightGrams(item.product);
    return sum + (itemWeight * item.quantity);
  }, 0);
  const totalChargeableWeightGrams = totalProductWeightGrams + PACKAGING_WEIGHT_GRAMS;
  const lengthCm = validItems.reduce((maxValue, item) => {
    const itemLength = resolveProductDimensionCm(item.product?.length, DEFAULT_LENGTH_CM);
    return Math.max(maxValue, itemLength);
  }, DEFAULT_LENGTH_CM);
  const breadthCm = validItems.reduce((maxValue, item) => {
    const itemBreadth = resolveProductDimensionCm(item.product?.breadth, DEFAULT_BREADTH_CM);
    return Math.max(maxValue, itemBreadth);
  }, DEFAULT_BREADTH_CM);
  const heightCm = validItems.reduce((sum, item) => {
    const itemHeight = resolveProductDimensionCm(item.product?.height, DEFAULT_HEIGHT_CM);
    return sum + (itemHeight * item.quantity);
  }, 0) || DEFAULT_HEIGHT_CM;
  const packageMetrics = {
    chargeableWeightGrams: totalChargeableWeightGrams,
    lengthCm,
    breadthCm,
    heightCm,
  };

  return {
    cart,
    orderItems,
    subtotalAmount,
    packageMetrics,
  };
};

router.post('/send-otp', authMiddleware, async (req, res) => {
  try {
    const contactNumber = String(req.body.contactNumber || '').trim();

    if (!/^\d{10}$/.test(contactNumber)) {
      return res.status(400).json({ message: 'Contact number must be a valid 10 digit mobile number' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const key = `${req.user.userId}:${contactNumber}`;

    otpStore.set(key, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      verified: false,
      verificationToken: '',
    });

    // Demo mode: OTP is returned for local testing (replace with SMS provider in production).
    return res.json({ message: 'OTP sent successfully', debugOtp: otp });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
});

router.post('/verify-otp', authMiddleware, async (req, res) => {
  try {
    const contactNumber = String(req.body.contactNumber || '').trim();
    const otp = String(req.body.otp || '').trim();
    const key = `${req.user.userId}:${contactNumber}`;
    const otpEntry = otpStore.get(key);

    if (!otpEntry || otpEntry.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'OTP expired or not found. Please resend OTP.' });
    }

    if (otpEntry.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const verificationToken = crypto.randomBytes(18).toString('hex');
    otpStore.set(key, {
      ...otpEntry,
      verified: true,
      verificationToken,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    return res.json({ message: 'OTP verified', verificationToken });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify OTP', error: error.message });
  }
});

router.post('/quote', authMiddleware, async (req, res) => {
  try {
    const cartResult = await getCartWithValidation(req.user.userId);
    if (cartResult.error) {
      return res.status(400).json({ message: cartResult.error });
    }

    const address = normalizeAddress(req.body.address || {});
    const addressError = validateAddress(address);
    if (addressError) {
      return res.status(400).json({ message: addressError });
    }

    const quote = await getDeliveryQuote(address, cartResult.subtotalAmount, cartResult.packageMetrics);
    return res.json(quote);
  } catch (error) {
    const message = String(error?.message || 'Failed to generate quote');
    const isConfigError = /DELHIVERY_ORIGIN_PINCODE|Delhivery One is not configured|registered pickup pincode/i.test(message);

    return res.status(isConfigError ? 400 : 500).json({
      message: isConfigError ? message : 'Failed to generate quote',
      error: message,
    });
  }
});

router.post('/place', authMiddleware, async (req, res) => {
  try {
    const { contactNumber, verificationToken, address, paymentMethod } = req.body;
    const cleanContact = String(contactNumber || '').trim();
    const key = `${req.user.userId}:${cleanContact}`;
    const otpEntry = otpStore.get(key);

    if (!/^\d{10}$/.test(cleanContact)) {
      return res.status(400).json({ message: 'A valid contact number is required' });
    }

    if (!otpEntry || !otpEntry.verified || otpEntry.verificationToken !== verificationToken || otpEntry.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'OTP verification is required before placing the order' });
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

    const cartResult = await getCartWithValidation(req.user.userId);
    if (cartResult.error) {
      return res.status(400).json({ message: cartResult.error });
    }

    const { cart, orderItems, subtotalAmount } = cartResult;
    const quote = await getDeliveryQuote(shippingAddress, subtotalAmount, cartResult.packageMetrics);
    const paymentReference = `PAY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const order = await Order.create({
      user: req.user.userId,
      items: orderItems,
      subtotalAmount,
      deliveryCharge: quote.deliveryCharge,
      deliveryPartner: quote.deliveryPartner,
      totalAmount: quote.payableAmount,
      status: 'pending',
      contactNumber: cleanContact,
      shippingAddress,
      paymentMethod,
      paymentStatus: 'paid',
      paymentReference,
      statusTimeline: {
        pendingAt: new Date(),
      },
    });

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'email')
      .populate('items.product', 'name image images');

    otpStore.delete(key);

    res.status(201).json({
      message: 'Order placed successfully',
      order: populatedOrder,
    });
  } catch (error) {
    const message = String(error?.message || 'Failed to place order');
    const isConfigError = /DELHIVERY_ORIGIN_PINCODE|Delhivery One is not configured|registered pickup pincode/i.test(message);

    res.status(isConfigError ? 400 : 500).json({
      message: isConfigError ? message : 'Failed to place order',
      error: message,
    });
  }
});

router.get('/my', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('items.product', 'name image images category');

    await Promise.all(
      orders.map(async (order) => {
        const changed = await syncOrderTrackingFromDelhivery(order);
        if (changed) {
          await order.save();
        }
      })
    );

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

    const changed = await syncOrderTrackingFromDelhivery(order);
    if (changed) {
      await order.save();
    }

    const refreshedOrder = changed
      ? await Order.findById(order._id).populate('items.product', 'name image images category price')
      : order;

    res.json(refreshedOrder);
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

    await Promise.all(
      orders.map(async (order) => {
        const changed = await syncOrderTrackingFromDelhivery(order);
        if (changed) {
          await order.save();
        }
      })
    );

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

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

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

    if (status === 'shipped') {
      await syncOrderTrackingFromDelhivery(order);
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

    const updated = await Order.findById(order._id)
      .populate('user', 'email')
      .populate('items.product', 'name image images category price');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update order', error: error.message });
  }
});

module.exports = router;
