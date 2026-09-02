/* FreshMeat — Order tracking controller */

const ORDER_STEPS = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        window.location.href = '/orders.html';
        return;
    }
    loadOrder(id);
});

async function loadOrder(id) {
    try {
        const res = await apiCall('/api/orders/' + id);
        const o = res.data;
        renderTracking(o);
    } catch (e) {
        document.getElementById('track-loading').innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message)}</h6>
            <a href="/orders.html" class="btn btn-fm mt-2">Back</a></div>`;
    }
}

function renderTracking(o) {
    document.getElementById('track-loading').classList.add('d-none');
    const content = document.getElementById('track-content');
    content.classList.remove('d-none');

    const cancelled = o.status === 'CANCELLED';
    const currentIdx = cancelled ? -1 : ORDER_STEPS.indexOf(o.status);

    const timeline = ORDER_STEPS.map((step, i) => {
        const display = step.replace(/_/g, ' ');
        const cls = i < currentIdx ? 'done' : (i === currentIdx ? 'active' : '');
        const icon = i <= currentIdx ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
        return `
        <div class="timeline-step ${cls}">
            <div class="timeline-dot"><i class="${icon}"></i></div>
            <span>${display}</span>
        </div>`;
    }).join('');

    content.innerHTML = `
        <div class="card card-fm p-4 mt-3">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                    <small class="text-muted">Order</small>
                    <h4 class="fw-bold mb-0">${escapeHtml(o.orderNumber)}</h4>
                </div>
                <div class="text-end">
                    <small class="text-muted">Status</small><br>
                    <span class="status-badge status-${o.status}">${o.status.replace(/_/g, ' ')}</span>
                </div>
            </div>

            ${cancelled
                ? `<div class="alert alert-danger d-flex align-items-center gap-2">
                     <i class="fa-solid fa-circle-xmark"></i> This order was cancelled.
                   </div>`
                : `<div class="timeline">${timeline}</div>`}

            <hr>

            <div class="row g-3">
                <div class="col-md-6">
                    <h6 class="fw-bold">Items</h6>
                    ${(o.items || []).map(i => `
                        <div class="d-flex justify-content-between small mb-1">
                            <span>${escapeHtml(i.productName)} <span class="text-muted">× ${i.quantity} KG${i.cuttingOption ? ' (' + i.cuttingOption.replace(/_/g,' ') + ')' : ''}</span></span>
                            <span>${fmtMoney(i.subtotal)}</span>
                        </div>`).join('')}
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold">Totals</h6>
                    <div class="small">
                        <div class="d-flex justify-content-between"><span>Subtotal</span><span>${fmtMoney(o.subtotal)}</span></div>
                        <div class="d-flex justify-content-between"><span>Discount</span><span class="text-success">-${fmtMoney(o.discountAmount)}</span></div>
                        <div class="d-flex justify-content-between"><span>Delivery</span><span>${Number(o.deliveryCharge) === 0 ? 'FREE' : fmtMoney(o.deliveryCharge)}</span></div>
                        <div class="d-flex justify-content-between fw-bold mt-1"><span>Total</span><span>${fmtMoney(o.grandTotal)}</span></div>
                    </div>
                </div>
            </div>

            <hr>

            <div class="row g-3 small text-muted">
                <div class="col-md-6">
                    <h6 class="fw-bold text-dark">Delivery Address</h6>
                    ${escapeHtml(o.deliveryDoor)}, ${escapeHtml(o.deliveryStreet)}, ${escapeHtml(o.deliveryArea)},<br>
                    ${escapeHtml(o.deliveryCity)} - ${escapeHtml(o.deliveryPincode)}, ${escapeHtml(o.deliveryState)}
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold text-dark">Delivery Info</h6>
                    <div><i class="fa-solid fa-clock me-1"></i>Slot: ${escapeHtml(o.deliverySlot)}</div>
                    <div><i class="fa-solid fa-user me-1"></i>${escapeHtml(o.customerName)} (${escapeHtml(o.customerPhone)})</div>
                    <div><i class="fa-solid fa-credit-card me-1"></i>${(o.paymentMethod || '').replace(/_/g, ' ')}</div>
                    <div><i class="fa-solid fa-calendar me-1"></i>Placed: ${fmtDate(o.createdAt)}</div>
                </div>
            </div>
            <div class="mt-3">
                <a href="/orders.html" class="btn btn-fm-outline btn-sm"><i class="fa-solid fa-arrow-left me-1"></i>View All Orders</a>
            </div>
        </div>`;
}