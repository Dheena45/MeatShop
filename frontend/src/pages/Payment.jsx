import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { fmtMoney, fmtDateOnly } from '../lib/format';
import { showToast } from '../lib/toast';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

/* Simulated UPI gateway — ported from payment.html + js/payment.js */
export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order');
  const { logout } = useAuth();
  const { refresh } = useCart();

  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPayment = useCallback(async () => {
    try {
      const res = await apiCall('/api/orders/' + orderId);
      const o = res.data;
      if (!o || (o.paymentMethod || '') !== 'ONLINE') {
        setError('This order does not require an online payment.'); return;
      }
      if (o.status === 'CANCELLED' || o.paymentStatus === 'CANCELLED') {
        setError('This payment was cancelled.'); return;
      }
      setOrder(o);
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        logout();
        navigate('/login?redirect=' + encodeURIComponent('/payment?order=' + orderId));
        return;
      }
      setError(e.message || 'Could not load payment details.');
    }
  }, [orderId, logout, navigate]);

  useEffect(() => {
    if (!orderId) { setError('Missing order reference.'); return; }
    loadPayment();
  }, [orderId, loadPayment]);

  async function submitResult(success) {
    if (busy) return;
    setBusy(true);
    try {
      const body = { success };
      if (success) {
        body.transactionRef = 'DEMOUPI-' + new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14);
      }
      await apiCall('/api/orders/' + orderId + '/payment/confirm', { method: 'POST', body });
      if (success) refresh();
      const res = await apiCall('/api/orders/' + orderId);
      setOrder(res.data);
    } catch (e) {
      showToast(e.message || 'Could not record the payment result.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <section className="section-pad pt-4">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="pay-card text-center">
            <div className="pay-icon-circle fail mx-auto mb-3"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <h5 className="fw-bold">Payment Unavailable</h5>
            <p className="text-muted small mb-3">{error}</p>
            <Link to="/orders" className="btn btn-fm-outline btn-sm"><i className="fa-solid fa-arrow-left me-1"></i>Back to My Orders</Link>
          </div>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="section-pad pt-4">
        <div className="container" style={{ maxWidth: 760 }}><Spinner /></div>
      </section>
    );
  }

  const o = order;

  if (o.paymentStatus === 'PAID') {
    return (
      <section className="section-pad pt-4">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="pay-card text-center">
            <div className="pay-icon-circle ok mx-auto mb-3"><i className="fa-solid fa-check"></i></div>
            <span className="pay-demo-badge mb-2"><i className="fa-solid fa-flask"></i>DEMO GATEWAY</span>
            <h5 className="fw-bold mt-2 mb-1">Payment Successful</h5>
            <p className="text-muted small mb-3">Your UPI payment was confirmed and the order is now confirmed for delivery.</p>
            <div className="pay-card-info mb-3 text-start">
              <div className="pay-row"><span className="text-muted">Order Number</span><b>{o.orderNumber || ('#' + o.id)}</b></div>
              <div className="pay-row"><span className="text-muted">Payment Method</span><b>UPI / Online</b></div>
              <div className="pay-row"><span className="text-muted">Payment Status</span><b style={{ color: 'var(--success)' }}>PAID</b></div>
              <div className="pay-row"><span className="text-muted">Paid Amount</span><b>{fmtMoney(o.paidAmount || o.grandTotal)}</b></div>
              <div className="pay-row"><span className="text-muted">Paid On</span><b>{o.paidAt ? fmtDateOnly(o.paidAt) : '-'}</b></div>
              <div className="pay-row"><span className="text-muted">Order Status</span><b>{(o.status || '').replace(/_/g, ' ')}</b></div>
            </div>
            <div className="d-grid gap-2">
              <Link to={'/order-tracking?id=' + o.id + (o.orderNumber ? '&no=' + encodeURIComponent(o.orderNumber) : '')} className="btn btn-fm">
                <i className="fa-solid fa-location-dot me-1"></i>Track Order
              </Link>
              <Link to={'/invoice?order=' + o.id} className="btn btn-fm-outline"><i className="fa-solid fa-file-invoice me-1"></i>View Bill</Link>
              <Link to="/orders" className="btn btn-fm-outline"><i className="fa-solid fa-list me-1"></i>My Orders</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const retried = o.paymentStatus === 'FAILED';

  return (
    <section className="section-pad pt-4">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="pay-card">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="fw-bold mb-0"><i className="fa-solid fa-shield-halved me-1" style={{ color: 'var(--primary)' }}></i>Secure UPI Payment</h5>
            <span className="pay-demo-badge"><i className="fa-solid fa-flask"></i>DEMO GATEWAY</span>
          </div>
          <p className="text-muted small mb-3">FreshMeat Payment &middot; Order {o.orderNumber || ('#' + o.id)}</p>

          {retried ? (
            <div className="alert alert-danger py-2 small">
              <i className="fa-solid fa-circle-xmark me-1"></i>Your previous payment attempt failed. You can retry below.
            </div>
          ) : null}

          <div className="text-center my-4">
            <div className="pay-amount">{fmtMoney(o.grandTotal)}</div>
            <div className="text-muted small">Amount payable</div>
          </div>

          <div className="pay-card-info mb-3">
            <div className="pay-row"><span className="text-muted">UPI / VPA</span><b>freshmeat@upi</b></div>
            <div className="pay-row"><span className="text-muted">Payment Status</span><b>{(o.paymentStatus || 'PENDING').replace(/_/g, ' ')}</b></div>
            <div className="pay-row"><span className="text-muted">Order Status</span><b>{(o.status || '').replace(/_/g, ' ')}</b></div>
            <div className="pay-row"><span className="text-muted">Delivery Slot</span><b>{o.deliverySlot || '-'}</b></div>
          </div>

          <button className="btn btn-fm w-100 btn-fm-lg mb-2" onClick={() => submitResult(true)} disabled={busy}>
            {busy ? <><span className="spinner-border spinner-border-sm me-2"></span>Processing Payment...</> : <><i className="fa-solid fa-circle-check me-1"></i>Simulate Successful Payment</>}
          </button>
          <button className="btn btn-fm-outline w-100" onClick={() => submitResult(false)} disabled={busy}>
            <i className="fa-solid fa-circle-xmark me-1"></i>Simulate Failed Payment
          </button>
          <p className="text-muted small text-center mt-3 mb-0">
            <i className="fa-solid fa-flask me-1"></i>Development demo &mdash; no real money is charged. The order is
            confirmed only <b>after</b> the gateway confirms payment success.
          </p>
        </div>
      </div>
    </section>
  );
}
