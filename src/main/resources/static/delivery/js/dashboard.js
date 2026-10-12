/* FreshMeat — Delivery Boy dashboard
   Talks only to /api/delivery/**. Any other order id is rejected server side
   with 403, so there is nothing to hide on the client either. */

// Every delivery page operates on the DELIVERY_BOY session
// (freshmeat_delivery_* keys), independent of admin/customer sessions.
Auth.setRole('delivery');

let dbState = '';
let dbSearch = '';
let dbOrders = [];
let dbSummary = {};
let sheetOrder = null;
let toastTimer = null;

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireDeliveryBoy()) return;

    const user = Auth.getUser() || {};
    document.getElementById('db-user-name').textContent = user.name || 'Delivery Boy';
    document.getElementById('db-greeting').textContent = greetingFor(new Date());
    document.getElementById('db-date').textContent =
        new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    document.getElementById('logout-btn').addEventListener('click', function () {
        // Only the DELIVERY_BOY keys are removed; other roles stay logged in.
        Auth.clear();
        window.location.href = '/login.html?role=delivery';
    });
    document.getElementById('db-refresh').addEventListener('click', function () {
        loadAll(true);
    });
    document.getElementById('db-search').addEventListener('input', debounce(function (e) {
        dbSearch = e.target.value.trim();
        loadOrders();
    }, 350));
    document.getElementById('sheet-close').addEventListener('click', closeSheet);
    document.getElementById('sheet-backdrop').addEventListener('click', closeSheet);
    document.getElementById('cash-backdrop').addEventListener('click', closeCashConfirm);
    document.getElementById('cash-modal-close').addEventListener('click', closeCashConfirm);
    document.getElementById('cash-modal-cancel').addEventListener('click', closeCashConfirm);
    document.getElementById('cash-confirm-btn').addEventListener('click', confirmCashCollect);
    document.getElementById('warn-backdrop').addEventListener('click', closeCashWarn);
    document.getElementById('warn-modal-close').addEventListener('click', closeCashWarn);
    document.getElementById('warn-cancel').addEventListener('click', closeCashWarn);
    document.getElementById('warn-collect').addEventListener('click', function () {
        const target = warnOrder;
        closeCashWarn();
        if (target) openCashConfirm(target.id);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeSheet();
            closeCashConfirm();
            closeCashWarn();
        }
    });

    document.querySelectorAll('.db-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            dbState = tab.dataset.state || '';
            loadOrders();
        });
    });

    loadAll();
});

