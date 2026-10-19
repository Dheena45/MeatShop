import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall, resolveImage } from '../lib/api';
import { fmtMoney, fmtDate, fmtDateOnly } from '../lib/format';
import { showToast } from '../lib/toast';
import { customerOrderStatusClass, customerOrderStatusLabel } from '../lib/orderStatus';
import { showModal, hideModal } from '../lib/modal';
import EmptyState from './EmptyState';
import Spinner from './Spinner';

/* Order history list + detail/cancel/review modals, shared by the standalone
   /orders page and the Profile page's "My Orders" tab (ported from orders.js). */
export default function OrdersList() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [reviewedOrderIds, setReviewedOrderIds] = useState(() => new Set());

  // detail modal
  const [detailOrder, setDetailOrder] = useState(null);
  // cancel modal
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  // review modal
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const loadOrders = useCallback(async () => {
    setError('');
    try {
      const rres = await apiCall('/api/reviews/my-reviews');
      const reviews = rres.data || [];
      setReviewedOrderIds(new Set(reviews.map(r => r.orderId).filter(Boolean)));
    } catch (e) {
      setReviewedOrderIds(new Set());
    }
    try {
      const res = await apiCall('/api/orders/my-orders');
      setOrders(res.data || []);
    } catch (e) {
      setError(e.message);
      setOrders([]);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const canCancel = (status) =>
    status === 'PLACED' || status === 'CONFIRMED' || status === 'PREPARING' || status === 'READY_FOR_PICKUP';

  function viewBill(orderId) {
    window.open('/invoice?order=' + orderId, '_blank');
  }

  async function viewDetail(id) {
    try {
      const res = await apiCall('/api/orders/' + id);
      setDetailOrder(res.data);
      showModal('orderDetailModal');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function openCancel(order) {
    setCancelTarget(order);
    showModal('cancelOrderModal');
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await apiCall('/api/orders/' + cancelTarget.id + '/cancel', { method: 'PUT' });
      hideModal('cancelOrderModal');
      setCancelTarget(null);
      showToast('Order cancelled successfully.');
      loadOrders();
    } catch (e) {
      showToast(e.message || 'Could not cancel order', 'error');
    } finally {
      setCancelling(false);
    }
  }

  function openReview(order) {
    setReviewTarget(order);
    setReviewRating(0);
    setReviewHover(0);
    setReviewComment('');
    setReviewError('');
    setReviewSubmitting(false);
    showModal('reviewModal');
  }

  async function submitReview() {
    if (!reviewTarget) return;
    if (!reviewRating) { setReviewError('Please select a rating (1 to 5 stars).'); return; }
    if (!reviewComment.trim()) { setReviewError('Please write your review.'); return; }
    if (reviewComment.length > 1000) { setReviewError('Review must not exceed 1000 characters.'); return; }
    setReviewSubmitting(true);
    setReviewError('');
    try {
      await apiCall('/api/reviews', {
        method: 'POST',
        body: { orderId: reviewTarget.id, rating: reviewRating, comment: reviewComment.trim() }
      });
      setReviewedOrderIds(prev => new Set(prev).add(reviewTarget.id));
      hideModal('reviewModal');
      setReviewTarget(null);
      loadOrders();
      showToast('Review submitted successfully. Thank you!');
    } catch (e) {
      setReviewError(e.message || 'Could not submit review');
    } finally {
      setReviewSubmitting(false);
    }
  }

  if (orders === null) return <Spinner className="mt-3" />;
  if (error) return <EmptyState icon="fa-triangle-exclamation" title={error} />;
  if (!orders.length) {
    return (
      <EmptyState icon="fa-truck" title="No orders yet" text="Your fresh cuts are waiting. Place your first order!"
        to="/shop" actionLabel="Start Shopping" />
    );
  }

  return (
    <>
      {orders.map(o => (
        <div className="order-card" key={o.id}>
          <div className="oc-head">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <div><small className="text-muted d-block">Order No.</small><strong className="order-no">{o.orderNumber}</strong></div>
              <div><small className="text-muted d-block">Placed On</small><strong>{fmtDate(o.createdAt)}</strong></div>
            </div>
            <span className={'status-badge status-' + customerOrderStatusClass(o.status)}>{customerOrderStatusLabel(o.status)}</span>
          </div>
          <div className="oc-body">
            {(o.items || []).map((item, i) => (
              <div className="order-line" key={i}>
                <img src={resolveImage(item.productImage)} alt="" />
                <div className="flex-grow-1">
                  <strong className="small">{item.productName}</strong>
                  <div className="text-muted small">
                    {item.quantity} KG &times; {fmtMoney(item.pricePerKg)}
                    {item.cuttingOption ? ' \u2022 ' + item.cuttingOption.replace(/_/g, ' ') : ''}
                  </div>
                </div>
                <div className="text-end"><div className="text-muted small">{fmtMoney(item.subtotal)}</div></div>
              </div>
            ))}

            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
              <div className="small text-muted">
                <i className="fa-solid fa-location-dot me-1"></i>{o.deliveryDoor}, {o.deliveryArea}, {o.deliveryCity} &nbsp;&bull;&nbsp;
                <i className="fa-solid fa-clock me-1"></i>{o.deliverySlot}
              </div>
              <div className="small text-muted">
                <i className="fa-solid fa-credit-card me-1"></i>{(o.paymentMethod || '').replace(/_/g, ' ')}
                <span className={'status-badge status-' + (o.paymentStatus || 'PENDING')}>{(o.paymentStatus || 'PENDING').replace(/_/g, ' ')}</span>
                {o.paymentStatus === 'PAID' ? <>&nbsp;<span className="text-success">Paid {fmtMoney(o.paidAmount || o.grandTotal)}</span></> : null}
              </div>
              <div className="d-flex align-items-center gap-3">
                <strong className="fs-5">{fmtMoney(o.grandTotal)}</strong>
                <div className="d-flex gap-2 flex-wrap">
                  {o.status === 'DELIVERED' ? (
                    reviewedOrderIds.has(o.id)
                      ? <span className="reviewed-tag"><i className="fa-solid fa-circle-check me-1"></i>Review Submitted</span>
                      : <button className="btn btn-fm-outline btn-sm" onClick={() => openReview(o)}><i className="fa-solid fa-star me-1"></i>Write a Review</button>
                  ) : null}
                  <Link className="btn btn-fm-outline btn-sm" to={'/order-tracking?id=' + o.id}>
                    <i className="fa-solid fa-location-arrow me-1"></i>Track Order
                  </Link>
                  <button className="btn btn-fm-outline btn-sm" onClick={() => viewDetail(o.id)}>
                    <i className="fa-regular fa-eye me-1"></i>Details
                  </button>
                  {o.status && o.status !== 'CANCELLED' ? (
                    <button className="btn btn-fm-outline btn-sm" onClick={() => viewBill(o.id)}>
                      <i className="fa-solid fa-file-invoice me-1"></i>Bill
                    </button>
                  ) : null}
                  {canCancel(o.status) ? (
                    <button className="btn btn-fm-outline btn-sm" style={{ borderColor: '#dc3545', color: '#dc3545' }} onClick={() => openCancel(o)}>
                      <i className="fa-solid fa-ban me-1"></i>Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Order detail modal */}
      <div className="modal fade" id="orderDetailModal" tabIndex={-1}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-receipt me-2 text-primary"></i>Order Details</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              {detailOrder ? (
                <>
                  <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
                    <div><small className="text-muted">Order</small><br /><strong>{detailOrder.orderNumber}</strong></div>
                    <div><small className="text-muted">Status</small><br /><span className={'status-badge status-' + customerOrderStatusClass(detailOrder.status)}>{customerOrderStatusLabel(detailOrder.status)}</span></div>
                    <div><small className="text-muted">Date</small><br /><span>{fmtDate(detailOrder.createdAt)}</span></div>
                  </div>
                  <hr />
                  {(detailOrder.items || []).map((i, idx) => (
                    <div className="d-flex justify-content-between small mb-1" key={idx}>
                      <span>{i.productName} <span className="text-muted">&times; {i.quantity} KG{i.cuttingOption ? ' (' + i.cuttingOption.replace(/_/g, ' ') + ')' : ''}</span></span>
                      <span>{fmtMoney(i.subtotal)}</span>
                    </div>
                  ))}
                  <hr />
                  <div className="small">
                    <div className="d-flex justify-content-between mb-1"><span>Subtotal</span><span>{fmtMoney(detailOrder.subtotal)}</span></div>
                    <div className="d-flex justify-content-between mb-1"><span>Discount</span><span className="text-success">-{fmtMoney(detailOrder.discountAmount)}</span></div>
                    <div className="d-flex justify-content-between mb-1"><span>Delivery</span><span>{Number(detailOrder.deliveryCharge) === 0 ? 'FREE' : fmtMoney(detailOrder.deliveryCharge)}</span></div>
                    <div className="d-flex justify-content-between fw-bold mt-2"><span>Grand Total</span><span>{fmtMoney(detailOrder.grandTotal)}</span></div>
                  </div>
                  <hr />
                  <div className="small text-muted">
                    <div><i className="fa-solid fa-location-dot me-1"></i>{detailOrder.deliveryDoor}, {detailOrder.deliveryStreet}, {detailOrder.deliveryArea}, {detailOrder.deliveryCity} - {detailOrder.deliveryPincode}</div>
                    <div className="mt-1"><i className="fa-solid fa-clock me-1"></i>Slot: {detailOrder.deliverySlot}</div>
                    <div className="mt-1">
                      <i className="fa-solid fa-credit-card me-1"></i>{(detailOrder.paymentMethod || '').replace(/_/g, ' ')}
                      <span className={'status-badge status-' + (detailOrder.paymentStatus || 'PENDING')}>{(detailOrder.paymentStatus || 'PENDING').replace(/_/g, ' ')}</span>
                      {detailOrder.paymentStatus === 'PAID' ? (
                        <>&nbsp;<span className="text-success">Paid {fmtMoney(detailOrder.paidAmount || detailOrder.grandTotal)}{detailOrder.paidAt ? ' on ' + fmtDateOnly(detailOrder.paidAt) : ''}</span></>
                      ) : null}
                    </div>
                  </div>
                  {detailOrder.status && detailOrder.status !== 'CANCELLED' ? (
                    <div className="mt-3 text-end">
                      <button className="btn btn-fm-outline btn-sm" onClick={() => viewBill(detailOrder.id)}>
                        <i className="fa-solid fa-file-invoice me-1"></i>View Bill
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      <div className="modal fade" id="cancelOrderModal" tabIndex={-1} aria-labelledby="cancelOrderModalLabel" data-bs-backdrop="static" data-bs-keyboard="false">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="cancelOrderModalLabel"><i className="fa-solid fa-ban text-danger me-2"></i>Cancel Order</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body text-center pb-2">
              <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
              <p className="mb-0 fw-semibold">Are you sure you want to cancel this order?</p>
              <div className="confirm-order-info">
                <span>Order No: <strong>{cancelTarget ? cancelTarget.orderNumber : '-'}</strong></span>
                <span>Items: <strong>{cancelTarget && (cancelTarget.items || []).length ? (cancelTarget.items.length + (cancelTarget.items.length === 1 ? ' item' : ' items')) : '-'}</strong></span>
                <span>Total: <strong>{cancelTarget && cancelTarget.grandTotal != null ? fmtMoney(cancelTarget.grandTotal) : '-'}</strong></span>
              </div>
              <p className="small text-muted mt-3 mb-0"><i className="fa-solid fa-circle-info me-1"></i>This action cannot be undone.</p>
            </div>
            <div className="modal-footer border-0 justify-content-center pb-4 pt-2">
              <button type="button" className="btn btn-fm-outline" data-bs-dismiss="modal">Keep Order</button>
              <button type="button" className="btn btn-danger-fm" onClick={confirmCancel} disabled={cancelling}>
                {cancelling ? <><span className="spinner-border spinner-border-sm me-1"></span>Cancelling...</> : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review modal */}
      <div className="modal fade" id="reviewModal" tabIndex={-1} aria-labelledby="reviewModalLabel" data-bs-backdrop="static" data-bs-keyboard="false">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="reviewModalLabel"><i className="fa-solid fa-star text-gold me-2"></i>Review Your Order</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Order</label>
                <p className="mb-0">{reviewTarget ? (reviewTarget.orderNumber ? '#' + reviewTarget.orderNumber : 'Order #' + reviewTarget.id) : '-'}</p>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Products</label>
                <div className="d-flex flex-wrap gap-2">
                  {reviewTarget && (reviewTarget.items || []).length
                    ? reviewTarget.items.map((i, idx) => (
                      <span className="badge order-product-chip" key={idx}>{i.productName}{i.quantity ? ' \u00d7 ' + i.quantity + ' KG' : ''}</span>
                    ))
                    : <span className="text-muted">-</span>}
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Your Rating</label>
                <div className="rating-input d-flex gap-1 fs-3 review-star-row" style={{ cursor: 'pointer', color: 'var(--gold)' }}
                  onMouseLeave={() => setReviewHover(0)}>
                  {[1, 2, 3, 4, 5].map(v => (
                    <i key={v} data-v={v}
                      className={(reviewHover || reviewRating) >= v ? 'fa-solid fa-star' : 'fa-regular fa-star'}
                      onMouseEnter={() => setReviewHover(v)}
                      onClick={() => setReviewRating(v)}></i>
                  ))}
                </div>
                <div className="small text-muted mt-1">1 = Poor, 5 = Excellent</div>
              </div>
              <div className="mb-2">
                <label className="form-label fw-semibold" htmlFor="reviewModalComment">Your Review</label>
                <textarea className="form-control form-control-fm" id="reviewModalComment" rows={3} maxLength={1000}
                  placeholder="Share your experience with this order..." value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}></textarea>
                <div className="form-text text-muted text-end">{reviewComment.length} / 1000</div>
              </div>
              {reviewError ? <div className="text-danger small mb-2">{reviewError}</div> : null}
            </div>
            <div className="modal-footer border-0 justify-content-center pb-4 pt-2">
              <button type="button" className="btn btn-fm-outline" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-fm" onClick={submitReview} disabled={reviewSubmitting}>
                {reviewSubmitting ? <><span className="spinner-border spinner-border-sm me-1"></span>Submitting...</> : <><i className="fa-solid fa-paper-plane me-1"></i>Submit Review</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
