import React, { useMemo, useState } from 'react';
import { ShoppingCart, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { assetUrl } from '../config/api';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  const photos = useMemo(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images;
    }
    return product.image ? [product.image] : [];
  }, [product.images, product.image]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const activePhoto = photos[activePhotoIndex] || photos[0] || '';

  return (
    <div className="card group product-card">
      <div
        className="relative overflow-hidden bg-rose-50 cursor-pointer w-full aspect-video sm:h-64"
        onClick={() => navigate(`/product/${product._id}`)}
      >
        <img
          src={assetUrl(activePhoto)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo, index) => (
              <button
                key={photo + index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhotoIndex(index);
                }}
                className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  index === activePhotoIndex ? 'border-rose-400' : 'border-white'
                }`}
              >
                <img src={assetUrl(photo)} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-2">
          <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-1 rounded-full inline-block">
            {product.category} • {photos.length} photo{photos.length === 1 ? '' : 's'}
          </span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-2 line-clamp-2">{product.name}</h3>
        <div className="flex justify-between items-center gap-2">
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(product.price)}</span>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/product/${product._id}`)}
              className="btn-secondary inline-flex items-center gap-2 px-3 py-2"
              title="View details"
            >
              <Eye size={18} />
            </button>
            <button
              onClick={() => addToCart(product._id)}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2"
            >
              <ShoppingCart size={18} />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;