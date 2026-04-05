const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${baseName}-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage: storage,
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
    const products = await Product.find(query).select('-weight -length -breadth -height').sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('-weight -length -breadth -height');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

const normalizeUploadedImages = (files = []) => files.map(file => `/uploads/${file.filename}`);

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

const removeImageFile = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) {
    return;
  }

  const filePath = path.join(__dirname, '..', imagePath.replace(/^\//, ''));
  fs.unlink(filePath, () => {
    // File cleanup should not block product updates.
  });
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

const parseWeightInGrams = (rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
};

const parseDimensionInCm = (rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
};

// Add new product (admin only)
router.post('/', authMiddleware, adminMiddleware, upload.array('images', 10), async (req, res) => {
  try {
    const { name, price, category, description, weight, length, breadth, height } = req.body;
    const details = normalizeDetails(parseProductDetails(req.body.details));
    const parsedWeight = parseWeightInGrams(weight);
    const parsedLength = parseDimensionInCm(length);
    const parsedBreadth = parseDimensionInCm(breadth);
    const parsedHeight = parseDimensionInCm(height);

    if (parsedWeight === null) {
      return res.status(400).json({ message: 'Product weight (grams) is required and must be greater than 0' });
    }

    if (parsedLength === null || parsedBreadth === null || parsedHeight === null) {
      return res.status(400).json({ message: 'Package dimensions (length, breadth, height in cm) are required and must be greater than 0' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    const images = normalizeUploadedImages(req.files);
    
    const product = new Product({
      name,
      price: parseFloat(price),
      category,
      weight: parsedWeight,
      length: parsedLength,
      breadth: parsedBreadth,
      height: parsedHeight,
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
    const { name, price, category, description, weight, length, breadth, height } = req.body;
    const hasDetailsPayload = req.body.details !== undefined;
    const details = hasDetailsPayload ? normalizeDetails(parseProductDetails(req.body.details)) : null;
    const product = await Product.findById(req.params.id);
    const parsedWeight = parseWeightInGrams(weight);
    const parsedLength = parseDimensionInCm(length);
    const parsedBreadth = parseDimensionInCm(breadth);
    const parsedHeight = parseDimensionInCm(height);

    if (parsedWeight === null) {
      return res.status(400).json({ message: 'Product weight (grams) is required and must be greater than 0' });
    }

    if (parsedLength === null || parsedBreadth === null || parsedHeight === null) {
      return res.status(400).json({ message: 'Package dimensions (length, breadth, height in cm) are required and must be greater than 0' });
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.name = name ?? product.name;
    product.price = price !== undefined ? parseFloat(price) : product.price;
    product.category = category ?? product.category;
    product.weight = parsedWeight;
    product.length = parsedLength;
    product.breadth = parsedBreadth;
    product.height = parsedHeight;
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
      removedImages.forEach(removeImageFile);
    }

    if (req.files && req.files.length > 0) {
      const newImages = normalizeUploadedImages(req.files);
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