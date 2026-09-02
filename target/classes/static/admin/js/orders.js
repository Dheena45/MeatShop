/* FreshMeat — Admin Orders controller */

let currentFilter = '';
let selectedOrder = null;
let detailOrdersCache = {};

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('orders', 'Orders', 'Track & manage customer orders')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div class="d-flex flex-wrap gap-2" id="status-filters">
        <button class="btn-admin-outline ${!currentFilter ? 'active-fill' : ''}" data-status="" style="padding:0.4rem 1rem;font-size:0.78rem;">All</button>
        ${ACTIVE_ORDER_STATUSES.map(s => `
          <button class="btn-admin-outline" data-status="${s}" style="padding:0.4rem 1rem;font-size:0.78rem;">${s.replace(/_/g, ' ')}</button>`).join('')}
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
            <tr><th>Order No.</th><th>Customer</th><th>Items</th><th>Total</th><th>Placed On</th><th>Slot</th><th>Payment</th><th>Status</th><th class="text-end">Action</th></tr>
          </thead>
          <tbody>
            ${orders.map(o => `
            <tr>
              <td><strong class="small">${escapeHtml(o.orderNumber)}</strong></td>
              <td>
                <strong class="small">${escapeHtml(o.customerName)}</strong>
                <div class="text-muted" style="font-size:0.72rem;">${escapeHtml(o.customerPhone || '')}</div>
              </td>
              <td>${(o.items || []).length}</td>
              <td><strong>${fmtMoney(o.grandTotal)}</strong></td>
              <td class="text-muted" style="font-size:0.78rem;">${fmtDate(o.createdAt)}</td>
              <td class="text-muted" style="font-size:0.78rem;">${escapeHtml(o.deliverySlot || '-')}</td>
              <td style="font-size:0.78rem;">${escapeHtml((o.paymentMethod || '').replace(/_/g, ' '))}</td>
              <td>${adminStatusBadge(o.status)}</td>
              <td class="text-end">
                <button class="btn-icon-xs edit" onclick="openOrderModal(${o.id})" title="View / Update"><i class="fa-regular fa-eye"></i></button>
              </td>
            </tr>`).join('')}
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
        const currentIdx = ACTIVE_ORDER_STATUSES.indexOf(o.status);

        document.getElementById('om-body').innerHTML = `
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <label class="form-label">Status</label>
            <select class="form-select form-control-fm" id="om-status">
              ${ACTIVE_ORDER_STATUSES.map(s =>
                  `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-6 d-flex align-items-end">
            <button class="btn-admin" id="om-update-btn" onclick="updateOrderStatus()"><i class="fa-solid fa-floppy-disk me-1"></i>Update Status</button>
          </div>
        </div>

        <table class="table table-fm align-middle">
          <thead><tr><th>Product</th><th>Qty</th><th>Cutting</th><th>Price/KG</th><th class="text-end">Subtotal</th></tr></thead>
          <tbody>
            ${(o.items || []).map(i => `
              <tr>
                <td><strong class="small">${escapeHtml(i.productName)}</strong></td>
                <td>${i.quantity} KG</td>
                <td class="text-muted" style="font-size:0.78rem;">${escapeHtml((i.cuttingOption || '').replace(/_/g, ' '))}</td>
                <td>${fmtMoney(i.pricePerKg)}</td>
                <td class="text-end">${fmtMoney(i.subtotal)}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div class="row g-2 mt-1">
          <div class="col-md-7">
            <label class="form-label">Customer</label>
            <p class="mb-1">${escapeHtml(o.customerName)} &nbsp; ${escapeHtml(o.customerPhone || '')}</p>
            <p class="mb-2 text-muted small">${escapeHtml(o.customerEmail || '')}</p>
            <label class="form-label">Delivery Address</label>
            <p class="mb-1" style="font-size:0.85rem;">
              ${escapeHtml(o.deliveryDoor)}, ${escapeHtml(o.deliveryStreet)}, ${escapeHtml(o.deliveryArea)},<br>
              ${escapeHtml(o.deliveryCity)} - ${escapeHtml(o.deliveryPincode)}, ${escapeHtml(o.deliveryState)}
            </p>
            <p class="text-muted" style="font-size:0.82rem;">
              <i class="fa-solid fa-clock me-1"></i>Slot: ${escapeHtml(o.deliverySlot || '-')}<br>
              <i class="fa-solid fa-note-sticky me-1"></i>Notes: ${escapeHtml(o.notes || '-')}
            </p>
          </div>
          <div class="col-md-5">
            <label class="form-label">Summary</label>
            <div class="small">
              <div class="d-flex justify-content-between"><span>Subtotal</span><span>${fmtMoney(o.subtotal)}</span></div>
              <div class="d-flex justify-content-between"><span>Discount</span><span class="text-success">-${fmtMoney(o.discountAmount)}</span></div>
              <div class="d-flex justify-content-between"><span>Tax</span><span>${fmtMoney(o.tax)}</span></div>
              <div class="d-flex justify-content-between"><span>Delivery</span><span>${Number(o.deliveryCharge) === 0 ? 'FREE' : fmtMoney(o.deliveryCharge)}</span></div>
              <hr class="my-1">
              <div class="d-flex justify-content-between fw-bold"><span>Grand Total</span><span>${fmtMoney(o.grandTotal)}</span></div>
              <div class="d-flex justify-content-between text-muted" style="font-size:0.78rem;">
                <span>Payment</span><span>${escapeHtml((o.paymentMethod || '').replace(/_/g, ' '))}</span>
              </div>
              <div class="d-flex justify-content-between text-muted" style="font-size:0.78rem;">
                <span>Payment Status</span><span>${escapeHtml((o.paymentStatus || '').replace(/_/g, ' '))}</span>
              </div>
            </div>
          </div>
        </div>`;
        new bootstrap.Modal(document.getElementById('orderModal')).show();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function updateOrderStatus() {
    const status = document.getElementById('om-status').value;
    if (!selectedOrder || status === selectedOrder.status) return;
    if (!confirm('Set order to "' + status.replace(/_/g, ' ') + '"?')) return;

    try {
        await apiCall('/api/admin/orders/' + selectedOrder.id + '/status', {
            method: 'PUT', body: { status }
        });
        showToast('Order status updated');
        bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();
        loadOrders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}