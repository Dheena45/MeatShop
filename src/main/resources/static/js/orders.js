/* FreshMeat — Orders controller (shared by /orders.html and the Profile page) */

// Only highlight the "Orders" header nav item on the standalone orders page.
if (document.getElementById('orders-list')) {
    getActiveNavKey = function () { return 'orders'; };
}

document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('orders-list')) return; // embedded elsewhere (e.g. Profile page)
    if (!Auth.requireLogin()) return;
    loadOrders();
});

let detailOrdersCache = {};
let ordersCache = {};
let reviewedOrderIds = new Set();

async function loadReviewedOrders() {
    if (!Auth.isLoggedIn()) return;
    try {
        const res = await apiCall('/api/reviews/my-reviews');
        const reviews = res.data || [];
        reviewedOrderIds = new Set(reviews.map(r => r.orderId).filter(Boolean));
    } catch (e) {
        reviewedOrderIds = new Set();
    }
}

async function loadOrders() {
    const loadingEl = document.getElementById('orders-loading');
    const listEl = document.getElementById('orders-list');
    try {
        await loadReviewedOrders();
        const res = await apiCall('/api/orders/my-orders');
        const orders = res.data || [];
        ordersCache = {};
        orders.forEach(o => { ordersCache[o.id] = o; });
        if (loadingEl) loadingEl.classList.add('d-none');
        if (listEl) listEl.classList.remove('d-none');
        if (listEl) listEl.innerHTML = ordersHtml(orders);
    } catch (e) {
        if (loadingEl) loadingEl.innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message)}</h6></div>`;
    }
}

// Load the user's orders into an arbitrary container (used by the Profile page).
async function loadOrdersInto(containerId, loadingId) {
    const listEl = document.getElementById(containerId);
    if (!listEl) return;
    const loadingEl = loadingId ? document.getElementById(loadingId) : null;
    try {
        await loadReviewedOrders();
        const res = await apiCall('/api/orders/my-orders');
        const orders = res.data || [];
        ordersCache = {};
        orders.forEach(o => { ordersCache[o.id] = o; });
        if (loadingEl) loadingEl.classList.add('d-none');
        listEl.classList.remove('d-none');
        listEl.innerHTML = ordersHtml(orders);
    } catch (e) {
        if (loadingEl) loadingEl.classList.add('d-none');
        listEl.classList.remove('d-none');
        listEl.innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message)}</h6></div>`;
    }
}

function refreshOrdersView() {
    if (document.getElementById('orders-list')) loadOrders();
    else loadOrdersInto('profile-myorders', 'myorders-loading');
}

