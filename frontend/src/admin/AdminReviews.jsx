import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { fmtDate } from '../lib/format';
import { showToast } from '../lib/toast';
import Stars from '../components/Stars';
import { AdminStatusBadge, EmptyBox, SpinnerBox, hideModal, showModal, useModalId } from './AdminLayout';

/* FreshMeat — Admin Reviews controller (ported from reviews.js) */

const REVIEW_STATUSES = ['APPROVED', 'REJECTED'];

export default function AdminReviews() {
  const [reviews, setReviews] = useState(null);
  const [currentFilter, setCurrentFilter] = useState('');

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const deleteModalId = useModalId('deleteReviewModal');

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

  const loadReviews = useCallback(async () => {
    const url = '/api/admin/reviews' + (currentFilter ? '?status=' + currentFilter : '');
    setReviews(null);
    try {
      const res = await apiCall(url);
      if (!mounted.current) return;
      setReviews(res.data || []);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setReviews([]);
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [currentFilter]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  async function setReviewStatus(id, status) {
    try {
      await apiCall('/api/admin/reviews/' + id + '/status', { method: 'PUT', body: { status } });
      showToast('Review ' + (status === 'APPROVED' ? 'approved' : 'rejected') + '.');
      loadReviews();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message, 'error');
    }
  }

  function askDeleteReview(id) {
    setPendingDelete(id);
    showModal(deleteModalId);
  }

  async function confirmDeleteReview() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiCall('/api/admin/reviews/' + pendingDelete, { method: 'DELETE' });
      hideModal(deleteModalId);
      setPendingDelete(null);
      showToast('Review deleted.');
      loadReviews();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <div className="d-flex flex-wrap gap-2" id="status-filters">
          {['', ...REVIEW_STATUSES].map(s => (
            <button
              key={s || 'all'}
              className={'btn-admin-outline' + (currentFilter === s ? ' active-fill' : '')}
              style={{ padding: '0.4rem 1rem', fontSize: '0.78rem' }}
              onClick={() => setCurrentFilter(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="table-responsive">
          {reviews == null ? <SpinnerBox /> : !reviews.length ? (
            <EmptyBox msg="No reviews match this filter" />
          ) : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Customer</th><th>Order</th><th>Rating</th><th>Review</th>
                  <th>Date</th><th>Status</th><th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(r => (
                  <tr key={r.id}>
                    <td><strong className="small">{r.customerName || 'FreshMeat User'}</strong></td>
                    <td className="text-muted" style={{ fontSize: '0.82rem' }}>
                      {r.orderNumber || 'Order #' + (r.orderId || '-')}
                    </td>
                    <td aria-label={r.rating + ' out of 5 stars'}><Stars rating={r.rating} /></td>
                    <td style={{ fontSize: '0.82rem', maxWidth: 280 }}>{r.comment || ''}</td>
                    <td className="text-muted" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
                    <td><AdminStatusBadge status={r.status} /></td>
                    <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                      <div className="d-inline-flex gap-1">
                        {r.status !== 'APPROVED' ? (
                          <button className="btn-icon-xs toggle-on" onClick={() => setReviewStatus(r.id, 'APPROVED')} title="Approve">
                            <i className="fa-solid fa-check"></i>
                          </button>
                        ) : (
                          <button className="btn-icon-xs toggle-off" onClick={() => setReviewStatus(r.id, 'REJECTED')} title="Reject">
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        )}
                        <button className="btn-icon-xs del" onClick={() => askDeleteReview(r.id)} title="Delete">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete review confirmation modal */}
      <div className="modal fade" id={deleteModalId} tabIndex="-1" aria-labelledby={deleteModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={deleteModalId + 'Label'}>
                <i className="fa-solid fa-triangle-exclamation text-danger me-2"></i>Delete Review
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">Are you sure you want to permanently delete this review?</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn-admin"
                style={{ background: 'var(--danger)' }}
                onClick={confirmDeleteReview}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner-border spinner-border-sm me-1"></span>Deleting...</> : 'Delete Review'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}