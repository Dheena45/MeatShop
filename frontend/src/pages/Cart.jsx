import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall, resolveImage } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { showToast } from '../lib/toast';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { useCart } from '../context/CartContext';

/* Cart — ported from cart.html + js/cart.js */
export default function Cart() {
  const navigate = useNavigate();
  const { setCart, refresh } = useCart();
  const [cart, setLocalCart] = useState(null);
  const [error, setError] = useState('');

  const loadCart = useCallback(async () => {
    try {
      const res = await apiCall('/api/cart');
      setLocalCart(res.data);
      setCart(res.data);
    } catch (e) {
      if (e.status === 401) { navigate('/login?redirect=' + encodeURIComponent('/cart')); return; }
      setError(e.message);
    }
  }, [navigate, setCart]);

  useEffect(() => { loadCart(); }, [loadCart]);

  function changeQty(itemId, delta) {
    const item = (cart.items || []).find(i => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    const minQty = Number(item.minOrderQty) || 1;
    if (newQty < minQty) { showToast('Minimum order quantity is ' + minQty + ' KG', 'error'); return; }
    if (newQty > Number(item.availableStock)) { showToast('Only ' + item.availableStock + ' KG available', 'error'); return; }
    updateCart(itemId, { quantity: newQty });
  }

  function updateCart(itemId, payload) {
    apiCall('/api/cart/items/' + itemId, { method: 'PUT', body: payload })
      .then(res => { setLocalCart(res.data); setCart(res.data); refresh(); })
      .catch(err => showToast(err.message, 'error'));
  }

  function removeItem(itemId) {
    apiCall('/api/cart/items/' + itemId, { method: 'DELETE' })
      .then(() => { showToast('Item removed'); loadCart(); refresh(); })
      .catch(err => showToast(err.message, 'error'));
  }

  function clearCart() {
    if (!window.confirm('Are you sure you want to clear your cart?')) return;
    apiCall('/api/cart', { method: 'DELETE' })
      .then(() => { showToast('Cart cleared'); loadCart(); refresh(); })
      .catch(err => showToast(err.message, 'error'));
  }

  function goCheckout() {
    if (!cart || !cart.items.length) { showToast('Your cart is empty', 'warning'); return; }
    navigate('/checkout');
  }

  if (error) {
    return (
      <section className="section-pad pt-4">
        <div className="container">
          <h1 className="section-title mb-4">Your Cart</h1>
          <EmptyState icon="fa-triangle-exclamation" title={error} />
        </div>
      </section>
    );
  }

  if (!cart) {
    return (
      <section className="section-pad pt-4">
        <div className="container">
          <h1 className="section-title mb-4">Your Cart</h1>
          <Spinner />
        </div>
      </section>
    );
  }

  const items = cart.items || [];

  return (
    <section className="section-pad pt-4">
      <div className="container">
        <h1 className="section-title mb-4">Your Cart</h1>
        <div className="row g-4">
          <div className="col-lg-8">
            {items.length === 0 ? (
              <div className="cart-table">
                <EmptyState icon="fa-basket-shopping" title="Your cart is empty" text="Add some fresh cuts to get started." to="/shop" actionLabel="Browse Products" />
              </div>
            ) : (
              <div className="cart-table">
                {items.map(item => {
                  const eff = Number(item.effectiveUnitPrice || item.unitPrice);
                  const original = Number(item.unitPrice || eff);
                  const discounted = original > eff;
                  const outStock = !item.available || Number(item.availableStock) <= 0;
                  return (
                    <div className="cart-line" key={item.id}>
                      <Link to={'/product-details?id=' + item.productId}>
                        <img src={resolveImage(item.productImage)} alt={item.productName} />
                      </Link>
                      <div className="cl-info flex-grow-1">
                        <h6><Link to={'/product-details?id=' + item.productId} className="text-dark">{item.productName}</Link></h6>
                        <div className="cl-meta">
                          {item.cuttingOption ? <span className="badge text-bg-light me-2">{item.cuttingOption.replace(/_/g, ' ')}</span> : null}
                          Rate: <strong>{fmtMoney(eff)}</strong>/KG
                          {discounted ? <span className="text-muted text-decoration-line-through">{fmtMoney(original)}</span> : null}
                        </div>
                        {outStock ? <div className="text-danger small mt-1">Only {item.availableStock} KG left &mdash; update quantity</div> : null}
                      </div>
                      <div className="d-flex flex-column align-items-end gap-2">
                        <button className="cl-remove" onClick={() => removeItem(item.id)} title="Remove"><i className="fa-solid fa-trash-can"></i></button>
                        <div className="qty-stepper">
                          <button type="button" onClick={() => changeQty(item.id, -1)}><i className="fa-solid fa-minus"></i></button>
                          <input type="number" value={item.quantity} readOnly />
                          <button type="button" onClick={() => changeQty(item.id, 1)}><i className="fa-solid fa-plus"></i></button>
                        </div>
                      </div>
                      <div className="text-end" style={{ minWidth: 100 }}>
                        <strong>{fmtMoney(Number(item.subtotal || 0))}</strong>
                        <div className="text-muted small">{item.quantity} KG</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="d-flex justify-content-between flex-wrap gap-2 mt-3">
              <Link to="/shop" className="btn btn-fm-outline"><i className="fa-solid fa-arrow-left me-1"></i> Continue Shopping</Link>
              {items.length ? (
                <button className="btn btn-fm-outline" onClick={clearCart} style={{ borderColor: '#dc3545', color: '#dc3545' }}>
                  <i className="fa-solid fa-trash me-1"></i>Clear Cart
                </button>
              ) : null}
            </div>
          </div>
          <div className="col-lg-4">
            <div className="summary-card">
              <h5 className="mb-3">Order Summary</h5>
              <div className="summary-line"><span>Items</span><span>{cart.totalItems || 0}</span></div>
              <div className="summary-line"><span>Subtotal</span><span>{fmtMoney(cart.subtotal || 0)}</span></div>
              <div className="summary-line muted"><span>Discount</span><span className="text-success">- {fmtMoney(cart.discount || 0)}</span></div>
              <div className="summary-line muted"><span>Delivery Charge</span><span>{Number(cart.deliveryCharge || 0) > 0 ? fmtMoney(cart.deliveryCharge) : 'FREE'}</span></div>
              <div className="summary-divider"></div>
              <div className="summary-total"><span>Grand Total</span><span>{fmtMoney(cart.grandTotal || 0)}</span></div>
              <small className="text-muted d-block mt-1">Free delivery on orders above &#8377;499</small>
              <button className="btn btn-fm w-100 btn-fm-lg mt-3" onClick={goCheckout} disabled={!items.length}>
                <i className="fa-solid fa-lock me-1"></i>Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
