import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { fmtDateOnly, fmtMoney } from '../lib/format';
import { showToast } from '../lib/toast';
import { deliverySlotsForDay } from '../lib/slots';
import {
  AdminStatusBadge,
  DeliveryStateBadge,
  EmptyBox,
  OrderDetailSections,
  PaymentCell,
  SpinnerBox,
  addressOneLine,
  hideModal,
  showModal,
  useModalId
} from './AdminLayout';

/* FreshMeat — Admin Delivery Management (ported from delivery.js) */

function todayInput() {
  const d = new Date();
  const p = x => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function slotsForDate(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  if (isNaN(d.getTime())) return deliverySlotsForDay(-1);
  return deliverySlotsForDay(d.getDay());
}

export default function AdminDelivery() {
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [boys, setBoys] = useState([]);

  const [search, setSearch] = useState('');
  const [boyId, setBoyId] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [date, setDate] = useState('');

  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const [assignOrderId, setAssignOrderId] = useState(null);
  const [assignIsReassign, setAssignIsReassign] = useState(false);
  const [assignOrder, setAssignOrder] = useState(null);
  const [assignBoyId, setAssignBoyId] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [assignSlot, setAssignSlot] = useState('');
  const [assignSlotList, setAssignSlotList] = useState([]);
  const [assignHint, setAssignHint] = useState('Only active Delivery Boys are listed.');
  const [assignSaving, setAssignSaving] = useState(false);

  const [cancelRow, setCancelRow] = useState(null); /* order row pending cancellation */
  const [cancelling, setCancelling] = useState(false);

  const orderModalId = useModalId('deliveryOrderModal');
  const assignModalId = useModalId('assignModal');
  const cancelModalId = useModalId('cancelOrderModal');

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function handleAuth(e) {
    if (e && (e.status === 401 || e.status === 403)) {
      showToast('Your session has expired. Please login again.', 'error', { title: 'Session Expired' });
      return true;
    }
    return false;
  }

  const loadBoys = useCallback(async () => {
    try {
      const res = await apiCall('/api/admin/delivery-boys');
      if (!mounted.current) return;
      setBoys(res.data || []);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not load delivery boys.', 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const loadDeliveries = useCallback(async (opts = {}) => {
    const f = {
      search: opts.search != null ? opts.search : search,
      boyId: opts.boyId != null ? opts.boyId : boyId,
      state: opts.state != null ? opts.state : stateFilter,
      date: opts.date != null ? opts.date : date
    };
    const p = new URLSearchParams();
    p.set('state', f.state || '');
    p.set('search', (f.search || '').trim());
    p.set('deliveryBoyId', f.boyId || '');
    p.set('date', f.date || '');
    setRows(null);
    try {
      const [boardRes, summaryRes] = await Promise.all([
        apiCall('/api/admin/delivery?' + p.toString()),
        apiCall('/api/admin/delivery/summary')
      ]);
      if (!mounted.current) return;
      setSummary(summaryRes.data || {});
      setRows(boardRes.data || []);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setRows([]);
      showToast(e.message || 'Could not load deliveries.', 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [search, boyId, stateFilter, date]);

  useEffect(() => { loadBoys(); }, [loadBoys]);

  useEffect(() => {
    const t = setTimeout(() => loadDeliveries(), 300);
    return () => clearTimeout(t);
  }, [loadDeliveries]);

  async function openOrderDetails(id) {
    setOrder(null);
    setOrderLoading(true);
    showModal(orderModalId);
    try {
      const res = await apiCall('/api/admin/delivery/' + id);
      setOrder(res.data);
    } catch (e) {
      if (e.status === 401 || e.status === 403) { hideModal(orderModalId); handleAuth(e); return; }
      setOrder({ __error: e.message || 'Could not load this order.' });
    } finally {
      setOrderLoading(false);
    }
  }

  async function openAssignModal(id, isReassign) {
    setAssignOrderId(id);
    setAssignIsReassign(isReassign);
    setAssignOrder(null);
    try {
      const res = await apiCall('/api/admin/orders/' + id);
      const o = res.data;
      setAssignOrder(o);
      const active = boys.filter(b => b.active);
      setAssignBoyId('');
      setAssignHint(active.length
        ? (isReassign ? 'The current delivery boy will be marked as reassigned and the new one takes over.' : 'Only active Delivery Boys are listed.')
        : 'Create and activate a Delivery Boy first.');

      const baseDate = todayInput();
      let d = baseDate;
      if (isReassign && o.delivery && o.delivery.deliveryDate) d = o.delivery.deliveryDate;
      setAssignDate(d);
      const slots = slotsForDate(d);
      setAssignSlotList(slots);
      setAssignSlot((isReassign && o.delivery && o.delivery.deliverySlot) ? o.delivery.deliverySlot : (slots[0] || ''));

      hideModal(orderModalId);
      setTimeout(() => showModal(assignModalId), 300);
    } catch (e) {
      if (e.status === 401 || e.status === 403) return handleAuth(e);
      showToast(e.message || 'Could not load the order.', 'error');
    }
  }

  function onAssignDateChange(value) {
    setAssignDate(value);
    const slots = slotsForDate(value);
    setAssignSlotList(slots);
    setAssignSlot(slots[0] || '');
  }

  async function confirmAssign() {
    if (!assignBoyId) return showToast('Please select a Delivery Boy.', 'warning');
    if (!assignDate) return showToast('Please select a delivery date.', 'warning');
    if (!assignSlot) return showToast('Please select a delivery slot.', 'warning');
    setAssignSaving(true);
    try {
      const res = await apiCall('/api/admin/delivery/' + assignOrderId + (assignIsReassign ? '/reassign' : '/assign'), {
        method: assignIsReassign ? 'PUT' : 'POST',
        body: { deliveryBoyId: Number(assignBoyId), deliveryDate: assignDate, deliverySlot: assignSlot }
      });
      hideModal(assignModalId);
      showToast((res && res.message) || (assignIsReassign ? 'Delivery Boy reassigned.' : 'Delivery Boy assigned.'));
      await Promise.all([loadDeliveries(), loadBoys()]);
    } catch (e) {
      if (e.status === 401 || e.status === 403) handleAuth(e);
      else showToast(e.message || 'Could not update the delivery.', 'error', { title: assignIsReassign ? 'Cannot Reassign' : 'Cannot Assign' });
    } finally {
      setAssignSaving(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setBoyId('');
    setStateFilter('');
    setDate('');
  }

  /* Cancellation is offered for every board order that is not already
     delivered. It deliberately does not look at the delivery boy, so an order
     whose Delivery Boy account was removed can still be resolved. */
  function cancellable(o) {
    return ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(o.status);
  }

  function prepareCancel(order) {
    setCancelRow(order);
    showModal(cancelModalId);
  }

  async function confirmCancel() {
    if (!cancelRow || cancelling) return;
    setCancelling(true);
    try {
      await apiCall('/api/admin/orders/' + cancelRow.id + '/status', {
        method: 'PUT',
        body: { status: 'CANCELLED' }
      });
      const number = cancelRow.orderNumber;
      hideModal(cancelModalId);
      setCancelRow(null);
      // The status endpoint reports a generic "status updated"; show a
      // cancellation-specific message so the admin gets clear feedback.
      showToast('Order ' + number + ' cancelled.', 'success', { title: 'Order Cancelled' });
      // Reload the board + summary (and the boys' open counts) so the cancelled
      // order drops off immediately and every counter is correct. The cancelled
      // order stays visible in Admin Orders under the "CANCELLED" filter.
      await Promise.all([loadDeliveries(), loadBoys()]);
    } catch (e) {
      if (e.status === 401 || e.status === 403) { handleAuth(e); return; }
      showToast(e.message || 'Could not cancel the order.', 'error', { title: 'Cannot Cancel Order' });
    } finally {
      setCancelling(false);
    }
  }

  function toggleState(state) {
    setStateFilter(prev => (prev === state ? '' : state));
  }

  const assignable = o => o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY_FOR_PICKUP';
  const hasBoy = o => o.delivery && o.delivery.deliveryBoyId;
  const activeBoys = boys.filter(b => b.active);

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-3">
          <div className="stat-card clickable h-100" onClick={() => toggleState('PENDING_ASSIGNMENT')}>
            <div className="stat-icon orange"><i className="fa-solid fa-user-clock"></i></div>
            <div className="stat-meta">
              <h6>Pending Assignment</h6>
              <div className="stat-value">{summary ? (summary.pendingAssignment || 0) : '-'}</div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>Need a delivery boy</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="stat-card clickable h-100" onClick={() => toggleState('ASSIGNED')}>
            <div className="stat-icon blue"><i className="fa-solid fa-box-open"></i></div>
            <div className="stat-meta">
              <h6>Assigned</h6>
              <div className="stat-value">{summary ? (summary.assigned || 0) : '-'}</div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>Not started yet</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="stat-card clickable h-100" onClick={() => toggleState('OUT_FOR_DELIVERY')}>
            <div className="stat-icon purple"><i className="fa-solid fa-location-arrow"></i></div>
            <div className="stat-meta">
              <h6>Out for Delivery</h6>
              <div className="stat-value">{summary ? (summary.outForDelivery || 0) : '-'}</div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>On the way</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="stat-card clickable h-100" onClick={() => toggleState('DELIVERED')}>
            <div className="stat-icon green"><i className="fa-solid fa-circle-check"></i></div>
            <div className="stat-meta">
              <h6>Delivered Today</h6>
              <div className="stat-value">{summary ? (summary.deliveredToday || 0) : '-'}</div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>Cash: {fmtMoney(summary ? (summary.cashCollectedToday || 0) : 0)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-4">
            <label className="form-label">Search</label>
            <div className="search-box">
              <input type="text" placeholder="Order no, customer, phone or delivery boy" value={search} onChange={e => setSearch(e.target.value)} />
              <i className="fa-solid fa-magnifying-glass"></i>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Delivery Boy</label>
            <select className="form-select form-control-fm" value={boyId} onChange={e => setBoyId(e.target.value)}>
              <option value="">All Delivery Boys</option>
              {boys.map(b => (
                <option value={b.id} key={b.id} disabled={!b.active}>{b.name}{b.active ? '' : ' (inactive)'}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Status</label>
            <select className="form-select form-control-fm" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="PENDING_ASSIGNMENT">Pending Assignment</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">Date</label>
            <input type="date" className="form-control form-control-fm" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="col-6 col-md-2 d-grid">
            <button className="btn-admin-outline" type="button" onClick={clearFilters}>
              <i className="fa-solid fa-xmark me-1"></i>Clear
            </button>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <div className="card-title mb-0"><i className="fa-solid fa-truck-fast text-primary me-2"></i>Deliveries</div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>{rows ? rows.length + ' order(s)' : ''}</span>
            <button className="btn-icon-xs" title="Refresh" onClick={() => loadDeliveries()}><i className="fa-solid fa-rotate"></i></button>
          </div>
        </div>
        <div className="table-responsive">
          {rows === null ? <SpinnerBox /> : !rows.length ? <EmptyBox msg="No deliveries match these filters" /> : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>Delivery Address</th><th>Slot</th><th className="text-end">Total</th>
                  <th>Payment</th><th>Delivery Boy</th><th>Status</th><th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(o => (
                  <tr key={o.id}>
                    <td className="row-clickable" onClick={() => openOrderDetails(o.id)} title="View order details">
                      <strong className="small">{o.orderNumber}</strong>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>{fmtDateOnly(o.createdAt)}</div>
                    </td>
                    <td>
                      <div className="small">{o.customerName || '-'}</div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>{o.customerPhone || '-'}</div>
                    </td>
                    <td style={{ maxWidth: 230, fontSize: '0.78rem' }}>{addressOneLine(o)}</td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {o.deliverySlot || '-'}
                      {o.delivery && o.delivery.deliveryDate ? (
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                          <i className="fa-solid fa-calendar-days me-1"></i>{o.delivery.deliveryDate} {o.delivery.deliverySlot || ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="text-end small fw-semibold">{fmtMoney(o.grandTotal)}</td>
                    <td><PaymentCell order={o} /></td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {hasBoy(o) ? (
                        <>
                          {o.delivery.deliveryBoyName}
                          {o.delivery.deliveryBoyActive === false
                            ? <span className="badge-status INACTIVE" style={{ fontSize: '0.6rem', marginLeft: 4 }}>Inactive</span>
                            : null}
                        </>
                      ) : <span className="text-muted">Unassigned</span>}
                    </td>
                    <td className="row-clickable" onClick={() => openOrderDetails(o.id)} title="View order details">
                      <div className="d-flex flex-wrap gap-1">
                        <AdminStatusBadge status={o.status} />
                        <DeliveryStateBadge state={(o.delivery && o.delivery.state) || 'PENDING_ASSIGNMENT'} />
                      </div>
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <button className="btn-icon-xs" onClick={() => openOrderDetails(o.id)} title="View Order Details">
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        {assignable(o) && !hasBoy(o) ? (
                          <button className="btn-icon-xs edit" onClick={() => openAssignModal(o.id, false)} title="Assign Delivery Boy">
                            <i className="fa-solid fa-user-plus"></i>
                          </button>
                        ) : null}
                        {assignable(o) && hasBoy(o) ? (
                          <button className="btn-icon-xs edit" onClick={() => openAssignModal(o.id, true)} title="Reassign Delivery Boy">
                            <i className="fa-solid fa-user-clock"></i>
                          </button>
                        ) : null}
                        {cancellable(o) ? (
                          <button className="btn-icon-xs del" onClick={() => prepareCancel(o)} title="Cancel Order">
                            <i className="fa-solid fa-ban"></i>
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Order detail modal (shared with the Orders page) */}
      <div className="modal fade" id={orderModalId} tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-receipt me-2 text-primary"></i>Order #{order ? (order.orderNumber || '') : ''}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              {orderLoading || !order ? <SpinnerBox /> : order.__error ? <EmptyBox msg={order.__error} /> : (
                <OrderDetailSections
                  order={order}
                  onAssign={() => openAssignModal(order.id, false)}
                  onReassign={() => openAssignModal(order.id, true)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assign / Reassign modal */}
      <div className="modal fade" id={assignModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className={'fa-solid me-2 text-primary ' + (assignIsReassign ? 'fa-user-clock' : 'fa-user-plus')}></i>
                {assignIsReassign ? 'Reassign Delivery Boy' : 'Assign Delivery Boy'}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-2" style={{ fontSize: '0.85rem' }}>Order <strong>{assignOrder ? assignOrder.orderNumber : '-'}</strong></p>
              <div className="p-3 rounded mb-3" style={{ background: '#f8f5f0' }}>
                {assignOrder ? (
                  <div style={{ fontSize: '0.85rem' }}>
                    <div><strong>{assignOrder.customerName || '-'}</strong> &middot; {assignOrder.customerPhone || '-'}</div>
                    <div className="text-muted">
                      {assignOrder.deliverySlot || 'No slot'} &middot; {fmtMoney(assignOrder.grandTotal)} &middot; {String(assignOrder.paymentMethod || '').replace(/_/g, ' ')}
                    </div>
                    <div className="text-muted">{addressOneLine(assignOrder)}</div>
                    {assignOrder.delivery && assignOrder.delivery.deliveryBoyName ? (
                      <div className="mt-2">Currently with <strong>{assignOrder.delivery.deliveryBoyName}</strong></div>
                    ) : (
                      <div className="mt-2 text-warning-emphasis"><i className="fa-solid fa-circle-exclamation me-1"></i>No delivery boy assigned yet</div>
                    )}
                  </div>
                ) : <SpinnerBox />}
              </div>
              <label className="form-label">Delivery Boy</label>
              <select className="form-select form-control-fm" value={assignBoyId} onChange={e => setAssignBoyId(e.target.value)}>
                {!activeBoys.length ? <option value="">No active Delivery Boys available</option> : (
                  <>
                    <option value="">Select Delivery Boy</option>
                    {activeBoys.map(b => (
                      <option
                        value={b.id}
                        key={b.id}
                        disabled={assignOrder && assignOrder.delivery && assignOrder.delivery.deliveryBoyId === b.id}
                      >
                        {b.name} ({b.phone || ''}) - {b.assignedCount} active
                      </option>
                    ))}
                  </>
                )}
              </select>
              <div className="form-text text-muted" style={{ fontSize: '0.75rem' }}>{assignHint}</div>
              <div className="row g-2 mt-2">
                <div className="col-6">
                  <label className="form-label">Delivery Date</label>
                  <input type="date" className="form-control form-control-fm" value={assignDate} onChange={e => onAssignDateChange(e.target.value)} />
                </div>
                <div className="col-6">
                  <label className="form-label">Delivery Slot</label>
                  <select className="form-select form-control-fm" value={assignSlot} onChange={e => setAssignSlot(e.target.value)}>
                    {assignSlotList.map(s => <option value={s} key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-text text-muted" style={{ fontSize: '0.75rem' }}>
                The slot list follows the weekday/weekend rules the customer saw at checkout.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn-admin" disabled={!activeBoys.length || assignSaving} onClick={confirmAssign}>
                {assignSaving ? (
                  <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                ) : (
                  <><i className={'fa-solid me-1 ' + (assignIsReassign ? 'fa-user-clock' : 'fa-user-plus')}></i>
                    {assignIsReassign ? 'Reassign' : 'Assign'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel order confirmation */}
      <div className="modal fade" id={cancelModalId} tabIndex="-1" aria-labelledby={cancelModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={cancelModalId + 'Label'}>
                <i className="fa-solid fa-ban text-danger me-2"></i>Cancel Order
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">
                Are you sure you want to cancel order{' '}
                <strong>{cancelRow ? cancelRow.orderNumber : ''}</strong>?
              </p>
              <div className="mt-3 p-3 rounded" style={{ background: '#f8f5f0', fontSize: '0.85rem' }}>
                <div><strong>{cancelRow ? (cancelRow.customerName || '-') : ''}</strong> &middot; {cancelRow ? (cancelRow.customerPhone || '-') : ''}</div>
                <div className="text-muted">{cancelRow ? addressOneLine(cancelRow) : ''}</div>
                <div className="text-muted">
                  {cancelRow ? fmtMoney(cancelRow.grandTotal) : ''} &middot; {cancelRow ? String(cancelRow.paymentMethod || '').replace(/_/g, ' ') : ''}
                </div>
              </div>
              <p className="text-danger small mt-3 mb-0">
                <i className="fa-solid fa-triangle-exclamation me-1"></i>
                This cancels the order and closes its delivery. Stock is returned and an unpaid payment stays
                unpaid. The order, its items and the delivery history are preserved.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Keep Order</button>
              <button
                type="button"
                className="btn-admin"
                style={{ background: '#dc3545', borderColor: '#dc3545' }}
                onClick={confirmCancel}
                disabled={cancelling}
              >
                {cancelling ? <><span className="spinner-border spinner-border-sm me-1"></span>Cancelling...</> : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
