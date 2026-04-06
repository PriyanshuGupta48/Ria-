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
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingBag size={64} className="mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven't added any items yet.</p>
        <Link to="/" className="btn-primary inline-block">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Shopping Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {cart.items.map((item) => (
            <div key={item.product._id} className="bg-white rounded-lg shadow-md p-4 mb-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <img
                  src={assetUrl(item.product.images?.[0] || item.product.image)}
                  alt={item.product.name}
                  className="w-32 h-32 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{item.product.name}</h3>
                  <p className="text-red-600 font-bold text-xl mt-2">{formatCurrency(item.product.price)}</p>
                  
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-2 border rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.product._id, Math.max(1, item.quantity - 1))}
                        className="p-2 hover:bg-gray-100 transition"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-12 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product._id, item.quantity + 1)}
                        className="p-2 hover:bg-gray-100 transition"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => removeFromCart(item.product._id)}
                      className="text-red-600 hover:text-red-700 transition flex items-center gap-1"
                    >
                      <Trash2 size={18} />
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-600">Subtotal</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(item.product.price * item.quantity)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatCurrency(getCartTotal())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="text-gray-700">Calculated at checkout</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-red-600">{formatCurrency(getCartTotal())}</span>
                </div>
              </div>
            </div>
            <Link to="/" className="btn-primary w-full text-center block">
              Continue Shopping
            </Link>
            <Link to="/my-orders" className="btn-secondary w-full mt-3 text-center block">
              View My Orders
            </Link>
            <button
              type="button"
              className="btn-secondary w-full mt-3"
              onClick={openCheckoutPopup}
            >
              Place Order
            </button>
          </div>
        </div>
      </div>

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4 py-8">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-rose-100 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-rose-500">Secure Checkout</p>
                <h2 className="text-xl font-bold text-slate-800 mt-1">Complete Your Order</h2>
              </div>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-rose-50 text-slate-700"
                onClick={() => setIsCheckoutOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                <div className={`rounded-lg px-3 py-2 text-center ${checkoutStep === 'contact' ? 'bg-rose-400 text-white' : 'bg-rose-50 text-slate-600'}`}>
                  1. Contact OTP
                </div>
                <div className={`rounded-lg px-3 py-2 text-center ${checkoutStep === 'address' ? 'bg-rose-400 text-white' : 'bg-rose-50 text-slate-600'}`}>
                  2. Address
                </div>
                <div className={`rounded-lg px-3 py-2 text-center ${checkoutStep === 'payment' ? 'bg-rose-400 text-white' : 'bg-rose-50 text-slate-600'}`}>
                  3. Payment
                </div>
              </div>
            </div>

            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              {checkoutStep === 'contact' && (
                <div className="space-y-4">
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