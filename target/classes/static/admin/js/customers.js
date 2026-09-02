/* FreshMeat — Admin Customers controller */

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
    loadCustomers();
});

async function loadCustomers() {
    const q = document.getElementById('customer-search').value.trim();
    const body = document.getElementById('customers-body');
    try {
        const res = await apiCall('/api/admin/customers' + (q ? '?search=' + encodeURIComponent(q) : ''));
        const customers = res.data || [];
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
              <td>${c.enabled ? '<span class="badge-status CONFIRMED">Active</span>' : '<span class="badge-status CANCELLED">Blocked</span>'}</td>
              <td class="text-end">
                <button class="btn-icon-xs ${c.enabled ? '' : 'toggle-off'}" onclick="toggleCustomer(${c.id})" title="${c.enabled ? 'Block' : 'Unblock'}">
                  <i class="fa-solid ${c.enabled ? 'fa-user-slash' : 'fa-user-check'}"></i>
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

async function toggleCustomer(id) {
    if (!confirm('Toggle this customer\'s account status?')) return;
    try {
        await apiCall('/api/admin/customers/' + id + '/toggle', { method: 'PUT' });
        showToast('Customer status updated');
        loadCustomers();
    } catch (e) { showToast(e.message, 'error'); }
}