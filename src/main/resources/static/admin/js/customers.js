/* FreshMeat — Admin Customers controller */

let customersCache = {};
let deleteCustomerId = null;
let deleteCustomerModal = null;
let toggleCustomerId = null;
let toggleAction = null;
let toggleCustomerModal = null;

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('customers', 'Customers', 'Registered customer accounts')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <div class="search-box">
        <input type="text" id="customer-search" placeholder="Search customers...">
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>
    </div>
    <div class="admin-card">
      <div id="customers-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    document.getElementById('customer-search').addEventListener('input', debounce(() => loadCustomers(), 400));
    document.getElementById('confirm-delete-customer-btn').addEventListener('click', confirmDeleteCustomer);
    document.getElementById('confirm-toggle-customer-btn').addEventListener('click', confirmToggleCustomer);

    // Clean focus before Bootstrap toggles aria-hidden on hide, so no element
    // inside the hidden modal keeps focus (prevents the blocked aria-hidden warning).
    document.getElementById('deleteCustomerModal').addEventListener('hidden.bs.modal', () => {
        const modalEl = document.getElementById('deleteCustomerModal');
        const active = document.activeElement;
        if (modalEl && active && modalEl.contains(active)) active.blur();
    });
    document.getElementById('toggleCustomerModal').addEventListener('hidden.bs.modal', () => {
        const modalEl = document.getElementById('toggleCustomerModal');
        const active = document.activeElement;
        if (modalEl && active && modalEl.contains(active)) active.blur();
    });

    loadCustomers();
});

async function loadCustomers() {
    const q = document.getElementById('customer-search').value.trim();
    const body = document.getElementById('customers-body');
    try {
        const res = await apiCall('/api/admin/customers' + (q ? '?search=' + encodeURIComponent(q) : ''));
        const customers = res.data || [];
        customersCache = {};
        customers.forEach(c => { customersCache[c.id] = c; });
        if (!customers.length) { body.innerHTML = emptyBoxHtml('No customers found'); return; }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Joined</th><th>Status</th><th class="text-end">Action</th></tr></thead>
          <tbody>
            ${customers.map(c => `
            <tr>
              <td><strong class="small">${escapeHtml(c.name)}</strong></td>
              <td class="text-muted">${escapeHtml(c.email)}</td>
              <td>${escapeHtml(c.phone || '-')}</td>
              <td class="text-muted" style="font-size:0.78rem;">${fmtDateOnly(c.createdAt)}</td>
              <td>${c.enabled ? '<span class="badge-status CONFIRMED">Active</span>' : '<span class="badge-status CANCELLED">Inactive</span>'}</td>
              <td>
                <div class="d-flex justify-content-end gap-1">
                  <button class="btn-icon-xs ${c.enabled ? 'toggle-on' : 'toggle-off'}" onclick="prepareToggleCustomer(${c.id}, '${c.enabled ? 'deactivate' : 'activate'}')" title="${c.enabled ? 'Deactivate' : 'Activate'}">
                    <i class="fa-solid ${c.enabled ? 'fa-user-slash' : 'fa-user-check'}"></i>
                  </button>
                  <button class="btn-icon-xs del" onclick="prepareDeleteCustomer(${c.id})" title="Delete Customer">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

function prepareToggleCustomer(id, action) {
    const c = customersCache[id] || {};
    const deactivating = action === 'deactivate';
    toggleCustomerId = id;
    toggleAction = action;

    document.getElementById('toggleCustomerModalLabel').textContent = deactivating ? 'Deactivate Customer' : 'Activate Customer';
    document.getElementById('toggle-customer-msg').textContent = deactivating
        ? 'Are you sure you want to deactivate this customer?'
        : 'Are you sure you want to activate this customer?';
    document.getElementById('toggle-customer-name').textContent = c.name || '';
    document.getElementById('toggle-customer-email').textContent = c.email || '';
    document.getElementById('toggle-customer-warn').style.display = deactivating ? '' : 'none';

    const btn = document.getElementById('confirm-toggle-customer-btn');
    btn.textContent = deactivating ? 'Deactivate Customer' : 'Activate Customer';
    btn.style.background = deactivating ? '#dc3545' : '';
    btn.style.borderColor = deactivating ? '#dc3545' : '';
    btn.disabled = false;

    if (!toggleCustomerModal) toggleCustomerModal = new bootstrap.Modal(document.getElementById('toggleCustomerModal'));
    toggleCustomerModal.show();
}

async function confirmToggleCustomer() {
    if (!toggleCustomerId) return;
    const deactivating = toggleAction === 'deactivate';
    const btn = document.getElementById('confirm-toggle-customer-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' + (deactivating ? 'Deactivating...' : 'Activating...');
    try {
        await apiCall('/api/admin/customers/' + toggleCustomerId + '/toggle', { method: 'PUT' });
        toggleCustomerModal.hide();
        toggleCustomerId = null;
        toggleAction = null;
        showToast(deactivating ? 'Customer deactivated successfully.' : 'Customer activated successfully.');
        loadCustomers();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        btn.disabled = false;
        btn.innerHTML = deactivating ? 'Deactivate Customer' : 'Activate Customer';
        showToast(e.message || 'Could not update customer status', 'error');
    }
}

function prepareDeleteCustomer(id) {
    const c = customersCache[id] || {};
    deleteCustomerId = id;
    document.getElementById('dc-name').textContent = c.name || '';
    document.getElementById('dc-email').textContent = c.email || '';

    const btn = document.getElementById('confirm-delete-customer-btn');
    btn.disabled = false;
    btn.innerHTML = 'Delete Customer';

    if (!deleteCustomerModal) deleteCustomerModal = new bootstrap.Modal(document.getElementById('deleteCustomerModal'));
    deleteCustomerModal.show();
}

async function confirmDeleteCustomer() {
    if (!deleteCustomerId) return;
    const btn = document.getElementById('confirm-delete-customer-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...';
    try {
        const res = await apiCall('/api/admin/customers/' + deleteCustomerId, { method: 'DELETE' });
        deleteCustomerModal.hide();
        deleteCustomerId = null;
        showToast((res && res.message) || 'Customer deleted successfully.');
        loadCustomers();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        btn.disabled = false;
        btn.innerHTML = 'Delete Customer';
        showToast(e.message || 'Could not delete customer', 'error');
    }
}