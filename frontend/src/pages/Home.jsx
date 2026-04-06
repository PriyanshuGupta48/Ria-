import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import CategoryFilter from '../components/CategoryFilter';
import { apiUrl } from '../config/api';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

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
    try {
      const response = await axios.get(apiUrl('/api/products'));
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
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
    <div className="container mx-auto px-4 py-8">
      <section className="hero-panel mb-10">
        <div className="hero-copy">
          <span className="hero-pill">Curated Croatia</span>
          <h1 className="hero-title">Authentic Croatian Treasures</h1>
          <p className="hero-text">
            Discover gifts, decor, and keepsakes inspired by Croatia’s coastlines, culture, and craft.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/my-orders" className="btn-primary inline-flex items-center justify-center">
              My Orders
            </Link>
            <Link to="/cart" className="btn-secondary inline-flex items-center justify-center">
              Go to Cart
            </Link>
          </div>
        </div>
        <div className="hero-stat">
          <div>
            <p className="hero-stat-number">Handpicked</p>
            <p className="hero-stat-label">Premium souvenirs and thoughtful gifts</p>
          </div>
        </div>
      </section>

      <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products found in this category.</p>
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