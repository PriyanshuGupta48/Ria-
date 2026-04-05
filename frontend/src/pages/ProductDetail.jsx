import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star, Trash2, AlertCircle, ImagePlus, X } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

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
          axios.get(`http://localhost:3500/api/products/${id}`),
          axios.get(`http://localhost:3500/api/reviews/${id}`),
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

      const response = await axios.post('http://localhost:3500/api/reviews', reviewData, {
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
      await axios.delete(`http://localhost:3500/api/reviews/${reviewId}`, {
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-rose-400"></div>
          <p className="mt-4 text-slate-700">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-rose-400 mx-auto mb-4" />
          <p className="text-slate-700">Product not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-rose-400 text-white rounded-lg hover:bg-rose-500"
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
    <div className="min-h-screen bg-white pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-rose-400 hover:text-rose-500 mb-6"
        >
          <ChevronLeft className="h-5 w-5" />
          Back to Products
        </button>

        {/* Product Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="relative bg-rose-50 rounded-lg overflow-hidden h-96 flex items-center justify-center border-2 border-rose-100">
              <img src={`http://localhost:5000${currentImage}`} alt={product.name} className="w-full h-full object-contain" />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActivePhotoIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-lg hover:bg-rose-50 transition"
                  >
                    <ChevronLeft className="h-5 w-5 text-rose-400" />
                  </button>
                  <button
                    onClick={() => setActivePhotoIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-lg hover:bg-rose-50 transition"
                  >
                    <ChevronRight className="h-5 w-5 text-rose-400" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition ${
                      activePhotoIndex === idx ? 'border-rose-400' : 'border-rose-100'
                    }`}
                  >
                    <img src={`http://localhost:5000${img}`} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-700 mb-2">{product.name}</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(averageRating) ? 'fill-rose-400 text-rose-400' : 'text-rose-100'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-slate-600">
                  {averageRating} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            </div>

            <div className="border-t-2 border-b-2 border-rose-100 py-4 space-y-2">
              <p className="text-slate-600">Price</p>
              <p className="text-3xl font-bold text-rose-500">{formatCurrency(product.price)}</p>
              <p className="text-sm text-slate-500">Category: {product.category}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Description</h3>
              <p className="text-slate-600 leading-relaxed">{product.description}</p>
            </div>

            {detailRows.length > 0 && (
              <div className="bg-white border-2 border-rose-100 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Item Details</h3>
                <div className="space-y-2">
                  {detailRows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4 border-b border-rose-50 pb-2 last:border-0 last:pb-0">
                      <span className="text-slate-500 text-sm">{row.label}</span>
                      <span className="text-slate-700 text-sm font-medium text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add to Cart Section */}
            <div className="space-y-4 bg-rose-50 p-6 rounded-lg border-2 border-rose-100">
              <div className="flex items-center gap-4">
                <label className="text-slate-700 font-semibold">Quantity:</label>
                <div className="flex items-center gap-3 border-2 border-rose-200 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-rose-400 hover:bg-rose-100 transition"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold text-slate-700">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 text-rose-400 hover:bg-rose-100 transition"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                className="w-full bg-gradient-to-r from-rose-300 to-rose-400 hover:from-rose-400 hover:to-rose-500 text-white font-bold py-3 rounded-lg transition duration-200"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="border-t-2 border-rose-100 pt-12">
          <h2 className="text-3xl font-bold text-slate-700 mb-8">Reviews ({reviews.length})</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Review Form */}
            <div className="lg:col-span-1">
              <div className="bg-rose-50 p-6 rounded-lg border-2 border-rose-100 sticky top-24">
                <h3 className="text-lg font-semibold text-slate-700 mb-4">
                  {userReview ? 'Edit Your Review' : 'Write a Review'}
                </h3>
                {user ? (
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Rating</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className="transition"
                          >
                            <Star
                              className={`h-6 w-6 ${
                                star <= rating
                                  ? 'fill-rose-400 text-rose-400'
                                  : 'text-rose-200 hover:text-rose-300'
                              }`}
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
                        className="w-full p-3 border-2 border-rose-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 text-slate-700 resize-none"
                        rows={4}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {comment.length}/500 characters
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Photo of received item (optional)</label>
                      <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-rose-200 rounded-lg px-4 py-3 bg-white text-slate-700 hover:border-rose-300 cursor-pointer transition">
                        <ImagePlus className="h-4 w-4 text-rose-400" />
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
                            src={reviewImagePreview || `http://localhost:5000${userReview.image}`}
                            alt="Review upload preview"
                            className="w-full h-40 object-cover rounded-lg border border-rose-200"
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
                      className="w-full bg-rose-400 hover:bg-rose-500 disabled:bg-rose-300 text-white font-semibold py-2 rounded-lg transition"
                    >
                      {submittingReview ? 'Submitting...' : userReview ? 'Update Review' : 'Submit Review'}
                    </button>

                    {userReview && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(userReview._id)}
                        className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Review
                      </button>
                    )}
                  </form>
                ) : (
                  <p className="text-slate-600 text-sm">
                    Please <a href="/login" className="text-rose-400 hover:underline">log in</a> to write a review.
                  </p>
                )}
              </div>
            </div>

            {/* Reviews List */}
            <div className="lg:col-span-2 space-y-4">
              {reviews.length === 0 ? (
                <div className="text-center py-12 bg-rose-50 rounded-lg border-2 border-rose-100">
                  <p className="text-slate-600">No reviews yet. Be the first to review!</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review._id} className="bg-white p-6 rounded-lg border-2 border-rose-100">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-slate-700">{review.email.split('@')[0]}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating ? 'fill-rose-400 text-rose-400' : 'text-rose-100'
                                }`}
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
                        src={`http://localhost:5000${review.image}`}
                        alt="User shared item"
                        className="mt-3 w-full max-w-sm h-56 object-cover rounded-lg border border-rose-100"
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