function greetingFor(d) {
    const h = d.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

async function loadAll(withSpin) {
    if (withSpin) {
        const btn = document.getElementById('db-refresh');
        btn.classList.add('spinning');
        setTimeout(() => btn.classList.remove('spinning'), 900);
    }
    await Promise.all([loadSummary(), loadOrders()]);
}

async function loadSummary() {
    try {
        const res = await apiCall('/api/delivery/summary');
        dbSummary = res.data || {};
    } catch (e) {
        if (handleAuth(e)) return;
        dbSummary = {};
    }
    renderSummary();
}

function renderSummary() {
    const stats = [
        { key: 'today', label: "Today's Deliveries", value: dbSummary.todayDeliveries || 0, cls: 'accent-orange', icon: 'fa-boxes-stacked' },
        { key: 'pending', label: 'To Pick Up', value: dbSummary.pendingDeliveries || 0, cls: 'accent-blue', icon: 'fa-location-arrow' },
        { key: 'transit', label: 'On The Way', value: dbSummary.outForDelivery || 0, cls: 'accent-purple', icon: 'fa-truck-fast' },
        { key: 'done', label: 'Completed', value: dbSummary.completedDeliveries || 0, cls: 'accent-green', icon: 'fa-circle-check' }
    ];
    document.getElementById('db-stats').innerHTML = stats.map(s => `
        <div class="db-stat ${s.cls}">
            <span class="db-stat-label"><i class="fa-solid ${s.icon} me-1"></i>${s.label}</span>
            <span class="db-stat-value">${s.value}</span>
        </div>`).join('');
}

async function loadOrders() {
    const list = document.getElementById('db-list');
    list.innerHTML = `
        <div class="db-empty">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <p>Loading your deliveries...</p>
        </div>`;
    try {
        const p = new URLSearchParams();
        if (dbSearch) p.set('search', dbSearch);
        if (dbState) p.set('state', dbState);
        const res = await apiCall('/api/delivery/all?' + p.toString());
        dbOrders = res.data || [];
        renderList();
    } catch (e) {
        if (handleAuth(e)) return;
        dbOrders = [];
        list.innerHTML = emptyHtml('fa-triangle-exclamation', 'Could not load deliveries', e.message || 'Please try again.');
    }
}

function emptyHtml(icon, title, text) {
    return `
        <div class="db-empty">
            <i class="fa-solid ${icon}"></i>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(text || '')}</p>
        </div>`;
}

function chipLabel(state) {
    return {
        ASSIGNED: 'To Pick Up',
        OUT_FOR_DELIVERY: 'On The Way',
        DELIVERED: 'Delivered',
        PENDING_ASSIGNMENT: 'Unassigned'
    }[state] || state.replace(/_/g, ' ');
}

function renderList() {
    const list = document.getElementById('db-list');
    if (!dbOrders.length) {
        list.innerHTML = dbSearch || dbState
            ? emptyHtml('fa-magnifying-glass', 'No matching deliveries', 'Try a different search or tab.')
            : emptyHtml('fa-box-open', 'Nothing assigned yet', 'New deliveries assigned to you will show up here.');
        return;
    }

    list.innerHTML = dbOrders.map(o => {
        const d = o.delivery || {};
        const state = d.state || 'PENDING_ASSIGNMENT';
        const cod = o.paymentMethod === 'CASH_ON_DELIVERY';
        const unpaid = o.paymentStatus !== 'PAID';

        const actions = [];
        if (d.canStart) {
            actions.push(`<button class="db-btn db-btn-primary" data-action="pickup" data-id="${o.id}">
                <i class="fa-solid fa-box"></i>Confirm Pickup</button>`);
        }
        if (d.canCollectCash) {
            actions.push(`<button class="db-btn db-btn-gold" data-action="cash" data-id="${o.id}">
                <i class="fa-solid fa-money-bill-wave"></i>Collect ${fmtMoney(o.grandTotal)}</button>`);
        }
        // Mark Delivered stays visible for every order being delivered so the
        // boy always sees the way forward; the click handler gates the COD
        // unpaid case (warning modal, no API call) before calling the API.
        if (state === 'OUT_FOR_DELIVERY') {
            actions.push(`<button class="db-btn db-btn-green" data-action="delivered" data-id="${o.id}">
                <i class="fa-solid fa-circle-check"></i>Mark Delivered</button>`);
        }
        actions.push(`<button class="db-btn db-btn-ghost" data-action="view" data-id="${o.id}">
            <i class="fa-solid fa-eye"></i>Full Details</button>`);

        let payLine;
        if (cod && unpaid && state !== 'DELIVERED') {
            payLine = `
                <div class="db-pay-line">
                    <span class="db-cod-hint"><i class="fa-solid fa-money-bill-wave me-1"></i>Cash on delivery - not collected</span>
                    <span class="db-pay-badge PENDING">${fmtMoney(o.grandTotal)}</span>
                </div>`;
        } else {
            payLine = `
                <div class="db-pay-line">
                    <span class="db-pay-badge ${escapeHtml(o.paymentStatus || 'PENDING')}">${escapeHtml((o.paymentMethod || '').replace(/_/g, ' '))}</span>
                    <span><strong>${fmtMoney(o.grandTotal)}</strong>
                        <span class="db-pay-badge ${escapeHtml(o.paymentStatus || 'PENDING')}" style="margin-left:0.35rem;">${escapeHtml(o.paymentStatus || 'PENDING')}</span></span>
                </div>`;
        }

        return `
        <article class="db-card state-${state}" data-id="${o.id}" role="button" tabindex="0" title="View order details">
            <div class="db-card-top">
                <div>
                    <div class="db-order-no">#${escapeHtml(o.orderNumber)}</div>
                    <div class="db-order-when">${fmtDate(o.createdAt)}</div>
                </div>
                <span class="db-chip ${state}">${escapeHtml(chipLabel(state))}</span>
            </div>

            <div class="db-customer">${escapeHtml(o.customerName || '-')} <span>- ${escapeHtml(o.customerPhone || '')}</span></div>
            <div class="db-address">
                <i class="fa-solid fa-location-dot me-1"></i>${escapeHtml([o.deliveryDoor, o.deliveryStreet, o.deliveryArea, o.deliveryCity, o.deliveryPincode].filter(Boolean).join(', ') || '-')}
            </div>
            <div class="db-meta">
                <span><i class="fa-regular fa-clock"></i>${escapeHtml(o.deliverySlot || 'Any time')}</span>
                ${d.deliveryDate && d.deliverySlot ? '<span><i class="fa-solid fa-calendar-days"></i>' + escapeHtml(d.deliveryDate) + ' ' + escapeHtml(d.deliverySlot) + '</span>' : ''}
                <span><i class="fa-solid fa-boxes-stacked"></i>${(o.items || []).length} item(s)</span>
                ${d.startedAt ? '<span><i class="fa-solid fa-box-open"></i>Picked Up ' + fmtDate(d.startedAt) + '</span>' : ''}
                ${d.completedAt ? '<span><i class="fa-solid fa-flag-checkered"></i>Delivered ' + fmtDate(d.completedAt) + '</span>' : ''}
            </div>

            ${payLine}

            <div class="db-actions">${actions.join('')}</div>
        </article>`;
    }).join('');
}

document.getElementById('db-list').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (btn) {
        const id = Number(btn.dataset.id);
        const action = btn.dataset.action;
        if (action === 'view') openSheet(id);
        else if (action === 'pickup') doAction(btn, id, 'pickup', 'Pickup confirmed. Order is out for delivery!');
        else if (action === 'cash') openCashConfirm(id);
        else if (action === 'delivered') handleDeliver(btn, id);
        return;
    }
    // Tapping anywhere on an assigned order's card (including its status chip)
    // opens the Order Details view.
    const card = e.target.closest('.db-card[data-id]');
    if (card) openSheet(Number(card.dataset.id));
});

