import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { fmtMoney, fmtDate, fmtDateOnly } from '../lib/format';
import { CUSTOMER_ORDER_STEPS, customerOrderStepIndex, customerOrderStatusClass, customerOrderStatusLabel } from '../lib/orderStatus';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

/* Order tracking — ported from order-tracking.html + js/order-tracking.js */
export default function OrderTracking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('id');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) { navigate('/orders'); return; }
    apiCall('/api/orders/' + id)
      .then(res => setOrder(res.data))
      .catch(e => setError(e.message));
  }, [id, navigate]);

  if (error) {
    return (
      <section className="section-pad pt-4">
        <div className="container" style={{ maxWidth: 820 }}>
          <Link to="/orders" className="small"><i className="fa-solid fa-arrow-left me-1"></i>Back to My Orders</Link>
          <EmptyState icon="fa-triangle-exclamation" title={error} to="/orders" actionLabel="Back" />
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="section-pad pt-4">
        <div className="container" style={{ maxWidth: 820 }}><Spinner /></div>
      </section>
    );
  }

  const o = order;
  const cancelled = o.status === 'CANCELLED';
  const currentIdx = customerOrderStepIndex(o.status);

  return (
    <section className="section-pad pt-4">
      <div className="container" style={{ maxWidth: 820 }}>
        <Link to="/orders" className="small"><i className="fa-solid fa-arrow-left me-1"></i>Back to My Orders</Link>

        <div className="card card-fm p-4 mt-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <small className="text-muted">Order</small>
              <h4 className="fw-bold mb-0">{o.orderNumber}</h4>
            </div>
            <div className="text-end">
              <small className="text-muted">Status</small><br />
              <span className={'status-badge status-' + customerOrderStatusClass(o.status)}>{customerOrderStatusLabel(o.status)}</span>
            </div>
          </div>

          {cancelled ? (
            <div className="alert alert-danger d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-xmark"></i> This order was cancelled.
            </div>
          ) : (
            <div className="timeline">
              {CUSTOMER_ORDER_STEPS.map((step, i) => {
                const cls = i < currentIdx ? 'done' : (i === currentIdx ? 'active' : '');
                const icon = i <= currentIdx ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
                return (
                  <div className={'timeline-step ' + cls} key={step.key}>
                    <div className="timeline-dot"><i className={icon}></i></div>
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <hr />

          <div className="row g-3">
            <div className="col-md-6">
              <h6 className="fw-bold">Items</h6>
              {(o.items || []).map((i, idx) => (
                <div className="d-flex justify-content-between small mb-1" key={idx}>
                  <span>{i.productName} <span className="text-muted">&times; {i.quantity} KG{i.cuttingOption ? ' (' + i.cuttingOption.replace(/_/g, ' ') + ')' : ''}</span></span>
                  <span>{fmtMoney(i.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="col-md-6">
              <h6 className="fw-bold">Totals</h6>
              <div className="small">
                <div className="d-flex justify-content-between"><span>Subtotal</span><span>{fmtMoney(o.subtotal)}</span></div>
                <div className="d-flex justify-content-between"><span>Discount</span><span className="text-success">-{fmtMoney(o.discountAmount)}</span></div>
                <div className="d-flex justify-content-between"><span>Delivery</span><span>{Number(o.deliveryCharge) === 0 ? 'FREE' : fmtMoney(o.deliveryCharge)}</span></div>
                <div className="d-flex justify-content-between fw-bold mt-1"><span>Total</span><span>{fmtMoney(o.grandTotal)}</span></div>
              </div>
            </div>
          </div>

          <hr />

          <div className="row g-3 small text-muted">
            <div className="col-md-6">
              <h6 className="fw-bold text-dark">Delivery Address</h6>
              {o.deliveryDoor}, {o.deliveryStreet}, {o.deliveryArea},<br />
              {o.deliveryCity} - {o.deliveryPincode}, {o.deliveryState}
            </div>
            <div className="col-md-6">
              <h6 className="fw-bold text-dark">Delivery Info</h6>
              <div><i className="fa-solid fa-clock me-1"></i>Slot: {o.deliverySlot}</div>
              <div><i className="fa-solid fa-user me-1"></i>{o.customerName} ({o.customerPhone})</div>
              <div>
                <i className="fa-solid fa-credit-card me-1"></i>{(o.paymentMethod || '').replace(/_/g, ' ')}
                <span className={'status-badge status-' + (o.paymentStatus || 'PENDING')}>{(o.paymentStatus || 'PENDING').replace(/_/g, ' ')}</span>
              </div>
              {o.paymentStatus === 'PAID' ? (
                <div><i className="fa-solid fa-circle-check me-1" style={{ color: 'var(--success)' }}></i>Paid {fmtMoney(o.paidAmount || o.grandTotal)}{o.paidAt ? ' on ' + fmtDateOnly(o.paidAt) : ''}</div>
              ) : null}
              <div><i className="fa-solid fa-calendar me-1"></i>Placed: {fmtDate(o.createdAt)}</div>
            </div>
          </div>

          <div className="mt-3 d-flex flex-wrap gap-2">
            <Link to="/orders" className="btn btn-fm-outline btn-sm"><i className="fa-solid fa-arrow-left me-1"></i>View All Orders</Link>
            {o.status !== 'CANCELLED' ? (
              <button className="btn btn-fm btn-sm" onClick={() => window.open('/invoice?order=' + o.id, '_blank')}>
                <i className="fa-solid fa-file-invoice me-1"></i>View Bill
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
