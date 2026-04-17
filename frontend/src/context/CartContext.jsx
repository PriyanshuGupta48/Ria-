import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { apiUrl } from '../config/api';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(null);
  const { user } = useAuth();

  const fetchCart = async () => {
    if (!user) {
      setCart(null);
      return;
    }
    try {
      const response = await axios.get(apiUrl('/api/cart'));
      setCart(response.data);
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  const addToCart = async (productId, quantity = 1) => {
    if (!user) {
      toast.error('Please login to add items to cart');
      return false;
    }
    try {
      const response = await axios.post(apiUrl('/api/cart/add'), {
        productId,
        quantity
      });
      setCart(response.data);
      toast.success('Added to cart!');
      return true;
    } catch (error) {
      toast.error('Failed to add to cart');
      return false;
    }
  };

  const updateQuantity = async (productId, quantity) => {
    try {
      const response = await axios.put(apiUrl(`/api/cart/update/${productId}`), {
        quantity
      });
      setCart(response.data);
    } catch (error) {
      toast.error('Failed to update cart');
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const response = await axios.delete(apiUrl(`/api/cart/remove/${productId}`));
      setCart(response.data);
      toast.success('Removed from cart');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const getCartTotal = () => {
    if (!cart || !cart.items) return 0;
    return cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);
  };

  const placeOrder = async (checkoutPayload = {}) => {
    if (!user) {
      toast.error('Please login to place an order');
      return false;
    }

    try {
      await axios.post(apiUrl('/api/orders/place'), checkoutPayload);
      toast.success('Order placed successfully!');
      await fetchCart();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to place order');
      return false;
    }
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      updateQuantity,
      removeFromCart,
      getCartTotal,
      fetchCart,
      placeOrder
    }}>
      {children}
    </CartContext.Provider>
  );
};