document.getElementById('db-list').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // Let the inner action buttons handle their own keyboard activation.
    if (e.target.closest('[data-action]')) return;
    const card = e.target.closest('.db-card[data-id]');
    if (card) {
        e.preventDefault();
        openSheet(Number(card.dataset.id));
    }
});

async function doAction(btn, orderId, action, successMsg) {
    const icon = btn.querySelector('i');
    const original = btn.innerHTML;
    btn.classList.add('loading');
    btn.disabled = true;
    if (icon) icon.classList.add('fa-spin');

    try {
        await apiCall('/api/delivery/' + orderId + '/' + action, { method: 'PUT' });
        toast(successMsg, 'ok');
        closeSheet();
        await loadAll();
    } catch (e) {
        if (handleAuth(e)) return;
        toast(e.message || 'Something went wrong.', 'err');
        btn.classList.remove('loading');
        btn.disabled = false;
        if (icon) icon.classList.remove('fa-spin');
        btn.innerHTML = original;
    }
}

function openSheet(orderId) {
    const cached = dbOrders.find(o => o.id === orderId);
    if (cached) renderSheet(cached);

    document.getElementById('sheet-backdrop').hidden = false;
    document.getElementById('detail-sheet').hidden = false;
    document.body.style.overflow = 'hidden';

    apiCall('/api/delivery/' + orderId)
        .then(res => renderSheet(res.data))
        .catch(e => {
            if (handleAuth(e)) return;
            toast(e.message || 'Could not load this delivery.', 'err');
            closeSheet();
        });
}

function closeSheet() {
    document.getElementById('sheet-backdrop').hidden = true;
    document.getElementById('detail-sheet').hidden = true;
    document.body.style.overflow = '';
    sheetOrder = null;
}

