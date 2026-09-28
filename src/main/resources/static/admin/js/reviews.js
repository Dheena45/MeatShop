/* FreshMeat — Admin Reviews controller */

let currentFilter = '';
let pendingDeleteReview = null;
const DELETE_REVIEW_MODAL = new bootstrap.Modal(document.getElementById('deleteReviewModal'));

const REVIEW_STATUSES = ['APPROVED', 'REJECTED'];

function reviewStars(rating) {
    const r = Math.max(1, Math.min(5, Number(rating || 0)));
    return '<span style="color:var(--gold);">' + '★'.repeat(r) + '☆'.repeat(5 - r) + '</span>';
}

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('reviews', 'Reviews', 'Moderate customer feedback')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div class="d-flex flex-wrap gap-2" id="status-filters">
        <button class="btn-admin-outline active-fill" data-status="" style="padding:0.4rem 1rem;font-size:0.78rem;">All</button>
        ${REVIEW_STATUSES.map(s => `
          <button class="btn-admin-outline" data-status="${s}" style="padding:0.4rem 1rem;font-size:0.78rem;">${s}</button>`).join('')}
      </div>
    </div>
    <div class="admin-card">
      <div id="reviews-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    document.getElementById('status-filters').addEventListener('click', e => {
        const btn = e.target.closest('button[data-status]');
        if (!btn) return;
        currentFilter = btn.dataset.status;
        document.querySelectorAll('#status-filters button').forEach(b => b.classList.remove('active-fill'));
        btn.classList.add('active-fill');
        loadReviews();
    });

    document.getElementById('delete-review-confirm-btn').addEventListener('click', confirmDeleteReview);

    document.getElementById('deleteReviewModal').addEventListener('hidden.bs.modal', () => {
        const modalEl = document.getElementById('deleteReviewModal');
        const active = document.activeElement;
        if (modalEl && active && modalEl.contains(active)) active.blur();
    });

    loadReviews();
});

async function loadReviews() {
    const params = '';
    const url = '/api/admin/reviews' + (currentFilter ? '?status=' + currentFilter : '');
    const body = document.getElementById('reviews-body');
    try {
        const res = await apiCall(url);
        const reviews = res.data || [];
        if (!reviews.length) {
            body.innerHTML = emptyBoxHtml('No reviews match this filter');
            return;
        }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Order</th>
              <th>Rating</th>
              <th>Review</th>
              <th>Date</th>
              <th>Status</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${reviews.map(r => `
              <tr>
                <td><strong class="small">${escapeHtml(r.customerName || 'FreshMeat User')}</strong></td>
                <td class="text-muted" style="font-size:0.82rem;">${escapeHtml(r.orderNumber || 'Order #' + (r.orderId || '-'))}</td>
                <td aria-label="${r.rating} out of 5 stars">${reviewStars(r.rating)}</td>
                <td style="font-size:0.82rem;max-width:280px;">${escapeHtml(r.comment || '')}</td>
                <td class="text-muted" style="font-size:0.78rem;white-space:nowrap;">${fmtDate(r.createdAt)}</td>
                <td>${adminStatusBadge(r.status)}</td>
                <td class="text-end" style="white-space:nowrap;">
                  <div class="d-inline-flex gap-1">
                    ${r.status !== 'APPROVED' ? `
                      <button class="btn-icon-xs toggle-on" onclick="setReviewStatus(${r.id}, 'APPROVED')" title="Approve"><i class="fa-solid fa-check"></i></button>` : `
                      <button class="btn-icon-xs toggle-off" onclick="setReviewStatus(${r.id}, 'REJECTED')" title="Reject"><i class="fa-solid fa-xmark"></i></button>`}
                    <button class="btn-icon-xs del" onclick="askDeleteReview(${r.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

async function setReviewStatus(id, status) {
    const label = status.toLowerCase();
    try {
        await apiCall('/api/admin/reviews/' + id + '/status', { method: 'PUT', body: { status } });
        showToast('Review ' + (status === 'APPROVED' ? 'approved' : 'rejected') + '.');
        loadReviews();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        else showToast(e.message, 'error');
    }
}

function askDeleteReview(id) {
    pendingDeleteReview = id;
    document.getElementById('delete-review-confirm-msg').textContent =
        'Are you sure you want to permanently delete this review?';
    DELETE_REVIEW_MODAL.show();
}

async function confirmDeleteReview() {
    if (!pendingDeleteReview) return;
    const btn = document.getElementById('delete-review-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...';
    try {
        await apiCall('/api/admin/reviews/' + pendingDeleteReview, { method: 'DELETE' });
        DELETE_REVIEW_MODAL.hide();
        pendingDeleteReview = null;
        showToast('Review deleted.');
        loadReviews();
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            Auth.requireAdmin();
        } else {
            showToast(e.message, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Delete Review';
    }
}