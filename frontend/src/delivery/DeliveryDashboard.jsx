import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiCall } from '../lib/api';
import { fmtMoney, fmtDate } from '../lib/format';
import { showToast } from '../lib/toast';
import { useAuth } from '../context/AuthContext';

/* FreshMeat — Delivery Boy dashboard (ported from
   static/delivery/dashboard.html + delivery/js/dashboard.js).

   Talks only to /api/delivery/**. Any other order id is rejected server side
   with 403, so there is nothing to hide on the client either. The active role
   (/delivery/*) makes the API client send the DELIVERY_BOY token. */

const TABS = [
  { state: '', label: 'All' },
  { state: 'ASSIGNED', label: 'To Pick Up' },
  { state: 'OUT_FOR_DELIVERY', label: 'On The Way' },
  { state: 'DELIVERED', label: 'Delivered' }
];

const STAT_DEFS = [
  { key: 'today', label: "Today's Deliveries", field: 'todayDeliveries', cls: 'accent-orange', icon: 'fa-boxes-stacked' },
  { key: 'pending', label: 'To Pick Up', field: 'pendingDeliveries', cls: 'accent-blue', icon: 'fa-location-arrow' },
  { key: 'transit', label: 'On The Way', field: 'outForDelivery', cls: 'accent-purple', icon: 'fa-truck-fast' },
  { key: 'done', label: 'Completed', field: 'completedDeliveries', cls: 'accent-green', icon: 'fa-circle-check' }
];

const CHIP_LABELS = {
  ASSIGNED: 'To Pick Up',
  OUT_FOR_DELIVERY: 'On The Way',
  DELIVERED: 'Delivered',
  PENDING_ASSIGNMENT: 'Unassigned'
};

function greetingFor(d) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function chipLabel(state) {
  return CHIP_LABELS[state] || String(state || '').replace(/_/g, ' ');
}

const busyKey = (action, id) => action + ':' + id;

/**
 * Client-side gate checked BEFORE calling the delivery-completion API. It only
 * mirrors the backend rule for UX; it never bypasses server enforcement, which
 * re-checks payment method, payment status and the boy's ownership.
 */
