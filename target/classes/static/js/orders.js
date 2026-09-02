/* FreshMeat — Orders page controller */

function getActiveNavKey() { return 'orders'; }

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;
    loadOrders();
});

async function loadOrders() {
    try {
        const res = await apiCall('/api/orders/my-orders');
        const orders = res.data || [];
        document.getElementById('orders-loading').classList.add('d-none');
        document.getElementById('orders-list').classList.remove('d-none');

        if (!orders.length) {
            document.getElementById('orders-list').innerHTML = `<div class="empty-state">
                <div class="es-icon"><i class="fa-solid fa-truck"></i></div>
                <h6>No orders yet</h6>
                <p>Your fresh cuts are waiting. Place your first order!</p>
                <a href="/shop.html" class="btn btn-fm mt-2">Start Shopping</a>
            </div>`;
            return;
        }

        document.getElementById('orders-list').innerHTML = orders.map(o => {
            const status = o.status;
            const canCancel = (status === 'PLACED' || status === 'CONFIRMED');
            return `
            <div class="order-card">
              <div class="oc-head">
                <div class="d-flex align-items-center gap-3 flex-wrap">
                  <div><small class="text-muted d-block">Order No.</small><strong class="order-no">${escapeHtml(o.orderNumber)}</strong></div>
                  <div><small class="text-muted d-block">Placed On</small><strong>${fmtDate(o.createdAt)}</strong></div>
                </div>
                <span class="status-badge status-${status}">${status.replace(/_/g, ' ')}</span>
              </div>
              <div class="oc-body">
                ${(o.items || []).map(item => `
                  <div class="order-line">
                    <img src="${escapeHtml(item.productImage || 'https://placehold.co/600x600/2d2d2d/f5f0e8?text=FreshMeat')}" alt="">
                    <div class="flex-grow-1">
                      <strong class="small">${escapeHtml(item.productName)}</strong>
                      <div class="text-muted small">${item.quantity} KG × ${fmtMoney(item.pricePerKg)}
                        ${item.cuttingOption ? ' • ' + item.cuttingOption.replace(/_/g, ' ') : ''}</div>
                    </div>
                    <div class="text-muted small">${fmtMoney(item.subtotal)}</div>
                  </div>`).join('')}

                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
                  <div class="small text-muted">
                    <i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(o.deliveryDoor)}, ${escapeHtml(o.deliveryArea)}, ${escapeHtml(o.deliveryCity)} &nbsp;•&nbsp;
                    <i class="fa-solid fa-clock me-1"></i>${escapeHtml(o.deliverySlot)}
                  </div>
                  <div class="d-flex align-items-center gap-3">
                    <strong class="fs-5">${fmtMoney(o.grandTotal)}</strong>
                    <div class="d-flex gap-2 flex-wrap">
                      <button class="btn btn-fm-outline btn-sm" onclick="window.location.href='/order-tracking.html?id=${o.id}'">
                        <i class="fa-solid fa-location-arrow me-1"></i>Track Order</button>
                      <button class="btn btn-fm-outline btn-sm" data-bs-toggle="modal" data-bs-target="#orderDetailModal" onclick="viewOrderDetail(${o.id})">
                        <i class="fa-regular fa-eye me-1"></i>Details</button>
                      ${canCancel ? `
                        <button class="btn btn-fm-outline btn-sm" style="border-color:#dc3545;color:#dc3545;" onclick="cancelOrder(${o.id})">
                          <i class="fa-solid fa-ban me-1"></i>Cancel</button>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>`;
        }).join('');
    } catch (e) {
        document.getElementById('orders-loading').innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message)}</h6></div>`;
    }
}

let detailOrdersCache = {};
async function viewOrderDetail(id) {
    try {
        const res = await apiCall('/api/orders/' + id);
        const o = res.data;
        const modalBody = document.getElementById('orderDetailModalBody');
        modalBody.innerHTML = `
            <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
                <div><small class="text-muted">Order</small><br><strong>${escapeHtml(o.orderNumber)}</strong></div>
                <div><small class="text-muted">Status</small><br><span class="status-badge status-${o.status}">${o.status.replace(/_/g,' ')}</span></div>
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
                <div class="mt-1"><i class="fa-solid fa-credit-card me-1"></i>${(o.paymentMethod || '').replace(/_/g, ' ')}</div>
            </div>`;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function cancelOrder(id) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
        await apiCall('/api/orders/' + id + '/cancel', { method: 'PUT' });
        showToast('Order cancelled');
        loadOrders();
    } catch (e) {
        showToast(e.message, 'error');
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