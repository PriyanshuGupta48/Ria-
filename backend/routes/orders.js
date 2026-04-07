const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
const otpStore = new Map();

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 45 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_RESEND_ATTEMPTS = 2;
const OTP_MAX_VERIFY_ATTEMPTS = 3;
const OTP_VERIFIED_TOKEN_TTL_MS = 15 * 60 * 1000;
const MSG91_VERIFY_ACCESS_TOKEN_URL = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';

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

const buildOtpSessionKey = (userId, contactNumber) => `${userId}:${contactNumber}`;

const getOtpState = (key) => {
  const state = otpStore.get(key);
  if (!state) {
    return null;
  }

  if (state.verified && state.verificationExpiresAt && state.verificationExpiresAt < Date.now()) {
    otpStore.delete(key);
    return null;
  }

  return state;
};

const isMsg91VerificationSuccess = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const booleanSignals = [payload.success, payload.status, payload.valid]
    .some((value) => value === true || value === 'true');

  if (booleanSignals) {
    return true;
  }

  const stringSignals = [payload.type, payload.message, payload.response]
    .map((value) => String(value || '').toLowerCase());

  return stringSignals.some((value) => value.includes('success') || value.includes('verified') || value.includes('valid'));
};

const verifyMsg91AccessToken = async (accessToken) => {
  const authKey = String(process.env.MSG91_AUTH_KEY || '').trim();

  if (!authKey) {
    throw new Error('MSG91_AUTH_KEY is missing. Configure it in backend environment variables.');
  }

  const response = await fetch(MSG91_VERIFY_ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      authkey: authKey,
      'access-token': accessToken,
    }),
  });

  const text = await response.text();
  let body = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      body = { raw: text };
    }
  }

  return {
    ok: response.ok,
    body,
  };
};

const extractLast10Digits = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10) {
    return '';
  }

  return digits.slice(-10);
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

const buildShipmentAddressLine = (address = {}) => {
  return [address.houseNo, address.laneNo, address.landmark]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
};

const getDelhiveryPickupDetails = () => ({
  name: String(process.env.DELHIVERY_PICKUP_NAME || process.env.DELHIVERY_SENDER_NAME || '').trim(),
  phone: String(process.env.DELHIVERY_PICKUP_PHONE || process.env.DELHIVERY_SENDER_PHONE || '').trim(),
  address: String(process.env.DELHIVERY_PICKUP_ADDRESS || '').trim(),
  city: String(process.env.DELHIVERY_PICKUP_CITY || '').trim(),
  state: String(process.env.DELHIVERY_PICKUP_STATE || '').trim(),
  pinCode: String(process.env.DELHIVERY_ORIGIN_PINCODE || '').trim(),
  country: String(process.env.DELHIVERY_PICKUP_COUNTRY || 'India').trim(),
  location: String(process.env.DELHIVERY_PICKUP_LOCATION || process.env.DELHIVERY_PICKUP_NAME || 'primary').trim(),
});

const buildOrderPackageMetrics = (order) => {
  const validItems = (order?.items || []).filter((item) => item?.product);

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

  return {
    chargeableWeightGrams: totalChargeableWeightGrams,
    lengthCm,
    breadthCm,
    heightCm,
  };
};

const buildDelhiveryShipmentPayload = (order) => {
  const shippingAddress = order?.shippingAddress || {};
  const pickup = getDelhiveryPickupDetails();
  const packageMetrics = buildOrderPackageMetrics(order);
  const items = Array.isArray(order?.items) ? order.items : [];
  const productNames = items
    .map((item) => `${item?.product?.name || 'Product'} x ${item?.quantity || 1}`)
    .join(', ')
    .slice(0, 250);

  const addressLine = [
    buildShipmentAddressLine(shippingAddress),
    String(shippingAddress.city || '').trim(),
    String(shippingAddress.state || '').trim(),
    String(shippingAddress.pinCode || '').trim(),
    String(shippingAddress.country || 'India').trim(),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    pickup_location: pickup.location,
    name: String(order?.customerName || '').trim(),
    customer_name: String(order?.customerName || '').trim(),
    phone: String(order?.contactNumber || '').trim(),
    customer_phone: String(order?.contactNumber || '').trim(),
    order: String(order?._id || '').trim(),
    seller_inv_no: String(order?._id || '').trim(),
    reference_number: String(order?._id || '').trim(),
    payment_mode: 'Pre-paid',
    cod_amount: 0,
    total_amount: Number(order?.totalAmount || 0),
    invoice_amount: Number(order?.totalAmount || 0),
    products_desc: productNames,
    product_desc: productNames,
    address: addressLine,
    city: String(shippingAddress.city || '').trim(),
    state: String(shippingAddress.state || '').trim(),
    pin: String(shippingAddress.pinCode || '').trim(),
    country: String(shippingAddress.country || 'India').trim(),
    shipment_length: packageMetrics.lengthCm,
    shipment_breadth: packageMetrics.breadthCm,
    shipment_height: packageMetrics.heightCm,
    shipment_weight: packageMetrics.chargeableWeightGrams,
    weight: packageMetrics.chargeableWeightGrams,
    waybill: String(order?.awbNumber || '').trim(),
    return_name: pickup.name,
    return_phone: pickup.phone,
    return_address: pickup.address,
    return_city: pickup.city,
    return_state: pickup.state,
    return_pin: pickup.pinCode,
    return_country: pickup.country,
  };
};

