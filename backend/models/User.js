const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const savedAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    default: '',
    trim: true,
  },
  phoneNumber: {
    type: String,
    default: '',
    trim: true,
  },
  email: {
    type: String,
    default: '',
    trim: true,
    lowercase: true,
  },
  houseNo: {
    type: String,
    default: '',
    trim: true,
  },
  street: {
    type: String,
    default: '',
    trim: true,
  },
  landmark: {
    type: String,
    default: '',
    trim: true,
  },
  city: {
    type: String,
    default: '',
    trim: true,
  },
  state: {
    type: String,
    default: '',
    trim: true,
  },
  pinCode: {
    type: String,
    default: '',
    trim: true,
  },
  country: {
    type: String,
    default: 'India',
    trim: true,
  },
  label: {
    type: String,
    default: 'Home',
    trim: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
}, { _id: true, timestamps: true });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: false,
    default: null
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    default: null,
    sparse: true
  },
  addresses: {
    type: [savedAddressSchema],
    default: [],
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', async function(next) {
  // Keep backward compatibility with existing isAdmin data.
  if (this.isModified('role')) {
    this.isAdmin = this.role === 'admin';
  } else if (this.isModified('isAdmin')) {
    this.role = this.isAdmin ? 'admin' : 'user';
  }

  if (!this.password) return next();
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }

  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);