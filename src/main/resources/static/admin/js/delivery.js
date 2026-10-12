/* FreshMeat — Admin Delivery Management */

let deliveryRows = [];
let deliveryBoys = [];
let assignModal = null;
let orderModal = null;
let assignOrderId = null;
let assignIsReassign = false;

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('delivery', 'Delivery Management', 'Assign delivery boys and track every order')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="row g-3 mb-3">
      <div class="col-6 col-xl-3">
        <div class="stat-card clickable h-100" data-state="PENDING_ASSIGNMENT">
          <div class="stat-icon orange"><i class="fa-solid fa-user-clock"></i></div>
          <div class="stat-meta">
            <h6>Pending Assignment</h6>
            <div class="stat-value" id="sum-pending">-</div>
            <div class="text-muted" style="font-size:0.72rem;">Need a delivery boy</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-xl-3">
        <div class="stat-card clickable h-100" data-state="ASSIGNED">
          <div class="stat-icon blue"><i class="fa-solid fa-box-open"></i></div>
          <div class="stat-meta">
            <h6>Assigned</h6>
            <div class="stat-value" id="sum-assigned">-</div>
            <div class="text-muted" style="font-size:0.72rem;">Not started yet</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-xl-3">
        <div class="stat-card clickable h-100" data-state="OUT_FOR_DELIVERY">
          <div class="stat-icon purple"><i class="fa-solid fa-location-arrow"></i></div>
          <div class="stat-meta">
            <h6>Out for Delivery</h6>
            <div class="stat-value" id="sum-transit">-</div>
            <div class="text-muted" style="font-size:0.72rem;">On the way</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-xl-3">
        <div class="stat-card clickable h-100" data-state="DELIVERED">
          <div class="stat-icon green"><i class="fa-solid fa-circle-check"></i></div>
          <div class="stat-meta">
            <h6>Delivered Today</h6>
            <div class="stat-value" id="sum-delivered">-</div>
            <div class="text-muted" style="font-size:0.72rem;" id="sum-cash">Cash: -</div>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-4">
          <label class="form-label" for="f-search">Search</label>
          <div class="search-box">
            <input type="text" id="f-search" placeholder="Order no, customer, phone or delivery boy">
            <i class="fa-solid fa-magnifying-glass"></i>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label" for="f-boy">Delivery Boy</label>
          <select class="form-select form-control-fm" id="f-boy"><option value="">All Delivery Boys</option></select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label" for="f-state">Status</label>
          <select class="form-select form-control-fm" id="f-state">
            <option value="">All Statuses</option>
            <option value="PENDING_ASSIGNMENT">Pending Assignment</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label" for="f-date">Date</label>
          <input type="date" class="form-control form-control-fm" id="f-date">
        </div>
        <div class="col-6 col-md-2 d-grid">
          <button class="btn-admin-outline" id="clear-filters" type="button"><i class="fa-solid fa-xmark me-1"></i>Clear</button>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div class="card-title mb-0"><i class="fa-solid fa-truck-fast text-primary me-2"></i>Deliveries</div>
        <div class="d-flex align-items-center gap-2">
          <span class="text-muted" style="font-size:0.75rem;" id="result-count"></span>
          <button class="btn-icon-xs" id="refresh-btn" title="Refresh"><i class="fa-solid fa-rotate"></i></button>
        </div>
      </div>
      <div id="delivery-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    document.getElementById('f-search').addEventListener('input', debounce(loadDeliveries, 350));
    document.getElementById('f-boy').addEventListener('change', loadDeliveries);
    document.getElementById('f-state').addEventListener('change', loadDeliveries);
    document.getElementById('f-date').addEventListener('change', loadDeliveries);
    document.getElementById('refresh-btn').addEventListener('click', loadDeliveries);
    document.getElementById('clear-filters').addEventListener('click', () => {
        document.getElementById('f-search').value = '';
        document.getElementById('f-boy').value = '';
        document.getElementById('f-state').value = '';
        document.getElementById('f-date').value = '';
        loadDeliveries();
    });

    document.querySelectorAll('.stat-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const sel = document.getElementById('f-state');
            sel.value = sel.value === card.dataset.state ? '' : card.dataset.state;
            loadDeliveries();
        });
    });

    // Blur before Bootstrap flips aria-hidden, otherwise the browser console
    // warns about an aria-hidden element still holding focus.
    ['assignModal', 'orderModal'].forEach(id => {
        document.getElementById(id).addEventListener('hidden.bs.modal', () => {
            const el = document.getElementById(id);
            if (el.contains(document.activeElement)) document.activeElement.blur();
        });
    });

    loadBoys();
    loadDeliveries();
});