const createDelhiveryShipment = async (order) => {
  const existingAwb = String(order?.awbNumber || '').trim();
  const existingTrackingLink = String(order?.trackingLink || '').trim();

  if (existingAwb) {
    return {
      awbNumber: existingAwb,
      trackingLink: existingTrackingLink || `https://www.delhivery.com/track/package/${encodeURIComponent(existingAwb)}`,
      courierExpectedDeliveryDate: order?.courierExpectedDeliveryDate || null,
      bookingSource: 'existing',
    };
  }

  const bookUrl = String(process.env.DELHIVERY_ONE_SHIPMENT_URL || 'https://track.delhivery.com/api/cmu/create.json').trim();
  const apiToken = String(process.env.DELHIVERY_ONE_API_TOKEN || '').trim();
  const authScheme = String(process.env.DELHIVERY_ONE_AUTH_SCHEME || 'Token').trim();

  if (!bookUrl || !apiToken) {
    throw new Error('Delhivery shipment booking is not configured. Set DELHIVERY_ONE_SHIPMENT_URL and DELHIVERY_ONE_API_TOKEN.');
  }

  const payload = buildDelhiveryShipmentPayload(order);
  const requestMethod = String(process.env.DELHIVERY_ONE_SHIPMENT_METHOD || 'POST').trim().toUpperCase();
  const headers = {
    Authorization: `${authScheme} ${apiToken}`,
  };

  const params = new URLSearchParams(
    Object.entries({
      format: 'json',
      data: JSON.stringify([payload]),
    }).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {})
  );

  let requestUrl = bookUrl;
  let requestBody = '';

  if (requestMethod === 'GET') {
    requestUrl = `${bookUrl}${bookUrl.includes('?') ? '&' : '?'}${params.toString()}`;
  } else {
    requestBody = params.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(requestUrl, {
    method: requestMethod,
    headers,
    body: requestMethod === 'GET' ? undefined : requestBody,
  });

  const responseText = await response.text();
  let responseBody = {};

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch (error) {
      responseBody = { raw: responseText };
    }
  }

  if (!response.ok) {
    const errorMessage = buildCompactApiError(responseBody, responseText);
    throw new Error(`Delhivery shipment booking failed: ${errorMessage}`);
  }

  const resolvedAwb = findStringByKeys(responseBody, [
    'waybill',
    'awb',
    'awb_number',
    'awbno',
    'waybill_no',
    'waybillno',
  ]) || String(order?.awbNumber || '').trim();

  const trackingLink = resolvedAwb
    ? `https://www.delhivery.com/track/package/${encodeURIComponent(resolvedAwb)}`
    : '';

  const courierExpectedDeliveryDate = findDateByKeys(responseBody, [
    'expected_delivery_date',
    'expected_delivery',
    'promise_delivery_date',
    'promised_delivery_date',
    'etd',
    'eta',
  ]);

  if (!resolvedAwb) {
    const errorMessage = buildCompactApiError(responseBody, responseText);
    throw new Error(`Delhivery shipment booking did not return a waybill${errorMessage ? `: ${errorMessage}` : ''}`);
  }

  return {
    awbNumber: resolvedAwb,
    trackingLink,
    courierExpectedDeliveryDate,
    bookingSource: 'delhivery_one',
    raw: responseBody,
  };
};

const buildDelhiveryPayload = ({ address, packageMetrics, customerName, contactNumber }) => {
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

  // Add customer details if provided
  if (customerName) {
    payload.customer_name = String(customerName).trim();
  }

  if (contactNumber) {
    payload.customer_phone = String(contactNumber).trim();
  }

  return payload;
};

