const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const Review = require('../models/Review');
const {
  cloudinaryConfigured,
  uploadLocalPathToCloudinary,
} = require('../utils/mediaStorage');

dotenv.config();

const uploadsRoot = path.join(__dirname, '..', 'uploads');

const isLocalUploadPath = (value) => typeof value === 'string' && value.startsWith('/uploads/');

const toAbsoluteLocalPath = (value) => path.join(__dirname, '..', value.replace(/^\//, ''));

const uploadAndReplace = async (localPath, folder, cache) => {
  if (!isLocalUploadPath(localPath)) {
    return localPath;
  }

  if (cache.has(localPath)) {
    return cache.get(localPath);
  }

  const absolutePath = toAbsoluteLocalPath(localPath);
  if (!fs.existsSync(absolutePath)) {
    console.warn(`Skipping missing file: ${localPath}`);
    cache.set(localPath, localPath);
    return localPath;
  }

  const uploaded = await uploadLocalPathToCloudinary(absolutePath, { folder });
  cache.set(localPath, uploaded.url);
  console.log(`Uploaded ${localPath} -> ${uploaded.url}`);
  return uploaded.url;
};

const migrateProducts = async (cache) => {
  const products = await Product.find({});
  let updatedCount = 0;

  for (const product of products) {
    const originalImages = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];

    const nextImages = [];
    let changed = false;

    for (const imagePath of originalImages) {
      const nextPath = await uploadAndReplace(imagePath, 'products', cache);
      nextImages.push(nextPath);
      if (nextPath !== imagePath) {
        changed = true;
      }
    }

    if (nextImages.length === 0) {
      continue;
    }

    if (!product.image || product.image !== nextImages[0]) {
      product.image = nextImages[0];
      changed = true;
    }

    if (JSON.stringify(product.images || []) !== JSON.stringify(nextImages)) {
      product.images = nextImages;
      changed = true;
    }

    if (changed) {
      await product.save();
      updatedCount += 1;
    }
  }

  return updatedCount;
};

const migrateReviews = async (cache) => {
  const reviews = await Review.find({ image: { $exists: true, $ne: '' } });
  let updatedCount = 0;

  for (const review of reviews) {
    if (!isLocalUploadPath(review.image)) {
      continue;
    }

    const nextPath = await uploadAndReplace(review.image, 'reviews', cache);
    if (nextPath !== review.image) {
      review.image = nextPath;
      await review.save();
      updatedCount += 1;
    }
  }

  return updatedCount;
};

const main = async () => {
  if (!cloudinaryConfigured) {
    throw new Error('Cloudinary env vars are missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET first.');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  if (!fs.existsSync(uploadsRoot)) {
    console.log('No uploads directory found. Nothing to migrate.');
    return;
  }

  const cache = new Map();
  const productUpdates = await migrateProducts(cache);
  const reviewUpdates = await migrateReviews(cache);

  console.log(`Migration complete. Updated ${productUpdates} products and ${reviewUpdates} reviews.`);
};

main()
  .catch((error) => {
    console.error('Media migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });