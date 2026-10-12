/* FreshMeat — Admin Orders controller */

let currentFilter = '';
let selectedOrder = null;
let detailOrdersCache = {};
let statusUpdateInFlight = false;
const PAYMENT_MODAL = new bootstrap.Modal(document.getElementById('paymentModal'));
// Mirrors OrderService.NEXT_STATUS for the ADMIN path only. The admin drives the
// order from PLACED (confirm) through to READY_FOR_PICKUP and can cancel any
// time; the two hand-over steps are deliberately NOT offered here because
// confirming the pick-up (READY_FOR_PICKUP -> OUT_FOR_DELIVERY) and marking it
// delivered (OUT_FOR_DELIVERY -> DELIVERED) are actions for the assigned
// Delivery Boy. The server enforces the same rule, so even a direct API call
// cannot reach them. Making the order READY_FOR_PICKUP does not require an
// assignment yet; the Delivery Boy is assigned afterwards and pickup itself then
// requires an active assignment.
const ORDER_TRANSITIONS = {
    'PLACED': ['CONFIRMED', 'CANCELLED'],
    'CONFIRMED': ['PREPARING', 'CANCELLED'],
    'PREPARING': ['READY_FOR_PICKUP', 'CANCELLED'],
    'READY_FOR_PICKUP': ['CANCELLED'],
    'OUT_FOR_DELIVERY': [],
    'DELIVERED': [],
    'CANCELLED': []
};

document.addEventListener('DOMContentLoaded', function () {
    // A deep link must carry the backend enum value (READY_FOR_PICKUP), never the
    // display label (READY FOR PICKUP). Anything else is ignored and falls back to
    // All, so a hand-typed/legacy URL can never push an unbound value at the API.
    const urlStatus = new URLSearchParams(window.location.search).get('status');
    if (urlStatus && ACTIVE_ORDER_STATUSES.includes(urlStatus)) currentFilter = urlStatus;

    if (!initAdminPage('orders', 'Orders', 'Track & manage customer orders')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div class="d-flex flex-wrap gap-2" id="status-filters">
        <button class="btn-admin-outline ${!currentFilter ? 'active-fill' : ''}" data-status="" style="padding:0.4rem 1rem;font-size:0.78rem;">All</button>
        ${ACTIVE_ORDER_STATUSES.map(s => `
          <button class="btn-admin-outline ${s === currentFilter ? 'active-fill' : ''}" data-status="${s}" style="padding:0.4rem 1rem;font-size:0.78rem;">${s.replace(/_/g, ' ')}</button>`).join('')}
      </div>
      <div class="search-box">
        <input type="text" id="order-search" placeholder="Search order no / name / phone...">
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>
    </div>
    <div class="admin-card">
      <div id="orders-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    document.getElementById('status-filters').addEventListener('click', e => {
        const btn = e.target.closest('button[data-status]');
        if (!btn) return;
        currentFilter = btn.dataset.status;
        document.querySelectorAll('#status-filters button').forEach(b => b.classList.remove('active-fill'));
        btn.classList.add('active-fill');
        loadOrders();
    });

    document.getElementById('order-search').addEventListener('input', debounce(() => loadOrders(), 400));
    document.getElementById('payment-confirm-btn').addEventListener('click', confirmPaymentReceived);
    // Confirming a Delivery Boy is an ASSIGNMENT, not an order status change.
    // This posts to /api/admin/delivery/{id}/assign and leaves the order status
    // untouched; starting preparation stays a separate explicit step.
    document.getElementById('assign-confirm-btn').addEventListener('click', confirmAssign);

    // Clean focus before Bootstrap toggles aria-hidden on hide, so no element
    // inside the hidden modal keeps focus (prevents the blocked aria-hidden warning).
    document.getElementById('paymentModal').addEventListener('hidden.bs.modal', () => {
        const modalEl = document.getElementById('paymentModal');
        const active = document.activeElement;
        if (modalEl && active && modalEl.contains(active)) active.blur();
    });
    document.getElementById('assignDeliveryModal').addEventListener('hidden.bs.modal', () => {
        const modalEl = document.getElementById('assignDeliveryModal');
        const active = document.activeElement;
        if (modalEl && active && modalEl.contains(active)) active.blur();
    });

    loadOrders();
});

