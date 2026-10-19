import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCall, downloadFile } from '../lib/api';
import { fmtDate, fmtMoney } from '../lib/format';
import { showToast } from '../lib/toast';
import { deliverySlotsForDay } from '../lib/slots';
import {
  AdminStatusBadge,
  EmptyBox,
  OrderDetailSections,
  SpinnerBox,
  addressOneLine,
  hideModal,
  showModal,
  useModalId
} from './AdminLayout';

/* FreshMeat — Admin Orders controller (ported from orders.js) */

const ACTIVE_ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

const ORDER_TRANSITIONS = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['CANCELLED'],
  OUT_FOR_DELIVERY: ['CANCELLED'],
  DELIVERED: [],
  CANCELLED: []
};

function terminalStatusNote(status) {
  if (status === 'DELIVERED') return 'This order has been delivered and cannot be changed.';
  if (status === 'OUT_FOR_DELIVERY') return 'This order is out for delivery. An admin can cancel it, or the assigned Delivery Boy can mark it delivered.';
  if (status === 'READY_FOR_PICKUP') return 'Pickup and delivery are handled by the assigned Delivery Boy.';
  if (status === 'CANCELLED') return 'This order has been cancelled and cannot be changed.';
  return '';
}

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

const MU = '\u00B7';

/* 80mm thermal receipt (ported from receiptHtml). */
function Receipt({ inv }) {
  const rcMoney = v => {
    const n = Number(v || 0);
    const s = n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '\u20B9' + s.replace(/\.00$/, '');
  };
  const qty = v => String(Number(v || 0)).replace(/\.0+$/, '');
  const cutting = c => (c ? String(c).replace(/_/g, ' ') : 'Standard');
  const ddMMyyyy = d => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    const p = x => String(x).padStart(2, '0');
    return p(dt.getDate()) + '-' + p(dt.getMonth() + 1) + '-' + dt.getFullYear();
  };

  const doorStreetArea = [inv.deliveryDoor, inv.deliveryStreet, inv.deliveryArea].filter(Boolean).join(', ');
  const cityPart = [inv.deliveryCity, inv.deliveryPincode].filter(Boolean).join(' - ');
  const deliverTo = [doorStreetArea, (cityPart ? '(' + cityPart + ')' : ''), inv.deliveryState].filter(Boolean).join(', ');

  return (
    <>
      <div className="rce-brand">FRESHMEAT</div>
      <div className="rce-sub">Fresh Meat Shop</div>
      <div className="rce-sep"></div>
      <div className="rce-meta">
        <div className="rce-kv"><span>Invoice</span><b>{inv.invoiceNumber || '-'}</b></div>
        <div className="rce-kv"><span>Order</span><b>#{inv.orderNumber || ''}</b></div>
        <div className="rce-kv"><span>Date</span><b>{ddMMyyyy(inv.invoiceDate)}</b></div>
      </div>
      <div className="rce-sep"></div>
      <div className="rce-customer">
        <div className="rce-kv"><span>Customer</span><b>{inv.customerName || ''}</b></div>
        <div className="rce-kv"><span>Mobile</span><b>{inv.customerPhone || ''}</b></div>
        {deliverTo ? (
          <div className="rce-kv" style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
            <span>Deliver To:</span><span>{deliverTo}</span>
          </div>
        ) : null}
      </div>
      <div className="rce-sep"></div>
      <div className="rce-items">
        {(inv.items || []).length ? (inv.items || []).map((it, idx) => (
          <div className="rce-item" key={idx}>
            <span className="rce-name">{it.productName}<span className="rce-cutting">({cutting(it.cuttingOption)})</span></span>
            <span className="rce-qty">{qty(it.quantity)} {it.unit || 'KG'}</span>
            <span className="rce-amt">{rcMoney(it.subtotal)}</span>
          </div>
        )) : <div>No items</div>}
      </div>
      <div className="rce-sep"></div>
      <div className="rce-totals">
        <div className="rce-kv"><span>Subtotal</span><span>{rcMoney(inv.subtotal)}</span></div>
        <div className="rce-kv"><span>Discount</span><span>-{rcMoney(inv.discountAmount)}</span></div>
        <div className="rce-kv"><span>Delivery</span><span>{Number(inv.deliveryCharge) === 0 ? 'FREE' : rcMoney(inv.deliveryCharge)}</span></div>
        <div className="rce-sep"></div>
        <div className="rce-kv rce-total"><span>TOTAL</span><span>{rcMoney(inv.grandTotal)}</span></div>
      </div>
      <div className="rce-sep"></div>
      <div className="rce-pay">
        <div className="rce-kv"><span>Payment</span><b>{String(inv.paymentMethod || '-').replace(/_/g, ' ')}</b></div>
        <div className="rce-kv"><span>Status</span><b>{String(inv.paymentStatus || '-').replace(/_/g, ' ')}</b></div>
        {inv.paidAt ? <div className="rce-kv"><span>Paid On</span><b>{ddMMyyyy(inv.paidAt)}</b></div> : null}
        <div className="rce-kv"><span>Order Status</span><b>{String(inv.orderStatus || '-').replace(/_/g, ' ')}</b></div>
        {inv.deliverySlot ? <div className="rce-kv"><span>Delivery</span><b>{inv.deliverySlot}</b></div> : null}
      </div>
      {inv.notes ? <div className="rce-notes">Notes: {inv.notes}</div> : null}
      <div className="rce-sep"></div>
      <div className="rce-foot">
        <div className="rce-thanks">Thank you for shopping with FreshMeat!</div>
        <div className="rce-helpline">
          {inv.storeAddress || ''}{inv.storePhone ? ' • ' + inv.storePhone : ''}{inv.storeEmail ? ' • ' + inv.storeEmail : ''}
        </div>
      </div>
    </>
  );
}

