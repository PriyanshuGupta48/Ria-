import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { PackageSearch, Clock3, CheckCircle2, Truck, Home, XCircle, ArrowRight } from 'lucide-react';
import { apiUrl, assetUrl } from '../config/api';

const API_BASE = apiUrl();

const STATUS_META = {
  pending: {
    label: 'Pending',
    uiClass: 'bg-amber-100 text-amber-800',
    icon: Clock3,
  },
  accepted: {
    label: 'Accepted',
    uiClass: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle2,
  },
  shipped: {
    label: 'Shipped',
    uiClass: 'bg-sky-100 text-sky-800',
    icon: Truck,
  },
  delivered: {
    label: 'Delivered',
    uiClass: 'bg-teal-100 text-teal-800',
    icon: Home,
  },
  cancelled: {
    label: 'Rejected',
    uiClass: 'bg-rose-100 text-rose-800',
    icon: XCircle,
  },
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

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyOrders = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/orders/my`);
        setOrders(response.data || []);
      } catch (error) {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMyOrders();
  }, []);

  const hasOrders = useMemo(() => orders.length > 0, [orders]);

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

  const formatDateOnly = (rawDate) => {
    if (!rawDate) return 'Not set yet';
    return new Date(rawDate).toLocaleDateString();
  };

  const getStepTimestamp = (order, step) => {
    const timelineField = STEP_TIME_FIELD[step];
    const timelineDate = order?.statusTimeline?.[timelineField];

    if (timelineDate) {
      return timelineDate;
    }

    if (step === 'pending') {
      return order?.createdAt || null;
    }

    // Fallback for older orders that predate timeline fields.
    if (isStepDone(order.status, step)) {
      return order?.updatedAt || null;
    }

    return null;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-center items-center h-56">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
        </div>
      </div>
    );
  }

  if (!hasOrders) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="dashboard-panel max-w-2xl mx-auto text-center">
          <PackageSearch className="mx-auto text-rose-400" size={48} />
          <h1 className="mt-4 text-2xl font-bold text-slate-800">No orders yet</h1>
          <p className="mt-2 text-slate-600">Place your first order and you can track its status here.</p>
          <Link to="/" className="btn-primary inline-block mt-6">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="dashboard-panel mb-6">
        <h1 className="text-3xl font-black text-slate-800">My Orders</h1>
        <p className="text-sm text-slate-600 mt-1">Check whether your order is pending, accepted, shipped, or rejected and track each step.</p>
      </div>

      <div className="space-y-5">
        {orders.map((order) => {
          const statusMeta = STATUS_META[order.status] || STATUS_META.pending;
          const StatusIcon = statusMeta.icon;

          return (
            <div key={order._id} className="dashboard-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Order ID</p>
                  <p className="text-sm font-semibold text-slate-700">{order._id}</p>
                  <p className="text-xs text-slate-500 mt-1">Placed on {new Date(order.createdAt).toLocaleString()}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full font-semibold ${statusMeta.uiClass}`}>
                    <StatusIcon size={14} />
                    {statusMeta.label}
                  </span>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(order.totalAmount)}</p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Order Tracking</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-2 md:gap-3 items-center">
                  {TRACKING_STEPS.map((step, index) => {
                    const done = isStepDone(order.status, step);
                    const reachedDate = getStepTimestamp(order, step);

                    return (
                      <React.Fragment key={`${order._id}-${step}`}>
                        <div
                          className={`rounded-2xl border px-3 py-3 text-center transition ${
                            done
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm'
                              : 'border-rose-100 bg-white text-slate-500'
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide">{STEP_LABELS[step]}</p>
                          <p className={`text-[11px] mt-1 ${done ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {formatDateTime(reachedDate)}
                          </p>
                        </div>

                        {index < TRACKING_STEPS.length - 1 && (
                          <div className="hidden md:flex justify-center">
                            <ArrowRight
                              size={18}
                              className={done ? 'text-emerald-400' : 'text-rose-200'}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {order.status === 'cancelled' && (
                  <p className="mt-2 text-xs text-rose-600">This order was rejected/cancelled by admin.</p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3">
                <p className="text-sm font-semibold text-slate-700 mb-2">Delivery Updates</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <p className="text-slate-600">
                    Dispatch Date: <span className="font-semibold text-slate-800">{formatDateOnly(order.expectedShippingDate)}</span>
                  </p>
                  {TRACKING_STEPS.indexOf(order.status) < TRACKING_STEPS.indexOf('shipped') ? (
                    <p className="text-slate-600 sm:col-span-2">
                      Delivery will be handled by courier partner after shipment.
                    </p>
                  ) : (
                    <>
                      <p className="text-slate-600">
                        Expected Delivery: <span className="font-semibold text-slate-800">{formatDateOnly(order.courierExpectedDeliveryDate)}</span>
                      </p>
                      <p className="text-slate-600">
                        AWB: <span className="font-semibold text-slate-800">{order.awbNumber || 'Pending sync'}</span>
                      </p>
                      <p className="text-slate-600 sm:col-span-2">
                        Tracking:{' '}
                        {order.trackingLink ? (
                          <a
                            href={order.trackingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-sky-700 hover:text-sky-800"
                          >
                            Open tracking link
                          </a>
                        ) : (
                          <span className="font-semibold text-slate-800">Pending sync</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-2">
                  <p className="text-slate-600">
                    Delivery Partner: <span className="font-semibold text-slate-800">{order.deliveryPartner || 'Assigned by admin'}</span>
                  </p>
                  <p className="text-slate-600">
                    Delivery Charge: <span className="font-semibold text-slate-800">{formatCurrency(order.deliveryCharge || 0)}</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-rose-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Items</p>
                <div className="space-y-3">
                  {(order.items || []).map((item, index) => (
                    <div key={`${order._id}-${index}`} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3">
                      <img
                        src={assetUrl(item.product?.images?.[0] || item.product?.image || '')}
                        alt={item.product?.name || 'Product'}
                        className="h-14 w-14 rounded-lg object-cover"
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
          );
        })}
      </div>
    </div>
  );
};

export default Orders;