async function loadBoys() {
    try {
        const res = await apiCall('/api/admin/delivery-boys');
        deliveryBoys = res.data || [];
        const sel = document.getElementById('f-boy');
        const current = sel.value;
        sel.innerHTML = '<option value="">All Delivery Boys</option>' + deliveryBoys.map(b =>
            `<option value="${b.id}" ${!b.active ? 'disabled' : ''}>${escapeHtml(b.name)}${b.active ? '' : ' (inactive)'}</option>`
        ).join('');
        sel.value = current;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        showToast(e.message || 'Could not load delivery boys.', 'error');
    }
}

async function loadDeliveries() {
    const body = document.getElementById('delivery-body');
    if (!deliveryRows.length) body.innerHTML = spinnerHtml();
    try {
        const p = new URLSearchParams();
        p.set('state', document.getElementById('f-state').value || '');
        p.set('search', document.getElementById('f-search').value.trim());
        p.set('deliveryBoyId', document.getElementById('f-boy').value || '');
        p.set('date', document.getElementById('f-date').value || '');

        const [boardRes, summaryRes] = await Promise.all([
            apiCall('/api/admin/delivery?' + p.toString()),
            apiCall('/api/admin/delivery/summary')
        ]);

        renderSummary(summaryRes.data || {});
        deliveryRows = boardRes.data || [];
        renderTable();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        deliveryRows = [];
        body.innerHTML = emptyBoxHtml(e.message || 'Could not load deliveries.');
    }
}

function renderSummary(s) {
    document.getElementById('sum-pending').textContent = s.pendingAssignment || 0;
    document.getElementById('sum-assigned').textContent = s.assigned || 0;
    document.getElementById('sum-transit').textContent = s.outForDelivery || 0;
    document.getElementById('sum-delivered').textContent = s.deliveredToday || 0;
    document.getElementById('sum-cash').textContent = 'Cash: ' + fmtMoney(s.cashCollectedToday || 0);
}

