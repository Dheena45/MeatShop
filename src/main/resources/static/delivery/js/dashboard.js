/* FreshMeat — Delivery Boy dashboard
   Talks only to /api/delivery/**. Any other order id is rejected server side
   with 403, so there is nothing to hide on the client either. */

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
        Auth.clear();
        window.location.href = '/login.html';
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
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSheet();
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
            actions.push(`<button class="db-btn db-btn-primary" data-action="start" data-id="${o.id}">
                <i class="fa-solid fa-location-arrow"></i>Start Delivery</button>`);
        }
        if (d.canCollectCash) {
            actions.push(`<button class="db-btn db-btn-gold" data-action="cash" data-id="${o.id}">
                <i class="fa-solid fa-money-bill-wave"></i>Collect ${fmtMoney(o.grandTotal)}</button>`);
        }
        if (d.canMarkDelivered) {
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
        <article class="db-card state-${state}">
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
                <span><i class="fa-solid fa-boxes-stacked"></i>${(o.items || []).length} item(s)</span>
                ${d.startedAt ? '<span><i class="fa-solid fa-play"></i>Started ' + fmtDate(d.startedAt) + '</span>' : ''}
                ${d.completedAt ? '<span><i class="fa-solid fa-flag-checkered"></i>Delivered ' + fmtDate(d.completedAt) + '</span>' : ''}
            </div>

            ${payLine}

            <div class="db-actions">${actions.join('')}</div>
        </article>`;
    }).join('');
}

document.getElementById('db-list').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    if (action === 'view') openSheet(id);
    else if (action === 'start') doAction(btn, id, 'start', 'Delivery started. Have a safe trip!');
    else if (action === 'cash') openSheet(id, 'cash');
    else if (action === 'delivered') doAction(btn, id, 'delivered', 'Order marked as delivered.');
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

function openSheet(orderId, focus) {
    const cached = dbOrders.find(o => o.id === orderId);
    if (cached) renderSheet(cached);

    document.getElementById('sheet-backdrop').hidden = false;
    document.getElementById('detail-sheet').hidden = false;
    document.body.style.overflow = 'hidden';

    apiCall('/api/delivery/' + orderId)
        .then(res => {
            renderSheet(res.data);
            if (focus === 'cash') {
                setTimeout(() => {
                    const ref = document.getElementById('sheet-ref');
                    if (ref) ref.focus();
                }, 250);
            }
        })
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
            <span>${escapeHtml(i.productName || 'Item')} <span class="db-ref">x${i.quantity}</span></span>
            <span>${fmtMoney(i.subtotal)}</span>
        </li>`).join('');

    let actions = '';
    if (d.canStart) {
        actions += `<button class="db-btn db-btn-primary" data-sheet-action="start" data-id="${o.id}">
            <i class="fa-solid fa-location-arrow"></i>Start Delivery</button>`;
    }
    if (d.canCollectCash) {
        actions += `
        <div class="db-ref">
            <label for="sheet-ref">Cash received from customer (optional note / UPI ref)</label>
            <input type="text" id="sheet-ref" maxlength="100" placeholder="e.g. UPI 4821-9930" autocomplete="off">
        </div>
        <button class="db-btn db-btn-gold" data-sheet-action="cash" data-id="${o.id}">
            <i class="fa-solid fa-money-bill-wave"></i>Collect ${fmtMoney(o.grandTotal)} Cash</button>`;
    }
    if (d.canMarkDelivered) {
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
        <div class="db-detail-value big mt-2">Total: ${fmtMoney(o.grandTotal)}</div>
    </div>

    <div class="db-detail-block">
        <div class="db-detail-label">Payment</div>
        <div class="db-detail-value">
            ${escapeHtml((o.paymentMethod || '-').replace(/_/g, ' '))}
            <span class="db-pay-badge ${escapeHtml(o.paymentStatus || 'PENDING')}" style="margin-left:0.35rem;">${escapeHtml(o.paymentStatus || 'PENDING')}</span>
            ${cod && unpaid ? '<div class="db-cod-hint mt-1"><i class="fa-solid fa-triangle-exclamation me-1"></i>Collect the cash before marking delivered.</div>' : ''}
            ${o.paidAt ? '<div class="db-detail-value muted" style="font-size:0.78rem;">Paid ' + fmtDate(o.paidAt) + '</div>' : ''}
        </div>
    </div>

    <div class="db-detail-block">
        <div class="db-detail-label">Delivery Progress</div>
        <div class="db-detail-value muted" style="font-size:0.82rem;">
            ${d.assignedAt ? '<div><i class="fa-solid fa-user-check me-1"></i>Assigned: ' + fmtDate(d.assignedAt) + '</div>' : ''}
            ${d.startedAt ? '<div><i class="fa-solid fa-location-arrow me-1"></i>Started: ' + fmtDate(d.startedAt) + '</div>' : ''}
            ${d.completedAt ? '<div><i class="fa-solid fa-flag-checkered me-1"></i>Delivered: ' + fmtDate(d.completedAt) + '</div>' : ''}
            ${!d.startedAt && !d.completedAt ? '<div>Waiting for you to start this delivery.</div>' : ''}
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
        const ref = document.getElementById('sheet-ref');
        collectCash(btn, id, ref ? ref.value.trim() : '');
    } else {
        doAction(btn, id, action, action === 'start' ? 'Delivery started. Have a safe trip!' : 'Order marked as delivered.');
    }
});

async function collectCash(btn, orderId, transactionRef) {
    btn.classList.add('loading');
    btn.disabled = true;
    const icon = btn.querySelector('i');
    if (icon) icon.classList.add('fa-spin');

    try {
        await apiCall('/api/delivery/' + orderId + '/payment-received', {
            method: 'PUT',
            body: { transactionRef: transactionRef || '' }
        });
        toast('Cash collected. Now mark the order as delivered.', 'ok');
        closeSheet();
        await loadAll();
    } catch (e) {
        if (handleAuth(e)) return;
        toast(e.message || 'Could not record the payment.', 'err');
        btn.classList.remove('loading');
        btn.disabled = false;
        if (icon) icon.classList.remove('fa-spin');
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
            window.location.href = '/login.html?redirect=' + encodeURIComponent('/delivery/dashboard.html');
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
