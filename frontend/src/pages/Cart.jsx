import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { MapPin, Loader2, Trash2, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { apiUrl, assetUrl } from '../config/api';

// Auto pincode lookup removed per user request; keep manual entry for city/state

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, getCartTotal, fetchCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('contact');
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    houseNo: '',
    laneNo: '',
    landmark: '',
    city: '',
    pinCode: '',
    state: '',
    country: 'India',
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressMode, setAddressMode] = useState('new');
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  // pincode auto-lookup removed; no extra state required
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [placingOrder, setPlacingOrder] = useState(false);
  const laneRef = useRef(null);

  const createEmptyAddress = () => ({
    fullName: customerName || '',
    phoneNumber: contactNumber || '',
    email: customerEmail || user?.email || '',
    houseNo: '',
    laneNo: '',
    landmark: '',
    city: '',
    pinCode: '',
    state: '',
    country: 'India',
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));

  const selectedAreaOptions = [];

  const updateAddressField = (field, value) => {
    setAddress((prev) => {
      if (field === 'pinCode') {
        const cleanPin = String(value || '').replace(/[^0-9]/g, '').slice(0, 6);
        return { ...prev, pinCode: cleanPin };
      }

      if (field === 'phoneNumber') {
        const cleanPhone = String(value || '').replace(/[^0-9]/g, '').slice(0, 10);
        return { ...prev, phoneNumber: cleanPhone };
      }

      return { ...prev, [field]: value };
    });
  };

  const formatAddressLine = (entry) => [entry.houseNo, entry.laneNo || entry.street, entry.landmark]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');

  const loadSavedAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const response = await axios.get(apiUrl('/api/addresses'));
      const addresses = Array.isArray(response.data?.addresses) ? response.data.addresses : [];
      setSavedAddresses(addresses);

      const defaultAddress = addresses.find((entry) => entry.isDefault) || addresses[0] || null;
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        setAddressMode('saved');
        setAddress({
          fullName: defaultAddress.fullName || '',
          phoneNumber: defaultAddress.phoneNumber || '',
          email: defaultAddress.email || user?.email || '',
          houseNo: defaultAddress.houseNo || '',
          laneNo: defaultAddress.street || defaultAddress.laneNo || '',
          landmark: defaultAddress.landmark || '',
          city: defaultAddress.city || '',
          pinCode: defaultAddress.pinCode || '',
          state: defaultAddress.state || '',
          country: defaultAddress.country || 'India',
        });
      }
    } catch (error) {
      setSavedAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const syncAddressFromContact = () => {
    setAddress((prev) => ({
      ...prev,
      fullName: prev.fullName || customerName,
      phoneNumber: prev.phoneNumber || contactNumber,
      email: prev.email || customerEmail || user?.email || '',
    }));
  };

  const startNewAddress = () => {
    setSelectedAddressId('');
    setAddressMode('new');
    setAddress(createEmptyAddress());
  };

  const selectSavedAddress = (entry) => {
    setSelectedAddressId(entry.id);
    setAddressMode('saved');
    setAddress({
      fullName: entry.fullName || '',
      phoneNumber: entry.phoneNumber || '',
      email: entry.email || user?.email || '',
      houseNo: entry.houseNo || '',
      laneNo: entry.street || entry.laneNo || '',
      landmark: entry.landmark || '',
      city: entry.city || '',
      pinCode: entry.pinCode || '',
      state: entry.state || '',
      country: entry.country || 'India',
    });
  };

  const persistCurrentAddress = async () => {
    const payload = {
      fullName: String(address.fullName || customerName || '').trim(),
      phoneNumber: String(address.phoneNumber || contactNumber || '').trim(),
      email: String(address.email || customerEmail || user?.email || '').trim(),
      houseNo: String(address.houseNo || '').trim(),
      street: String(address.laneNo || '').trim(),
      landmark: String(address.landmark || '').trim(),
      city: String(address.city || '').trim(),
      state: String(address.state || '').trim(),
      pinCode: String(address.pinCode || '').trim(),
      country: String(address.country || 'India').trim(),
      label: 'Home',
      isDefault: selectedAddressId ? false : true,
    };

    if (!payload.fullName || !payload.phoneNumber || !payload.houseNo || !payload.street || !payload.city || !payload.state || !payload.pinCode) {
      throw new Error('Complete the address before saving it');
    }

    const response = selectedAddressId
      ? await axios.put(apiUrl(`/api/addresses/${selectedAddressId}`), { address: payload })
      : await axios.post(apiUrl('/api/addresses'), { address: payload });

    const addresses = Array.isArray(response.data?.addresses) ? response.data.addresses : [];
    setSavedAddresses(addresses);

    const activeAddress = response.data?.address || addresses.find((entry) => entry.isDefault) || addresses[0] || null;
    if (activeAddress) {
      setSelectedAddressId(activeAddress.id);
      setAddressMode('saved');
    }

    return activeAddress || payload;
  };

  const deleteSavedAddress = async (addressId) => {
    try {
      const response = await axios.delete(apiUrl(`/api/addresses/${addressId}`));
      const addresses = Array.isArray(response.data?.addresses) ? response.data.addresses : [];
      setSavedAddresses(addresses);
      if (selectedAddressId === addressId) {
        const nextDefault = addresses.find((entry) => entry.isDefault) || addresses[0] || null;
        if (nextDefault) {
          selectSavedAddress(nextDefault);
        } else {
          startNewAddress();
        }
      }
      toast.success('Address deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete address');
    }
  };

  const setDefaultSavedAddress = async (addressId) => {
    try {
      const response = await axios.post(apiUrl(`/api/addresses/${addressId}/select`));
      const addresses = Array.isArray(response.data?.addresses) ? response.data.addresses : [];
      setSavedAddresses(addresses);
      const activeAddress = response.data?.address || addresses.find((entry) => entry.id === addressId) || null;
      if (activeAddress) {
        selectSavedAddress(activeAddress);
      }
      toast.success('Default address selected');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to select address');
    }
  };
  useEffect(() => {
    if (window.Razorpay) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    const fetchAvailableCoupons = async () => {
      if (!cart?.items?.length) {
        setAvailableCoupons([]);
        return;
      }

      setLoadingCoupons(true);
      try {
        const response = await axios.get(apiUrl('/api/available-coupons'));
        setAvailableCoupons(Array.isArray(response.data?.offers) ? response.data.offers : []);
      } catch (error) {
        setAvailableCoupons([]);
      } finally {
        setLoadingCoupons(false);
      }
    };

    fetchAvailableCoupons();
  }, [cart]);

  useEffect(() => {
    if (!appliedCoupon?.code || !cart?.items?.length) {
      return;
    }

    let isCancelled = false;

    const refreshCoupon = async () => {
      try {
        const response = await axios.post(apiUrl('/api/apply-coupon'), {
          code: appliedCoupon.code,
        });

        if (isCancelled) return;

        setAppliedCoupon(response.data?.coupon ? {
          ...response.data.coupon,
          discountAmount: Number(response.data.discountAmount || 0),
          subtotalAmount: Number(response.data.subtotalAmount || 0),
          finalSubtotal: Number(response.data.finalSubtotal || 0),
          freeDelivery: Boolean(response.data.freeDelivery),
        } : null);
      } catch (error) {
        if (isCancelled) return;
        setAppliedCoupon(null);
        setCouponCode('');
        toast.error(error.response?.data?.message || 'Coupon is no longer valid');
      }
    };

    refreshCoupon();

    return () => {
      isCancelled = true;
    };
  }, [cart]);

  const loadRazorpaySdk = () => {
    if (window.Razorpay) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const applyCoupon = async (code = couponCode.trim()) => {
    const couponToApply = String(code || '').trim().toUpperCase();
    if (!couponToApply) {
      toast.error('Enter a coupon code');
      return;
    }

    setCouponBusy(true);
    try {
      const response = await axios.post(apiUrl('/api/apply-coupon'), {
        code: couponToApply,
      });

      const applied = response.data?.coupon
        ? {
            ...response.data.coupon,
            discountAmount: Number(response.data.discountAmount || 0),
            subtotalAmount: Number(response.data.subtotalAmount || 0),
            finalSubtotal: Number(response.data.finalSubtotal || 0),
            freeDelivery: Boolean(response.data.freeDelivery),
          }
        : null;

      setCouponCode(applied?.code || couponToApply);
      setAppliedCoupon(applied);
      setQuote(null);
      toast.success(response.data?.message || 'Coupon applied');
      return applied;
    } catch (error) {
      setAppliedCoupon(null);
      toast.error(error.response?.data?.message || 'Invalid coupon');
      return null;
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = async () => {
    setCouponBusy(true);
    try {
      await axios.post(apiUrl('/api/remove-coupon'));
    } catch (error) {
      // Coupon state is local to the checkout flow; clear it even if the no-op endpoint fails.
    } finally {
      setAppliedCoupon(null);
      setCouponCode('');
      setQuote(null);
      setCouponBusy(false);
      toast.success('Coupon removed');
    }
  };

  const openCheckoutPopup = () => {
    syncAddressFromContact();
    setCheckoutStep('contact');
    setCustomerName(customerName || '');
    setContactNumber(contactNumber || '');
    setCustomerEmail(user?.email || '');
    setQuote(null);
    setAddress(createEmptyAddress());
    setSavedAddresses([]);
    setSelectedAddressId('');
    setAddressMode('new');
    setIsCheckoutOpen(true);
    loadSavedAddresses();
  };

  const continueToAddress = () => {
    if (!customerName.trim()) {
      toast.error('Enter your full name');
      return;
    }

    if (!/^\d{10}$/.test(contactNumber.trim())) {
      toast.error('Enter a valid 10 digit contact number');
      return;
    }

    setAddress((prev) => ({
      ...prev,
      fullName: prev.fullName || customerName.trim(),
      phoneNumber: prev.phoneNumber || contactNumber.trim(),
      email: prev.email || customerEmail || user?.email || '',
    }));

    setCheckoutStep('address');
  };

  

  const proceedToPayment = async () => {
    if (loadingQuote) {
      return;
    }

    // Validate required fields
    if (!String(address.fullName || customerName || '').trim()) {
      toast.error('Enter the full name for the address');
      return;
    }

    if (!/^\d{10}$/.test(String(address.phoneNumber || contactNumber || '').trim())) {
      toast.error('Enter a valid 10 digit phone number');
      return;
    }

    if (!address.pinCode.trim() || address.pinCode.length !== 6) {
      toast.error('Enter a valid 6-digit pincode');
      return;
    }

    if (!address.city.trim()) {
      toast.error('Enter the city for delivery');
      return;
    }

    if (!address.state.trim()) {
      toast.error('Enter the state for delivery');
      return;
    }

    if (!String(address.houseNo || '').trim()) {
      toast.error('Enter House/Flat number for accurate delivery');
      return;
    }

    if (!String(address.laneNo || '').trim()) {
      toast.error('Enter Street / Area for accurate delivery');
      return;
    }

    if (user?.email && !String(address.email || '').trim()) {
      setAddress((prev) => ({ ...prev, email: user.email }));
    }

    try {
      if (user?.email) {
        await persistCurrentAddress();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save address');
      return;
    }

    setLoadingQuote(true);
    try {
      const response = await axios.post(apiUrl('/api/orders/quote'), {
        address,
        couponCode: appliedCoupon?.code || '',
      });
      setQuote(response.data);
      setCheckoutStep('payment');
    } catch (error) {
      const backendMessage = String(error.response?.data?.message || '').trim();
      const backendError = String(error.response?.data?.error || '').trim();
      const networkMessage = String(error.message || '').trim();
      const detailedError = backendError || backendMessage;
      const errorMessage =
        detailedError ||
        networkMessage ||
        'Failed to calculate delivery charges';
      toast.error(errorMessage, { id: 'quote-error' });
    } finally {
      setLoadingQuote(false);
    }
  };

  const payAndPlaceOrder = async () => {
    if (placingOrder) {
      return;
    }

    setPlacingOrder(true);

    try {
      const sdkLoaded = await loadRazorpaySdk();
      if (!sdkLoaded || !window.Razorpay) {
        toast.error('Razorpay SDK failed to load. Check your internet and try again.');
        return;
      }

      const createOrderResponse = await axios.post(apiUrl('/api/orders/payment/create-order'), {
        customerName: customerName.trim(),
        contactNumber,
        address,
        email: address.email || user?.email || '',
        paymentMethod,
        couponCode: appliedCoupon?.code || '',
      });

      const { keyId, razorpayOrder } = createOrderResponse.data || {};

      if (!keyId || !razorpayOrder?.id) {
        toast.error('Unable to initialize Razorpay payment.');
        return;
      }

      await new Promise((resolve, reject) => {
        const gatewayMethodMap = {
          UPI: { upi: true, card: false, netbanking: false },
          Card: { upi: false, card: true, netbanking: false },
          NetBanking: { upi: false, card: false, netbanking: true },
        };

        const razorpayInstance = new window.Razorpay({
          key: keyId,
          order_id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: 'Ria',
          description: 'Order payment',
          method: gatewayMethodMap[paymentMethod] || undefined,
          prefill: {
            name: customerName.trim(),
            contact: `91${contactNumber}`,
          },
          notes: {
            customerName: customerName.trim(),
            contactNumber,
          },
          handler: async (response) => {
            try {
              await axios.post(apiUrl('/api/orders/payment/verify'), {
                customerName: customerName.trim(),
                contactNumber,
                address,
                email: address.email || user?.email || '',
                paymentMethod,
                couponCode: appliedCoupon?.code || '',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              await fetchCart();
              setAppliedCoupon(null);
              setCouponCode('');
              setAvailableCoupons([]);
              setIsCheckoutOpen(false);
              toast.success('Payment successful. Order placed!');
              navigate('/my-orders');
              resolve(true);
            } catch (error) {
              const verifyMessage = String(error.response?.data?.message || error.message || '').trim();
              reject(new Error(verifyMessage || 'Payment verification failed'));
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled.')),
          },
          theme: {
            color: '#fb7185',
          },
        });

        razorpayInstance.on('payment.failed', (response) => {
          const failureMessage = String(response?.error?.description || 'Payment failed').trim();
          reject(new Error(failureMessage));
        });

        razorpayInstance.open();
      });
    } catch (error) {
      const errorMessage = String(error.response?.data?.message || error.message || '').trim();
      toast.error(errorMessage || 'Failed to process payment');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-12 sm:py-16 text-center">
        <ShoppingBag size={48} className="mx-auto text-gray-400 mb-3 sm:mb-4" />
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2 sm:mb-4">Your cart is empty</h2>
        <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6">Looks like you haven't added any items yet.</p>
        <Link to="/" className="btn-primary inline-block">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-6 sm:mb-8">Shopping Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2">
          {cart.items.map((item) => {
            const product = item?.product || null;

            if (!product?._id) {
              return null;
            }

            const productImage = product.images?.[0] || product.image || '';

            return (
            <div key={item.product._id} className="bg-white rounded-xl shadow-md p-3 sm:p-4 mb-3 sm:mb-4 border border-rose-50">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <img
                  src={assetUrl(productImage)}
                  alt={product.name || 'Cart item'}
                  className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">{product.name}</h3>
                  <p className="text-rose-600 font-bold text-lg sm:text-xl mt-1">{formatCurrency(product.price)}</p>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
                    <div className="flex items-center gap-1.5 border rounded-lg border-gray-200">
                      <button
                        onClick={() => updateQuantity(product._id, Math.max(1, item.quantity - 1))}
                        className="p-1.5 hover:bg-gray-100 transition"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(product._id, item.quantity + 1)}
                        className="p-1.5 hover:bg-gray-100 transition"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => removeFromCart(product._id)}
                      className="text-rose-600 hover:text-rose-700 transition flex items-center gap-1 text-sm font-medium"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right mt-2 sm:mt-0">
                  <p className="text-xs sm:text-sm text-gray-600">Subtotal</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-800">
                    {formatCurrency(product.price * item.quantity)}
                  </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 sticky top-20 lg:top-24 border border-rose-50">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Order Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm sm:text-base">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatCurrency(getCartTotal())}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base">
                <span className="text-gray-600">Discount</span>
                <span className="font-semibold text-emerald-600">
                  -{formatCurrency(appliedCoupon?.discountAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm sm:text-base">
                <span className="text-gray-600">Delivery</span>
                <span className="font-semibold text-gray-700">
                  {quote?.freeDelivery ? 'FREE 🎉' : formatCurrency(quote?.deliveryCharge ?? (Math.max((getCartTotal() - (appliedCoupon?.discountAmount || 0)), 0) > 999 ? 0 : 70))}
                </span>
              </div>
              {appliedCoupon?.code && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <p className="font-semibold">Applied Coupon: {appliedCoupon.code}</p>
                  <p className="mt-1">You saved {formatCurrency(appliedCoupon.discountAmount || 0)}</p>
                </div>
              )}
              <p className="text-xs text-slate-600">Free delivery on orders above ₹999</p>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-base sm:text-lg font-bold">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-rose-600">
                    {formatCurrency(Math.max((quote?.payableAmount ?? Math.max(getCartTotal() - (appliedCoupon?.discountAmount || 0), 0) + (quote?.deliveryCharge || 0)), 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 mb-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-800">Apply Coupon</h3>
                {appliedCoupon?.code ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    onClick={removeCoupon}
                    disabled={couponBusy}
                  >
                    Remove coupon
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  className="btn-primary whitespace-nowrap"
                  onClick={() => applyCoupon()}
                  disabled={couponBusy}
                >
                  {couponBusy ? 'Applying...' : 'Apply'}
                </button>
              </div>

              <button
                type="button"
                className="w-full flex items-center justify-between rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setOffersOpen((prev) => !prev)}
              >
                <span>Available Offers</span>
                <span>{offersOpen ? '−' : '+'}</span>
              </button>

              {offersOpen && (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {loadingCoupons ? (
                    <p className="text-sm text-slate-500">Loading offers...</p>
                  ) : availableCoupons.length === 0 ? (
                    <p className="text-sm text-slate-500">No active coupons available right now.</p>
                  ) : (
                    availableCoupons.map((offer) => (
                      <div key={offer._id} className="rounded-2xl border border-white bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-800">{offer.code}</p>
                            <p className="text-xs text-slate-600 mt-1">{offer.discountLabel}</p>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                            onClick={() => applyCoupon(offer.code)}
                            disabled={couponBusy || !offer.isApplicable}
                          >
                            Apply
                          </button>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <p>Minimum order {formatCurrency(offer.minOrderAmount || 0)}</p>
                          <p>Expires {offer.expiryLabel || 'Not set'}</p>
                          {offer.freeDelivery && <p>Includes free delivery</p>}
                          {!offer.isApplicable && offer.eligibilityReason && (
                            <p className="text-amber-700">{offer.eligibilityReason}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 sm:space-y-3">
              <Link to="/" className="btn-primary w-full text-center block text-sm sm:text-base">
                Continue Shopping
              </Link>
              <Link to="/my-orders" className="btn-secondary w-full text-center block text-sm sm:text-base">
                View My Orders
              </Link>
              <button
                type="button"
                className="btn-secondary w-full text-sm sm:text-base"
                onClick={openCheckoutPopup}
              >
                Place Order
              </button>
            </div>
          </div>
        </div>
      </div>

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-3 sm:px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl border border-rose-100 shadow-2xl overflow-hidden my-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-rose-100 gap-2 sm:gap-4">
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-rose-500">Secure Checkout</p>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5 sm:mt-1">Complete Your Order</h2>
              </div>
              <button
                type="button"
                className="p-1.5 sm:p-2 rounded-full hover:bg-rose-50 text-slate-700 self-start sm:self-auto"
                onClick={() => setIsCheckoutOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 sm:px-6 pt-3 sm:pt-4">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold">
                <div className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-center ${checkoutStep === 'contact' ? 'bg-rose-400 text-white' : 'bg-rose-50 text-slate-600'}`}>
                  1. Contact
                </div>
                <div className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-center ${checkoutStep === 'address' ? 'bg-rose-400 text-white' : 'bg-rose-50 text-slate-600'}`}>
                  2. Address
                </div>
                <div className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-center ${checkoutStep === 'payment' ? 'bg-rose-400 text-white' : 'bg-rose-50 text-slate-600'}`}>
                  3. Payment
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 sm:py-5 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
              {checkoutStep === 'contact' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter your full name"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Number</label>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                      placeholder="Enter 10 digit mobile number"
                      className="input-field"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button type="button" className="btn-primary" onClick={continueToAddress}>
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {checkoutStep === 'address' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Saved Addresses</h3>
                        <p className="text-xs text-slate-600">Select, edit or save an address tied to your account.</p>
                      </div>
                      <button type="button" className="text-xs font-semibold text-rose-600 hover:text-rose-700" onClick={startNewAddress}>
                        Add New Address
                      </button>
                    </div>

                    {loadingAddresses ? (
                      <p className="text-sm text-slate-600">Loading saved addresses...</p>
                    ) : savedAddresses.length === 0 ? (
                      <p className="text-sm text-slate-600">No saved addresses yet. Add one below and we’ll remember it next time.</p>
                    ) : (
                      <div className="space-y-2">
                        {savedAddresses.map((entry) => (
                          <div key={entry.id} className={`rounded-xl border p-3 ${selectedAddressId === entry.id ? 'border-rose-300 bg-white' : 'border-rose-100 bg-white/80'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800">{entry.label || 'Home'} {entry.isDefault ? <span className="text-[10px] uppercase tracking-wider text-emerald-600">Default</span> : null}</p>
                                <p className="text-xs text-slate-600 mt-1 truncate">{entry.fullName} • {entry.phoneNumber}</p>
                                <p className="text-xs text-slate-600 mt-1">{formatAddressLine(entry)}, {entry.city}, {entry.state} - {entry.pinCode}</p>
                              </div>
                              <div className="flex flex-wrap gap-2 justify-end">
                                <button type="button" className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700" onClick={() => selectSavedAddress(entry)}>
                                  Use
                                </button>
                                <button type="button" className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700" onClick={() => setDefaultSavedAddress(entry.id)}>
                                  Default
                                </button>
                                <button type="button" className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-slate-700" onClick={() => selectSavedAddress(entry)}>
                                  Edit
                                </button>
                                <button type="button" className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600" onClick={() => deleteSavedAddress(entry.id)}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-rose-100 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Shipping Details</h3>
                        <p className="text-xs text-slate-600">Free delivery on orders above ₹999</p>
                      </div>
                      <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">{addressMode === 'saved' ? 'Saved Address' : 'New Address'}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name <span className="text-rose-500">*</span></label>
                        <input className="input-field" placeholder="Enter full name" value={address.fullName || ''} onChange={(e) => updateAddressField('fullName', e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number <span className="text-rose-500">*</span></label>
                        <input className="input-field" placeholder="10 digit mobile number" inputMode="numeric" maxLength={10} value={address.phoneNumber || ''} onChange={(e) => updateAddressField('phoneNumber', e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                        <input className="input-field" placeholder="Email address" value={address.email || ''} onChange={(e) => updateAddressField('email', e.target.value)} />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">House No / Flat / Building <span className="text-rose-500">*</span></label>
                        <input className="input-field" placeholder="House / Flat / Building" value={address.houseNo || ''} onChange={(e) => updateAddressField('houseNo', e.target.value)} />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Street / Area <span className="text-rose-500">*</span></label>
                        <input ref={laneRef} className="input-field" placeholder="Street / Area" value={address.laneNo || ''} onChange={(e) => updateAddressField('laneNo', e.target.value)} />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Landmark</label>
                        <input className="input-field" placeholder="Nearby landmark (optional)" value={address.landmark || ''} onChange={(e) => updateAddressField('landmark', e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">City <span className="text-rose-500">*</span></label>
                        <input className="input-field bg-slate-50" placeholder="City" value={address.city || ''} onChange={(e) => updateAddressField('city', e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">State <span className="text-rose-500">*</span></label>
                        <input className="input-field bg-slate-50" placeholder="State" value={address.state || ''} onChange={(e) => updateAddressField('state', e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Pin Code <span className="text-rose-500">*</span></label>
                        <input className="input-field" placeholder="Enter 6 digit pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={address.pinCode || ''} onChange={(e) => updateAddressField('pinCode', e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Country</label>
                        <input className="input-field" placeholder="Country" value={address.country || 'India'} onChange={(e) => updateAddressField('country', e.target.value)} />
                      </div>
                    </div>

                    <div className="flex justify-between gap-3 flex-wrap">
                      <button type="button" className="btn-secondary" onClick={() => setCheckoutStep('contact')}>
                        Back
                      </button>
                      <div className="flex gap-2 flex-wrap">
                        <button type="button" className="btn-secondary" onClick={async () => {
                          try {
                            setSavingAddress(true);
                            await persistCurrentAddress();
                            toast.success('Address saved');
                          } catch (error) {
                            toast.error(error.message || 'Failed to save address');
                          } finally {
                            setSavingAddress(false);
                          }
                        }} disabled={savingAddress}>
                          {savingAddress ? 'Saving...' : 'Save Address'}
                        </button>
                        <button type="button" className="btn-primary" onClick={proceedToPayment} disabled={loadingQuote || savingAddress}>
                          {loadingQuote ? 'Calculating...' : 'Continue To Payment'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {checkoutStep === 'payment' && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Amount Breakdown</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-700">
                        <span>Items Total</span>
                        <span className="font-semibold">{formatCurrency(quote?.subtotal || getCartTotal())}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Discount</span>
                        <span className="font-semibold text-emerald-700">-{formatCurrency(quote?.discountAmount || appliedCoupon?.discountAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Delivery</span>
                        <span className="font-semibold">{quote?.freeDelivery ? 'FREE 🎉' : formatCurrency(quote?.deliveryCharge || 70)}</span>
                      </div>
                      <p className="text-xs text-slate-600">Free delivery on orders above ₹999</p>
                      {quote?.coupon?.code && (
                        <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-emerald-900">
                          <p className="text-xs font-semibold">Applied Coupon: {quote.coupon.code}</p>
                          <p className="text-xs mt-1">You saved {formatCurrency(quote.discountAmount || 0)}</p>
                        </div>
                      )}
                      <div className="border-t border-rose-200 pt-2 flex justify-between text-slate-900 font-bold">
                        <span>Total Payable</span>
                        <span>{formatCurrency(quote?.payableAmount || getCartTotal())}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Select Payment Gateway</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {['UPI', 'Card', 'NetBanking'].map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            paymentMethod === method
                              ? 'bg-rose-400 text-white border-rose-400'
                              : 'bg-white text-slate-700 border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button type="button" className="btn-secondary" onClick={() => setCheckoutStep('address')}>
                      Back
                    </button>
                    <button type="button" className="btn-primary" onClick={payAndPlaceOrder} disabled={placingOrder}>
                      {placingOrder ? 'Processing Payment...' : 'Pay & Place Order'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;