function deliveryGate(order) {
  if (!order) return { type: 'unknown' };
  const cod = order.paymentMethod === 'CASH_ON_DELIVERY';
  if (cod && order.paymentStatus !== 'PAID') return { type: 'cod-unpaid', order };
  if (order.paymentStatus !== 'PAID') return { type: 'unpaid', order };
  return null;
}

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [filterState, setFilterState] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState({});

  /* Bottom sheet: { open, order } */
  const [sheet, setSheet] = useState({ open: false, order: null });
  /* Cash collection modal: { open, order } */
  const [cash, setCash] = useState({ open: false, order: null });
  const [cashSaving, setCashSaving] = useState(false);
  const [cashError, setCashError] = useState('');
  /* Cash-not-collected warning modal: { open, order } */
  const [warn, setWarn] = useState({ open: false, order: null });

  const now = new Date();
  const greeting = greetingFor(now);
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  const handleAuth = useCallback((e) => {
    if (e && (e.status === 401 || e.status === 403)) {
      showToast(
        e.status === 403
          ? 'This delivery is not assigned to you.'
          : 'Your session expired. Please sign in again.',
        'error'
      );
      setTimeout(() => {
        logout();
        navigate('/login?role=delivery&redirect=' + encodeURIComponent('/delivery/dashboard'));
      }, 1600);
      return true;
    }
    return false;
  }, [logout, navigate]);

  /* ---------------- Data loading ---------------- */

  const loadSummary = useCallback(async () => {
    try {
      const res = await apiCall('/api/delivery/summary');
      setSummary(res.data || {});
    } catch (e) {
      if (handleAuth(e)) return;
      setSummary({});
    }
  }, [handleAuth]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setListError('');
    try {
      const p = new URLSearchParams();
      if (debouncedSearch) p.set('search', debouncedSearch);
      if (filterState) p.set('state', filterState);
      const res = await apiCall('/api/delivery/all?' + p.toString());
      const list = res.data || [];
      setOrders(list);
      return list;
    } catch (e) {
      if (handleAuth(e)) return [];
      setOrders([]);
      setListError(e.message || 'Please try again.');
      return [];
    } finally {
      setOrdersLoading(false);
    }
  }, [debouncedSearch, filterState, handleAuth]);

  const loadAll = useCallback(async (withSpin) => {
    if (withSpin) {
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 900);
    }
    const [, list] = await Promise.all([loadSummary(), loadOrders()]);
    return list || [];
  }, [loadSummary, loadOrders]);

  /* Debounce the search box exactly like the original (350ms). */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  /* Load the summary once, and the list whenever the tab/search changes. */
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  /* ---------------- Overlay helpers ---------------- */

  const closeSheet = useCallback(() => setSheet({ open: false, order: null }), []);

  const closeCashConfirm = useCallback(() => {
    setCash({ open: false, order: null });
    setCashError('');
    setCashSaving(false);
  }, []);

  const closeCashWarn = useCallback(() => setWarn({ open: false, order: null }), []);

  /* Lock body scroll while any sheet/modal is open (mirrors the original). */
  const anyOverlayOpen = sheet.open || cash.open || warn.open;
  useEffect(() => {
    document.body.style.overflow = anyOverlayOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [anyOverlayOpen]);

  /* Escape closes every overlay. */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        closeSheet();
        closeCashConfirm();
        closeCashWarn();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeSheet, closeCashConfirm, closeCashWarn]);

  /* ---------------- Actions ---------------- */

  function setBusyFor(key, value) {
    setBusy(prev => {
      const next = { ...prev };
      if (value) next[key] = true;
      else delete next[key];
      return next;
    });
  }

  async function doAction(orderId, action, successMsg) {
    const key = busyKey(action, orderId);
    setBusyFor(key, true);
    try {
      await apiCall('/api/delivery/' + orderId + '/' + action, { method: 'PUT' });
      showToast(successMsg, 'success');
      closeSheet();
      await loadAll();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Something went wrong.', 'error');
    } finally {
      setBusyFor(key, false);
    }
  }

  function openSheet(orderId) {
    const cached = orders.find(o => o.id === orderId);
    setSheet({ open: true, order: cached || null });

    apiCall('/api/delivery/' + orderId)
      .then(res => setSheet(prev => (prev.open ? { open: true, order: res.data } : prev)))
      .catch(e => {
        if (handleAuth(e)) return;
        showToast(e.message || 'Could not load this delivery.', 'error');
        closeSheet();
      });
  }

  function orderSnapshot(orderId) {
    if (sheet.open && sheet.order && sheet.order.id === orderId) return sheet.order;
    return orders.find(o => o.id === orderId) || null;
  }

  function handleDeliver(orderId) {
    const gate = deliveryGate(orderSnapshot(orderId));
    if (gate && gate.type === 'cod-unpaid') {
      openCashWarn(gate.order);
      return; // do NOT call the delivery API until the cash has been collected
    }
    if (gate) {
      showToast('This order cannot be marked delivered until its payment is complete.', 'error');
      return;
    }
    doAction(orderId, 'delivered', 'Order marked as delivered.');
  }

  function handleCardAction(action, id) {
    if (action === 'view') openSheet(id);
    else if (action === 'pickup') doAction(id, 'pickup', 'Pickup confirmed. Order is out for delivery!');
    else if (action === 'cash') openCashConfirm(id);
    else if (action === 'delivered') handleDeliver(id);
  }

  function handleSheetAction(action, id) {
    if (action === 'cash') openCashConfirm(id);
    else if (action === 'delivered') handleDeliver(id);
    else doAction(id, action, 'Pickup confirmed. Order is out for delivery!');
  }

  /* ---------------- Cash collection ---------------- */

  /** Opens a fresh copy of the order (server-authoritative) inside the modal. */
  async function openCashConfirm(orderId) {
    // The cash modal is the follow-up to the warning modal; dismiss the warning
    // first so the two dialogs never stack on the same overlay layer.
    closeCashWarn();
    try {
      const res = await apiCall('/api/delivery/' + orderId);
      setCashError('');
      setCashSaving(false);
      setCash({ open: true, order: res.data });
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not open cash collection.', 'error');
    }
  }

  async function confirmCashCollect() {
    if (!cash.order) return;

    setCashError('');
    setCashSaving(true);
    const orderId = cash.order.id;
    const amount = Number(cash.order.grandTotal);
    try {
      // The server re-validates the amount (it must equal the order total),
      // the COD method, the payment state and the boy's ownership; duplicate
      // collection and unpaid/cancelled states are rejected there.
      await apiCall('/api/delivery/' + orderId + '/payment-received', {
        method: 'PUT',
        body: { amount, transactionRef: '' }
      });
      showToast('Cash collected. Payment is PAID. You can now mark the order as delivered.', 'success');
      closeCashConfirm();
      const freshOrders = await loadAll();

      // Keep an open detail sheet in sync with the fresh server state so the
      // PAID badge and the newly-enabled Mark Delivered button appear in
      // place, without leaving this page.
      setSheet(prev => {
        if (!prev.open) return prev;
        const fresh = freshOrders.find(o => o.id === orderId);
        return fresh ? { open: true, order: fresh } : prev;
      });
    } catch (e) {
      if (handleAuth(e)) return;
      // The order stays OUT_FOR_DELIVERY and unpaid; tell the boy the exact
      // reason inline so the failure is never mistaken for a success.
      const message = e.message || 'Could not record the payment.';
      setCashError(message);
      showToast(message, 'error');
      setCashSaving(false);
    }
  }

  /* ---------------- Cash-not-collected warning ---------------- */

  function openCashWarn(order) {
    setWarn({ open: true, order });
  }

  function handleWarnCollect() {
    const target = warn.order;
    closeCashWarn();
    if (target) openCashConfirm(target.id);
  }

  /* ---------------- Rendering helpers ---------------- */

  function emptyBlock(icon, title, text) {
    return (
      <div className="db-empty">
        <i className={'fa-solid ' + icon}></i>
        <strong>{title}</strong>
        <p>{text || ''}</p>
      </div>
    );
  }

  function renderStats() {
    return STAT_DEFS.map(s => (
      <div className={'db-stat ' + s.cls} key={s.key}>
        <span className="db-stat-label"><i className={'fa-solid ' + s.icon + ' me-1'}></i>{s.label}</span>
        <span className="db-stat-value">{summary[s.field] || 0}</span>
      </div>
    ));
  }

  function renderCard(o) {
    const d = o.delivery || {};
    const state = d.state || 'PENDING_ASSIGNMENT';
    const cod = o.paymentMethod === 'CASH_ON_DELIVERY';
    const unpaid = o.paymentStatus !== 'PAID';

    const actions = [];
    if (d.canStart) {
      actions.push({ action: 'pickup', cls: 'db-btn-primary', icon: 'fa-box', label: 'Confirm Pickup' });
    }
    if (d.canCollectCash) {
      actions.push({ action: 'cash', cls: 'db-btn-gold', icon: 'fa-money-bill-wave', label: 'Collect ' + fmtMoney(o.grandTotal) });
    }
    // Mark Delivered stays visible for every order being delivered so the boy
    // always sees the way forward; the handler gates the COD unpaid case
    // (warning modal, no API call) before calling the API.
    if (state === 'OUT_FOR_DELIVERY') {
      actions.push({ action: 'delivered', cls: 'db-btn-green', icon: 'fa-circle-check', label: 'Mark Delivered' });
    }
    actions.push({ action: 'view', cls: 'db-btn-ghost', icon: 'fa-eye', label: 'Full Details' });

    let payLine;
    if (cod && unpaid && state !== 'DELIVERED') {
      payLine = (
        <div className="db-pay-line">
          <span className="db-cod-hint"><i className="fa-solid fa-money-bill-wave me-1"></i>Cash on delivery - not collected</span>
          <span className="db-pay-badge PENDING">{fmtMoney(o.grandTotal)}</span>
        </div>
      );
    } else {
      payLine = (
        <div className="db-pay-line">
          <span className={'db-pay-badge ' + (o.paymentStatus || 'PENDING')}>{String(o.paymentMethod || '').replace(/_/g, ' ')}</span>
          <span>
            <strong>{fmtMoney(o.grandTotal)}</strong>
            <span className={'db-pay-badge ' + (o.paymentStatus || 'PENDING')} style={{ marginLeft: '0.35rem' }}>{o.paymentStatus || 'PENDING'}</span>
          </span>
        </div>
      );
    }

    return (
      <article
        className={'db-card state-' + state}
        data-id={o.id}
        role="button"
        tabIndex={0}
        title="View order details"
        key={o.id}
        onClick={e => {
          if (e.target.closest('[data-action]')) return;
          openSheet(o.id);
        }}
        onKeyDown={e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          if (e.target.closest('[data-action]')) return;
          e.preventDefault();
          openSheet(o.id);
        }}
      >
        <div className="db-card-top">
          <div>
            <div className="db-order-no">#{o.orderNumber}</div>
            <div className="db-order-when">{fmtDate(o.createdAt)}</div>
          </div>
          <span className={'db-chip ' + state}>{chipLabel(state)}</span>
        </div>

        <div className="db-customer">{o.customerName || '-'} <span>- {o.customerPhone || ''}</span></div>
        <div className="db-address">
          <i className="fa-solid fa-location-dot me-1"></i>
          {[o.deliveryDoor, o.deliveryStreet, o.deliveryArea, o.deliveryCity, o.deliveryPincode].filter(Boolean).join(', ') || '-'}
        </div>
        <div className="db-meta">
          <span><i className="fa-regular fa-clock"></i>{o.deliverySlot || 'Any time'}</span>
          {d.deliveryDate && d.deliverySlot ? (
            <span><i className="fa-solid fa-calendar-days"></i>{d.deliveryDate} {d.deliverySlot}</span>
          ) : null}
          <span><i className="fa-solid fa-boxes-stacked"></i>{(o.items || []).length} item(s)</span>
          {d.startedAt ? <span><i className="fa-solid fa-box-open"></i>Picked Up {fmtDate(d.startedAt)}</span> : null}
          {d.completedAt ? <span><i className="fa-solid fa-flag-checkered"></i>Delivered {fmtDate(d.completedAt)}</span> : null}
        </div>

        {payLine}

        <div className="db-actions">
          {actions.map(a => {
            const key = busyKey(a.action, o.id);
            const isBusy = !!busy[key];
            return (
              <button
                key={a.action}
                className={'db-btn ' + a.cls + (isBusy ? ' loading' : '')}
                data-action={a.action}
                data-id={o.id}
                type="button"
                disabled={isBusy}
                onClick={e => {
                  e.stopPropagation();
                  handleCardAction(a.action, o.id);
                }}
              >
                <i className={'fa-solid ' + a.icon}></i>{a.label}
              </button>
            );
          })}
        </div>
      </article>
    );
  }

  function renderList() {
    if (ordersLoading) {
      return (
        <div className="db-empty">
          <i className="fa-solid fa-circle-notch fa-spin"></i>
          <p>Loading your deliveries...</p>
        </div>
      );
    }
    if (listError) {
      return emptyBlock('fa-triangle-exclamation', 'Could not load deliveries', listError);
    }
    if (!orders.length) {
      return (debouncedSearch || filterState)
        ? emptyBlock('fa-magnifying-glass', 'No matching deliveries', 'Try a different search or tab.')
        : emptyBlock('fa-box-open', 'Nothing assigned yet', 'New deliveries assigned to you will show up here.');
    }
    return orders.map(renderCard);
  }

  function renderSheetBody() {
    const o = sheet.order;
    if (!o) return null;

    const d = o.delivery || {};
    const state = d.state || 'PENDING_ASSIGNMENT';
    const cod = o.paymentMethod === 'CASH_ON_DELIVERY';
    const unpaid = o.paymentStatus !== 'PAID';

    const items = (o.items || []).map((i, idx) => (
      <li key={idx}>
        <span>
          {i.productName || 'Item'} <span className="db-ref">x{i.quantity} KG</span>
          {i.cuttingOption ? (
            <span className="db-detail-value muted" style={{ fontSize: '0.72rem', display: 'block' }}>
              {String(i.cuttingOption).replace(/_/g, ' ')}
            </span>
          ) : null}
        </span>
        <span>{fmtMoney(i.subtotal)}</span>
      </li>
    ));

    const acts = [];
    if (d.canStart) {
      acts.push({ action: 'pickup', cls: 'db-btn-primary', icon: 'fa-box', label: 'Confirm Pickup' });
    }
    if (d.canCollectCash) {
      acts.push({ action: 'cash', cls: 'db-btn-gold', icon: 'fa-money-bill-wave', label: 'Collect ' + fmtMoney(o.grandTotal) + ' Cash' });
    }
    if (state === 'OUT_FOR_DELIVERY') {
      acts.push({ action: 'delivered', cls: 'db-btn-green', icon: 'fa-circle-check', label: 'Mark Delivered' });
    }

    let sheetActions;
    if (!acts.length) {
      sheetActions = (
        <div className="db-detail-value muted" style={{ textAlign: 'center', padding: '0.5rem 0' }}>
          <i className="fa-solid fa-circle-info me-1"></i>No action needed from you on this delivery.
        </div>
      );
    } else {
      sheetActions = acts.map(a => {
        const key = busyKey(a.action, o.id);
        const isBusy = !!busy[key];
        return (
          <button
            key={a.action}
            className={'db-btn ' + a.cls + (isBusy ? ' loading' : '')}
            data-sheet-action={a.action}
            data-id={o.id}
            type="button"
            disabled={isBusy}
            onClick={() => handleSheetAction(a.action, o.id)}
          >
            <i className={'fa-solid ' + a.icon}></i>{a.label}
          </button>
        );
      });
    }

    return (
      <>
        <div className="db-detail-block">
          <div className="db-detail-label">Customer</div>
          <div className="db-detail-value">
            <strong>{o.customerName || '-'}</strong><br />
            <span className="db-detail-value muted">{o.customerPhone || ''}</span>
          </div>
        </div>

        <div className="db-detail-block">
          <div className="db-detail-label">Delivery Address</div>
          <div className="db-address-box">
            {[o.deliveryDoor, o.deliveryStreet, o.deliveryArea].filter(Boolean).join(', ') || '-'}<br />
            {[o.deliveryCity, o.deliveryPincode].filter(Boolean).join(' - ')}{o.deliveryState ? ', ' + o.deliveryState : ''}
          </div>
          <div className="db-detail-value muted mt-2">
            <i className="fa-regular fa-clock me-1"></i>Preferred slot: {o.deliverySlot || 'Any time'}
          </div>
        </div>

        <div className="db-detail-block">
          <div className="db-detail-label">Items ({(o.items || []).length})</div>
          <ul className="db-items">
            {items.length ? items : <li><span className="db-detail-value muted">No item details</span></li>}
          </ul>
          <div className="db-detail-value muted mt-2" style={{ fontSize: '0.82rem' }}>
            <div className="d-flex justify-content-between"><span>Subtotal</span><span>{fmtMoney(o.subtotal)}</span></div>
            <div className="d-flex justify-content-between"><span>Discount</span><span>-{fmtMoney(o.discountAmount)}</span></div>
            <div className="d-flex justify-content-between"><span>Delivery</span><span>{Number(o.deliveryCharge) === 0 ? 'FREE' : fmtMoney(o.deliveryCharge)}</span></div>
            <div className="d-flex justify-content-between fw-bold" style={{ color: 'var(--db-text)' }}><span>Total</span><span>{fmtMoney(o.grandTotal)}</span></div>
          </div>
        </div>

        <div className="db-detail-block">
          <div className="db-detail-label">Payment</div>
          <div className="db-detail-value">
            {String(o.paymentMethod || '-').replace(/_/g, ' ')}
            <span className={'db-pay-badge ' + (o.paymentStatus || 'PENDING')} style={{ marginLeft: '0.35rem' }}>{o.paymentStatus || 'PENDING'}</span>
            {cod && unpaid ? (
              <div className="db-cod-hint mt-1">
                <i className="fa-solid fa-triangle-exclamation me-1"></i>Please collect and submit the full cash payment before confirming delivery.
              </div>
            ) : null}
            {o.paidAt ? (
              <div className="db-detail-value muted" style={{ fontSize: '0.78rem' }}>Paid {fmtDate(o.paidAt)}</div>
            ) : null}
          </div>
        </div>

        <div className="db-detail-block">
          <div className="db-detail-label">Delivery Progress</div>
          <div className="db-detail-value muted" style={{ fontSize: '0.82rem' }}>
            {d.deliveryDate && d.deliverySlot ? (
              <div><i className="fa-solid fa-calendar-days me-1"></i>Scheduled: {d.deliveryDate} {d.deliverySlot}</div>
            ) : null}
            {d.assignedAt ? <div><i className="fa-solid fa-user-check me-1"></i>Assigned: {fmtDate(d.assignedAt)}</div> : null}
            {d.startedAt ? <div><i className="fa-solid fa-box-open me-1"></i>Picked Up: {fmtDate(d.startedAt)}</div> : null}
            {d.completedAt ? <div><i className="fa-solid fa-flag-checkered me-1"></i>Delivered: {fmtDate(d.completedAt)}</div> : null}
            {!d.startedAt && !d.completedAt ? <div>Waiting for you to confirm the pickup at the store.</div> : null}
          </div>
        </div>

        {o.notes ? (
          <div className="db-detail-block">
            <div className="db-detail-label">Customer Note</div>
            <div className="db-detail-value">{o.notes}</div>
          </div>
        ) : null}

        <div className="db-sheet-actions">{sheetActions}</div>
      </>
    );
  }

  const sheetState = (sheet.order && sheet.order.delivery && sheet.order.delivery.state) || 'PENDING_ASSIGNMENT';

  return (
    <>
      <header className="db-header">
        <div className="db-header-inner">
          <div className="db-brand">
            <span className="db-logo">&#129385;</span>
            <div>
              <strong>FreshMeat</strong>
              <small>Delivery Partner</small>
            </div>
          </div>
          <div className="db-header-right">
            <span className="db-user">{(user && user.name) || 'Delivery Boy'}</span>
            <button
              className="db-icon-btn"
              type="button"
              title="Logout"
              aria-label="Logout"
              onClick={() => { logout(); navigate('/login?role=delivery'); }}
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="db-main">
        <div className="db-hello">
          <h1>{greeting}</h1>
          <p className="db-date">{dateStr}</p>
        </div>

        <div className="db-stats">{renderStats()}</div>

        <div className="db-toolbar">
          <div className="db-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="search"
              placeholder="Search order, name or phone"
              autoComplete="off"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className={'db-icon-btn' + (refreshing ? ' spinning' : '')}
            type="button"
            title="Refresh"
            aria-label="Refresh"
            onClick={() => loadAll(true)}
          >
            <i className="fa-solid fa-rotate"></i>
          </button>
        </div>

        <div className="db-tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t.state || 'all'}
              className={'db-tab' + (filterState === t.state ? ' active' : '')}
              type="button"
              onClick={() => setFilterState(t.state)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="db-list">{renderList()}</div>
      </main>

      {/* Delivery detail sheet */}
      <div className="db-sheet-backdrop" hidden={!sheet.open} onClick={closeSheet}></div>
      <div className="db-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" hidden={!sheet.open}>
        <div className="db-sheet-handle"></div>
        <div className="db-sheet-head">
          <div>
            <h2 id="sheet-title">{sheet.order ? '#' + sheet.order.orderNumber : 'Delivery'}</h2>
            <p id="sheet-sub">
              {sheet.order ? <span className={'db-chip ' + sheetState}>{chipLabel(sheetState)}</span> : null}
            </p>
          </div>
          <button className="db-icon-btn" type="button" aria-label="Close" onClick={closeSheet}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="db-sheet-body">{renderSheetBody()}</div>
      </div>

      {/* Cash collection confirmation modal */}
      <div className="db-sheet-backdrop" hidden={!cash.open} onClick={closeCashConfirm}></div>
      <div className="db-cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-modal-title" hidden={!cash.open}>
        <div className="db-cash-modal-head">
          <h2 id="cash-modal-title"><i className="fa-solid fa-money-bill-wave me-1"></i>Collect Cash</h2>
          <button className="db-icon-btn" type="button" aria-label="Close" onClick={closeCashConfirm}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="db-cash-modal-body">
          <div className="db-cash-modal-row">
            <span className="db-cash-modal-label">Order</span>
            <span className="db-cash-modal-value">#{cash.order ? (cash.order.orderNumber || cash.order.id) : '---'}</span>
          </div>
          <div className="db-cash-modal-row">
            <span className="db-cash-modal-label">Customer</span>
            <span className="db-cash-modal-value">{(cash.order && cash.order.customerName) || '-'}</span>
          </div>
          <div className="db-cash-modal-row">
            <span className="db-cash-modal-label">Payment method</span>
            <span className="db-cash-modal-value">{String((cash.order && cash.order.paymentMethod) || 'CASH_ON_DELIVERY').replace(/_/g, ' ')}</span>
          </div>
          <div className="db-cash-modal-amount">
            <span className="db-cash-modal-label">Amount to collect</span>
            <strong>{cash.order ? fmtMoney(cash.order.grandTotal) : '--'}</strong>
          </div>
          <p className="db-cash-modal-question">Did you collect the full cash amount from the customer?</p>
          {cashError ? <div className="db-inline-msg">{cashError}</div> : null}
        </div>
        <div className="db-cash-modal-foot">
          <button className="db-btn db-btn-ghost" type="button" onClick={closeCashConfirm}>Cancel</button>
          <button className="db-btn db-btn-gold" type="button" onClick={confirmCashCollect} disabled={cashSaving}>
            {cashSaving
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
              : <><i className="fa-solid fa-money-bill-wave"></i>Confirm Cash Collected</>}
          </button>
        </div>
      </div>

      {/* Cash-not-collected warning modal (the actual grand total is injected) */}
      <div className="db-sheet-backdrop" hidden={!warn.open} onClick={closeCashWarn}></div>
      <div className="db-cash-modal" role="dialog" aria-modal="true" aria-labelledby="warn-modal-title" hidden={!warn.open}>
        <div className="db-cash-modal-head">
          <h2 id="warn-modal-title">
            <i className="fa-solid fa-triangle-exclamation me-1" style={{ color: '#B45309' }}></i>Cash Not Collected
          </h2>
          <button className="db-icon-btn" type="button" aria-label="Close" onClick={closeCashWarn}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="db-cash-modal-body">
          <p className="db-warn-modal-msg">
            Cash has not been collected yet. Please collect {fmtMoney(warn.order ? warn.order.grandTotal : 0)} from the customer before marking this order as delivered.
          </p>
          <p className="db-warn-modal-sub">Please collect the cash payment first. Click Collect Cash to open the payment form.</p>
        </div>
        <div className="db-cash-modal-foot">
          <button className="db-btn db-btn-ghost" type="button" onClick={closeCashWarn}>Cancel</button>
          <button className="db-btn db-btn-gold" type="button" onClick={handleWarnCollect}>
            <i className="fa-solid fa-money-bill-wave"></i>Collect Cash
          </button>
        </div>
      </div>
    </>
  );
}