function ordersHtml(orders) {
    if (!orders.length) {
        return `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-truck"></i></div>
            <h6>No orders yet</h6>
            <p>Your fresh cuts are waiting. Place your first order!</p>
            <a href="/shop.html" class="btn btn-fm mt-2">Start Shopping</a>
        </div>`;
    }
    return orders.map(o => {
        const status = o.status;
        // Mirrors the server rule: an order can be cancelled until it is out
        // for delivery, and never once delivered.
        const canCancel = (status === 'PLACED' || status === 'CONFIRMED'
            || status === 'PREPARING' || status === 'READY_FOR_PICKUP');
        return `
        <div class="order-card">
          <div class="oc-head">
            <div class="d-flex align-items-center gap-3 flex-wrap">
              <div><small class="text-muted d-block">Order No.</small><strong class="order-no">${escapeHtml(o.orderNumber)}</strong></div>
              <div><small class="text-muted d-block">Placed On</small><strong>${fmtDate(o.createdAt)}</strong></div>
            </div>
            <span class="status-badge status-${customerOrderStatusClass(status)}">${escapeHtml(customerOrderStatusLabel(status))}</span>
          </div>
          <div class="oc-body">
            ${(o.items || []).map(item => {
              return `
              <div class="order-line">
                <img src="${escapeHtml(item.productImage || '/images/default-meat.jpg')}" alt="">
                <div class="flex-grow-1">
                  <strong class="small">${escapeHtml(item.productName)}</strong>
                  <div class="text-muted small">${item.quantity} KG × ${fmtMoney(item.pricePerKg)}
                    ${item.cuttingOption ? ' • ' + item.cuttingOption.replace(/_/g, ' ') : ''}</div>
                </div>
                <div class="text-end">
                  <div class="text-muted small">${fmtMoney(item.subtotal)}</div>
                </div>
              </div>`;
            }).join('')}

            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
              <div class="small text-muted">
                <i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(o.deliveryDoor)}, ${escapeHtml(o.deliveryArea)}, ${escapeHtml(o.deliveryCity)} &nbsp;•&nbsp;
                <i class="fa-solid fa-clock me-1"></i>${escapeHtml(o.deliverySlot)}
              </div>
              <div class="small text-muted">
                <i class="fa-solid fa-credit-card me-1"></i>${(o.paymentMethod || '').replace(/_/g, ' ')}
                <span class="status-badge status-${o.paymentStatus || 'PENDING'}">${(o.paymentStatus || 'PENDING').replace(/_/g, ' ')}</span>
                ${o.paymentStatus === 'PAID' ? ` &nbsp;<span class="text-success">Paid ${fmtMoney(o.paidAmount || o.grandTotal)}</span>` : ''}
              </div>
              <div class="d-flex align-items-center gap-3">
                <strong class="fs-5">${fmtMoney(o.grandTotal)}</strong>
                <div class="d-flex gap-2 flex-wrap">
                  ${orderReviewHtml(o)}
                  <button class="btn btn-fm-outline btn-sm" onclick="window.location.href='/order-tracking.html?id=${o.id}'">
                    <i class="fa-solid fa-location-arrow me-1"></i>Track Order</button>
                  <button class="btn btn-fm-outline btn-sm" data-bs-toggle="modal" data-bs-target="#orderDetailModal" onclick="viewOrderDetail(${o.id})">
                    <i class="fa-regular fa-eye me-1"></i>Details</button>
                  ${o.status && o.status !== 'CANCELLED' ? `
                    <button class="btn btn-fm-outline btn-sm" onclick="viewBill(${o.id})">
                      <i class="fa-solid fa-file-invoice me-1"></i>Bill</button>` : ''}
                  ${canCancel ? `
                    <button class="btn btn-fm-outline btn-sm" style="border-color:#dc3545;color:#dc3545;" onclick="cancelOrder(${o.id})">
                      <i class="fa-solid fa-ban me-1"></i>Cancel</button>` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
}

function orderReviewHtml(order) {
    if (order.status !== 'DELIVERED') return '';
    if (reviewedOrderIds.has(order.id)) {
        return '<span class="reviewed-tag"><i class="fa-solid fa-circle-check me-1"></i>Review Submitted</span>';
    }
    return `<button class="btn btn-fm-outline btn-sm" onclick="openReviewModal(${order.id})">
        <i class="fa-solid fa-star me-1"></i>Write a Review</button>`;
}

function viewBill(orderId) {
    window.open('/invoice.html?order=' + orderId, '_blank');
}

async function viewOrderDetail(id) {
    try {
        const res = await apiCall('/api/orders/' + id);
        const o = res.data;
        const modalBody = document.getElementById('orderDetailModalBody');
        modalBody.innerHTML = `
            <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
                <div><small class="text-muted">Order</small><br><strong>${escapeHtml(o.orderNumber)}</strong></div>
                <div><small class="text-muted">Status</small><br><span class="status-badge status-${customerOrderStatusClass(o.status)}">${escapeHtml(customerOrderStatusLabel(o.status))}</span></div>
                <div><small class="text-muted">Date</small><br><span>${fmtDate(o.createdAt)}</span></div>
            </div>
            <hr>
            ${(o.items || []).map(i => `
                <div class="d-flex justify-content-between small mb-1">
                    <span>${escapeHtml(i.productName)} <span class="text-muted">× ${i.quantity} KG${i.cuttingOption ? ' (' + i.cuttingOption.replace(/_/g,' ') + ')' : ''}</span></span>
                    <span>${fmtMoney(i.subtotal)}</span>
                </div>`).join('')}
            <hr>
            <div class="small">
                <div class="d-flex justify-content-between mb-1"><span>Subtotal</span><span>${fmtMoney(o.subtotal)}</span></div>
                <div class="d-flex justify-content-between mb-1"><span>Discount</span><span class="text-success">-${fmtMoney(o.discountAmount)}</span></div>
                <div class="d-flex justify-content-between mb-1"><span>Delivery</span><span>${Number(o.deliveryCharge) === 0 ? 'FREE' : fmtMoney(o.deliveryCharge)}</span></div>
                <div class="d-flex justify-content-between fw-bold mt-2"><span>Grand Total</span><span>${fmtMoney(o.grandTotal)}</span></div>
            </div>
            <hr>
            <div class="small text-muted">
                <div><i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(o.deliveryDoor)}, ${escapeHtml(o.deliveryStreet)}, ${escapeHtml(o.deliveryArea)}, ${escapeHtml(o.deliveryCity)} - ${escapeHtml(o.deliveryPincode)}</div>
                <div class="mt-1"><i class="fa-solid fa-clock me-1"></i>Slot: ${escapeHtml(o.deliverySlot)}</div>
                <div class="mt-1">
                    <i class="fa-solid fa-credit-card me-1"></i>${(o.paymentMethod || '').replace(/_/g, ' ')}
                    <span class="status-badge status-${o.paymentStatus || 'PENDING'}">${(o.paymentStatus || 'PENDING').replace(/_/g, ' ')}</span>
                    ${o.paymentStatus === 'PAID'
                        ? ` &nbsp;<span class="text-success">Paid ${fmtMoney(o.paidAmount || o.grandTotal)}${o.paidAt ? ' on ' + fmtDateOnly(o.paidAt) : ''}</span>`
                        : ''}
                  </div>
            </div>
            ${o.status && o.status !== 'CANCELLED' ? `
            <div class="mt-3 text-end">
                <button class="btn btn-fm-outline btn-sm" onclick="viewBill(${o.id})">
                    <i class="fa-solid fa-file-invoice me-1"></i>View Bill</button>
            </div>` : ''}`;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

let cancelOrderId = null;
let cancelModal = null;

function cancelOrder(id) {
    const order = ordersCache[id] || {};
    cancelOrderId = id;

    document.getElementById('cancelOrderNo').textContent = order.orderNumber || '-';

    const itemCount = (order.items || []).length;
    document.getElementById('cancelOrderItems').textContent =
        itemCount ? itemCount + (itemCount === 1 ? ' item' : ' items') : '-';

    document.getElementById('cancelOrderTotal').textContent =
        order.grandTotal != null ? fmtMoney(order.grandTotal) : '-';

    document.getElementById('confirmCancelBtn').disabled = false;
    if (!cancelModal) cancelModal = new bootstrap.Modal(document.getElementById('cancelOrderModal'));
    cancelModal.show();
}

async function confirmCancelOrder() {
    if (!cancelOrderId) return;
    const btn = document.getElementById('confirmCancelBtn');
    btn.disabled = true;
    try {
        await apiCall('/api/orders/' + cancelOrderId + '/cancel', { method: 'PUT' });
        cancelModal.hide();
        cancelOrderId = null;
        showToast('Order cancelled successfully.');
        refreshOrdersView();
    } catch (e) {
        btn.disabled = false;
        showToast(e.message || 'Could not cancel order', 'error');
    }
}

function reorder(order) {
    // Quick reorder: add all items of delivered order back into cart
    const item = order.items[0];
    if (!item) return;
    apiCall('/api/cart/items', {
        method: 'POST',
        body: { productId: item.productId, quantity: item.quantity, cuttingOption: item.cuttingOption }
    }).then(() => {
        updateCartCount();
        showToast('Added to cart!');
    }).catch(e => showToast(e.message, 'error'));
}

/* ---------- Write a Review (delivered orders, one per order) ---------- */

let reviewOrderId = null;
let reviewModalInstance = null;

function reviewOrderProductsHtml(orderId) {
    const order = ordersCache[orderId] || {};
    const items = order.items || [];
    if (!items.length) return '<span class="text-muted">-</span>';
    return items.map(i =>
        `<span class="badge order-product-chip">${escapeHtml(i.productName)}${i.quantity ? ' × ' + i.quantity + ' KG' : ''}</span>`)
        .join(' ');
}

function ensureReviewModal() {
    if (document.getElementById('reviewModal')) return;
    const el = document.createElement('div');
    el.innerHTML = `
    <div class="modal fade" id="reviewModal" tabindex="-1" aria-labelledby="reviewModalLabel" data-bs-backdrop="static" data-bs-keyboard="false">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="reviewModalLabel"><i class="fa-solid fa-star text-gold me-2"></i>Review Your Order</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label fw-semibold">Order</label>
              <p class="mb-0" id="reviewModalOrder">-</p>
            </div>
            <div class="mb-3">
              <label class="form-label fw-semibold">Products</label>
              <div class="d-flex flex-wrap gap-2" id="reviewModalProducts">-</div>
            </div>
            <div class="mb-3">
              <label class="form-label fw-semibold">Your Rating</label>
              <div class="rating-input d-flex gap-1 fs-3 review-star-row" style="cursor:pointer;color:var(--gold)">
                <i data-v="1" class="fa-regular fa-star"></i><i data-v="2" class="fa-regular fa-star"></i>
                <i data-v="3" class="fa-regular fa-star"></i><i data-v="4" class="fa-regular fa-star"></i>
                <i data-v="5" class="fa-regular fa-star"></i>
              </div>
              <div class="small text-muted mt-1">1 = Poor, 5 = Excellent</div>
            </div>
            <div class="mb-2">
              <label class="form-label fw-semibold" for="reviewModalComment">Your Review</label>
              <textarea class="form-control form-control-fm" id="reviewModalComment" rows="3" maxlength="1000" placeholder="Share your experience with this order..."></textarea>
              <div class="form-text text-muted text-end" id="reviewModalCounter">0 / 1000</div>
            </div>
            <div id="reviewModalError" class="text-danger small d-none mb-2"></div>
          </div>
          <div class="modal-footer border-0 justify-content-center pb-4 pt-2">
            <button type="button" class="btn btn-fm-outline" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-fm" id="reviewModalSubmit" onclick="submitOrderReview()">
              <i class="fa-solid fa-paper-plane me-1"></i>Submit Review</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(el.firstElementChild);
    document.getElementById('reviewModal').addEventListener('hidden.bs.modal', () => {
        const m = document.getElementById('reviewModal');
        const active = document.activeElement;
        if (m && active && m.contains(active)) active.blur();
    });
}

function setupReviewStars() {
    let selected = Number(document.getElementById('reviewModal').dataset.rating || 0);
    const stars = document.querySelectorAll('#reviewModal .review-star-row i');
    stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
            const v = Number(star.dataset.v);
            stars.forEach(s => {
                s.className = Number(s.dataset.v) <= v ? 'fa-solid fa-star' : 'fa-regular fa-star';
            });
        });
        star.addEventListener('click', () => {
            selected = Number(star.dataset.v);
            stars.forEach(s => {
                s.className = Number(s.dataset.v) <= selected ? 'fa-solid fa-star' : 'fa-regular fa-star';
            });
            document.getElementById('reviewModal').dataset.rating = String(selected);
        });
    });
    document.getElementById('reviewModal').querySelector('.rating-input').addEventListener('mouseleave', () => {
        stars.forEach(s => {
            s.className = Number(s.dataset.v) <= selected ? 'fa-solid fa-star' : 'fa-regular fa-star';
        });
    });
}