function renderSheet(o) {
    sheetOrder = o;
    const d = o.delivery || {};
    const state = d.state || 'PENDING_ASSIGNMENT';
    const cod = o.paymentMethod === 'CASH_ON_DELIVERY';
    const unpaid = o.paymentStatus !== 'PAID';

    document.getElementById('sheet-title').textContent = '#' + o.orderNumber;
    document.getElementById('sheet-sub').innerHTML =
        '<span class="db-chip ' + state + '">' + escapeHtml(chipLabel(state)) + '</span>';

    const items = (o.items || []).map(i => `
        <li>
            <span>${escapeHtml(i.productName || 'Item')} <span class="db-ref">x${i.quantity} KG</span>
                ${i.cuttingOption ? '<span class="db-detail-value muted" style="font-size:0.72rem;display:block;">' + escapeHtml(String(i.cuttingOption).replace(/_/g, ' ')) + '</span>' : ''}
            </span>
            <span>${fmtMoney(i.subtotal)}</span>
        </li>`).join('');

    let actions = '';
    if (d.canStart) {
        actions += `<button class="db-btn db-btn-primary" data-sheet-action="pickup" data-id="${o.id}">
            <i class="fa-solid fa-box"></i>Confirm Pickup</button>`;
    }
    if (d.canCollectCash) {
        actions += `<button class="db-btn db-btn-gold" data-sheet-action="cash" data-id="${o.id}">
            <i class="fa-solid fa-money-bill-wave"></i>Collect ${fmtMoney(o.grandTotal)} Cash</button>`;
    }
    if (state === 'OUT_FOR_DELIVERY') {
        actions += `<button class="db-btn db-btn-green" data-sheet-action="delivered" data-id="${o.id}">
            <i class="fa-solid fa-circle-check"></i>Mark Delivered</button>`;
    }
    if (!actions) {
        actions = `<div class="db-detail-value muted" style="text-align:center;padding:0.5rem 0;">
            <i class="fa-solid fa-circle-info me-1"></i>No action needed from you on this delivery.
        </div>`;
    }

    document.getElementById('sheet-body').innerHTML = `
    <div class="db-detail-block">
        <div class="db-detail-label">Customer</div>
        <div class="db-detail-value">
            <strong>${escapeHtml(o.customerName || '-')}</strong><br>
            <span class="db-detail-value muted">${escapeHtml(o.customerPhone || '')}</span>
        </div>
    </div>

    <div class="db-detail-block">
        <div class="db-detail-label">Delivery Address</div>
        <div class="db-address-box">
            ${escapeHtml([o.deliveryDoor, o.deliveryStreet, o.deliveryArea].filter(Boolean).join(', ') || '-')}<br>
            ${escapeHtml([o.deliveryCity, o.deliveryPincode].filter(Boolean).join(' - '))}${o.deliveryState ? ', ' + escapeHtml(o.deliveryState) : ''}
        </div>
        <div class="db-detail-value muted mt-2">
            <i class="fa-regular fa-clock me-1"></i>Preferred slot: ${escapeHtml(o.deliverySlot || 'Any time')}
        </div>
    </div>

    <div class="db-detail-block">
        <div class="db-detail-label">Items (${(o.items || []).length})</div>
        <ul class="db-items">${items || '<li><span class="db-detail-value muted">No item details</span></li>'}</ul>
        <div class="db-detail-value muted mt-2" style="font-size:0.82rem;">
            <div class="d-flex justify-content-between"><span>Subtotal</span><span>${fmtMoney(o.subtotal)}</span></div>
            <div class="d-flex justify-content-between"><span>Discount</span><span>-${fmtMoney(o.discountAmount)}</span></div>
            <div class="d-flex justify-content-between"><span>Delivery</span><span>${Number(o.deliveryCharge) === 0 ? 'FREE' : fmtMoney(o.deliveryCharge)}</span></div>
            <div class="d-flex justify-content-between fw-bold" style="color:var(--db-text);"><span>Total</span><span>${fmtMoney(o.grandTotal)}</span></div>
        </div>
    </div>

    <div class="db-detail-block">
        <div class="db-detail-label">Payment</div>
        <div class="db-detail-value">
            ${escapeHtml((o.paymentMethod || '-').replace(/_/g, ' '))}
            <span class="db-pay-badge ${escapeHtml(o.paymentStatus || 'PENDING')}" style="margin-left:0.35rem;">${escapeHtml(o.paymentStatus || 'PENDING')}</span>
            ${cod && unpaid ? '<div class="db-cod-hint mt-1"><i class="fa-solid fa-triangle-exclamation me-1"></i>Please collect and submit the full cash payment before confirming delivery.</div>' : ''}
            ${o.paidAt ? '<div class="db-detail-value muted" style="font-size:0.78rem;">Paid ' + fmtDate(o.paidAt) + '</div>' : ''}
        </div>
    </div>

    <div class="db-detail-block">
        <div class="db-detail-label">Delivery Progress</div>
        <div class="db-detail-value muted" style="font-size:0.82rem;">
            ${d.deliveryDate && d.deliverySlot ? '<div><i class="fa-solid fa-calendar-days me-1"></i>Scheduled: ' + escapeHtml(d.deliveryDate) + ' ' + escapeHtml(d.deliverySlot) + '</div>' : ''}
            ${d.assignedAt ? '<div><i class="fa-solid fa-user-check me-1"></i>Assigned: ' + fmtDate(d.assignedAt) + '</div>' : ''}
            ${d.startedAt ? '<div><i class="fa-solid fa-box-open me-1"></i>Picked Up: ' + fmtDate(d.startedAt) + '</div>' : ''}
            ${d.completedAt ? '<div><i class="fa-solid fa-flag-checkered me-1"></i>Delivered: ' + fmtDate(d.completedAt) + '</div>' : ''}
            ${!d.startedAt && !d.completedAt ? '<div>Waiting for you to confirm the pickup at the store.</div>' : ''}
        </div>
    </div>

    ${o.notes ? `<div class="db-detail-block">
        <div class="db-detail-label">Customer Note</div>
        <div class="db-detail-value">${escapeHtml(o.notes)}</div>
    </div>` : ''}

    <div class="db-sheet-actions">${actions}</div>`;
}

