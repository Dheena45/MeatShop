/* FreshMeat — Simulated UPI payment gateway page (development demo).
 *
 * This page stands in for a real payment gateway. It runs entirely in the
 * customer's browser and posts the OUTCOME of a payment to the server, which
 * applies the same transition rules a real gateway callback would apply:
 *   success  -> payment PENDING/FAILED -> PAID, order PLACED -> CONFIRMED
 *   failure  -> payment PENDING        -> FAILED, order stays PLACED
 * No real money moves and no amount is hard-coded as paid — the server decides
 * based on the posted result.
 */

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    if (!orderId) {
        showError('Missing order reference.');
        return;
    }
    loadPayment(orderId);
});

function showBox(html) {
    document.getElementById('pay-loading').classList.add('d-none');
    const box = document.getElementById('pay-box');
    box.classList.remove('d-none');
    box.innerHTML = html;
}

function showError(message) {
    showBox(`
        <div class="pay-card text-center">
            <div class="pay-icon-circle fail mx-auto mb-3"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h5 class="fw-bold">Payment Unavailable</h5>
            <p class="text-muted small mb-3">${escapeHtml(message)}</p>
            <a href="/orders.html" class="btn btn-fm-outline btn-sm"><i class="fa-solid fa-arrow-left me-1"></i>Back to My Orders</a>
        </div>`);
}

async function loadPayment(orderId) {
    try {
        const res = await apiCall('/api/orders/' + orderId);
        const o = res.data;

        if (!o || (o.paymentMethod || '') !== 'ONLINE') {
            showError('This order does not require an online payment.');
            return;
        }
        if ((o.status === 'CANCELLED') || (o.paymentStatus === 'CANCELLED')) {
            showError('This payment was cancelled.');
            return;
        }
        if (o.paymentStatus === 'PAID') {
            renderSuccess(o);
            return;
        }
        renderPayment(o);
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            Auth.clear();
            window.location.href = '/login.html?redirect=' +
                encodeURIComponent('/payment.html?order=' + orderId);
            return;
        }
        showError(e.message || 'Could not load payment details.');
    }
}

function renderPayment(o) {
    const retried = o.paymentStatus === 'FAILED';
    showBox(`
        <div class="pay-card">
            <div class="d-flex align-items-center justify-content-between mb-2">
                <h5 class="fw-bold mb-0"><i class="fa-solid fa-shield-halved me-1" style="color:var(--primary)"></i>Secure UPI Payment</h5>
                <span class="pay-demo-badge"><i class="fa-solid fa-flask"></i>DEMO GATEWAY</span>
            </div>
            <p class="text-muted small mb-3">FreshMeat Payment · Order ${escapeHtml(o.orderNumber || ('#' + o.id))}</p>

            ${retried ? `<div class="alert alert-danger py-2 small">
                <i class="fa-solid fa-circle-xmark me-1"></i>Your previous payment attempt failed. You can retry below.
            </div>` : ''}

            <div class="text-center my-4">
                <div class="pay-amount">${fmtMoney(o.grandTotal)}</div>
                <div class="text-muted small">Amount payable</div>
            </div>

            <div class="pay-card-info mb-3">
                <div class="pay-row"><span class="text-muted">UPI / VPA</span><b>freshmeat@upi</b></div>
                <div class="pay-row"><span class="text-muted">Payment Status</span><b>${(o.paymentStatus || 'PENDING').replace(/_/g, ' ')}</b></div>
                <div class="pay-row"><span class="text-muted">Order Status</span><b>${(o.status || '').replace(/_/g, ' ')}</b></div>
                <div class="pay-row"><span class="text-muted">Delivery Slot</span><b>${escapeHtml(o.deliverySlot || '-')}</b></div>
            </div>

            <button class="btn btn-fm w-100 btn-fm-lg mb-2" id="pay-success-btn">
                <i class="fa-solid fa-circle-check me-1"></i>Simulate Successful Payment</button>
            <button class="btn btn-fm-outline w-100" id="pay-fail-btn">
                <i class="fa-solid fa-circle-xmark me-1"></i>Simulate Failed Payment</button>
            <p class="text-muted small text-center mt-3 mb-0">
                <i class="fa-solid fa-flask me-1"></i>Development demo — no real money is charged. The order is
                confirmed only <b>after</b> the gateway confirms payment success.</p>
        </div>`);

    document.getElementById('pay-success-btn').addEventListener('click', () => submitResult(true, o.id));
    document.getElementById('pay-fail-btn').addEventListener('click', () => submitResult(false, o.id));
}

