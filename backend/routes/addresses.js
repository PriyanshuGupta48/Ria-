const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const normalizeAddress = (rawAddress = {}) => ({
  fullName: String(rawAddress.fullName || '').trim(),
  phoneNumber: String(rawAddress.phoneNumber || '').trim(),
  email: String(rawAddress.email || '').trim().toLowerCase(),
  houseNo: String(rawAddress.houseNo || '').trim(),
  street: String(rawAddress.street || rawAddress.laneNo || '').trim(),
  landmark: String(rawAddress.landmark || '').trim(),
  city: String(rawAddress.city || '').trim(),
  state: String(rawAddress.state || '').trim(),
  pinCode: String(rawAddress.pinCode || '').trim(),
  country: String(rawAddress.country || 'India').trim(),
  label: String(rawAddress.label || 'Home').trim() || 'Home',
  isDefault: Boolean(rawAddress.isDefault),
});

const validateAddress = (address) => {
  const requiredFields = ['fullName', 'phoneNumber', 'houseNo', 'street', 'city', 'state', 'pinCode', 'country'];
  for (const field of requiredFields) {
    if (!String(address[field] || '').trim()) {
      return `Address field '${field}' is required`;
    }
  }

  if (!/^\d{10}$/.test(address.phoneNumber)) {
    return 'Phone number must be a valid 10 digit mobile number';
  }

  if (!/^\d{6}$/.test(address.pinCode)) {
    return 'Pin code must be a valid 6 digit code';
  }

  return '';
};

const getUserWithAddresses = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  user.addresses = Array.isArray(user.addresses) ? user.addresses : [];
  return user;
};

const serializeAddress = (address) => ({
  id: address._id,
  fullName: address.fullName,
  phoneNumber: address.phoneNumber,
  email: address.email,
  houseNo: address.houseNo,
  street: address.street,
  landmark: address.landmark,
  city: address.city,
  state: address.state,
  pinCode: address.pinCode,
  country: address.country,
  label: address.label,
  isDefault: Boolean(address.isDefault),
  createdAt: address.createdAt,
  updatedAt: address.updatedAt,
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await getUserWithAddresses(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      addresses: user.addresses.map(serializeAddress),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load addresses', error: String(error?.message || error) });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const address = normalizeAddress(req.body.address || req.body);
    const validationError = validateAddress(address);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const user = await getUserWithAddresses(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const shouldSetDefault = user.addresses.length === 0 || Boolean(address.isDefault);
    if (shouldSetDefault) {
      user.addresses.forEach((entry) => {
        entry.isDefault = false;
      });
    }

    const newAddress = {
      ...address,
      isDefault: shouldSetDefault,
    };

    user.addresses.push(newAddress);
    await user.save();

    const savedAddress = user.addresses[user.addresses.length - 1];
    return res.status(201).json({
      message: 'Address saved successfully',
      address: serializeAddress(savedAddress),
      addresses: user.addresses.map(serializeAddress),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save address', error: String(error?.message || error) });
  }
});

router.put('/:addressId', authMiddleware, async (req, res) => {
  try {
    const address = normalizeAddress(req.body.address || req.body);
    const validationError = validateAddress(address);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const user = await getUserWithAddresses(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetAddress = user.addresses.id(req.params.addressId);
    if (!targetAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }

    Object.assign(targetAddress, {
      ...address,
      isDefault: Boolean(address.isDefault) || targetAddress.isDefault,
    });

    if (address.isDefault) {
      user.addresses.forEach((entry) => {
        if (String(entry._id) !== String(targetAddress._id)) {
          entry.isDefault = false;
        }
      });
    }

    await user.save();

    return res.json({
      message: 'Address updated successfully',
      address: serializeAddress(targetAddress),
      addresses: user.addresses.map(serializeAddress),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update address', error: String(error?.message || error) });
  }
});

router.delete('/:addressId', authMiddleware, async (req, res) => {
  try {
    const user = await getUserWithAddresses(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetAddress = user.addresses.id(req.params.addressId);
    if (!targetAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const wasDefault = Boolean(targetAddress.isDefault);
    targetAddress.deleteOne();

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    return res.json({
      message: 'Address deleted successfully',
      addresses: user.addresses.map(serializeAddress),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete address', error: String(error?.message || error) });
  }
});

router.post('/:addressId/select', authMiddleware, async (req, res) => {
  try {
    const user = await getUserWithAddresses(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetAddress = user.addresses.id(req.params.addressId);
    if (!targetAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }

    user.addresses.forEach((entry) => {
      entry.isDefault = String(entry._id) === String(targetAddress._id);
    });

    await user.save();

    return res.json({
      message: 'Default address selected',
      address: serializeAddress(targetAddress),
      addresses: user.addresses.map(serializeAddress),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to select address', error: String(error?.message || error) });
  }
});

module.exports = router;