const getDeliveryQuote = async (address, subtotalAmount, packageMetrics, customerName, contactNumber) => {
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

  const payload = buildDelhiveryPayload({ address, packageMetrics, customerName, contactNumber });
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

    const key = buildOtpSessionKey(req.user.userId, contactNumber);
    const now = Date.now();
    const existingState = getOtpState(key);

    if (!existingState) {
      otpStore.set(key, {
        createdAt: now,
        otpExpiresAt: now + OTP_EXPIRY_MS,
        nextResendAt: now + OTP_RESEND_COOLDOWN_MS,
        resendAttempts: 0,
        verifyAttempts: 0,
        verified: false,
        verificationToken: '',
        verificationExpiresAt: 0,
      });

      return res.json({
        message: 'OTP session created. Complete verification in MSG91 widget.',
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
      message: 'OTP resend allowed. Trigger resend from MSG91 widget now.',
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
    const accessToken = String(req.body.accessToken || req.body.access_token || '').trim();
    const key = buildOtpSessionKey(req.user.userId, contactNumber);
    const otpEntry = getOtpState(key);

    if (!/^[A-Za-z0-9._-]{16,}$/.test(accessToken)) {
      return res.status(400).json({ message: 'Valid MSG91 access token is required' });
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

    const msg91Result = await verifyMsg91AccessToken(accessToken);
    const verificationSuccessful = msg91Result.ok && isMsg91VerificationSuccess(msg91Result.body);

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

    const msg91Identifier = findStringByKeys(msg91Result.body, [
      'identifier',
      'mobile',
      'phone',
      'msisdn',
      'number',
    ]);

    const requestedContact = extractLast10Digits(contactNumber);
    const verifiedContact = extractLast10Digits(msg91Identifier);

    if (verifiedContact && requestedContact && verifiedContact !== requestedContact) {
      return res.status(400).json({
        message: 'Verified number does not match checkout contact number',
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
    const isConfigError = /MSG91_AUTH_KEY/i.test(message);
    return res.status(isConfigError ? 400 : 500).json({
      message: isConfigError ? message : 'Failed to verify OTP',
      error: message,
    });
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
    const { customerName, contactNumber, verificationToken, address, paymentMethod } = req.body;
    const cleanCustomerName = String(customerName || '').trim();
    const cleanContact = String(contactNumber || '').trim();
    const key = buildOtpSessionKey(req.user.userId, cleanContact);
    const otpEntry = getOtpState(key);

    if (!cleanCustomerName) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!/^\d{10}$/.test(cleanContact)) {
      return res.status(400).json({ message: 'A valid contact number is required' });
    }

    if (!otpEntry || !otpEntry.verified || otpEntry.verificationToken !== verificationToken || otpEntry.verificationExpiresAt < Date.now()) {
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
    const quote = await getDeliveryQuote(shippingAddress, subtotalAmount, cartResult.packageMetrics, cleanCustomerName, cleanContact);
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
      customerName: cleanCustomerName,
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

    const order = await Order.findById(req.params.orderId).populate('items.product', 'name weight length breadth height');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let shipmentDetails = null;

    if (status === 'accepted') {
      if (!expectedShippingDate) {
        return res.status(400).json({ message: 'Expected shipping date is required before accepting an order' });
      }

      const shippingDate = new Date(expectedShippingDate);

      if (Number.isNaN(shippingDate.getTime())) {
        return res.status(400).json({ message: 'Invalid expected shipping date format' });
      }

      order.expectedShippingDate = shippingDate;

      if (!order.awbNumber || !order.trackingLink) {
        shipmentDetails = await createDelhiveryShipment(order);
      }
    }

    if (status === 'shipped') {
      if (!order.awbNumber || !order.trackingLink) {
        shipmentDetails = await createDelhiveryShipment(order);
      }

      await syncOrderTrackingFromDelhivery(order);
    }

    if (shipmentDetails) {
      if (shipmentDetails.awbNumber) {
        order.awbNumber = shipmentDetails.awbNumber;
      }

      if (shipmentDetails.trackingLink) {
        order.trackingLink = shipmentDetails.trackingLink;
      }

      if (shipmentDetails.courierExpectedDeliveryDate) {
        order.courierExpectedDeliveryDate = shipmentDetails.courierExpectedDeliveryDate;
      }
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