async function submitResult(success, orderId) {
    const successBtn = document.getElementById('pay-success-btn');
    const failBtn = document.getElementById('pay-fail-btn');
    const busy = '<span class="spinner-border spinner-border-sm me-2"></span>' +
        (success ? 'Processing Payment...' : 'Processing...');
    const disable = b => { if (b) { b.disabled = true; b.innerHTML = busy; } };
    disable(successBtn);
    disable(failBtn);

    try {
        const body = { success };
        if (success) {
            body.transactionRef = 'DEMOUPI-' +
                new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14);
        }
        await apiCall('/api/orders/' + orderId + '/payment/confirm', { method: 'POST', body });
        if (success) updateCartCount();

        // Re-fetch to render the fresh server state.
        const res = await apiCall('/api/orders/' + orderId);
        const o = res.data;
        if (success && o.paymentStatus === 'PAID') {
            renderSuccess(o);
        } else {
            renderPayment(o);
        }
    } catch (e) {
        showToast(e.message || 'Could not record the payment result.', 'error');
        if (successBtn) { successBtn.disabled = false; successBtn.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i>Simulate Successful Payment'; }
        if (failBtn) { failBtn.disabled = false; failBtn.innerHTML = '<i class="fa-solid fa-circle-xmark me-1"></i>Simulate Failed Payment'; }
    }
}

function renderSuccess(o) {
    showBox(`
        <div class="pay-card text-center">
            <div class="pay-icon-circle ok mx-auto mb-3"><i class="fa-solid fa-check"></i></div>
            <span class="pay-demo-badge mb-2"><i class="fa-solid fa-flask"></i>DEMO GATEWAY</span>
            <h5 class="fw-bold mt-2 mb-1">Payment Successful</h5>
            <p class="text-muted small mb-3">Your UPI payment was confirmed and the order is now confirmed for delivery.</p>

            <div class="pay-card-info mb-3 text-start">
                <div class="pay-row"><span class="text-muted">Order Number</span><b>${escapeHtml(o.orderNumber || ('#' + o.id))}</b></div>
                <div class="pay-row"><span class="text-muted">Payment Method</span><b>UPI / Online</b></div>
                <div class="pay-row"><span class="text-muted">Payment Status</span><b style="color:var(--success)">PAID</b></div>
                <div class="pay-row"><span class="text-muted">Paid Amount</span><b>${fmtMoney(o.paidAmount || o.grandTotal)}</b></div>
                <div class="pay-row"><span class="text-muted">Paid On</span><b>${o.paidAt ? fmtDateOnly(o.paidAt) : '-'}</b></div>
                <div class="pay-row"><span class="text-muted">Order Status</span><b>${(o.status || '').replace(/_/g, ' ')}</b></div>
            </div>

            <div class="d-grid gap-2">
                <a href="/order-tracking.html?id=${o.id}${o.orderNumber ? '&no=' + encodeURIComponent(o.orderNumber) : ''}" class="btn btn-fm"><i class="fa-solid fa-location-dot me-1"></i>Track Order</a>
                <a href="/invoice.html?order=${o.id}" class="btn btn-fm-outline"><i class="fa-solid fa-file-invoice me-1"></i>View Bill</a>
                <a href="/orders.html" class="btn btn-fm-outline"><i class="fa-solid fa-list me-1"></i>My Orders</a>
            </div>
        </div>`);
}