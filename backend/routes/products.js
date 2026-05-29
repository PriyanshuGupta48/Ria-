const express = require('express');
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { uploadImage, deleteImageAsset } = require('../utils/mediaStorage');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Get all products for admin with internal fields
router.get('/admin/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { category } = req.query;
    let query = {};
    if (category && category !== 'All') {
      query.category = category;
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all products (public)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let query = {};
    if (category && category !== 'All') {
      query.category = category;
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

const normalizeUploadedImages = async (files = []) => {
  const uploaded = await Promise.all(files.map((file) => uploadImage(file, { folder: 'products' })));
  return uploaded.map((item) => item.url);
};

const parseRemovedImages = (rawValue) => {
  if (!rawValue) return [];

  if (Array.isArray(rawValue)) {
    return rawValue.filter(Boolean);
  }

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const removeImageFile = async (imagePath) => {
  await deleteImageAsset(imagePath);
};

const parseProductDetails = (rawDetails) => {
  if (!rawDetails) {
    return {};
  }

  if (typeof rawDetails === 'object' && !Array.isArray(rawDetails)) {
    return rawDetails;
  }

  if (typeof rawDetails === 'string') {
    try {
      const parsed = JSON.parse(rawDetails);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return {};
    }
  }

  return {};
};

const normalizeDetails = (details = {}) => ({
  size: details.size || '',
  color: details.color || '',
  washable: details.washable || '',
  material: details.material || '',
  pattern: details.pattern || '',
  careInstructions: details.careInstructions || '',
  origin: details.origin || '',
});

// parse helpers for weight/dimensions removed

// Add new product (admin only)
router.post('/', authMiddleware, adminMiddleware, upload.array('images', 10), async (req, res) => {
  try {
    const { name, price, category, description } = req.body;
    const details = normalizeDetails(parseProductDetails(req.body.details));
    // weight/dimensions removed - no validation required for fixed shipping model
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    const images = await normalizeUploadedImages(req.files);
    
    const product = new Product({
      name,
      price: parseFloat(price),
      category,
      description: description || '',
      details,
      image: images[0],
      images
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete product (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update product (admin only)
router.put('/:id', authMiddleware, adminMiddleware, upload.array('images', 10), async (req, res) => {
  try {
    const { name, price, category, description } = req.body;
    const hasDetailsPayload = req.body.details !== undefined;
    const details = hasDetailsPayload ? normalizeDetails(parseProductDetails(req.body.details)) : null;
    const product = await Product.findById(req.params.id);
    // weight/dimensions removed - skip parsing/validation

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.name = name ?? product.name;
    product.price = price !== undefined ? parseFloat(price) : product.price;
    product.category = category ?? product.category;
    // no-op for removed weight/dim fields
    product.description = description ?? product.description;
    if (hasDetailsPayload) {
      product.details = details;
    }

    const removedImages = parseRemovedImages(req.body.removedImages);
    const removedSet = new Set(removedImages);

    let existingImages = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];

    if (removedSet.size > 0) {
      existingImages = existingImages.filter((imagePath) => !removedSet.has(imagePath));
      await Promise.all(removedImages.map((imagePath) => removeImageFile(imagePath)));
    }

    if (req.files && req.files.length > 0) {
      const newImages = await normalizeUploadedImages(req.files);
      product.images = [...existingImages, ...newImages];
    } else {
      product.images = existingImages;
    }

    if (!product.images || product.images.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    product.image = product.images[0];

    await product.save();
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;