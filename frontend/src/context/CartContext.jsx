import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiCall } from '../lib/api';
import { useAuth } from './AuthContext';

/* Cart state shared by the header badge, the shop's sticky cart bar and the
   cart/checkout pages. Refreshes whenever the customer auth session changes. */

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isLoggedIn, role, logout, refresh: refreshAuth } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isLoggedIn || role !== 'customer') { setCart(null); return null; }
    setLoading(true);
    try {
      const res = await apiCall('/api/cart');
      setCart(res.data || null);
      return res.data || null;
    } catch (e) {
      if (e && e.status === 401) { logout(); }
      setCart(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, role, logout]);

  useEffect(() => { refresh(); }, [refresh]);

  /* Adds a product to the cart (used by product cards / details). */
  const addItem = useCallback(async (productId, quantity = 1, cuttingOption) => {
    const res = await apiCall('/api/cart/items', {
      method: 'POST',
      body: { productId, quantity, cuttingOption }
    });
    setCart(res && res.data ? res.data : cart);
    if (!res || !res.data) await refresh();
    return res;
  }, [cart, refresh]);

  const value = {
    cart,
    count: cart ? Number(cart.totalItems || 0) : 0,
    loading,
    refresh,
    addItem,
    setCart,
    /* Re-read the session (used by pages that just changed profile data). */
    refreshAuth
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