document.getElementById('sheet-body').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-sheet-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.sheetAction;

    if (action === 'cash') {
        openCashConfirm(id);
    } else if (action === 'delivered') {
        handleDeliver(btn, id);
    } else {
        doAction(btn, id, action, 'Pickup confirmed. Order is out for delivery!');
    }
});

/* ---------------- Cash collection confirmation modal ---------------- */

let cashOrder = null;

/** Opens a fresh copy of the order (server-authoritative) inside the modal. */
async function openCashConfirm(orderId) {
    // The cash modal is the follow-up to the warning modal; dismiss the warning
    // first so the two dialogs never stack on the same overlay layer.
    closeCashWarn();
    try {
        const res = await apiCall('/api/delivery/' + orderId);
        cashOrder = res.data;
        renderCashConfirm();
        document.getElementById('cash-backdrop').hidden = false;
        document.getElementById('cash-modal').hidden = false;
        document.body.style.overflow = 'hidden';
    } catch (e) {
        if (handleAuth(e)) return;
        toast(e.message || 'Could not open cash collection.', 'err');
    }
}

function renderCashConfirm() {
    const o = cashOrder;
    if (!o) return;
    document.getElementById('cash-modal-order').textContent = '#' + (o.orderNumber || o.id);
    document.getElementById('cash-modal-customer').textContent = o.customerName || '-';
    document.getElementById('cash-modal-method').textContent =
        String(o.paymentMethod || 'CASH_ON_DELIVERY').replace(/_/g, ' ');
    document.getElementById('cash-modal-amount').textContent = fmtMoney(o.grandTotal);
    const msg = document.getElementById('cash-modal-msg');
    if (msg) msg.hidden = true;
    const btn = document.getElementById('cash-confirm-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i>Confirm Cash Collected';
}

function closeCashConfirm() {
    document.getElementById('cash-backdrop').hidden = true;
    document.getElementById('cash-modal').hidden = true;
    document.body.style.overflow = '';
    cashOrder = null;
}

/* ---------------- Cash-not-collected warning modal ---------------- */

let warnOrder = null;

/** Latest server-backed view of an order for the pre-delivery client gate. */
function orderSnapshot(orderId) {
    if (sheetOrder && sheetOrder.id === orderId) return sheetOrder;
    return dbOrders.find(o => o.id === orderId) || null;
}

/**
 * Client-side gate checked BEFORE calling the delivery-completion API. It only
 * mirrors the backend rule for UX; it never bypasses server enforcement, which
 * re-checks payment method, payment status and the boy's ownership.
 */
function deliveryGate(order) {
    if (!order) return { type: 'unknown' };
    const cod = order.paymentMethod === 'CASH_ON_DELIVERY';
    if (cod && order.paymentStatus !== 'PAID') return { type: 'cod-unpaid', order };
    if (order.paymentStatus !== 'PAID') return { type: 'unpaid', order };
    return null;
}

function handleDeliver(btn, orderId) {
    const gate = deliveryGate(orderSnapshot(orderId));
    if (gate && gate.type === 'cod-unpaid') {
        openCashWarn(gate.order);
        return; // do NOT call the delivery API until the cash has been collected
    }
    if (gate) {
        toast('This order cannot be marked delivered until its payment is complete.', 'err');
        return;
    }
    doAction(btn, orderId, 'delivered', 'Order marked as delivered.');
}

function openCashWarn(order) {
    warnOrder = order;
    // Always the backend's actual grand total for this order, never a constant.
    document.getElementById('warn-modal-msg').textContent =
        'Cash has not been collected yet. Please collect ' + fmtMoney(order.grandTotal) +
        ' from the customer before marking this order as delivered.';
    document.getElementById('warn-backdrop').hidden = false;
    document.getElementById('warn-modal').hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeCashWarn() {
    document.getElementById('warn-backdrop').hidden = true;
    document.getElementById('warn-modal').hidden = true;
    document.body.style.overflow = '';
    warnOrder = null;
}

async function confirmCashCollect() {
    if (!cashOrder) return;

    const btn = document.getElementById('cash-confirm-btn');
    const msg = document.getElementById('cash-modal-msg');
    if (msg) msg.hidden = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const orderId = cashOrder.id;
    try {
        // The server re-validates the amount (it must equal the order total),
        // the COD method, the payment state and the boy's ownership; duplicate
        // collection and unpaid/cancelled states are rejected there.
        await apiCall('/api/delivery/' + orderId + '/payment-received', {
            method: 'PUT',
            body: { amount: Number(cashOrder.grandTotal), transactionRef: '' }
        });
        toast('Cash collected. Payment is PAID. You can now mark the order as delivered.', 'ok');
        closeCashConfirm();
        await loadAll();

        // Keep an open detail sheet in sync with the fresh server state so the
        // PAID badge and the newly-enabled Mark Delivered button appear in
        // place, without leaving this page.
        if (!document.getElementById('detail-sheet').hidden) {
            const fresh = dbOrders.find(o => o.id === orderId);
            if (fresh) renderSheet(fresh);
        }
    } catch (e) {
        if (handleAuth(e)) return;
        // The order stays OUT_FOR_DELIVERY and unpaid; tell the boy the exact
        // reason inline so the failure is never mistaken for a success.
        if (msg) { msg.textContent = e.message || 'Could not record the payment.'; msg.hidden = false; }
        toast(e.message || 'Could not record the payment.', 'err');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i>Confirm Cash Collected';
    }
}

/* ---------------- Helpers ---------------- */

function handleAuth(e) {
    if (e && (e.status === 401 || e.status === 403)) {
        toast(e.status === 403
            ? 'This delivery is not assigned to you.'
            : 'Your session expired. Please sign in again.', 'err');
        setTimeout(function () {
            Auth.clear();
            window.location.href = '/login.html?role=delivery&redirect=' + encodeURIComponent('/delivery/dashboard.html');
        }, 1600);
        return true;
    }
    return false;
}

function toast(message, kind) {
    const el = document.getElementById('db-toast');
    el.textContent = message;
    el.className = 'db-toast ' + (kind || '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'err' ? 4200 : 2800);
}