function openReviewModal(orderId) {
    if (!Auth.requireLogin()) return;
    ensureReviewModal();
    const order = ordersCache[orderId] || {};
    reviewOrderId = orderId;
    document.getElementById('reviewModal').dataset.rating = '';
    document.getElementById('reviewModalOrder').textContent = order.orderNumber ? '#' + order.orderNumber : 'Order #' + orderId;
    document.getElementById('reviewModalProducts').innerHTML = reviewOrderProductsHtml(orderId);
    document.getElementById('reviewModalComment').value = '';
    document.getElementById('reviewModalCounter').textContent = '0 / 1000';
    document.getElementById('reviewModalError').classList.add('d-none');
    document.getElementById('reviewModal').querySelectorAll('.review-star-row i').forEach(s => {
        s.className = 'fa-regular fa-star';
    });
    const submitBtn = document.getElementById('reviewModalSubmit');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i>Submit Review';
    setupReviewStars();
    document.getElementById('reviewModalComment').oninput = function () {
        document.getElementById('reviewModalCounter').textContent = this.value.length + ' / 1000';
    };
    if (!reviewModalInstance || typeof reviewModalInstance.show !== 'function') {
        reviewModalInstance = new bootstrap.Modal(document.getElementById('reviewModal'));
    }
    reviewModalInstance.show();
}