async function loadOrders() {
    const search = document.getElementById('order-search').value.trim();
    const params = new URLSearchParams();
    if (currentFilter) params.set('status', currentFilter);
    if (search) params.set('search', search);

    const body = document.getElementById('orders-body');
    try {
        const res = await apiCall('/api/admin/orders' + (params.toString() ? '?' + params.toString() : ''));
        const orders = res.data || [];
        if (!orders.length) { body.innerHTML = emptyBoxHtml('No orders match this filter'); return; }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead>
            <tr><th>Order No.</th><th>Customer</th><th>Product(s)</th><th>Total</th><th>Placed On</th><th>Slot</th><th>Payment</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${orders.map(o => {
              const productLines = (o.items || []).map(i =>
                `<div><strong>${escapeHtml(i.productName)}</strong> × ${i.quantity} KG</div>`
              ).join('');
              return `
            <tr class="row-clickable" onclick="openOrderModal(${o.id})" title="View order details">
              <td><strong class="small">${escapeHtml(o.orderNumber)}</strong></td>
              <td>
                <strong class="small">${escapeHtml(o.customerName)}</strong>
                <div class="text-muted" style="font-size:0.72rem;">${escapeHtml(o.customerPhone || '')}</div>
              </td>
              <td style="font-size:0.82rem;">${productLines}</td>
              <td><strong>${fmtMoney(o.grandTotal)}</strong></td>
              <td class="text-muted" style="font-size:0.78rem;">${fmtDate(o.createdAt)}</td>
              <td class="text-muted" style="font-size:0.78rem;">${escapeHtml(o.deliverySlot || '-')}</td>
              <td style="font-size:0.78rem;">${escapeHtml((o.paymentMethod || '').replace(/_/g, ' '))}</td>
              <td>${adminStatusBadge(o.status)}</td>
            </tr>`}).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

async function openOrderModal(id) {
    try {
        const res = await apiCall('/api/admin/orders/' + id);
        selectedOrder = res.data;
        detailOrdersCache[id] = res.data;

        document.getElementById('om-number').textContent = selectedOrder.orderNumber;
        const o = selectedOrder;

        const body = document.getElementById('om-body');
        // One shared renderer for the order detail sections (products, customer,
        // address, totals, payment line, delivery block), reused by the Delivery
        // page; the status editor stays Orders-only above it.
        body.innerHTML = statusEditorHtml(o) + orderDetailSectionsHtml(o, { paymentActions: true });

        // Assign / Reassign controls live inside the delivery panel.
        body.querySelectorAll('[data-delivery-assign]').forEach(btn => {
            btn.addEventListener('click', () => openAssignModal(Number(btn.dataset.deliveryAssign), false));
        });
        body.querySelectorAll('[data-delivery-reassign]').forEach(btn => {
            btn.addEventListener('click', () => openAssignModal(Number(btn.dataset.deliveryReassign), true));
        });

        bootstrap.Modal.getOrCreateInstance(document.getElementById('orderModal')).show();
    } catch (e) {
        if (e.status === 401 || e.status === 403) return Auth.requireAdmin();
        showToast(e.message || 'Could not load this order.', 'error');
    }
}

let assignModalInstance = null;
let assignOrderCache = {};
let assignIsReassign = false;
let assignOrderId = null;

async function openAssignModal(orderId, isReassign) {
    assignIsReassign = isReassign;
    assignOrderId = orderId;
    let order = assignOrderCache[orderId];
    if (!order) {
        try {
            const res = await apiCall('/api/admin/orders/' + orderId);
            order = res.data;
            assignOrderCache[orderId] = order;
        } catch (e) {
            if (e.status === 401 || e.status === 403) return Auth.requireAdmin();
            return showToast(e.message || 'Could not load the order.', 'error');
        }
    }

    const boys = await loadActiveDeliveryBoys();
    const select = document.getElementById('assign-boy-select');
    select.innerHTML = boys.length
        ? '<option value="">Select Delivery Boy</option>' + boys.map(b =>
            `<option value="${b.id}" ${isReassign && order.delivery && order.delivery.deliveryBoyId === b.id ? 'disabled' : ''}>${escapeHtml(b.name)} (${escapeHtml(b.phone || '')}) — ${b.assignedCount} active</option>`).join('')
        : '<option value="">No active Delivery Boys available</option>';

    document.getElementById('assign-order-number').textContent = order.orderNumber;
    document.getElementById('assign-summary').innerHTML = `
        <div class="small">
            <div><strong>${escapeHtml(order.customerName)}</strong> &nbsp;${escapeHtml(order.customerPhone || '')}</div>
            <div class="text-muted">${escapeHtml(order.deliverySlot || 'No slot')} &middot; ${fmtMoney(order.grandTotal)}</div>
            <div class="text-muted">${escapeHtml((order.paymentMethod || '').replace(/_/g, ' '))} / ${escapeHtml(order.paymentStatus || 'PENDING')}</div>
            ${order.delivery && order.delivery.deliveryBoyName
                ? '<div class="mt-1">Currently assigned to <strong>' + escapeHtml(order.delivery.deliveryBoyName) + '</strong></div>'
                : ''}
        </div>`;

    document.getElementById('assign-confirm-btn').disabled = false;
    document.getElementById('assign-confirm-btn').innerHTML =
        isReassign ? '<i class="fa-solid fa-user-clock me-1"></i>Reassign' : '<i class="fa-solid fa-user-plus me-1"></i>Confirm Delivery Boy';

    // Delivery date + slot default to today, and the slot dropdown only ever
    // offers the weekday/weekend slots the customer could have chosen. Both are
    // required by the backend. On a reassign the previous date + slot are kept
    // so an operator can swap the boy without silently rescheduling the order.
    setupAssignSchedule('assign-date', 'assign-slot');
    if (isReassign && order.delivery && order.delivery.deliveryDate) {
        const dateInput = document.getElementById('assign-date');
        dateInput.value = order.delivery.deliveryDate;
        dateInput.dispatchEvent(new Event('change'));
        document.getElementById('assign-slot').value = order.delivery.deliverySlot || '';
    }

    // Hand over from the order modal to the assign modal only once the first
    // one has finished hiding, so Bootstrap never stacks two backdrops.
    const orderModal = bootstrap.Modal.getInstance(document.getElementById('orderModal'));
    const openAssign = () => {
        if (!assignModalInstance) {
            assignModalInstance = new bootstrap.Modal(document.getElementById('assignDeliveryModal'));
        }
        assignModalInstance.show();
    };
    const orderModalEl = document.getElementById('orderModal');
    if (orderModal && orderModalEl.classList.contains('show')) {
        orderModalEl.addEventListener('hidden.bs.modal', openAssign, { once: true });
        orderModal.hide();
    } else {
        openAssign();
    }
}

async function confirmAssign() {
    const orderId = assignOrderId;
    const boyId = document.getElementById('assign-boy-select').value;
    const date = document.getElementById('assign-date').value;
    const slot = document.getElementById('assign-slot').value;
    const btn = document.getElementById('assign-confirm-btn');
    if (!boyId) {
        return showToast('Please select a Delivery Boy.', 'warning');
    }
    if (!date) {
        return showToast('Please select a delivery date.', 'warning');
    }
    if (!slot) {
        return showToast('Please select a delivery slot.', 'warning');
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    try {
        const url = assignIsReassign
            ? '/api/admin/delivery/' + orderId + '/reassign'
            : '/api/admin/delivery/' + orderId + '/assign';
        const res = await apiCall(url, {
            method: assignIsReassign ? 'PUT' : 'POST',
            body: { deliveryBoyId: Number(boyId), deliveryDate: date, deliverySlot: slot }
        });
        assignModalInstance.hide();
        delete assignOrderCache[orderId];
        // Assigning only links the boy to the order (with a delivery date + slot).
        // The order status is deliberately left untouched (CONFIRMED stays
        // CONFIRMED); making it ready for pickup remains a separate step.
        showToast((res && res.message) || (assignIsReassign
            ? 'Delivery Boy reassigned successfully.'
            : 'Delivery Boy assigned successfully.'),
            'success', { title: assignIsReassign ? 'Delivery Boy Reassigned' : 'Delivery Boy Assigned' });
        await openOrderModal(orderId);
        loadOrders();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        else showToast(e.message || 'Could not update the delivery', 'error', { title: assignIsReassign ? 'Cannot Reassign' : 'Cannot Assign' });
    } finally {
        btn.disabled = false;
        btn.innerHTML = assignIsReassign
            ? '<i class="fa-solid fa-user-clock me-1"></i>Reassign'
            : '<i class="fa-solid fa-user-plus me-1"></i>Confirm Delivery Boy';
    }
}

let activeBoysCache = null;
async function loadActiveDeliveryBoys() {
    if (activeBoysCache) return activeBoysCache;
    const res = await apiCall('/api/admin/delivery-boys/active');
    activeBoysCache = res.data || [];
    return activeBoysCache;
}

/* Status editor block inside the order modal. Rebuilt in place after a
   successful update so the dropdown offers the transitions of the new state. */
function statusEditorHtml(o) {
    const nextStatuses = ORDER_TRANSITIONS[o.status] || [];
    const canUpdate = nextStatuses.length > 0;
    const terminalNote = !canUpdate ? terminalStatusNote(o.status) : '';
    return `
        <div class="row g-3 mb-3" id="om-status-editor">
          <div class="col-md-6">
            <label class="form-label">Status</label>
            <select class="form-select form-control-fm" id="om-status" ${canUpdate ? '' : 'disabled'}>
              <option value="${o.status}" selected>${o.status.replace(/_/g, ' ')}</option>
              ${nextStatuses.map(s =>
                  `<option value="${s}">${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
            ${terminalNote ? `<div class="form-text text-muted" style="font-size:0.78rem;">${terminalNote}</div>` : ''}
            <div class="form-text" id="om-status-msg" style="font-size:0.78rem;"></div>
          </div>
          <div class="col-md-6 d-flex align-items-end">
            <button class="btn-admin" id="om-update-btn" onclick="updateOrderStatus()" ${canUpdate ? '' : 'disabled'}><i class="fa-solid fa-floppy-disk me-1"></i>Update Status</button>
          </div>
        </div>`;
}

function terminalStatusNote(status) {
    if (status === 'DELIVERED') return 'This order has been delivered and cannot be changed.';
    if (status === 'OUT_FOR_DELIVERY') return 'This order is out for delivery and only the assigned Delivery Boy can mark it delivered.';
    if (status === 'READY_FOR_PICKUP') return 'Pickup and delivery are handled by the assigned Delivery Boy.';
    if (status === 'CANCELLED') return 'This order has been cancelled and cannot be changed.';
    return '';
}

function setStatusMessage(message, type) {
    const el = document.getElementById('om-status-msg');
    if (!el) return;
    const colors = { success: '#1e9e4a', error: '#b91c1c', muted: '#7a756d' };
    el.textContent = message || '';
    el.style.color = colors[type] || colors.muted;
}

/* Applies the transition immediately (no confirmation popup). On success the
   modal's status editor and the order list are refreshed in place; failures are
   reported inline inside the same modal. */
async function updateOrderStatus() {
    const select = document.getElementById('om-status');
    const btn = document.getElementById('om-update-btn');
    if (!selectedOrder || !select || !btn || statusUpdateInFlight) return;

    const status = select.value;
    if (!status || status === selectedOrder.status) {
        setStatusMessage('Please select a different status to update this order.', 'error');
        return;
    }

    statusUpdateInFlight = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Updating...';
    setStatusMessage('Updating status\u2026', 'muted');

    try {
        await apiCall('/api/admin/orders/' + selectedOrder.id + '/status', {
            method: 'PUT', body: { status }
        });
        selectedOrder.status = status;
        delete assignOrderCache[selectedOrder.id];

        // Reflect the new state in the open modal...
        const editor = document.getElementById('om-status-editor');
        if (editor) editor.outerHTML = statusEditorHtml(selectedOrder);
        setStatusMessage(status === 'CANCELLED'
            ? 'Order cancelled.'
            : 'Status updated to ' + status.replace(/_/g, ' ').toLowerCase() + '.', 'success');

        // ...and refresh the matching row / filter results without a page reload.
        loadOrders();
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            Auth.requireAdmin();
            return;
        }
        // The server rejected the step (e.g. CONFIRMED -> PREPARING without a
        // confirmed Delivery Boy). Show its message and put the dropdown back on
        // the order's real status so the modal never shows an unsaved status.
        select.value = selectedOrder.status;
        setStatusMessage(e.message || 'Could not update the status.', 'error');
        // The editor is rebuilt only on success, so the original button still
        // exists here and must be restored for another attempt.
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i>Update Status';
    } finally {
        statusUpdateInFlight = false;
    }
}

function markPaymentReceived() {
    if (!selectedOrder) return;
    document.getElementById('payment-confirm-msg').innerHTML =
        'Confirm payment of <strong>' + fmtMoney(selectedOrder.grandTotal) + '</strong> via <strong>' +
        String(selectedOrder.paymentMethod || '').replace(/_/g, ' ') + '</strong> from <strong>' +
        escapeHtml(selectedOrder.customerName || 'customer') + '</strong>?';
    document.getElementById('payment-transaction-ref').value = '';
    PAYMENT_MODAL.show();
}

async function confirmPaymentReceived() {
    if (!selectedOrder) return;
    const btn = document.getElementById('payment-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    try {
        const ref = document.getElementById('payment-transaction-ref').value.trim();
        const res = await apiCall('/api/admin/orders/' + selectedOrder.id + '/payment-received', {
            method: 'PUT',
            body: { transactionRef: ref }
        });
        PAYMENT_MODAL.hide();
        showToast('Payment marked as received.');
        await openOrderModal(selectedOrder.id);
        loadOrders();
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            Auth.requireAdmin();
        } else {
            showToast(e.message, 'error', { title: 'Could not Mark Payment' });
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Confirm Payment';
    }
}

async function fetchInvoiceData() {
    const res = await apiCall('/api/admin/orders/' + selectedOrder.id + '/invoice');
    return res && res.data;
}

function receiptHtml(inv) {
    const rcMoney = v => {
        const n = Number(v || 0);
        const s = n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return '\u20B9' + s.replace(/\.00$/, '');
    };
    const qty = v => String(Number(v || 0)).replace(/\.0+$/, '');
    const cutting = c => c ? String(c).replace(/_/g, ' ') : 'Standard';
    const ddMMyyyy = d => {
        if (!d) return '-';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '-';
        const p = x => String(x).padStart(2, '0');
        return p(dt.getDate()) + '-' + p(dt.getMonth() + 1) + '-' + dt.getFullYear();
    };

    const items = (inv.items || []).map(it => `
        <div class="rce-item">
            <span class="rce-name">${escapeHtml(it.productName)}<span class="rce-cutting">(${escapeHtml(cutting(it.cuttingOption))})</span></span>
            <span class="rce-qty">${qty(it.quantity)} ${escapeHtml(it.unit || 'KG')}</span>
            <span class="rce-amt">${rcMoney(it.subtotal)}</span>
        </div>`).join('');

    const doorStreetArea = [inv.deliveryDoor, inv.deliveryStreet, inv.deliveryArea]
        .filter(Boolean).join(', ');
    const cityPart = [inv.deliveryCity, inv.deliveryPincode].filter(Boolean).join(' - ');
    const deliverTo = [doorStreetArea, (cityPart ? '(' + cityPart + ')' : ''), inv.deliveryState]
        .filter(Boolean).join(', ');

    const paidAt = inv.paidAt
        ? `<div class="rce-kv"><span>Paid On</span><b>${ddMMyyyy(inv.paidAt)}</b></div>` : '';

    return `
        <div class="rce-brand">FRESHMEAT</div>
        <div class="rce-sub">Fresh Meat Shop</div>
        <div class="rce-sep"></div>
        <div class="rce-meta">
            <div class="rce-kv"><span>Invoice</span><b>${escapeHtml(inv.invoiceNumber || '-')}</b></div>
            <div class="rce-kv"><span>Order</span><b>#${escapeHtml(inv.orderNumber || '')}</b></div>
            <div class="rce-kv"><span>Date</span><b>${ddMMyyyy(inv.invoiceDate)}</b></div>
        </div>
        <div class="rce-sep"></div>
        <div class="rce-customer">
            <div class="rce-kv"><span>Customer</span><b>${escapeHtml(inv.customerName || '')}</b></div>
            <div class="rce-kv"><span>Mobile</span><b>${escapeHtml(inv.customerPhone || '')}</b></div>
            ${deliverTo ? `<div class="rce-kv" style="display:flex;justify-content:flex-start;gap:8px;"><span>Deliver To:</span><span>${escapeHtml(deliverTo)}</span></div>` : ''}
        </div>
        <div class="rce-sep"></div>
        <div class="rce-items">
            ${items || '<div>No items</div>'}
        </div>
        <div class="rce-sep"></div>
        <div class="rce-totals">
            <div class="rce-kv"><span>Subtotal</span><span>${rcMoney(inv.subtotal)}</span></div>
            <div class="rce-kv"><span>Discount</span><span>-${rcMoney(inv.discountAmount)}</span></div>
            <div class="rce-kv"><span>Delivery</span><span>${Number(inv.deliveryCharge) === 0 ? 'FREE' : rcMoney(inv.deliveryCharge)}</span></div>
            <div class="rce-sep"></div>
            <div class="rce-kv rce-total"><span>TOTAL</span><span>${rcMoney(inv.grandTotal)}</span></div>
        </div>
        <div class="rce-sep"></div>
        <div class="rce-pay">
            <div class="rce-kv"><span>Payment</span><b>${escapeHtml((inv.paymentMethod || '-').replace(/_/g, ' '))}</b></div>
            <div class="rce-kv"><span>Status</span><b>${escapeHtml((inv.paymentStatus || '-').replace(/_/g, ' '))}</b></div>
            ${paidAt}
            <div class="rce-kv"><span>Order Status</span><b>${escapeHtml((inv.orderStatus || '-').replace(/_/g, ' '))}</b></div>
            ${inv.deliverySlot ? `<div class="rce-kv"><span>Delivery</span><b>${escapeHtml(inv.deliverySlot)}</b></div>` : ''}
        </div>
        ${inv.notes ? `<div class="rce-notes">Notes: ${escapeHtml(inv.notes)}</div>` : ''}
        <div class="rce-sep"></div>
        <div class="rce-foot">
            <div class="rce-thanks">Thank you for shopping with FreshMeat!</div>
            <div class="rce-helpline">${escapeHtml(inv.storeAddress || '')}${inv.storePhone ? ' • ' + escapeHtml(inv.storePhone) : ''}${inv.storeEmail ? ' • ' + escapeHtml(inv.storeEmail) : ''}</div>
        </div>`;
}

async function openInvoice() {
    if (!selectedOrder) return;
    const body = document.getElementById('invoice-modal-body');
    body.innerHTML = '<div class="text-center text-muted py-4"><i class="fa-solid fa-circle-notch fa-spin me-2"></i>Loading invoice...</div>';
    new bootstrap.Modal(document.getElementById('invoiceModal')).show();
    try {
        const inv = await fetchInvoiceData();
        if (!inv) throw new Error('Invoice data unavailable.');
        body.innerHTML = receiptHtml(inv);
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            Auth.requireAdmin();
            return;
        }
        body.innerHTML = '<div class="text-center py-4 text-danger">' + escapeHtml(e.message || 'Could not load the invoice.') + '</div>';
    }
}

async function printBill() {
    if (!selectedOrder) return;
    const printNode = document.getElementById('receipt-print');
    printNode.innerHTML = '<div class="text-center text-muted py-4">Loading receipt...</div>';
    try {
        const inv = await fetchInvoiceData();
        if (!inv) throw new Error('Invoice data unavailable.');
        printNode.innerHTML = receiptHtml(inv);
        window.print();
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            Auth.requireAdmin();
            return;
        }
        showToast(e.message || 'Could not prepare the receipt.', 'error');
    }
}

async function downloadInvoice() {
    if (!selectedOrder) return;
    try {
        const number = selectedOrder.orderNumber ||
            ((await fetchInvoiceData()) || {}).invoiceNumber || selectedOrder.id;
        await downloadFile('/api/admin/orders/' + selectedOrder.id + '/invoice/pdf',
            'FreshMeat-Invoice-' + number + '.pdf');
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        else showToast(e.message, 'error', { title: 'Download Failed' });
    }
}