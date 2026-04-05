const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const Review = require('../models/Review');
const Product = require('../models/Product');

const router = express.Router();

const reviewsUploadDir = path.join(__dirname, '..', 'uploads', 'reviews');
if (!fs.existsSync(reviewsUploadDir)) {
  fs.mkdirSync(reviewsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: reviewsUploadDir,
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'review';
    cb(null, `${safeBase}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  },
});

const deleteReviewImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) {
    return;
  }

  const absolutePath = path.join(__dirname, '..', imagePath.replace(/^\//, ''));
  fs.unlink(absolutePath, () => {
    // Ignore cleanup errors; review operations should not fail because of stale files.
  });
};

// Get all reviews for a product
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ productId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Create a new review
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { productId, comment, removeImage } = req.body;
    const rating = Number(req.body.rating);
    const userId = req.user.userId;
    const email = req.user.email;
    const uploadedImage = req.file ? `/uploads/reviews/${req.file.filename}` : '';

    // Validate inputs
    if (!productId || !rating || !comment) {
      return res.status(400).json({ message: 'productId, rating, and comment are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (comment.trim().length === 0 || comment.trim().length > 500) {
      return res.status(400).json({ message: 'Comment must be between 1 and 500 characters' });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.comment = comment;

      if (uploadedImage) {
        deleteReviewImage(existingReview.image);
        existingReview.image = uploadedImage;
      } else if (removeImage === 'true') {
        deleteReviewImage(existingReview.image);
        existingReview.image = '';
      }

      await existingReview.save();
      return res.status(200).json(existingReview);
    }

    // Create new review
    const newReview = new Review({
      productId,
      userId,
      email,
      rating,
      comment,
      image: uploadedImage,
    });

    await newReview.save();
    res.status(201).json(newReview);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }
    res.status(500).json({ message: 'Error creating review', error: error.message });
  }
});

// Delete a review (user can only delete their own)
router.delete('/:reviewId', authMiddleware, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    deleteReviewImage(review.image);
    await Review.findByIdAndDelete(reviewId);
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review', error: error.message });
  }
});

module.exports = router;
