import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Trash2, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { apiUrl, assetUrl } from '../config/api';

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, getCartTotal, placeOrder } = useCart();
  const navigate = useNavigate();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('contact');
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [address, setAddress] = useState({
    houseNo: '',
    laneNo: '',
    landmark: '',
    city: '',
    pinCode: '',
    state: '',
    country: 'India',
  });
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [placingOrder, setPlacingOrder] = useState(false);
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));

  const handlePlaceOrder = async () => {
    const success = await placeOrder({
      customerName: customerName.trim(),
      contactNumber,
      verificationToken,
      address,
      paymentMethod,
    });
    if (success) {
      setIsCheckoutOpen(false);
      navigate('/my-orders');
    }
  };

  const openCheckoutPopup = () => {
    setCheckoutStep('contact');
    setCustomerName('');
    setOtp('');
    setVerificationToken('');
    setQuote(null);
    setIsCheckoutOpen(true);
  };

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(contactNumber.trim())) {
      toast.error('Enter a valid 10 digit contact number');
      return;
    }

    setSendingOtp(true);
    try {
      const response = await axios.post(apiUrl('/api/orders/send-otp'), {
        contactNumber: contactNumber.trim(),
      });
      toast.success(`OTP sent${response.data?.debugOtp ? ` (Demo OTP: ${response.data.debugOtp})` : ''}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      toast.error('Enter the OTP');
      return;
    }

    setVerifyingOtp(true);
    try {
      const response = await axios.post(apiUrl('/api/orders/verify-otp'), {
        contactNumber: contactNumber.trim(),
        otp: otp.trim(),
      });
      setVerificationToken(response.data.verificationToken);
      toast.success('Contact verified successfully');
      setCheckoutStep('address');
    } catch (error) {
      toast.error(error.response?.data?.message || 'OTP verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const proceedToPayment = async () => {
    if (loadingQuote) {
      return;
    }

    setLoadingQuote(true);
    try {
      const response = await axios.post(apiUrl('/api/orders/quote'), {
        address,
      });
      setQuote(response.data);
      setCheckoutStep('payment');
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to calculate delivery charges';
      toast.error(errorMessage, { id: 'quote-error' });
    } finally {
      setLoadingQuote(false);
    }
  };

  const payAndPlaceOrder = async () => {
    setPlacingOrder(true);
    await handlePlaceOrder();
    setPlacingOrder(false);
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
          {cart.items.map((item) => (
            <div key={item.product._id} className="bg-white rounded-xl shadow-md p-3 sm:p-4 mb-3 sm:mb-4 border border-rose-50">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <img
                  src={assetUrl(item.product.images?.[0] || item.product.image)}
                  alt={item.product.name}
                  className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">{item.product.name}</h3>
                  <p className="text-rose-600 font-bold text-lg sm:text-xl mt-1">{formatCurrency(item.product.price)}</p>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
                    <div className="flex items-center gap-1.5 border rounded-lg border-gray-200">
                      <button
                        onClick={() => updateQuantity(item.product._id, Math.max(1, item.quantity - 1))}
                        className="p-1.5 hover:bg-gray-100 transition"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product._id, item.quantity + 1)}
                        className="p-1.5 hover:bg-gray-100 transition"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => removeFromCart(item.product._id)}
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
                    {formatCurrency(item.product.price * item.quantity)}
                  </p>
                </div>
              </div>
            </div>
          ))}
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
                <span className="text-gray-600">Shipping</span>
                <span className="text-gray-700">Calculated at checkout</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-base sm:text-lg font-bold">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-rose-600">{formatCurrency(getCartTotal())}</span>
                </div>
              </div>
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
                  1. Contact OTP
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
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                        placeholder="Enter 10 digit mobile number"
                        className="input-field"
                      />
                      <button type="button" className="btn-secondary whitespace-nowrap" onClick={sendOtp} disabled={sendingOtp}>
                        {sendingOtp ? 'Sending...' : 'Send OTP'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Enter OTP</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="6 digit OTP"
                      className="input-field"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button type="button" className="btn-primary" onClick={verifyOtp} disabled={verifyingOtp}>
                      {verifyingOtp ? 'Verifying...' : 'Verify & Continue'}
                    </button>
                  </div>
                </div>
              )}

              {checkoutStep === 'address' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input className="input-field" placeholder="House No" value={address.houseNo} onChange={(e) => setAddress({ ...address, houseNo: e.target.value })} />
                    <input className="input-field" placeholder="Lane / Street" value={address.laneNo} onChange={(e) => setAddress({ ...address, laneNo: e.target.value })} />
                    <input className="input-field" placeholder="Nearby Landmark" value={address.landmark} onChange={(e) => setAddress({ ...address, landmark: e.target.value })} />
                    <input className="input-field" placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    <input className="input-field" placeholder="Pin Code" value={address.pinCode} onChange={(e) => setAddress({ ...address, pinCode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} />
                    <input className="input-field" placeholder="State" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
                  </div>

                  <div className="flex justify-between">
                    <button type="button" className="btn-secondary" onClick={() => setCheckoutStep('contact')}>
                      Back
                    </button>
                    <button type="button" className="btn-primary" onClick={proceedToPayment} disabled={loadingQuote}>
                      {loadingQuote ? 'Calculating...' : 'Continue To Payment'}
                    </button>
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
                        <span>Delivery Charges ({quote?.deliveryPartner || 'Delhivery One'})</span>
                        <span className="font-semibold">{formatCurrency(quote?.deliveryCharge || 0)}</span>
                      </div>
                      {quote?.estimatedDeliveryDays && (
                        <div className="flex justify-between text-slate-700">
                          <span>Estimated Delivery</span>
                          <span className="font-semibold">{quote.estimatedDeliveryDays} day(s)</span>
                        </div>
                      )}
                      <div className="border-t border-rose-200 pt-2 flex justify-between text-slate-900 font-bold">
                        <span>Total Payable</span>
                        <span>{formatCurrency(quote?.payableAmount || getCartTotal())}</span>
                      </div>
                    </div>
                    {quote?.warning && (
                      <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        {quote.warning}
                      </p>
                    )}
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