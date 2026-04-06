const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const reviewRoutes = require('./routes/reviews');
const orderRoutes = require('./routes/orders');
const User = require('./models/User');

dotenv.config();

const app = express();

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);

// MongoDB connection
const seedAdminUser = async () => {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  const adminUser = await User.findOne({ email: adminEmail });

  if (adminUser) {
    adminUser.role = 'admin';
    adminUser.isAdmin = true;
    adminUser.password = adminPassword;
    await adminUser.save();
    return;
  }

  await User.create({
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
    isAdmin: true,
  });
};

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');

    await seedAdminUser();

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing backend process before starting a new one.`);
        process.exit(1);
      }

      console.error('Server error:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Available env vars:', {
      MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'MISSING',
      PORT: process.env.PORT || 'Using default 5000',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'MISSING'
    });
    process.exit(1);
  }
};

startServer();