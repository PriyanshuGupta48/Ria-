const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const reviewRoutes = require('./routes/reviews');
const orderRoutes = require('./routes/orders');
const couponRoutes = require('./routes/coupons');
const User = require('./models/User');

const app = express();

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/api/ping', (req, res) => {
  res.json({ ok: true });
});

// Proxy pincode lookup to avoid browser CORS issues and provide a stable backend fallback
const https = require('https');

app.get('/api/utils/pincode/:pincode', async (req, res) => {
  const raw = String(req.params.pincode || '');
  const pincode = raw.replace(/\D/g, '').slice(0, 6);

  if (pincode.length !== 6) {
    return res.status(400).json({ message: 'Invalid pincode' });
  }

  try {
    const apiUrl = `https://api.postalpincode.in/pincode/${pincode}`;

    https.get(apiUrl, (apiRes) => {
      let raw = '';
      apiRes.on('data', (chunk) => (raw += chunk));
      apiRes.on('end', () => {
        try {
          const data = JSON.parse(raw);
          return res.json(data);
        } catch (parseErr) {
          console.error('Pincode lookup parse failed:', parseErr?.message || parseErr);
          return res.status(502).json({ message: 'Invalid response from postal API', error: String(parseErr?.message || parseErr) });
        }
      });
    }).on('error', (e) => {
      console.error('Pincode lookup HTTP error:', e?.message || e);
      return res.status(502).json({ message: 'Failed to fetch pincode data', error: String(e?.message || e) });
    });
  } catch (err) {
    console.error('Pincode lookup failed:', err?.message || err);
    return res.status(502).json({ message: 'Failed to fetch pincode data', error: String(err?.message || err) });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', couponRoutes);

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

// Note: Provide a lightweight https-based fetch fallback for environments
// where global `fetch` isn't available. The /api/utils/pincode route uses
// the builtin `https` module to avoid adding dependencies.