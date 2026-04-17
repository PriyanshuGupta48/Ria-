import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star, Trash2, AlertCircle, ImagePlus, X } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { apiUrl, assetUrl } from '../config/api';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Review form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewImage, setReviewImage] = useState(null);
  const [reviewImagePreview, setReviewImagePreview] = useState('');
  const [removeReviewImage, setRemoveReviewImage] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [userReview, setUserReview] = useState(null);
  const currentUserId = user?.id || user?.userId || '';

  useEffect(() => {
    if (!reviewImage) {
      setReviewImagePreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(reviewImage);
    setReviewImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [reviewImage]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));

  // Fetch product and reviews
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productRes, reviewsRes] = await Promise.all([
          axios.get(apiUrl(`/api/products/${id}`)),
          axios.get(apiUrl(`/api/reviews/${id}`)),
        ]);
        setProduct(productRes.data);
        setReviews(reviewsRes.data);

        // Check if user has already reviewed this product
        if (user) {
          const existingReview = reviewsRes.data.find((r) => String(r.userId) === String(currentUserId));
          if (existingReview) {
            setUserReview(existingReview);
            setRating(existingReview.rating);
            setComment(existingReview.comment);
            setRemoveReviewImage(false);
          }
        }
      } catch (error) {
        toast.error('Failed to load product details');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, currentUserId]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please log in to submit a review');
      return;
    }

    if (!comment.trim()) {
      toast.error('Please write a comment');
      return;
    }

    if (reviewImage && reviewImage.size > 5 * 1024 * 1024) {
      toast.error('Image size must be 5MB or less');
      return;
    }

    setSubmittingReview(true);
    try {
      const reviewData = new FormData();
      reviewData.append('productId', id);
      reviewData.append('rating', String(rating));
      reviewData.append('comment', comment.trim());

      if (reviewImage) {
        reviewData.append('image', reviewImage);
      }

      if (removeReviewImage) {
        reviewData.append('removeImage', 'true');
      }

      const response = await axios.post(apiUrl('/api/reviews'), reviewData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update reviews list
      if (userReview) {
        setReviews(reviews.map((r) => (r._id === response.data._id ? response.data : r)));
      } else {
        setReviews([response.data, ...reviews]);
      }
      setUserReview(response.data);
      setComment(response.data.comment || '');
      setRating(response.data.rating || rating);
      setReviewImage(null);
      setRemoveReviewImage(false);
      toast.success('Review submitted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return;

    try {
      await axios.delete(apiUrl(`/api/reviews/${reviewId}`), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setReviews(reviews.filter((r) => r._id !== reviewId));
      setUserReview(null);
      setRating(5);
      setComment('');
      setReviewImage(null);
      setReviewImagePreview('');
      setRemoveReviewImage(false);
      toast.success('Review deleted successfully!');
    } catch (error) {
      toast.error('Error deleting review');
    }
  };

  const handleAddToCart = () => {
    addToCart(product._id, quantity);
    toast.success(`Added ${quantity} item(s) to cart!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderBottomColor: 'var(--brand-primary)' }}></div>
          <p className="mt-4 text-slate-700">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
          <p className="text-slate-700">Product not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const images = product.images?.length > 0 ? product.images : [product.image];
  const currentImage = images[activePhotoIndex];
  const details = product.details || {};
  const detailRows = [
    { label: 'Size', value: details.size },
    { label: 'Color', value: details.color },
    { label: 'Washable', value: details.washable },
    { label: 'Material', value: details.material },
    { label: 'Pattern / Style', value: details.pattern },
    { label: 'Care Instructions', value: details.careInstructions },
    { label: 'Origin', value: details.origin },
  ].filter((row) => String(row.value || '').trim().length > 0);
  const averageRating =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0;

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 mb-6 text-sm sm:text-base font-semibold transition"
          style={{ color: 'var(--brand-primary)' }}
        >
          <ChevronLeft className="h-5 w-5" />
          Back to Products
        </button>

        {/* Product Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-12">
          {/* Gallery */}
          <div className="space-y-3 lg:space-y-4">
            <div className="relative rounded-3xl overflow-hidden h-72 sm:h-96 lg:h-[34rem] flex items-center justify-center border shadow-md bg-white" style={{ borderColor: 'var(--border-soft)' }}>
              <img src={assetUrl(currentImage)} alt={product.name} className="w-full h-full object-cover" />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActivePhotoIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2.5 shadow-lg transition"
                  >
                    <ChevronLeft className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
                  </button>
                  <button
                    onClick={() => setActivePhotoIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2.5 shadow-lg transition"
                  >
                    <ChevronRight className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-2xl border-2 overflow-hidden transition ${
                      activePhotoIndex === idx ? 'scale-[1.02]' : ''
                    }`}
                    style={{ borderColor: activePhotoIndex === idx ? 'var(--brand-primary)' : 'var(--border-soft)' }}
                  >
                    <img src={assetUrl(img)} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4 sm:space-y-5 lg:space-y-6">
            <div className="rounded-3xl bg-white border shadow-md p-5 sm:p-6" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="inline-flex mb-3 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white" style={{ background: 'linear-gradient(120deg, var(--brand-accent) 0%, #49a580 100%)' }}>
                {product.category}
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-800 mb-2 leading-tight">{product.name}</h1>
              <div className="flex items-center flex-wrap gap-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(averageRating) ? 'fill-current' : 'text-slate-200'
                      }`}
                      style={i < Math.round(averageRating) ? { color: 'var(--brand-primary)' } : undefined}
                    />
                  ))}
                </div>
                <span className="text-slate-600">
                  {averageRating} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </div>
              <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                <p className="text-slate-600 text-sm sm:text-base">Price</p>
                <p className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: 'var(--brand-primary)' }}>
                  {formatCurrency(product.price)}
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-white border shadow-md p-5 sm:p-6" style={{ borderColor: 'var(--border-soft)' }}>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Description</h3>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">{product.description}</p>
            </div>

            {detailRows.length > 0 && (
              <div className="bg-white border rounded-3xl p-4 sm:p-5 shadow-md" style={{ borderColor: 'var(--border-soft)' }}>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3">Item Details</h3>
                <div className="space-y-2">
                  {detailRows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4 border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: 'var(--border-soft)' }}>
                      <span className="text-slate-500 text-sm">{row.label}</span>
                      <span className="text-slate-700 text-sm font-medium text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add to Cart Section */}
            <div className="space-y-3 sm:space-y-4 bg-white p-4 sm:p-5 lg:p-6 rounded-3xl border shadow-md" style={{ borderColor: 'var(--border-soft)' }}>
              <p className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--brand-accent)' }}>Purchase Options</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="text-slate-700 font-semibold text-sm sm:text-base">Quantity:</label>
                <div className="flex items-center gap-2 sm:gap-3 border rounded-xl w-fit" style={{ borderColor: 'var(--border-soft)' }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 transition text-sm sm:text-base"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    −
                  </button>
                  <span className="w-6 sm:w-8 text-center font-semibold text-slate-700 text-sm sm:text-base">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 transition text-sm sm:text-base"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                className="w-full btn-primary rounded-xl"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="border-t pt-8 sm:pt-10 lg:pt-12" style={{ borderColor: 'var(--border-soft)' }}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 mb-6 sm:mb-8">Reviews ({reviews.length})</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Review Form */}
            <div className="lg:col-span-1">
              <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-3xl border shadow-md sticky top-20 lg:top-24" style={{ borderColor: 'var(--border-soft)' }}>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4">
                  {userReview ? 'Edit Your Review' : 'Write a Review'}
                </h3>
                {user ? (
                  <form onSubmit={handleSubmitReview} className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 sm:mb-2">Rating</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className="transition"
                          >
                            <Star
                              className={`h-5 w-5 sm:h-6 sm:w-6 ${
                                star <= rating
                                  ? 'fill-current'
                                  : 'text-slate-300 hover:text-slate-400'
                              }`}
                              style={star <= rating ? { color: 'var(--brand-primary)' } : undefined}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Comment</label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value.slice(0, 500))}
                        placeholder="Share your thoughts..."
                        className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 text-slate-700 resize-none"
                        style={{ borderColor: 'var(--border-soft)', '--tw-ring-color': 'color-mix(in srgb, var(--brand-primary) 25%, white)' }}
                        rows={4}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {comment.length}/500 characters
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Photo of received item (optional)</label>
                      <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl px-4 py-3 bg-white text-slate-700 cursor-pointer transition" style={{ borderColor: 'var(--border-soft)' }}>
                        <ImagePlus className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
                        <span className="text-sm">Upload photo</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setReviewImage(file);
                            setRemoveReviewImage(false);
                          }}
                        />
                      </label>
                      {(reviewImagePreview || (userReview?.image && !removeReviewImage)) && (
                        <div className="mt-3 relative">
                          <img
                            src={reviewImagePreview || assetUrl(userReview.image)}
                            alt="Review upload preview"
                            className="w-full h-40 object-cover rounded-xl border"
                            style={{ borderColor: 'var(--border-soft)' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setReviewImage(null);
                              if (userReview?.image && !reviewImagePreview) {
                                setRemoveReviewImage(true);
                              }
                            }}
                            className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 p-1 rounded-full shadow"
                            aria-label="Remove review image"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-1">Accepted: JPG, PNG, WEBP, GIF (max 5MB)</p>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="w-full btn-primary rounded-xl disabled:opacity-70"
                    >
                      {submittingReview ? 'Submitting...' : userReview ? 'Update Review' : 'Submit Review'}
                    </button>

                    {userReview && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(userReview._id)}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 rounded-xl transition flex items-center justify-center gap-2 border border-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Review
                      </button>
                    )}
                  </form>
                ) : (
                  <p className="text-slate-600 text-sm">
                    Please <a href="/login" className="hover:underline" style={{ color: 'var(--brand-primary)' }}>log in</a> to write a review.
                  </p>
                )}
              </div>
            </div>

            {/* Reviews List */}
            <div className="lg:col-span-2 space-y-4">
              {reviews.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border shadow-sm" style={{ borderColor: 'var(--border-soft)' }}>
                  <p className="text-slate-600">No reviews yet. Be the first to review!</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review._id} className="bg-white p-6 rounded-3xl border shadow-sm" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-slate-700">{review.email.split('@')[0]}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating ? 'fill-current' : 'text-slate-200'
                                }`}
                                style={i < review.rating ? { color: 'var(--brand-primary)' } : undefined}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-slate-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {currentUserId && String(currentUserId) === String(review.userId) && (
                        <button
                          onClick={() => handleDeleteReview(review._id)}
                          className="text-red-500 hover:text-red-700 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-slate-700">{review.comment}</p>
                    {review.image && (
                      <img
                        src={assetUrl(review.image)}
                        alt="User shared item"
                        className="mt-3 w-full max-w-sm h-56 object-cover rounded-2xl border"
                        style={{ borderColor: 'var(--border-soft)' }}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
