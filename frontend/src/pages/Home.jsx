import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Truck, Gift } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import CategoryFilter from '../components/CategoryFilter';
import { apiUrl } from '../config/api';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const uniqueCategories = [...new Set(products.map((item) => item.category).filter(Boolean))];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedCategory === 'All') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => p.category === selectedCategory));
    }
  }, [selectedCategory, products]);

  const fetchProducts = async () => {
    setLoadError('');
    setLoading(true);

    const wakeBackend = async () => {
      try {
        await fetch(apiUrl('/api/health'), { method: 'GET', cache: 'no-store' });
      } catch (error) {
        // Best-effort warm-up call for sleeping backends.
      }
    };

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      await wakeBackend();

      let response = null;
      let lastError = null;
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          response = await axios.get(apiUrl('/api/products'));
          break;
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) {
            await wait(1200 * attempt);
          }
        }
      }

      if (!response) {
        throw lastError || new Error('Unable to load products');
      }

      const productList = Array.isArray(response.data) ? response.data : [];
      setProducts(productList);
      setFilteredProducts(productList);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setFilteredProducts([]);
      setLoadError('Products are taking longer to load. Please tap retry.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10">
      <section className="hero-panel mb-8 sm:mb-10">
        <div className="hero-copy">
          <span className="hero-pill">Handmade. Heartfelt. Home-ready.</span>
          <h1 className="hero-title">Crochet Pieces That Feel Personal</h1>
          <p className="hero-text">
            Discover thoughtfully crafted crochet gifts and decor for everyday joy, gifting moments, and cozy spaces.
          </p>
          <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3" id="collections">
            <a href="#product-catalog" className="btn-primary inline-flex items-center justify-center gap-2 text-sm sm:text-base">
              Explore Collection
              <ArrowRight size={16} />
            </a>
            <Link to="/register" className="btn-secondary inline-flex items-center justify-center text-sm sm:text-base">
              Create Account
            </Link>
            <Link to="/login" className="text-sm sm:text-base font-semibold text-slate-700 px-3 py-2 hover:text-slate-900 transition">
              Already a member? Sign in
            </Link>
          </div>
        </div>
        <div className="hero-stat">
          <div className="space-y-3">
            <div>
              <p className="hero-stat-number">{loadError ? '--' : `${products.length}+`}</p>
              <p className="hero-stat-label">Crafted pieces currently available</p>
            </div>
            <div>
              <p className="hero-stat-number">{loadError ? '--' : `${uniqueCategories.length} Categories`}</p>
              <p className="hero-stat-label">From tiny keepsakes to statement decor</p>
            </div>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="mb-6 rounded-2xl border bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-sm text-slate-700">{loadError}</p>
          <button type="button" onClick={fetchProducts} className="btn-secondary rounded-xl px-4 py-2">
            Retry
          </button>
        </div>
      )}

      <section id="why-dhaaga" className="mb-8 sm:mb-10 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <article className="value-card">
          <Sparkles size={18} className="text-brand-accent" />
          <h3 className="value-title">Unique Designs</h3>
          <p className="value-text">Each item carries a handmade finish, so your order feels one-of-a-kind.</p>
        </article>
        <article className="value-card">
          <ShieldCheck size={18} className="text-brand-accent" />
          <h3 className="value-title">Secure Payments</h3>
          <p className="value-text">Razorpay-backed checkout with verified transaction flow.</p>
        </article>
        <article className="value-card">
          <Truck size={18} className="text-brand-accent" />
          <h3 className="value-title">Reliable Delivery</h3>
          <p className="value-text">Transparent shipping quotes and smooth order tracking.</p>
        </article>
      </section>

      <section id="product-catalog" className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p className="catalog-caption">Shop by category</p>
            <h2 className="catalog-title">Find your next favorite</h2>
          </div>
          <Link to="/cart" className="btn-secondary inline-flex items-center gap-2 px-4 py-2 rounded-xl">
            <Gift size={16} />
            View Cart
          </Link>
        </div>
      </section>

      <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {loadError ? 'Unable to load products right now.' : 'No products found in this category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;