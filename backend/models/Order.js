const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryPartner: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    contactNumber: {
      type: String,
      default: '',
      trim: true,
    },
    customerName: {
      type: String,
      default: '',
      trim: true,
    },
    shippingAddress: {
      houseNo: { type: String, default: '', trim: true },
      laneNo: { type: String, default: '', trim: true },
      landmark: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      pinCode: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      country: { type: String, default: 'India', trim: true },
    },
    paymentMethod: {
      type: String,
      default: '',
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    paymentReference: {
      type: String,
      default: '',
      trim: true,
    },
    adminNote: {
      type: String,
      default: '',
      trim: true,
    },
    expectedShippingDate: {
      type: Date,
      default: null,
    },
    awbNumber: {
      type: String,
      default: '',
      trim: true,
    },
    trackingLink: {
      type: String,
      default: '',
      trim: true,
    },
    courierExpectedDeliveryDate: {
      type: Date,
      default: null,
    },
    statusTimeline: {
      pendingAt: {
        type: Date,
        default: null,
      },
      acceptedAt: {
        type: Date,
        default: null,
      },
      shippedAt: {
        type: Date,
        default: null,
      },
      deliveredAt: {
        type: Date,
        default: null,
      },
      cancelledAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