function renderTable() {
    const body = document.getElementById('delivery-body');
    document.getElementById('result-count').textContent = deliveryRows.length + ' order(s)';

    if (!deliveryRows.length) {
        body.innerHTML = emptyBoxHtml('No deliveries match these filters');
        return;
    }

    // A Delivery Boy is assigned (or reassigned) at readiness: once the order is
    // CONFIRMED and still in the store (PREPARING / READY_FOR_PICKUP), before the
    // boy confirms the pickup. READY_FOR_PICKUP cannot exist without an assignment,
    // so it only ever surfaces the reassign button.
    const assignable = o => o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY_FOR_PICKUP';
    const hasBoy = o => o.delivery && o.delivery.deliveryBoyId;

    body.innerHTML = `
    <table class="table table-fm align-middle">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Delivery Address</th>
          <th>Slot</th>
          <th class="text-end">Total</th>
          <th>Payment</th>
          <th>Delivery Boy</th>
          <th>Status</th>
          <th class="text-end">Action</th>
        </tr>
      </thead>
      <tbody>
        ${deliveryRows.map(o => `
        <tr>
          <td class="row-clickable" onclick="openOrderDetails(${o.id})" title="View order details">
            <strong class="small">${escapeHtml(o.orderNumber)}</strong>
            <div class="text-muted" style="font-size:0.72rem;">${fmtDateOnly(o.createdAt)}</div>
          </td>
          <td>
            <div class="small">${escapeHtml(o.customerName || '-')}</div>
            <div class="text-muted" style="font-size:0.72rem;">${escapeHtml(o.customerPhone || '-')}</div>
          </td>
          <td style="max-width:230px;font-size:0.78rem;">${escapeHtml(addressOneLine(o))}</td>
          <td style="font-size:0.78rem;">
            ${escapeHtml(o.deliverySlot || '-')}
            ${o.delivery && o.delivery.deliveryDate
              ? '<div class="text-muted" style="font-size:0.7rem;"><i class="fa-solid fa-calendar-days me-1"></i>' + escapeHtml(o.delivery.deliveryDate) + ' ' + escapeHtml(o.delivery.deliverySlot || '') + '</div>'
              : ''}
          </td>
          <td class="text-end small fw-semibold">${fmtMoney(o.grandTotal)}</td>
          <td>${paymentCellHtml(o)}</td>
          <td style="font-size:0.78rem;">
            ${hasBoy(o)
              ? escapeHtml(o.delivery.deliveryBoyName) + (o.delivery.deliveryBoyActive === false ? ' <span class="badge-status INACTIVE" style="font-size:0.6rem;">Inactive</span>' : '')
              : '<span class="text-muted">Unassigned</span>'}
          </td>
          <td class="row-clickable" onclick="openOrderDetails(${o.id})" title="View order details">
            <div class="d-flex flex-wrap gap-1">
              ${adminStatusBadge(o.status)}
              ${deliveryStateBadge((o.delivery && o.delivery.state) || 'PENDING_ASSIGNMENT')}
            </div>
          </td>
          <td>
            <div class="d-flex justify-content-end gap-1">
              <button class="btn-icon-xs" onclick="openOrderDetails(${o.id})" title="View Order Details">
                <i class="fa-solid fa-eye"></i>
              </button>
              ${assignable(o) && !hasBoy(o)
                ? `<button class="btn-icon-xs edit" onclick="openAssignModal(${o.id}, false)" title="Assign Delivery Boy"><i class="fa-solid fa-user-plus"></i></button>`
                : ''}
              ${assignable(o) && hasBoy(o)
                ? `<button class="btn-icon-xs edit" onclick="openAssignModal(${o.id}, true)" title="Reassign Delivery Boy"><i class="fa-solid fa-user-clock"></i></button>`
                : ''}
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ---------------- Assign / Reassign ---------------- */

async function openAssignModal(orderId, isReassign) {
    assignOrderId = orderId;
    assignIsReassign = isReassign;

    let order;
    try {
        const res = await apiCall('/api/admin/orders/' + orderId);
        order = res.data;
    } catch (e) {
        if (e.status === 401 || e.status === 403) return Auth.requireAdmin();
        return showToast(e.message || 'Could not load the order.', 'error');
    }

    const d = order.delivery;
    document.getElementById('assignModalLabel').innerHTML = isReassign
        ? '<i class="fa-solid fa-user-clock text-primary me-2"></i>Reassign Delivery Boy'
        : '<i class="fa-solid fa-user-plus text-primary me-2"></i>Assign Delivery Boy';
    document.getElementById('as-order-no').textContent = order.orderNumber;
    document.getElementById('as-summary').innerHTML = `
        <div style="font-size:0.85rem;">
          <div><strong>${escapeHtml(order.customerName || '-')}</strong> &middot; ${escapeHtml(order.customerPhone || '-')}</div>
          <div class="text-muted">${escapeHtml(order.deliverySlot || 'No slot')} &middot; ${fmtMoney(order.grandTotal)} &middot; ${escapeHtml((order.paymentMethod || '').replace(/_/g, ' '))}</div>
          <div class="text-muted">${escapeHtml(addressOneLine(order))}</div>
          ${d && d.deliveryBoyName
            ? `<div class="mt-2">Currently with <strong>${escapeHtml(d.deliveryBoyName)}</strong></div>`
            : '<div class="mt-2 text-warning-emphasis"><i class="fa-solid fa-circle-exclamation me-1"></i>No delivery boy assigned yet</div>'}
        </div>`;

    const activeBoys = deliveryBoys.filter(b => b.active);
    const sel = document.getElementById('as-boy');
    if (!activeBoys.length) {
        sel.innerHTML = '<option value="">No active Delivery Boys available</option>';
        document.getElementById('as-confirm').disabled = true;
        document.getElementById('as-hint').textContent = 'Create and activate a Delivery Boy first.';
    } else {
        sel.innerHTML = '<option value="">Select Delivery Boy</option>' + activeBoys.map(b =>
            `<option value="${b.id}" ${d && d.deliveryBoyId === b.id ? 'disabled' : ''}>${escapeHtml(b.name)} (${escapeHtml(b.phone || '')}) - ${b.assignedCount} active</option>`
        ).join('');
        document.getElementById('as-confirm').disabled = false;
        document.getElementById('as-hint').textContent = isReassign
            ? 'The current delivery boy will be marked as reassigned and the new one takes over.'
            : 'Only active Delivery Boys are listed.';
    }

    // Delivery date + slot default to today; the dropdown only offers the
    // weekday/weekend slots a customer could have picked. Both are required.
    // On a reassign the previous date + slot are kept so an operator can swap
    // the boy without silently rescheduling the order.
    setupAssignSchedule('as-date', 'as-slot');
    if (isReassign && order.delivery && order.delivery.deliveryDate) {
        const dateInput = document.getElementById('as-date');
        dateInput.value = order.delivery.deliveryDate;
        dateInput.dispatchEvent(new Event('change'));
        document.getElementById('as-slot').value = order.delivery.deliverySlot || '';
    }

    document.getElementById('as-confirm').innerHTML = isReassign
        ? '<i class="fa-solid fa-user-clock me-1"></i>Reassign'
        : '<i class="fa-solid fa-user-plus me-1"></i>Assign';

    if (!assignModal) assignModal = new bootstrap.Modal(document.getElementById('assignModal'));
    assignModal.show();
}

async function confirmAssign() {
    const boyId = document.getElementById('as-boy').value;
    const date = document.getElementById('as-date').value;
    const slot = document.getElementById('as-slot').value;
    if (!boyId) return showToast('Please select a Delivery Boy.', 'warning');
    if (!date) return showToast('Please select a delivery date.', 'warning');
    if (!slot) return showToast('Please select a delivery slot.', 'warning');

    const btn = document.getElementById('as-confirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    try {
        const res = await apiCall('/api/admin/delivery/' + assignOrderId + (assignIsReassign ? '/reassign' : '/assign'), {
            method: assignIsReassign ? 'PUT' : 'POST',
            body: { deliveryBoyId: Number(boyId), deliveryDate: date, deliverySlot: slot }
        });
        assignModal.hide();
        showToast((res && res.message) || (assignIsReassign ? 'Delivery Boy reassigned.' : 'Delivery Boy assigned.'));
        await Promise.all([loadDeliveries(), loadBoys()]);
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        else showToast(e.message || 'Could not update the delivery.', 'error', { title: assignIsReassign ? 'Cannot Reassign' : 'Cannot Assign' });
    } finally {
        btn.disabled = false;
        btn.innerHTML = assignIsReassign
            ? '<i class="fa-solid fa-user-clock me-1"></i>Reassign'
            : '<i class="fa-solid fa-user-plus me-1"></i>Assign';
    }
}

document.addEventListener('click', function (e) {
    if (e.target.closest('#as-confirm')) confirmAssign();
});

/* ---------------- Order details (shared with the Orders page) ---------------- */

/**
 * Opens the shared Order Details modal for a delivery-board order. It loads the
 * full order (products, cutting, customer, address, totals, payment and the
 * delivery block with the assigned Delivery Boy + scheduled slot + handover
 * history) from the admin delivery API and wires the Assign / Reassign buttons
 * into this page's existing assignment modal.
 */
async function openOrderDetails(orderId) {
    if (!orderModal) orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
    const numberEl = document.getElementById('om-number');
    const body = document.getElementById('om-body');
    numberEl.textContent = '';
    body.innerHTML = spinnerHtml();
    orderModal.show();

    try {
        const res = await apiCall('/api/admin/delivery/' + orderId);
        const o = res.data;
        numberEl.textContent = o.orderNumber;
        body.innerHTML = orderDetailSectionsHtml(o, {});

        // The delivery panel renders the Assign / Reassign controls. Hand over to
        // the assignment modal only once this one has fully hidden so Bootstrap
        // never stacks two backdrops.
        body.querySelectorAll('[data-delivery-assign]').forEach(btn =>
            btn.addEventListener('click', () => openAssignFromDetails(Number(btn.dataset.deliveryAssign), false)));
        body.querySelectorAll('[data-delivery-reassign]').forEach(btn =>
            btn.addEventListener('click', () => openAssignFromDetails(Number(btn.dataset.deliveryReassign), true)));
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            orderModal.hide();
            Auth.requireAdmin();
            return;
        }
        body.innerHTML = emptyBoxHtml(e.message || 'Could not load this order.');
    }
}

function openAssignFromDetails(orderId, isReassign) {
    const modalEl = document.getElementById('orderModal');
    const inst = bootstrap.Modal.getInstance(modalEl);
    const open = () => openAssignModal(orderId, isReassign);
    if (inst && modalEl.classList.contains('show')) {
        modalEl.addEventListener('hidden.bs.modal', open, { once: true });
        inst.hide();
    } else {
        open();
    }
}
