/* FreshMeat — Admin Delivery Management */

let deliveryRows = [];
let deliveryBoys = [];
let assignModal = null;
let detailModal = null;
let assignOrderId = null;
let assignIsReassign = false;
let deliveryModalOrder = null;

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
    ['assignModal', 'detailModal'].forEach(id => {
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

    // A Delivery Boy is confirmed (or reassigned) while the parcel is still in
    // the store: CONFIRMED, or PREPARING before the delivery starts.
    const assignable = o => o.status === 'CONFIRMED' || o.status === 'PREPARING';
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
          <td>
            <strong class="small">${escapeHtml(o.orderNumber)}</strong>
            <div class="text-muted" style="font-size:0.72rem;">${fmtDateOnly(o.createdAt)}</div>
          </td>
          <td>
            <div class="small">${escapeHtml(o.customerName || '-')}</div>
            <div class="text-muted" style="font-size:0.72rem;">${escapeHtml(o.customerPhone || '-')}</div>
          </td>
          <td style="max-width:230px;font-size:0.78rem;">${escapeHtml(addressOneLine(o))}</td>
          <td style="font-size:0.78rem;">${escapeHtml(o.deliverySlot || '-')}</td>
          <td class="text-end small fw-semibold">${fmtMoney(o.grandTotal)}</td>
          <td>${paymentCellHtml(o)}</td>
          <td style="font-size:0.78rem;">
            ${hasBoy(o)
              ? escapeHtml(o.delivery.deliveryBoyName) + (o.delivery.deliveryBoyActive === false ? ' <span class="badge-status INACTIVE" style="font-size:0.6rem;">Inactive</span>' : '')
              : '<span class="text-muted">Unassigned</span>'}
          </td>
          <td>
            <div class="d-flex flex-wrap gap-1">
              ${adminStatusBadge(o.status)}
              ${deliveryStateBadge((o.delivery && o.delivery.state) || 'PENDING_ASSIGNMENT')}
            </div>
          </td>
          <td>
            <div class="d-flex justify-content-end gap-1">
              <button class="btn-icon-xs" onclick="openDeliveryDetail(${o.id})" title="View Delivery Details">
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

    document.getElementById('as-confirm').innerHTML = isReassign
        ? '<i class="fa-solid fa-user-clock me-1"></i>Reassign'
        : '<i class="fa-solid fa-user-plus me-1"></i>Assign';

    if (!assignModal) assignModal = new bootstrap.Modal(document.getElementById('assignModal'));
    assignModal.show();
}

async function confirmAssign() {
    const boyId = document.getElementById('as-boy').value;
    if (!boyId) return showToast('Please select a Delivery Boy.', 'warning');

    const btn = document.getElementById('as-confirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    try {
        const res = await apiCall('/api/admin/delivery/' + assignOrderId + (assignIsReassign ? '/reassign' : '/assign'), {
            method: assignIsReassign ? 'PUT' : 'POST',
            body: { deliveryBoyId: Number(boyId) }
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

/* ---------------- Delivery detail ---------------- */

async function openDeliveryDetail(orderId) {
    const el = document.getElementById('dt-body');
    el.innerHTML = spinnerHtml();
    if (!detailModal) detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    detailModal.show();

    try {
        const res = await apiCall('/api/admin/delivery/' + orderId);
        deliveryModalOrder = res.data;
        renderDeliveryDetail(deliveryModalOrder);
    } catch (e) {
        if (e.status === 401 || e.status === 403) return Auth.requireAdmin();
        el.innerHTML = emptyBoxHtml(e.message || 'Could not load this delivery.');
    }
}

function renderDeliveryDetail(o) {
    const d = o.delivery || {};
    document.getElementById('dt-order-no').textContent = o.orderNumber;

    const history = (d.history || []).slice().reverse();
    const canAssign = (o.status === 'CONFIRMED' || o.status === 'PREPARING') && !d.deliveryBoyId;
    const canReassign = (o.status === 'CONFIRMED' || o.status === 'PREPARING') && !!d.deliveryBoyId;

    document.getElementById('dt-body').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        ${adminStatusBadge(o.status)}
        ${deliveryStateBadge(d.state)}
      </div>
      <div style="font-size:0.8rem;" class="text-muted">Placed ${fmtDate(o.createdAt)}</div>
    </div>

    <div class="row g-3">
      <div class="col-md-6">
        <div class="form-label mb-1"><i class="fa-solid fa-user me-1"></i>Customer</div>
        <div style="font-size:0.9rem;">
          <strong>${escapeHtml(o.customerName || '-')}</strong><br>
          <span class="text-muted">${escapeHtml(o.customerPhone || '-')}</span>
        </div>
        <div class="form-label mt-3 mb-1"><i class="fa-solid fa-location-dot me-1"></i>Delivery Address</div>
        <div style="font-size:0.9rem;">${addressBlockHtml(o)}</div>
        <div class="text-muted mt-1" style="font-size:0.8rem;">
          <i class="fa-regular fa-clock me-1"></i>${escapeHtml(o.deliverySlot || 'No preferred slot')}
        </div>
      </div>
      <div class="col-md-6">
        <div class="form-label mb-1"><i class="fa-solid fa-indian-rupee-sign me-1"></i>Payment</div>
        <div style="font-size:0.9rem;">
          ${escapeHtml((o.paymentMethod || '-').replace(/_/g, ' '))} &middot; ${paymentBadgeHtml(o)}<br>
          <strong class="d-inline-block mt-1">${fmtMoney(o.grandTotal)}</strong>
          ${o.paidAt ? '<br><span class="text-muted" style="font-size:0.78rem;">Paid ' + fmtDate(o.paidAt) + '</span>' : ''}
        </div>
        <div class="form-label mt-3 mb-1"><i class="fa-solid fa-id-badge me-1"></i>Delivery Boy</div>
        <div style="font-size:0.9rem;">
          ${d.deliveryBoyName
            ? '<strong>' + escapeHtml(d.deliveryBoyName) + '</strong>' + (d.deliveryBoyPhone ? ' <span class="text-muted" style="font-size:0.8rem;">' + escapeHtml(d.deliveryBoyPhone) + '</span>' : '')
            : '<span class="text-muted">Not assigned</span>'}
        </div>
        <div class="text-muted mt-1" style="font-size:0.78rem;">
          ${d.assignedAt ? '<div>Assigned: ' + fmtDate(d.assignedAt) + '</div>' : ''}
          ${d.startedAt ? '<div>Started: ' + fmtDate(d.startedAt) + '</div>' : ''}
          ${d.completedAt ? '<div>Delivered: ' + fmtDate(d.completedAt) + '</div>' : ''}
        </div>
      </div>
    </div>

    <div class="mt-3 pt-3 border-top">
      <div class="form-label mb-2"><i class="fa-solid fa-clock-rotate-left me-1"></i>Delivery History</div>
      ${history.length ? `<ul class="list-unstyled mb-0" style="font-size:0.85rem;">
        ${history.map(h => `
          <li class="mb-2 pb-2 border-bottom">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <strong>${escapeHtml(h.deliveryBoyName || '-')}</strong>
              <span class="badge-status ${h.status === 'COMPLETED' ? 'DELIVERED' : (h.status === 'REASSIGNED' ? 'CANCELLED' : 'CONFIRMED')}">${escapeHtml(String(h.status || '').replace(/_/g, ' '))}</span>
            </div>
            <div class="text-muted" style="font-size:0.75rem;">
              Assigned ${fmtDate(h.assignedAt)}
              ${h.startedAt ? ' &middot; Started ' + fmtDate(h.startedAt) : ''}
              ${h.completedAt ? ' &middot; Delivered ' + fmtDate(h.completedAt) : ''}
              ${h.assignedBy ? ' &middot; by ' + escapeHtml(h.assignedBy) : ''}
            </div>
          </li>`).join('')}
      </ul>` : '<div class="text-muted" style="font-size:0.85rem;">No delivery activity yet.</div>'}
    </div>

    ${canAssign || canReassign ? `
      <div class="mt-3 pt-3 border-top">
        <button class="btn-admin" id="dt-assign-btn">
          <i class="fa-solid ${canAssign ? 'fa-user-plus' : 'fa-user-clock'} me-1"></i>${canAssign ? 'Assign Delivery Boy' : 'Reassign Delivery Boy'}
        </button>
      </div>` : ''}`;

    const btn = document.getElementById('dt-assign-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            detailModal.hide();
            document.getElementById('detailModal').addEventListener('hidden.bs.modal',
                () => openAssignModal(o.id, !!canReassign), { once: true });
        });
    }
}