export default function AdminOrders() {
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');
  const initialFilter = urlStatus && ACTIVE_ORDER_STATUSES.includes(urlStatus) ? urlStatus : '';

  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusValue, setStatusValue] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusMsgType, setStatusMsgType] = useState('muted');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [paymentRef, setPaymentRef] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [assignOrderId, setAssignOrderId] = useState(null);
  const [assignIsReassign, setAssignIsReassign] = useState(false);
  const [assignOrder, setAssignOrder] = useState(null);
  const [assignBoys, setAssignBoys] = useState([]);
  const [assignBoyId, setAssignBoyId] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [assignSlot, setAssignSlot] = useState('');
  const [assignSlotList, setAssignSlotList] = useState([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignNoBoys, setAssignNoBoys] = useState(false);

  const [printInv, setPrintInv] = useState(null);

  const orderModalId = useModalId('orderModal');
  const paymentModalId = useModalId('paymentModal');
  const assignModalId = useModalId('assignDeliveryModal');

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

  const loadOrders = useCallback(async (opts = {}) => {
    const f = opts.filter != null ? opts.filter : filter;
    const s = opts.search != null ? opts.search : search;
    const params = new URLSearchParams();
    if (f) params.set('status', f);
    if (s) params.set('search', s);
    setOrders(null);
    setError('');
    try {
      const res = await apiCall('/api/admin/orders' + (params.toString() ? '?' + params.toString() : ''));
      if (!mounted.current) return;
      setOrders(res.data || []);
    } catch (e) {
      if (!mounted.current) return;
      handleAuth(e);
      setOrders([]);
      setError(e.message || 'Unable to load orders');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(() => loadOrders(), 300);
    return () => clearTimeout(t);
  }, [loadOrders]);

  useEffect(() => {
    if (printInv) {
      const t = setTimeout(() => window.print(), 120);
      return () => clearTimeout(t);
    }
  }, [printInv]);

  async function openOrder(id) {
    try {
      const res = await apiCall('/api/admin/orders/' + id);
      const o = res.data;
      setSelectedOrder(o);
      setStatusValue(o.status);
      setStatusMsg('');
      setStatusMsgType('muted');
      showModal(orderModalId);
    } catch (e) {
      if (e.status === 401 || e.status === 403) return handleAuth(e);
      showToast(e.message || 'Could not load this order.', 'error');
    }
  }

  async function updateOrderStatus() {
    if (!selectedOrder || statusUpdating) return;
    if (!statusValue || statusValue === selectedOrder.status) {
      setStatusMsg('Please select a different status to update this order.');
      setStatusMsgType('error');
      return;
    }
    const next = statusValue;
    setStatusUpdating(true);
    setStatusMsg('Updating status…');
    setStatusMsgType('muted');
    try {
      await apiCall('/api/admin/orders/' + selectedOrder.id + '/status', { method: 'PUT', body: { status: next } });
      setSelectedOrder(prev => ({ ...prev, status: next }));
      setStatusValue(next);
      setStatusMsg(next === 'CANCELLED' ? 'Order cancelled.' : 'Status updated to ' + next.replace(/_/g, ' ').toLowerCase() + '.');
      setStatusMsgType('success');
      loadOrders();
    } catch (e) {
      if (e.status === 401 || e.status === 403) { handleAuth(e); return; }
      setStatusValue(selectedOrder.status);
      setStatusMsg(e.message || 'Could not update the status.');
      setStatusMsgType('error');
    } finally {
      setStatusUpdating(false);
    }
  }

  function markPaymentReceived() {
    if (!selectedOrder) return;
    setPaymentRef('');
    showModal(paymentModalId);
  }

  async function confirmPaymentReceived() {
    if (!selectedOrder || paymentSaving) return;
    setPaymentSaving(true);
    try {
      const ref = paymentRef.trim();
      await apiCall('/api/admin/orders/' + selectedOrder.id + '/payment-received', {
        method: 'PUT',
        body: { transactionRef: ref }
      });
      hideModal(paymentModalId);
      showToast('Payment marked as received.');
      await openOrder(selectedOrder.id);
      loadOrders();
    } catch (e) {
      if (e.status === 401 || e.status === 403) handleAuth(e);
      else showToast(e.message, 'error', { title: 'Could not Mark Payment' });
    } finally {
      setPaymentSaving(false);
    }
  }

  async function openAssignModal(orderId, isReassign) {
    setAssignOrderId(orderId);
    setAssignIsReassign(isReassign);
    setAssignOrder(null);
    setAssignNoBoys(false);
    try {
      const [orderRes, boysRes] = await Promise.all([
        apiCall('/api/admin/orders/' + orderId),
        apiCall('/api/admin/delivery-boys/active')
      ]);
      const order = orderRes.data;
      const boys = boysRes.data || [];
      setAssignOrder(order);
      setAssignBoys(boys);
      setAssignNoBoys(boys.length === 0);

      const baseDate = todayInput();
      let date = baseDate;
      if (isReassign && order.delivery && order.delivery.deliveryDate) date = order.delivery.deliveryDate;
      setAssignDate(date);
      const slots = slotsForDate(date);
      setAssignSlotList(slots);
      setAssignSlot((isReassign && order.delivery && order.delivery.deliverySlot) ? order.delivery.deliverySlot : (slots[0] || ''));

      // Hand over from the order modal to the assign modal without stacking backdrops.
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
      const url = assignIsReassign
        ? '/api/admin/delivery/' + assignOrderId + '/reassign'
        : '/api/admin/delivery/' + assignOrderId + '/assign';
      const res = await apiCall(url, {
        method: assignIsReassign ? 'PUT' : 'POST',
        body: { deliveryBoyId: Number(assignBoyId), deliveryDate: assignDate, deliverySlot: assignSlot }
      });
      hideModal(assignModalId);
      showToast(
        (res && res.message) || (assignIsReassign ? 'Delivery Boy reassigned successfully.' : 'Delivery Boy assigned successfully.'),
        'success',
        { title: assignIsReassign ? 'Delivery Boy Reassigned' : 'Delivery Boy Assigned' }
      );
      await openOrder(assignOrderId);
      loadOrders();
    } catch (e) {
      if (e.status === 401 || e.status === 403) handleAuth(e);
      else showToast(e.message || 'Could not update the delivery', 'error', { title: assignIsReassign ? 'Cannot Reassign' : 'Cannot Assign' });
    } finally {
      setAssignSaving(false);
    }
  }

  async function fetchInvoiceData() {
    const res = await apiCall('/api/admin/orders/' + selectedOrder.id + '/invoice');
    return res && res.data;
  }

  function viewInvoice() {
    if (!selectedOrder) return;
    window.open('/invoice?order=' + selectedOrder.id + '&admin=1', '_blank');
  }

  async function printBill() {
    if (!selectedOrder) return;
    try {
      const inv = await fetchInvoiceData();
      if (!inv) throw new Error('Invoice data unavailable.');
      setPrintInv({ ...inv });
    } catch (e) {
      if (e.status === 401 || e.status === 403) { handleAuth(e); return; }
      showToast(e.message || 'Could not prepare the receipt.', 'error');
    }
  }

  async function downloadInvoice() {
    if (!selectedOrder) return;
    try {
      const number = selectedOrder.orderNumber ||
        ((await fetchInvoiceData()) || {}).invoiceNumber || selectedOrder.id;
      await downloadFile('/api/admin/orders/' + selectedOrder.id + '/invoice/pdf', 'FreshMeat-Invoice-' + number + '.pdf');
    } catch (e) {
      if (e.status === 401 || e.status === 403) handleAuth(e);
      else showToast(e.message, 'error', { title: 'Download Failed' });
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <div className="d-flex flex-wrap gap-2">
          <button
            className={'btn-admin-outline' + (!filter ? ' active-fill' : '')}
            style={{ padding: '0.4rem 1rem', fontSize: '0.78rem' }}
            onClick={() => setFilter('')}
          >All</button>
          {ACTIVE_ORDER_STATUSES.map(s => (
            <button
              key={s}
              className={'btn-admin-outline' + (s === filter ? ' active-fill' : '')}
              style={{ padding: '0.4rem 1rem', fontSize: '0.78rem' }}
              onClick={() => setFilter(s)}
            >{s.replace(/_/g, ' ')}</button>
          ))}
        </div>
        <div className="search-box">
          <input type="text" placeholder="Search order no / name / phone..." value={search} onChange={e => setSearch(e.target.value)} />
          <i className="fa-solid fa-magnifying-glass"></i>
        </div>
      </div>

      <div className="admin-card">
        <div className="table-responsive">
          {orders === null ? <SpinnerBox /> : error ? <EmptyBox msg={error} /> : !orders.length ? <EmptyBox msg="No orders match this filter" /> : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Order No.</th><th>Customer</th><th>Product(s)</th><th>Total</th><th>Placed On</th><th>Slot</th><th>Payment</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr className="row-clickable" key={o.id} onClick={() => openOrder(o.id)} title="View order details">
                    <td><strong className="small">{o.orderNumber}</strong></td>
                    <td>
                      <strong className="small">{o.customerName}</strong>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>{o.customerPhone || ''}</div>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {(o.items || []).map((i, idx) => (
                        <div key={idx}><strong>{i.productName}</strong> × {i.quantity} KG</div>
                      ))}
                    </td>
                    <td><strong>{fmtMoney(o.grandTotal)}</strong></td>
                    <td className="text-muted" style={{ fontSize: '0.78rem' }}>{fmtDate(o.createdAt)}</td>
                    <td className="text-muted" style={{ fontSize: '0.78rem' }}>{o.deliverySlot || '-'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{String(o.paymentMethod || '').replace(/_/g, ' ')}</td>
                    <td><AdminStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Order detail modal */}
      <div className="modal fade" id={orderModalId} tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="fa-solid fa-receipt me-2 text-primary"></i>Order #{selectedOrder ? selectedOrder.orderNumber : ''}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              {!selectedOrder ? <SpinnerBox /> : (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select form-control-fm"
                        value={statusValue}
                        disabled={(ORDER_TRANSITIONS[selectedOrder.status] || []).length === 0}
                        onChange={e => setStatusValue(e.target.value)}
                      >
                        <option value={selectedOrder.status}>{selectedOrder.status.replace(/_/g, ' ')}</option>
                        {(ORDER_TRANSITIONS[selectedOrder.status] || []).map(s => (
                          <option value={s} key={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      {terminalStatusNote(selectedOrder.status) ? (
                        <div className="form-text text-muted" style={{ fontSize: '0.78rem' }}>
                          {terminalStatusNote(selectedOrder.status)}
                        </div>
                      ) : null}
                      <div className="form-text" style={{ fontSize: '0.78rem', color: { success: '#1e9e4a', error: '#b91c1c', muted: '#7a756d' }[statusMsgType] || '#7a756d' }}>
                        {statusMsg}
                      </div>
                    </div>
                    <div className="col-md-6 d-flex align-items-end">
                      <button
                        className="btn-admin"
                        disabled={(ORDER_TRANSITIONS[selectedOrder.status] || []).length === 0 || statusUpdating}
                        onClick={updateOrderStatus}
                      >
                        {statusUpdating
                          ? <><span className="spinner-border spinner-border-sm me-1"></span>Updating...</>
                          : <><i className="fa-solid fa-floppy-disk me-1"></i>Update Status</>}
                      </button>
                    </div>
                  </div>
                  <OrderDetailSections
                    order={selectedOrder}
                    paymentActions
                    onMarkReceived={markPaymentReceived}
                    onViewInvoice={viewInvoice}
                    onPrint={printBill}
                    onDownload={downloadInvoice}
                    onAssign={() => openAssignModal(selectedOrder.id, false)}
                    onReassign={() => openAssignModal(selectedOrder.id, true)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mark payment received confirmation modal */}
      <div className="modal fade" id={paymentModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-money-bill-wave text-success me-2"></i>Mark Payment Received</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">
                {selectedOrder ? (
                  <>
                    Confirm payment of <strong>{fmtMoney(selectedOrder.grandTotal)}</strong> via{' '}
                    <strong>{String(selectedOrder.paymentMethod || '').replace(/_/g, ' ')}</strong> from{' '}
                    <strong>{selectedOrder.customerName || 'customer'}</strong>?
                  </>
                ) : 'Confirm that this payment has been received.'}
              </p>
              <input
                type="text"
                className="form-control form-control-fm mt-3"
                placeholder="Transaction ref / note (optional)"
                maxLength="100"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn-admin" disabled={paymentSaving} onClick={confirmPaymentReceived}>
                {paymentSaving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Assign / Reassign Delivery Boy modal */}
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
              <p className="mb-2" style={{ fontSize: '0.85rem' }}>
                Order <strong>{assignOrder ? assignOrder.orderNumber : '-'}</strong>
              </p>
              <div className="p-3 rounded mb-3" style={{ background: '#f8f5f0' }}>
                {assignOrder ? (
                  <div className="small">
                    <div><strong>{assignOrder.customerName}</strong> &nbsp;{assignOrder.customerPhone || ''}</div>
                    <div className="text-muted">{assignOrder.deliverySlot || 'No slot'} {MU} {fmtMoney(assignOrder.grandTotal)}</div>
                    <div className="text-muted">
                      {String(assignOrder.paymentMethod || '').replace(/_/g, ' ')} / {assignOrder.paymentStatus || 'PENDING'}
                    </div>
                    {assignOrder.delivery && assignOrder.delivery.deliveryBoyName ? (
                      <div className="mt-1">Currently assigned to <strong>{assignOrder.delivery.deliveryBoyName}</strong></div>
                    ) : null}
                  </div>
                ) : <SpinnerBox />}
              </div>
              <label className="form-label" htmlFor={assignModalId + '-boy'}>Delivery Boy</label>
              <select
                className="form-select form-control-fm"
                id={assignModalId + '-boy'}
                value={assignBoyId}
                onChange={e => setAssignBoyId(e.target.value)}
              >
                {assignNoBoys ? (
                  <option value="">No active Delivery Boys available</option>
                ) : (
                  <>
                    <option value="">Select Delivery Boy</option>
                    {assignBoys.map(b => (
                      <option
                        value={b.id}
                        key={b.id}
                        disabled={assignIsReassign && assignOrder && assignOrder.delivery && assignOrder.delivery.deliveryBoyId === b.id}
                      >
                        {b.name} ({b.phone || ''}) — {b.assignedCount} active
                      </option>
                    ))}
                  </>
                )}
              </select>
              <div className="form-text text-muted" style={{ fontSize: '0.75rem' }}>Only active Delivery Boys are listed.</div>
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
              <button type="button" className="btn-admin" disabled={assignNoBoys || assignSaving} onClick={confirmAssign}>
                {assignSaving ? (
                  <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                ) : (
                  <><i className={'fa-solid me-1 ' + (assignIsReassign ? 'fa-user-clock' : 'fa-user-plus')}></i>
                    {assignIsReassign ? 'Reassign' : 'Confirm Delivery Boy'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 80mm thermal receipt print target (screen-hidden, print-only) */}
      <div id="receipt-print" aria-hidden="true">
        {printInv ? <Receipt inv={printInv} /> : null}
      </div>
    </>
  );
}