async function submitOrderReview() {
    if (!reviewOrderId) return;
    const rating = Number(document.getElementById('reviewModal').dataset.rating || 0);
    const comment = document.getElementById('reviewModalComment').value.trim();
    const errorEl = document.getElementById('reviewModalError');
    errorEl.classList.add('d-none');

    if (!rating) { errorEl.textContent = 'Please select a rating (1 to 5 stars).'; errorEl.classList.remove('d-none'); return; }
    if (!comment) { errorEl.textContent = 'Please write your review.'; errorEl.classList.remove('d-none'); return; }
    if (comment.length > 1000) { errorEl.textContent = 'Review must not exceed 1000 characters.'; errorEl.classList.remove('d-none'); return; }

    const btn = document.getElementById('reviewModalSubmit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Submitting...';
    try {
        const res = await apiCall('/api/reviews', {
            method: 'POST',
            body: { orderId: reviewOrderId, rating, comment }
        });
        reviewedOrderIds.add(reviewOrderId);
        errorEl.classList.add('d-none');
        reviewModalInstance.hide();
        refreshOrdersView();
        showToast('Review submitted successfully. Thank you!');
    } catch (e) {
        errorEl.textContent = e.message || 'Could not submit review';
        errorEl.classList.remove('d-none');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i>Submit Review';
    }
}