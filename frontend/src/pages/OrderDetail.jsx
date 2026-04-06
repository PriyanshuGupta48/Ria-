import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, CheckCircle2, Truck, Home, XCircle, PackageSearch } from 'lucide-react';
import { apiUrl, assetUrl } from '../config/api';

const STATUS_META = {
  pending: { label: 'Pending', uiClass: 'bg-amber-100 text-amber-800', icon: Clock3 },
  accepted: { label: 'Accepted', uiClass: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  shipped: { label: 'Shipped', uiClass: 'bg-sky-100 text-sky-800', icon: Truck },
  delivered: { label: 'Delivered', uiClass: 'bg-teal-100 text-teal-800', icon: Home },
  cancelled: { label: 'Rejected', uiClass: 'bg-rose-100 text-rose-800', icon: XCircle },
};

const TRACKING_STEPS = ['pending', 'accepted', 'shipped', 'delivered'];

const STEP_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

const STEP_TIME_FIELD = {
  pending: 'pendingAt',
  accepted: 'acceptedAt',
  shipped: 'shippedAt',
  delivered: 'deliveredAt',
};

const OrderDetail = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await axios.get(apiUrl(`/api/orders/my/${orderId}`));
        setOrder(response.data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));

  const isStepDone = (orderStatus, step) => {
    if (orderStatus === 'cancelled') {
      return step === 'pending';
    }

    return TRACKING_STEPS.indexOf(orderStatus) >= TRACKING_STEPS.indexOf(step);
  };

  const formatDateTime = (rawDate) => {
    if (!rawDate) return 'Not reached yet';
    return new Date(rawDate).toLocaleString();
  };

  const getStepTimestamp = (currentOrder, step) => {
    const timelineField = STEP_TIME_FIELD[step];
    const timelineDate = currentOrder?.statusTimeline?.[timelineField];

    if (timelineDate) {
      return timelineDate;
    }

    if (step === 'pending') {
      return currentOrder?.createdAt || null;
    }

    if (isStepDone(currentOrder.status, step)) {
      return currentOrder?.updatedAt || null;
    }

    return null;
  };

  const statusMeta = useMemo(() => STATUS_META[order?.status] || STATUS_META.pending, [order?.status]);
  const StatusIcon = statusMeta.icon;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-center items-center h-56">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="dashboard-panel max-w-2xl mx-auto text-center">
          <PackageSearch className="mx-auto text-rose-400" size={48} />
          <h1 className="mt-4 text-2xl font-bold text-slate-800">Order details unavailable</h1>
          <p className="mt-2 text-slate-600">{error}</p>
          <Link to="/my-orders" className="btn-primary inline-flex items-center gap-2 mt-6">
            <ArrowLeft size={16} />
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Order details</p>
          <h1 className="text-3xl font-black text-slate-800 mt-1">{order._id}</h1>
        </div>
        <Link to="/my-orders" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-6">
        <div className="space-y-6">
          <div className="dashboard-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
                <span className={`mt-2 inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full font-semibold ${statusMeta.uiClass}`}>
                  <StatusIcon size={14} />
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(order.totalAmount)}</p>
            </div>
          </div>

          <div className="dashboard-panel">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Tracking</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TRACKING_STEPS.map((step) => {
                const done = isStepDone(order.status, step);
                const reachedDate = getStepTimestamp(order, step);

                return (
                  <div
                    key={step}
                    className={`rounded-2xl border px-4 py-4 ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-100 bg-white text-slate-500'}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide">{STEP_LABELS[step]}</p>
                    <p className={`text-sm mt-2 ${done ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {formatDateTime(reachedDate)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dashboard-panel">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Items</h2>
            <div className="space-y-3">
              {(order.items || []).map((item, index) => (
                <div key={`${order._id}-${index}`} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3">
                  <img
                    src={assetUrl(item.product?.images?.[0] || item.product?.image || '')}
                    alt={item.product?.name || 'Product'}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{item.product?.name || 'Product removed'}</p>
                    <p className="text-xs text-slate-600">Qty {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-slate-800">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="dashboard-panel">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-800">{formatCurrency(order.subtotalAmount || order.totalAmount)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Delivery charge</span>
                <span className="font-semibold text-slate-800">{formatCurrency(order.deliveryCharge || 0)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Payment method</span>
                <span className="font-semibold text-slate-800">{order.paymentMethod || 'Not set'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Payment status</span>
                <span className="font-semibold text-slate-800">{order.paymentStatus || 'pending'}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-panel">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Shipping Address</h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>{order.shippingAddress?.houseNo || '-'}, {order.shippingAddress?.laneNo || '-'}</p>
              <p>{order.shippingAddress?.landmark || '-'}</p>
              <p>{order.shippingAddress?.city || '-'} - {order.shippingAddress?.pinCode || '-'}</p>
              <p>{order.shippingAddress?.state || '-'}, {order.shippingAddress?.country || '-'}</p>
              <p>Contact: {order.contactNumber || '-'}</p>
            </div>
          </div>

          <div className="dashboard-panel">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Delivery Info</h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Partner: {order.deliveryPartner || 'Assigned by admin'}</p>
              <p>AWB: {order.awbNumber || 'Pending sync'}</p>
              <p>Expected dispatch: {order.expectedShippingDate ? new Date(order.expectedShippingDate).toLocaleDateString() : 'Not set yet'}</p>
              <p>Expected delivery: {order.courierExpectedDeliveryDate ? new Date(order.courierExpectedDeliveryDate).toLocaleDateString() : 'Not set yet'}</p>
              <p>
                Tracking:{' '}
                {order.trackingLink ? (
                  <a href={order.trackingLink} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:text-sky-800">
                    Open tracking link
                  </a>
                ) : (
                  <span className="font-semibold text-slate-800">Pending sync</span>
                )}
              </p>
            </div>
          </div>

          {order.adminNote ? (
            <div className="dashboard-panel">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Admin Note</h2>
              <p className="text-sm text-slate-700">{order.adminNote}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;