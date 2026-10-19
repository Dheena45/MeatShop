import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { showToast } from '../lib/toast';
import { deliverySlotsForDay, slotLabel } from '../lib/slots';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

/* Checkout — ported from checkout.html + js/checkout.js */
export default function Checkout() {
  const navigate = useNavigate();
  const { user, save, token, logout } = useAuth();
  const { setCart, refresh } = useCart();

  const [cart, setLocalCart] = useState(null);
  const [cartError, setCartError] = useState('');
  const [fields, setFields] = useState({ name: '', phone: '', email: '' });
  const [addr, setAddr] = useState({ doorNumber: '', street: '', area: '', city: '', state: '', pincode: '' });
  const [notes, setNotes] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressEditorMode, setAddressEditorMode] = useState('idle'); // idle | new | edit
  const [saveAddressChecked, setSaveAddressChecked] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedPay, setSelectedPay] = useState('CASH_ON_DELIVERY');
  const [placing, setPlacing] = useState(false);

  // Seed the customer fields from the cached session immediately.
  useEffect(() => {
    setFields({
      name: (user && user.name) || '',
      phone: (user && user.phone) || '',
      email: (user && user.email) || ''
    });
  }, [user]);

  const handleAuthExpired = useCallback(() => {
    logout();
    showToast('Your session has expired. Please log in again.', 'error', { title: 'Session Expired' });
    setTimeout(() => navigate('/login?redirect=' + encodeURIComponent('/checkout')), 1000);
  }, [logout, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Profile (best-effort) — refresh the form + cached user.
      try {
        const res = await apiCall('/api/profile');
        if (cancelled) return;
        const p = res.data || {};
        setFields({ name: p.name || '', phone: p.phone || '', email: p.email || '' });
        save(token, {
          id: p.id != null ? p.id : (user && user.id),
          name: p.name, email: p.email, phone: p.phone,
          role: p.role || (user && user.role)
        });
      } catch (e) {
        if (e.status === 401) { handleAuthExpired(); return; }
        showToast('Could not load your saved details. Please check them before ordering.', 'warning');
      }

      // Cart
      try {
        const res = await apiCall('/api/cart');
        if (cancelled) return;
        setLocalCart(res.data);
        setCart(res.data);
      } catch (e) {
        if (e.status === 401) { handleAuthExpired(); return; }
        setCartError(e.message);
      }

      // Saved addresses
      try {
        const res = await apiCall('/api/addresses');
        if (cancelled) return;
        const list = (res.data || []).filter(a => a && a.city && a.pincode);
        setSavedAddresses(list);
        setAddressesLoaded(true);
        if (list.length) {
          const def = list.find(a => a.isDefault) || (list.length === 1 ? list[0] : null);
          if (def) selectAddress(def.id, list);
        }
      } catch (e) {
        if (e.status === 401) { handleAuthExpired(); return; }
        setAddressesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, []);

  function selectAddress(id, list = savedAddresses) {
    const a = list.find(x => x.id === id);
    if (!a) return;
    setSelectedAddressId(a.id);
    setEditingAddressId(null);
    setAddressEditorMode('idle');
    setAddr({
      doorNumber: a.doorNumber || '', street: a.street || '', area: a.area || '',
      city: a.city || '', state: a.state || '', pincode: a.pincode || ''
    });
  }

  function addNewAddress() {
    setSelectedAddressId(null);
    setEditingAddressId(null);
    setAddressEditorMode('new');
    setAddr({ doorNumber: '', street: '', area: '', city: '', state: '', pincode: '' });
  }

  function editAddress(id) {
    const targetId = id != null ? id : selectedAddressId;
    const a = savedAddresses.find(x => x.id === targetId);
    if (!a) { addNewAddress(); return; }
    setSelectedAddressId(a.id);
    setEditingAddressId(a.id);
    setAddressEditorMode('edit');
    setAddr({
      doorNumber: a.doorNumber || '', street: a.street || '', area: a.area || '',
      city: a.city || '', state: a.state || '', pincode: a.pincode || ''
    });
  }

  function cancelAddressEdit() {
    setEditingAddressId(null);
    setAddressEditorMode('idle');
    if (selectedAddressId != null) selectAddress(selectedAddressId);
  }

  function validateAddress(f) {
    if (!f.doorNumber) return 'Please enter the door / house number';
    if (!f.street) return 'Please enter the street';
    if (!f.area) return 'Please enter the area / locality';
    if (!f.city) return 'Please enter the city';
    if (!f.state) return 'Please enter the state';
    if (!/^\d{6}$/.test(f.pincode)) return 'Please enter a valid 6-digit pincode';
    return '';
  }

  async function saveAddress() {
    const validation = validateAddress(addr);
    if (validation) { showToast(validation, 'warning'); return; }
    const existing = editingAddressId != null ? savedAddresses.find(a => a.id === editingAddressId) : null;
    const payload = {
      ...addr,
      label: existing && existing.label ? existing.label : 'Home',
      isDefault: existing ? Boolean(existing.isDefault) : savedAddresses.length === 0
    };
    try {
      let saved;
      if (editingAddressId != null) {
        const res = await apiCall('/api/addresses/' + editingAddressId, { method: 'PUT', body: payload });
        saved = res.data;
        showToast('Address updated');
      } else {
        const res = await apiCall('/api/addresses', { method: 'POST', body: payload });
        saved = res.data;
        showToast('Address saved');
      }
      // reload list
      const listRes = await apiCall('/api/addresses');
      const list = (listRes.data || []).filter(a => a && a.city && a.pincode);
      setSavedAddresses(list);
      setEditingAddressId(null);
      setAddressEditorMode('idle');
      const targetId = saved && saved.id != null ? saved.id : selectedAddressId;
      if (targetId != null) selectAddress(targetId, list);
    } catch (e) {
      if (e.status === 401) { handleAuthExpired(); return; }
      showToast(e.message || 'Could not save the address', 'error');
    }
  }

  async function persistAddressAfterOrder() {
    if (!saveAddressChecked) return;
    if (editingAddressId != null) return;
    const norm = v => (v == null ? '' : String(v).trim().toLowerCase());
    const already = savedAddresses.some(a =>
      norm(a.doorNumber) === norm(addr.doorNumber) && norm(a.street) === norm(addr.street) &&
      norm(a.area) === norm(addr.area) && norm(a.city) === norm(addr.city) &&
      norm(a.state) === norm(addr.state) && norm(a.pincode) === norm(addr.pincode));
    if (already) return;
    try {
      await apiCall('/api/addresses', {
        method: 'POST',
        body: { ...addr, label: 'Home', isDefault: savedAddresses.length === 0 }
      });
    } catch (e) { /* order already placed */ }
  }

  async function placeOrder() {
    if (placing) return;
    if (fields.name.trim().length < 2) { showToast('Please enter your full name', 'warning'); return; }
    if (!/^[6-9]\d{9}$/.test(fields.phone.trim())) { showToast('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.', 'warning'); return; }
    if (!/^\S+@\S+\.\S+$/.test(fields.email.trim())) { showToast('Please enter a valid email', 'warning'); return; }
    const addressError = validateAddress(addr);
    if (addressError) { showToast(addressError, 'warning'); return; }
    if (!selectedSlot) { showToast('Please select a delivery slot', 'warning'); return; }

    setPlacing(true);
    const payload = {
      customerName: fields.name.trim(),
      customerPhone: fields.phone.trim(),
      customerEmail: fields.email.trim(),
      deliveryDoor: addr.doorNumber,
      deliveryStreet: addr.street,
      deliveryArea: addr.area,
      deliveryCity: addr.city,
      deliveryState: addr.state,
      deliveryPincode: addr.pincode,
      deliverySlot: selectedSlot,
      paymentMethod: selectedPay,
      notes: notes.trim() || null
    };
    try {
      const res = await apiCall('/api/orders', { method: 'POST', body: payload });
      refresh();
      await persistAddressAfterOrder();
      const order = res.data || {};
      const orderNumber = order.orderNumber || '';
      if (selectedPay === 'ONLINE') {
        showToast('Order placed. Complete the UPI payment to confirm it.', 'info', { title: 'Payment Required' });
        setTimeout(() => {
          navigate('/payment?order=' + order.id + (orderNumber ? '&no=' + encodeURIComponent(orderNumber) : ''));
        }, 900);
      } else {
        showToast('Your order has been placed. The store will confirm it soon.', 'success', { title: 'Order Placed' });
        setTimeout(() => {
          navigate('/order-tracking?id=' + order.id + (orderNumber ? '&no=' + encodeURIComponent(orderNumber) : ''));
        }, 900);
      }
    } catch (err) {
      if (err.status === 401) { handleAuthExpired(); return; }
      showToast(err.message || 'Order failed', 'error');
      setPlacing(false);
    }
  }

  // Cart empty → show the empty state (mirrors renderSummary swapping the panel).
  if (cart && (cart.items || []).length === 0) {
    return (
      <section className="section-pad pt-4">
        <div className="container">
          <h1 className="section-title mb-4">Checkout</h1>
          <EmptyState icon="fa-basket-shopping" title="Your cart is empty" to="/shop" actionLabel="Go to Shop" />
        </div>
      </section>
    );
  }

  if (cartError) {
    return (
      <section className="section-pad pt-4">
        <div className="container">
          <h1 className="section-title mb-4">Checkout</h1>
          <EmptyState icon="fa-triangle-exclamation" title={cartError} />
        </div>
      </section>
    );
  }

  if (!cart) {
    return (
      <section className="section-pad pt-4">
        <div className="container">
          <h1 className="section-title mb-4">Checkout</h1>
          <Spinner />
        </div>
      </section>
    );
  }

  const items = cart.items || [];
  const today = new Date();
  const slots = deliverySlotsForDay(today.getDay());
  const isOnline = selectedPay === 'ONLINE';

  return (
    <section className="section-pad pt-4">
      <div className="container">
        <h1 className="section-title mb-4">Checkout</h1>
        <div className="row g-4">
          <div className="col-lg-8">
            {/* STEP 1 */}
            <div className="checkout-step">
              <h5><span className="step-num">1</span> Customer Information</h5>
              <div className="row g-3 mt-2">
                <div className="col-md-4">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-control form-control-fm" placeholder="Your full name"
                    value={fields.name} onChange={e => setFields({ ...fields, name: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Mobile Number</label>
                  <input type="tel" className="form-control form-control-fm" maxLength={10} placeholder="10-digit mobile"
                    value={fields.phone}
                    onChange={e => setFields({ ...fields, phone: e.target.value.replace(/\D+/g, '').slice(0, 10) })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control form-control-fm" placeholder="you@example.com"
                    value={fields.email} onChange={e => setFields({ ...fields, email: e.target.value })} />
                </div>
              </div>
            </div>

            {/* STEP 2 */}
            <div className="checkout-step">
              <h5><span className="step-num">2</span> Delivery Address</h5>
              {!addressesLoaded ? <div className="small text-muted mb-2">Loading your saved addresses&hellip;</div> : null}
              <div className="saved-address-list mb-3">
                {savedAddresses.map(a => {
                  const selected = a.id === selectedAddressId;
                  return (
                    <div key={a.id} className={'saved-address-card' + (selected ? ' selected' : '')}
                      onClick={() => selectAddress(a.id)}>
                      <div className="saved-address-info">
                        <div>
                          <strong>{a.label || ('Address ' + a.id)}</strong>
                          {a.isDefault ? <span className="default-badge">Default</span> : null}
                          {selected && !a.isDefault ? <span className="default-badge selected-badge">Selected</span> : null}
                        </div>
                        <div className="saved-address-meta">
                          {[a.doorNumber, a.street, a.area, a.city, a.state, a.pincode].filter(v => v != null && String(v).trim() !== '').join(', ')}
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm btn-link text-decoration-none"
                        onClick={e => { e.stopPropagation(); editAddress(a.id); }}>
                        <i className="fa-solid fa-pen"></i> Edit
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className="btn btn-sm btn-fm-outline" onClick={addNewAddress}>
                  <i className="fa-solid fa-plus me-1"></i>Add New Address
                </button>
                {selectedAddressId != null && addressEditorMode === 'idle' ? (
                  <button type="button" className="btn btn-sm btn-fm-outline" onClick={() => editAddress()}>
                    <i className="fa-solid fa-pen me-1"></i>Edit Selected
                  </button>
                ) : null}
              </div>

              <div>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Door / House No.</label>
                    <input type="text" className="form-control form-control-fm" placeholder="12-A"
                      value={addr.doorNumber} onChange={e => setAddr({ ...addr, doorNumber: e.target.value })} />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Street</label>
                    <input type="text" className="form-control form-control-fm" placeholder="Street name"
                      value={addr.street} onChange={e => setAddr({ ...addr, street: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Area</label>
                    <input type="text" className="form-control form-control-fm" placeholder="Area / locality"
                      value={addr.area} onChange={e => setAddr({ ...addr, area: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">City</label>
                    <input type="text" className="form-control form-control-fm" placeholder="City"
                      value={addr.city} onChange={e => setAddr({ ...addr, city: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">State</label>
                    <input type="text" className="form-control form-control-fm" placeholder="State"
                      value={addr.state} onChange={e => setAddr({ ...addr, state: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Pincode</label>
                    <input type="text" className="form-control form-control-fm" maxLength={6} placeholder="6-digit pincode"
                      value={addr.pincode} onChange={e => setAddr({ ...addr, pincode: e.target.value.replace(/\D+/g, '').slice(0, 6) })} />
                  </div>
                </div>
                {addressEditorMode !== 'idle' ? (
                  <div className="d-flex gap-2 mt-3">
                    <button type="button" className="btn btn-sm btn-fm" onClick={saveAddress}>
                      <i className="fa-solid fa-floppy-disk me-1"></i>{addressEditorMode === 'edit' ? 'Update Address' : 'Save Address'}
                    </button>
                    <button type="button" className="btn btn-sm btn-fm-outline" onClick={cancelAddressEdit}>Cancel</button>
                  </div>
                ) : null}
              </div>

              <div className="form-check mt-3">
                <input className="form-check-input" type="checkbox" id="co-save-address"
                  checked={saveAddressChecked} onChange={e => setSaveAddressChecked(e.target.checked)} />
                <label className="form-check-label small" htmlFor="co-save-address">Save this address to my profile</label>
              </div>
            </div>

            {/* STEP 3 */}
            <div className="checkout-step">
              <h5><span className="step-num">3</span> Delivery Slot</h5>
              <p className="text-muted small mb-3">Pick a delivery window for today.</p>
              <div className="row g-2">
                {slots.map(slot => (
                  <div className="col-6 col-md-4" key={slot}>
                    <div className={'slot-option' + (selectedSlot === slot ? ' selected' : '')}
                      onClick={() => setSelectedSlot(slot)}>{slotLabel(slot)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 4 */}
            <div className="checkout-step">
              <h5><span className="step-num">4</span> Payment Method</h5>
              <div className={'pay-option' + (selectedPay === 'CASH_ON_DELIVERY' ? ' selected' : '')}
                onClick={() => setSelectedPay('CASH_ON_DELIVERY')}>
                <i className="fa-solid fa-hand-holding-dollar fs-4" style={{ color: 'var(--success)' }}></i>
                <div>
                  <strong>Cash on Delivery</strong>
                  <div className="text-muted small">Pay in cash when your order arrives.</div>
                </div>
              </div>
              <div className={'pay-option' + (selectedPay === 'ONLINE' ? ' selected' : '')}
                onClick={() => setSelectedPay('ONLINE')}>
                <i className="fa-solid fa-mobile-screen-button fs-4" style={{ color: 'var(--primary)' }}></i>
                <div>
                  <strong>UPI / Online Payment</strong>
                  <div className="text-muted small">Pay securely using UPI before delivery.</div>
                </div>
              </div>
            </div>

            <div className="checkout-step">
              <h5><span className="step-num">5</span> Notes (Optional)</h5>
              <textarea className="form-control form-control-fm" rows={2} placeholder="Any delivery instructions..."
                value={notes} onChange={e => setNotes(e.target.value)}></textarea>
            </div>
          </div>

          {/* ORDER SUMMARY */}
          <div className="col-lg-4">
            <div className="summary-card">
              <h5>Order Summary</h5>
              <div className="mt-2 mb-2">
                {items.map(item => (
                  <div className="d-flex justify-content-between align-items-center small mb-2" key={item.id}>
                    <span>{item.productName.split(' ').slice(0, 3).join(' ')} <span className="text-muted">&times; {item.quantity} KG</span></span>
                    <span>{fmtMoney(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="summary-divider"></div>
              <div className="summary-line"><span>Subtotal</span><span>{fmtMoney(cart.subtotal)}</span></div>
              <div className="summary-line muted"><span>Discount</span><span className="text-success">- {fmtMoney(cart.discount)}</span></div>
              <div className="summary-line muted"><span>Delivery Charge</span><span>{Number(cart.deliveryCharge || 0) > 0 ? fmtMoney(cart.deliveryCharge) : 'FREE'}</span></div>
              <div className="summary-divider"></div>
              <div className="summary-total"><span>Grand Total</span><span>{fmtMoney(cart.grandTotal)}</span></div>
              <small className="text-muted d-block mt-1">
                <i className={'fa-solid me-1 ' + (isOnline ? 'fa-mobile-screen-button' : 'fa-hand-holding-dollar')}></i>
                {isOnline ? 'UPI / Online Payment' : 'Cash on Delivery'}
              </small>
              <button className="btn btn-fm w-100 btn-fm-lg mt-3" onClick={placeOrder} disabled={placing}>
                {placing ? <><span className="spinner-border spinner-border-sm me-2"></span>Placing Order...</> : <><i className="fa-solid fa-check me-1"></i>Place Order</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
