const normalizeCouponCode = (value) => String(value || '').trim().toUpperCase();

const toObjectIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value._id) return String(value._id).trim();
  return String(value).trim();
};

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

const formatDiscountLabel = (coupon) => {
  if (!coupon) return '';

  if (coupon.freeDelivery) {
    return 'Free delivery';
  }

  if (coupon.discountType === 'percentage') {
    return `${Number(coupon.discountValue || 0)}% OFF`;
  }

  return `Flat ₹${Number(coupon.discountValue || 0)} OFF`;
};

const summarizeCoupon = (coupon) => {
  if (!coupon) return null;

  const usageLimit = coupon.usageLimit === null || coupon.usageLimit === undefined ? null : Number(coupon.usageLimit);
  const usedCount = Number(coupon.usedCount || 0);

  return {
    _id: String(coupon._id),
    code: normalizeCouponCode(coupon.code),
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue || 0),
    discountLabel: formatDiscountLabel(coupon),
    minOrderAmount: Number(coupon.minOrderAmount || 0),
    maxDiscount: coupon.maxDiscount === null || coupon.maxDiscount === undefined ? null : Number(coupon.maxDiscount),
    expiryDate: coupon.expiryDate,
    expiryLabel: coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('en-IN') : '',
    usageLimit,
    usedCount,
    remainingUses: usageLimit === null ? null : Math.max(usageLimit - usedCount, 0),
    activeStatus: Boolean(coupon.activeStatus),
    firstOrderOnly: Boolean(coupon.firstOrderOnly),
    oneTimePerUser: Boolean(coupon.oneTimePerUser),
    freeDelivery: Boolean(coupon.freeDelivery),
    applicableProducts: Array.isArray(coupon.applicableProducts)
      ? coupon.applicableProducts.map(toObjectIdString).filter(Boolean)
      : [],
    applicableCategories: Array.isArray(coupon.applicableCategories)
      ? coupon.applicableCategories.map((category) => String(category || '').trim()).filter(Boolean)
      : [],
  };
};

const resolveEligibleItems = (cartItems = [], coupon = null) => {
  const productScope = new Set((coupon?.applicableProducts || []).map(toObjectIdString).filter(Boolean));
  const categoryScope = new Set((coupon?.applicableCategories || []).map((category) => String(category || '').trim().toLowerCase()).filter(Boolean));
  const hasScopedEligibility = productScope.size > 0 || categoryScope.size > 0;

  const eligibleItems = (cartItems || []).filter((item) => {
    const productId = toObjectIdString(item?.product?._id || item?.product);
    const category = String(item?.product?.category || '').trim().toLowerCase();

    if (!hasScopedEligibility) {
      return true;
    }

    return productScope.has(productId) || categoryScope.has(category);
  });

  return {
    hasScopedEligibility,
    eligibleItems,
  };
};

const calculateCouponPricing = ({
  coupon,
  cartItems = [],
  subtotalAmount = 0,
  userOrderCount = 0,
  hasUsedCouponBefore = false,
}) => {
  if (!coupon) {
    return { eligible: false, reason: 'Invalid coupon' };
  }

  if (!coupon.activeStatus) {
    return { eligible: false, reason: 'Coupon is disabled' };
  }

  if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) {
    return { eligible: false, reason: 'Coupon expired' };
  }

  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) {
    return { eligible: false, reason: 'Coupon usage limit reached' };
  }

  if (coupon.firstOrderOnly && Number(userOrderCount || 0) > 0) {
    return { eligible: false, reason: 'This coupon is valid only for first orders' };
  }

  if (coupon.oneTimePerUser && hasUsedCouponBefore) {
    return { eligible: false, reason: 'You have already used this coupon' };
  }

  const minimumOrder = Number(coupon.minOrderAmount || 0);
  if (Number(subtotalAmount || 0) < minimumOrder) {
    return {
      eligible: false,
      reason: `Minimum order ₹${minimumOrder} required`,
    };
  }

  const { hasScopedEligibility, eligibleItems } = resolveEligibleItems(cartItems, coupon);
  if (hasScopedEligibility && eligibleItems.length === 0) {
    return { eligible: false, reason: 'Coupon is not applicable to selected products or categories' };
  }

  const eligibleSubtotal = roundCurrency((hasScopedEligibility ? eligibleItems : cartItems).reduce((sum, item) => {
    const unitPrice = Number(item?.product?.price || 0);
    const quantity = Number(item?.quantity || 0);
    return sum + (unitPrice * quantity);
  }, 0));

  const discountBase = hasScopedEligibility ? eligibleSubtotal : Number(subtotalAmount || 0);
  if (discountBase <= 0) {
    return { eligible: false, reason: 'Coupon is not applicable to this cart' };
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = discountBase * (Number(coupon.discountValue || 0) / 100);
  } else {
    discountAmount = Number(coupon.discountValue || 0);
  }

  const maxDiscount = coupon.maxDiscount === null || coupon.maxDiscount === undefined ? null : Number(coupon.maxDiscount);
  if (maxDiscount !== null && Number.isFinite(maxDiscount)) {
    discountAmount = Math.min(discountAmount, maxDiscount);
  }

  discountAmount = roundCurrency(Math.min(Math.max(discountAmount, 0), discountBase));

  return {
    eligible: true,
    reason: '',
    eligibleSubtotal,
    discountAmount,
    freeDelivery: Boolean(coupon.freeDelivery),
  };
};

module.exports = {
  calculateCouponPricing,
  formatDiscountLabel,
  normalizeCouponCode,
  resolveEligibleItems,
  roundCurrency,
  summarizeCoupon,
  toObjectIdString,
};