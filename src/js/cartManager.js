// File: js/cartManager.js
/**
 * Cart Management System for Kaayko Store
 * - Max 2 unique products (by productId)
 * - Persistent across session (localStorage)
 * - Events for cart updates
 */

class CartManager {
  constructor() {
    this.storageKey = 'kaayko_cart';
    this.listeners = [];
    this.load();
  }

  // Load cart from localStorage
  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.cart = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load cart:', e);
      this.cart = [];
    }
  }

  // Save cart to localStorage
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to save cart:', e);
    }
  }

  // Get all cart items
  getItems() {
    return [...this.cart];
  }

  // Get cart item count (unique products)
  getCount() {
    return this.cart.length;
  }

  // Check if product is in cart
  hasProduct(productId) {
    return this.cart.some(item => item.productId === productId);
  }

  // Get specific cart item by productId
  getItem(productId) {
    return this.cart.find(item => item.productId === productId);
  }

  // Can add new product? (max 2 unique)
  canAddNewProduct() {
    return this.cart.length < 2;
  }

  // Add or update item in cart
  addItem({ productId, title, subtitle, price, imgSrc, size, gender }) {
    const existingIndex = this.cart.findIndex(item => item.productId === productId);
    
    const item = {
      productId,
      title,
      subtitle,
      price,
      imgSrc: imgSrc[0], // Use first image
      size,
      gender,
      addedAt: Date.now()
    };

    if (existingIndex >= 0) {
      // Update existing item
      this.cart[existingIndex] = { ...this.cart[existingIndex], ...item };
    } else {
      // Add new item (if allowed)
      if (!this.canAddNewProduct()) {
        return false; // Cart full
      }
      this.cart.push(item);
    }

    this.save();
    return true;
  }

  // Update item size/gender
  updateItem(productId, { size, gender }) {
    const item = this.cart.find(item => item.productId === productId);
    if (item) {
      if (size) item.size = size;
      if (gender) item.gender = gender;
      this.save();
      return true;
    }
    return false;
  }

  // Remove item from cart
  removeItem(productId) {
    const initialLength = this.cart.length;
    this.cart = this.cart.filter(item => item.productId !== productId);
    if (this.cart.length !== initialLength) {
      this.save();
      return true;
    }
    return false;
  }

  // Clear entire cart
  clear() {
    this.cart = [];
    this.save();
  }

  // Get total price
  getTotalPrice() {
    return this.cart.reduce((total, item) => {
      const price = parseFloat(item.price.replace(/[^0-9.]/g, ''));
      return total + price;
    }, 0);
  }

  // Subscribe to cart changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.getItems()));
  }
}

// Export singleton instance
export const cartManager = new CartManager();
