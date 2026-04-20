import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import {
  LayoutDashboard,
  PackagePlus,
  ClipboardList,
  LineChart,
  Settings,
  Trash2,
  Upload,
  PencilLine,
  Save,
  Plus,
  CheckCircle2,
  Clock3,
  Truck,
  XCircle,
  Boxes,
  IndianRupee,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiUrl, assetUrl } from '../config/api';
import { siteInfo } from '../config/siteInfo';

const API_BASE = apiUrl();

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  shipped: 'bg-sky-100 text-sky-800',
  delivered: 'bg-teal-100 text-teal-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

const TAB_ITEMS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'products', label: 'Add/Edit Items', icon: PackagePlus },
  { key: 'orders', label: 'Accept Orders', icon: ClipboardList },
  { key: 'insights', label: 'Monthly Insights', icon: LineChart },
  { key: 'settings', label: 'More Options', icon: Settings },
];

const toCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const getProductImages = (product) => {
  if (Array.isArray(product?.images) && product.images.length > 0) {
    return product.images;
  }
  if (product?.image) {
    return [product.image];
  }
  return [];
};

const EMPTY_DETAILS = {
  size: '',
  color: '',
  washable: '',
  material: '',
  pattern: '',
  careInstructions: '',
  origin: '',
};

const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Admin = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [insights, setInsights] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    acceptedOrders: 0,
    monthlyOrders: 0,
    monthlyRevenue: 0,
    monthlyNewProducts: 0,
    categoryBreakdown: [],
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    weight: '',
    length: '',
    breadth: '',
    height: '',
    category: 'Gifts',
    description: '',
    details: EMPTY_DETAILS,
  });
  const [images, setImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderScheduleById, setOrderScheduleById] = useState({});

  useEffect(() => {
    const previewUrls = images.map((file) => URL.createObjectURL(file));
    setImagePreviews(previewUrls);

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [productsRes, ordersRes, insightsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/products/admin/all`),
        axios.get(`${API_BASE}/api/orders/admin`),
        axios.get(`${API_BASE}/api/orders/admin/insights`),
      ]);

      setProducts(productsRes.data);
      setOrders(ordersRes.data);
      setOrderScheduleById((prev) => {
        const next = { ...prev };
        (ordersRes.data || []).forEach((order) => {
          next[order._id] = {
            expectedShippingDate: prev[order._id]?.expectedShippingDate || toDateInputValue(order.expectedShippingDate),
          };
        });
        return next;
      });
      setInsights(insightsRes.data);
    } catch (error) {
      toast.error('Failed to load admin dashboard data');
    }
  };

  const refreshOrdersAndInsights = async () => {
    try {
      const [ordersRes, insightsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/orders/admin`),
        axios.get(`${API_BASE}/api/orders/admin/insights`),
      ]);
      setOrders(ordersRes.data);
      setOrderScheduleById((prev) => {
        const next = { ...prev };
        (ordersRes.data || []).forEach((order) => {
          next[order._id] = {
            expectedShippingDate: prev[order._id]?.expectedShippingDate || toDateInputValue(order.expectedShippingDate),
          };
        });
        return next;
      });
      setInsights(insightsRes.data);
    } catch (error) {
      toast.error('Failed to refresh order data');
    }
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    const isEditing = Boolean(selectedProduct);
    const currentGallery = getProductImages(selectedProduct);
    const remainingExistingImages = currentGallery.filter((img) => !removedImages.includes(img));
    const parsedWeight = Number(formData.weight);
    const parsedLength = Number(formData.length);
    const parsedBreadth = Number(formData.breadth);
    const parsedHeight = Number(formData.height);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast.error('Weight must be greater than 0 grams');
      return;
    }

    if (!Number.isFinite(parsedLength) || parsedLength <= 0 || !Number.isFinite(parsedBreadth) || parsedBreadth <= 0 || !Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      toast.error('Length, breadth and height must be greater than 0 cm');
      return;
    }

    if (!isEditing && images.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    setLoading(true);
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('price', formData.price);
    formDataToSend.append('weight', String(Math.round(parsedWeight)));
    formDataToSend.append('length', String(Math.round(parsedLength)));
    formDataToSend.append('breadth', String(Math.round(parsedBreadth)));
    formDataToSend.append('height', String(Math.round(parsedHeight)));
    formDataToSend.append('category', formData.category);
    formDataToSend.append('description', formData.description);
    formDataToSend.append('details', JSON.stringify(formData.details));

    images.forEach((file) => {
      formDataToSend.append('images', file);
    });

    if (isEditing) {
      formDataToSend.append('removedImages', JSON.stringify(removedImages));
    }

    if (isEditing && images.length === 0 && remainingExistingImages.length === 0) {
      toast.error('Please keep at least one image or add a new one');
      setLoading(false);
      return;
    }

    try {
      if (isEditing) {
        await axios.put(`${API_BASE}/api/products/${selectedProduct._id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product updated successfully!');
      } else {
        await axios.post(`${API_BASE}/api/products`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product added successfully!');
      }

      resetProductForm();
      await fetchAdminData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/api/products/${productId}`);
      toast.success('Product deleted');
      if (selectedProduct?._id === productId) {
        resetProductForm();
      }
      await fetchAdminData();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const startEditProduct = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      weight: product.weight || '',
      length: product.length || '',
      breadth: product.breadth || '',
      height: product.height || '',
      category: product.category,
      description: product.description || '',
      details: {
        ...EMPTY_DETAILS,
        ...(product.details || {}),
      },
    });
    setImages([]);
    setRemovedImages([]);
    setActiveTab('products');
  };

  const resetProductForm = () => {
    setSelectedProduct(null);
    setFormData({ name: '', price: '', weight: '', length: '', breadth: '', height: '', category: 'Gifts', description: '', details: EMPTY_DETAILS });
    setImages([]);
    setRemovedImages([]);
  };

  const updateDetailField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      details: {
        ...prev.details,
        [field]: value,
      },
    }));
  };

  const updateOrderSchedule = (orderId, field, value) => {
    setOrderScheduleById((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [field]: value,
      },
    }));
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const orderSchedule = orderScheduleById[orderId] || {};
      await axios.put(`${API_BASE}/api/orders/admin/${orderId}/status`, {
        status,
        expectedShippingDate: orderSchedule.expectedShippingDate || undefined,
      });
      toast.success(`Order marked as ${status}`);
      await refreshOrdersAndInsights();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update order');
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products;
    }
    const normalized = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(normalized) ||
        product.category.toLowerCase().includes(normalized)
      );
    });
  }, [products, searchTerm]);

  const pendingOrdersList = useMemo(() => {
    return orders.filter((order) => order.status === 'pending');
  }, [orders]);

  const topProducts = useMemo(() => {
    const counts = new Map();

    orders.forEach((order) => {
      order.items?.forEach((item) => {
        const name = item.product?.name || 'Unknown Product';
        counts.set(name, (counts.get(name) || 0) + item.quantity);
      });
    });

    return Array.from(counts.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [orders]);

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="dashboard-panel">
          <p className="text-xs uppercase tracking-widest text-slate-500">Products</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-black text-slate-800">{insights.totalProducts}</p>
            <Boxes className="text-rose-400" size={28} />
          </div>
          <p className="text-sm text-slate-600 mt-2">{insights.monthlyNewProducts} added this month</p>
        </div>

        <div className="dashboard-panel">
          <p className="text-xs uppercase tracking-widest text-slate-500">Total Orders</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-black text-slate-800">{insights.totalOrders}</p>
            <ClipboardList className="text-sky-500" size={28} />
          </div>
          <p className="text-sm text-slate-600 mt-2">{insights.monthlyOrders} arrived this month</p>
        </div>

        <div className="dashboard-panel">
          <p className="text-xs uppercase tracking-widest text-slate-500">Pending Approval</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-black text-slate-800">{insights.pendingOrders}</p>
            <Clock3 className="text-amber-500" size={28} />
          </div>
          <p className="text-sm text-slate-600 mt-2">Action needed from admin</p>
        </div>

        <div className="dashboard-panel">
          <p className="text-xs uppercase tracking-widest text-slate-500">Monthly Revenue</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-black text-slate-800">{toCurrency(insights.monthlyRevenue)}</p>
            <IndianRupee className="text-emerald-500" size={28} />
          </div>
          <p className="text-sm text-slate-600 mt-2">Accepted, shipped and delivered</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="dashboard-panel">
          <h2 className="panel-title">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setActiveTab('products');
                resetProductForm();
              }}
            >
              <Plus size={16} className="inline mr-2" />
              Add New Item
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveTab('orders')}
            >
              <CheckCircle2 size={16} className="inline mr-2" />
              Review Pending Orders
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveTab('insights')}
            >
              <LineChart size={16} className="inline mr-2" />
              Monthly Insights
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={16} className="inline mr-2" />
              Dashboard Options
            </button>
          </div>
        </div>

        <div className="dashboard-panel">
          <h2 className="panel-title">Pending Orders</h2>
          <p className="panel-subtitle">Orders waiting to be accepted.</p>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {pendingOrdersList.length === 0 && (
              <p className="text-sm text-slate-600">No pending orders right now.</p>
            )}

            {pendingOrdersList.map((order) => (
              <div key={order._id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Order ID</p>
                    <p className="text-xs font-semibold text-slate-700 mb-1">{order._id}</p>
                    <p className="font-semibold text-slate-800">{order.user?.email || 'Unknown user'}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(order.createdAt).toLocaleString()} • {order.items?.length || 0} items
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    onClick={() => {
                      setActiveTab('orders');
                      toast('Set dispatch date, then accept. Add AWB when shipment is created.');
                    }}
                  >
                    Schedule & Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProductsTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      <div className="xl:col-span-3 dashboard-panel">
        <div className="flex items-center justify-between gap-3">
          <h2 className="panel-title">{selectedProduct ? 'Edit Product' : 'Add New Product'}</h2>
          <button type="button" className="btn-secondary" onClick={resetProductForm}>
            Reset
          </button>
        </div>

        <form onSubmit={handleSubmitProduct} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              name="name"
              required
              className="input-field"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (₹)</label>
              <input
                type="number"
                name="price"
                required
                step="0.01"
                className="input-field"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Weight (grams)</label>
              <input
                type="number"
                name="weight"
                min="1"
                required
                className="input-field"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Length (cm)</label>
              <input
                type="number"
                name="length"
                min="1"
                required
                className="input-field"
                value={formData.length}
                onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Breadth (cm)</label>
              <input
                type="number"
                name="breadth"
                min="1"
                required
                className="input-field"
                value={formData.breadth}
                onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Height (cm)</label>
              <input
                type="number"
                name="height"
                min="1"
                required
                className="input-field"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                name="category"
                className="input-field"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
              >
                {siteInfo.catalogCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              name="description"
              rows="3"
              className="input-field"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
            />
          </div>

          <div className="rounded-2xl border border-rose-100 p-4 bg-rose-50">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Item Details (shown to users)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Size</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 12 x 8 cm"
                  value={formData.details.size}
                  onChange={(e) => updateDetailField('size', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Red"
                  value={formData.details.color}
                  onChange={(e) => updateDetailField('color', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Washable</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Yes, hand wash"
                  value={formData.details.washable}
                  onChange={(e) => updateDetailField('washable', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Wool"
                  value={formData.details.material}
                  onChange={(e) => updateDetailField('material', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pattern / Style</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Bow"
                  value={formData.details.pattern}
                  onChange={(e) => updateDetailField('pattern', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Origin</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Handmade in India"
                  value={formData.details.origin}
                  onChange={(e) => updateDetailField('origin', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Care Instructions</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Keep away from direct water"
                  value={formData.details.careInstructions}
                  onChange={(e) => updateDetailField('careInstructions', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            {selectedProduct && (
              <>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Gallery</label>
                <div className="mb-3 flex flex-wrap gap-3">
                  {getProductImages(selectedProduct)
                    .filter((img) => !removedImages.includes(img))
                    .map((img, index) => (
                      <div key={img + index} className="relative h-16 w-16 rounded-xl overflow-hidden border border-rose-100 bg-white">
                        <img
                          src={assetUrl(img)}
                          alt={`Existing ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setRemovedImages((prev) => [...prev, img])}
                          className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs leading-none rounded-bl-md"
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}

            <label className="block text-sm font-medium text-slate-700 mb-1">
              Product Images {selectedProduct ? '(new uploads will be added to the current gallery)' : ''}
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImages(Array.from(e.target.files || []))}
              className="w-full text-slate-700"
              required={!selectedProduct}
            />
            <p className="mt-2 text-xs text-slate-700">
              Upload several photos so shoppers can inspect the item from different angles.
            </p>

            {imagePreviews.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={preview} className="h-16 w-16 rounded-xl overflow-hidden border border-rose-100 bg-white">
                    <img src={preview} alt={`Selected preview ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {selectedProduct ? <Save size={18} /> : <Upload size={18} />}
            {loading ? 'Saving...' : selectedProduct ? 'Save Changes' : 'Add Product'}
          </button>
        </form>
      </div>

      <div className="xl:col-span-2 dashboard-panel">
        <h2 className="panel-title">Previous Items</h2>
        <p className="panel-subtitle">Search and edit existing products quickly.</p>

        <input
          type="text"
          placeholder="Search by name or category"
          className="input-field mb-4"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="space-y-3 max-h-[38rem] overflow-y-auto pr-1">
          {filteredProducts.map((product) => (
            <div
              key={product._id}
              className={`flex items-center gap-4 p-3 border rounded-2xl ${
                selectedProduct?._id === product._id ? 'border-amber-300 bg-amber-50' : 'border-rose-100 bg-white'
              }`}
            >
              <img
                src={assetUrl(getProductImages(product)[0] || '')}
                alt={product.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">{product.name}</h3>
                <p className="text-sm text-slate-700">{toCurrency(product.price)}</p>
                <p className="text-xs text-rose-600">
                  {product.category} • {getProductImages(product).length} photo
                  {getProductImages(product).length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEditProduct(product)}
                className="text-rose-400 hover:text-rose-500 transition"
                title="Edit"
              >
                <PencilLine size={18} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProduct(product._id)}
                className="text-sky-400 hover:text-sky-500 transition"
                title="Delete"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <p className="text-slate-700 text-center py-4">No matching products found.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderOrdersTab = () => (
    <div className="dashboard-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="panel-title">Order Management</h2>
          <p className="panel-subtitle">Accept orders, move status and track progress.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={refreshOrdersAndInsights}>
          Refresh Orders
        </button>
      </div>

      <div className="space-y-4 mt-4">
        {orders.length === 0 && <p className="text-slate-600">No orders yet.</p>}

        {orders.map((order) => (
          <div key={order._id} className="rounded-2xl border border-rose-100 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Order ID</p>
                <p className="text-xs font-semibold text-slate-700 mb-1">{order._id}</p>
                <p className="font-semibold text-slate-800">{order.user?.email || 'Unknown User'}</p>
                <p className="text-xs text-slate-600">
                  {new Date(order.createdAt).toLocaleString()} • {order.items?.length || 0} items • {toCurrency(order.totalAmount)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_STYLES[order.status] || 'bg-slate-100 text-slate-700'}`}>
                  {order.status}
                </span>
                <select
                  className="input-field !py-2 !px-3 !rounded-xl"
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {order.status === 'pending' && (
                  <button
                    type="button"
                    className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    onClick={() => updateOrderStatus(order._id, 'accepted')}
                  >
                    Accept
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-rose-100 p-3 bg-rose-50 md:col-span-2">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Shipment Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Date (manual)</label>
                    <input
                      type="date"
                      className="input-field !py-2"
                      value={orderScheduleById[order._id]?.expectedShippingDate || ''}
                      onChange={(e) => updateOrderSchedule(order._id, 'expectedShippingDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">AWB Number</label>
                    <div className="input-field !py-2 bg-slate-100 text-slate-700">
                      {order.awbNumber || 'Auto-generated by Delhivery after shipment'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2">Dispatch date is required for Accepted status. AWB is synced automatically from Delhivery after shipment.</p>
              </div>

              {(order.items || []).map((item, index) => (
                <div key={`${order._id}-${index}`} className="rounded-xl border border-rose-100 p-3 flex items-center gap-3 bg-rose-50">
                  <img
                    src={assetUrl(item.product?.images?.[0] || item.product?.image || '')}
                    alt={item.product?.name || 'Product'}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.product?.name || 'Deleted Product'}</p>
                    <p className="text-xs text-slate-600">
                      Qty {item.quantity} • {toCurrency(item.unitPrice)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderInsightsTab = () => {
    const maxCategoryCount = Math.max(...(insights.categoryBreakdown || []).map((entry) => entry.count), 1);

    return (
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 dashboard-panel">
          <h2 className="panel-title">Monthly Insights</h2>
          <p className="panel-subtitle">Current month performance and growth indicators.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Orders this month</p>
              <p className="text-3xl font-black text-slate-800 mt-2">{insights.monthlyOrders}</p>
            </div>
            <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Revenue this month</p>
              <p className="text-3xl font-black text-slate-800 mt-2">{toCurrency(insights.monthlyRevenue)}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">New products</p>
              <p className="text-3xl font-black text-slate-800 mt-2">{insights.monthlyNewProducts}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Accepted orders</p>
              <p className="text-3xl font-black text-slate-800 mt-2">{insights.acceptedOrders}</p>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 dashboard-panel">
          <h2 className="panel-title">Category Distribution</h2>
          <p className="panel-subtitle">How your catalog is split by category.</p>

          <div className="space-y-3 mt-4">
            {(insights.categoryBreakdown || []).length === 0 && (
              <p className="text-sm text-slate-600">No category data available.</p>
            )}

            {(insights.categoryBreakdown || []).map((entry) => {
              const width = Math.max((entry.count / maxCategoryCount) * 100, 10);
              return (
                <div key={entry.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{entry.category}</span>
                    <span className="text-slate-600">{entry.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-rose-100 overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-5 dashboard-panel">
          <h2 className="panel-title">Best Selling Products</h2>
          <p className="panel-subtitle">Based on quantities across all received orders.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-3">
            {topProducts.length === 0 && <p className="text-sm text-slate-600">No order data available yet.</p>}
            {topProducts.map((entry) => (
              <div key={entry.name} className="rounded-2xl border border-rose-100 p-3 bg-white">
                <p className="text-sm font-semibold text-slate-800 truncate">{entry.name}</p>
                <p className="text-xs text-slate-600 mt-1">Sold units: {entry.qty}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="dashboard-panel">
        <h2 className="panel-title">Store Operations</h2>
        <p className="panel-subtitle">Additional options usually needed in day-to-day admin work.</p>

        <div className="space-y-3">
          <div className="rounded-2xl border border-rose-100 p-4 bg-rose-50">
            <p className="font-semibold text-slate-800">Order Safety Rules</p>
            <p className="text-sm text-slate-600 mt-1">
              Keep only verified payments in accepted or shipped state. Cancel suspicious orders quickly.
            </p>
          </div>
          <div className="rounded-2xl border border-rose-100 p-4 bg-sky-50">
            <p className="font-semibold text-slate-800">Catalog Hygiene</p>
            <p className="text-sm text-slate-600 mt-1">
              Add multiple photos and meaningful descriptions for each item to reduce returns.
            </p>
          </div>
          <div className="rounded-2xl border border-rose-100 p-4 bg-amber-50">
            <p className="font-semibold text-slate-800">Customer Messaging</p>
            <p className="text-sm text-slate-600 mt-1">
              Communicate expected shipping times as soon as order status changes to shipped.
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-panel">
        <h2 className="panel-title">Status Guide</h2>
        <p className="panel-subtitle">Recommended order progression for your team.</p>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
            <Clock3 className="text-amber-600 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-slate-800">Pending</p>
              <p className="text-sm text-slate-600">New request waiting for admin confirmation.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
            <CheckCircle2 className="text-emerald-600 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-slate-800">Accepted</p>
              <p className="text-sm text-slate-600">Order approved and queued for packing.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-3">
            <Truck className="text-sky-600 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-slate-800">Shipped</p>
              <p className="text-sm text-slate-600">Courier picked up the parcel and in transit.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-3">
            <XCircle className="text-rose-600 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-slate-800">Cancelled</p>
              <p className="text-sm text-slate-600">Rejected or canceled order due to issue.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="admin-header mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-rose-600">Control center</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 mt-1 sm:mt-2">Advanced Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">Manage insights, products, orders and operations from one place.</p>
        </div>
        <button type="button" onClick={fetchAdminData} className="btn-secondary whitespace-nowrap self-start sm:self-auto">
          Refresh Data
        </button>
      </div>

      <div className="dashboard-panel mb-4 sm:mb-6">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border transition text-xs sm:text-sm ${
                  isActive
                    ? 'bg-rose-400 text-white border-rose-400'
                    : 'bg-white text-slate-700 border-rose-100 hover:bg-rose-50'
                }`}
              >
                <Icon size={14} className="sm:size-[16px]" />
                <span className="font-semibold hidden sm:inline">{tab.label}</span>
                <span className="font-semibold sm:hidden">{tab.label.split('/')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'products' && renderProductsTab()}
      {activeTab === 'orders' && renderOrdersTab()}
      {activeTab === 'insights' && renderInsightsTab()}
      {activeTab === 'settings' && renderSettingsTab()}
    </div>
  );
};

export default Admin;
