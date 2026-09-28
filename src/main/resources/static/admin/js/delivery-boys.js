/* FreshMeat — Admin Delivery Boy Management
   Delivery boys are users, so there is no delete here on purpose: removing a
   row would orphan every past delivery. Deactivation keeps the history intact. */

let boys = [];
let boysCache = {};
let boyModal = null;
let toggleModal = null;
let editingBoyId = null;
let toggleBoyId = null;
let toggleToActive = false;

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('delivery-boys', 'Delivery Boys', 'Manage your delivery team')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="row g-3 mb-3">
      <div class="col-4">
        <div class="stat-card h-100">
          <div class="stat-icon blue"><i class="fa-solid fa-id-badge"></i></div>
          <div class="stat-meta">
            <h6>Total Boys</h6>
            <div class="stat-value" id="s-total">-</div>
          </div>
        </div>
      </div>
      <div class="col-4">
        <div class="stat-card h-100">
          <div class="stat-icon green"><i class="fa-solid fa-circle-check"></i></div>
          <div class="stat-meta">
            <h6>Active</h6>
            <div class="stat-value" id="s-active">-</div>
          </div>
        </div>
      </div>
      <div class="col-4">
        <div class="stat-card h-100">
          <div class="stat-icon red"><i class="fa-solid fa-circle-xmark"></i></div>
          <div class="stat-meta">
            <h6>Inactive</h6>
            <div class="stat-value" id="s-inactive">-</div>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div class="card-title mb-0"><i class="fa-solid fa-id-badge text-primary me-2"></i>Delivery Team</div>
        <div class="d-flex flex-wrap align-items-center gap-2">
          <div class="search-box">
            <input type="text" id="boy-search" placeholder="Search name, email or phone">
            <i class="fa-solid fa-magnifying-glass"></i>
          </div>
          <select class="form-select form-control-fm" id="boy-filter" style="width:auto;">
            <option value="">All</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
          <button class="btn-admin" id="add-boy-btn"><i class="fa-solid fa-plus me-1"></i>Add Delivery Boy</button>
        </div>
      </div>
      <div id="boys-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    document.getElementById('boy-search').addEventListener('input', debounce(loadBoys, 350));
    document.getElementById('boy-filter').addEventListener('change', loadBoys);
    document.getElementById('add-boy-btn').addEventListener('click', () => openBoyModal(null));
    document.getElementById('boy-save-btn').addEventListener('click', saveBoy);

    ['boyModal', 'toggleModal'].forEach(id => {
        document.getElementById(id).addEventListener('hidden.bs.modal', () => {
            const el = document.getElementById(id);
            if (el.contains(document.activeElement)) document.activeElement.blur();
        });
    });

    loadBoys();
});

async function loadBoys() {
    const body = document.getElementById('boys-body');
    body.innerHTML = spinnerHtml();
    try {
        const q = new URLSearchParams();
        q.set('search', document.getElementById('boy-search').value.trim());
        const active = document.getElementById('boy-filter').value;
        if (active) q.set('active', active);

        const res = await apiCall('/api/admin/delivery-boys?' + q.toString());
        boys = res.data || [];
        boysCache = {};
        boys.forEach(b => { boysCache[b.id] = b; });

        const total = boys.length;
        const activeCount = boys.filter(b => b.active).length;
        document.getElementById('s-total').textContent = total;
        document.getElementById('s-active').textContent = activeCount;
        document.getElementById('s-inactive').textContent = total - activeCount;

        if (!total) {
            body.innerHTML = emptyBoxHtml('No delivery boys found. Add one to start assigning deliveries.');
            return;
        }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th class="text-center">Active Deliveries</th>
              <th class="text-center">Completed Today</th>
              <th class="text-center">Total Completed</th>
              <th>Status</th>
              <th class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            ${boys.map(b => `
            <tr>
              <td>
                <strong class="small">${escapeHtml(b.name)}</strong>
                <div class="text-muted" style="font-size:0.72rem;">Since ${fmtDateOnly(b.createdAt)}</div>
              </td>
              <td class="text-muted small">${escapeHtml(b.email)}</td>
              <td class="small">${escapeHtml(b.phone || '-')}</td>
              <td class="text-center">${b.assignedCount > 0
                  ? '<span class="badge-status ASSIGNED">' + b.assignedCount + '</span>'
                  : '<span class="text-muted">0</span>'}</td>
              <td class="text-center">${b.completedTodayCount > 0
                  ? '<span class="badge-status DELIVERED">' + b.completedTodayCount + '</span>'
                  : '<span class="text-muted">0</span>'}</td>
              <td class="text-center text-muted">${b.completedCount}</td>
              <td>${b.active
                  ? '<span class="badge-status CONFIRMED">Active</span>'
                  : '<span class="badge-status INACTIVE">Inactive</span>'}</td>
              <td>
                <div class="d-flex justify-content-end gap-1">
                  <button class="btn-icon-xs edit" onclick="openBoyModal(${b.id})" title="Edit Delivery Boy">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="btn-icon-xs ${b.active ? 'toggle-on' : 'toggle-off'}"
                          onclick="prepareToggle(${b.id}, ${!b.active})"
                          title="${b.active ? 'Deactivate' : 'Activate'}">
                    <i class="fa-solid ${b.active ? 'fa-user-slash' : 'fa-user-check'}"></i>
                  </button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) return Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message || 'Could not load delivery boys.');
    }
}

function setFieldError(id, errId, message) {
    const input = document.getElementById(id);
    const err = document.getElementById(errId);
    if (message) {
        input.classList.add('is-invalid');
        if (err) err.textContent = message;
    } else {
        input.classList.remove('is-invalid');
    }
}

function openBoyModal(id) {
    editingBoyId = id || null;
    ['name', 'email', 'phone', 'password'].forEach(f => setFieldError('b-' + f, 'err-' + f, null));

    const isEdit = !!id;
    const b = isEdit ? (boysCache[id] || {}) : {};
    document.getElementById('boyModalLabel').innerHTML = isEdit
        ? '<i class="fa-solid fa-id-badge text-primary me-2"></i>Edit Delivery Boy'
        : '<i class="fa-solid fa-id-badge text-primary me-2"></i>Add Delivery Boy';

    document.getElementById('b-name').value = b.name || '';
    document.getElementById('b-email').value = b.email || '';
    document.getElementById('b-phone').value = b.phone || '';
    document.getElementById('b-password').value = '';
    document.getElementById('b-active').checked = isEdit ? !!b.active : true;

    const pw = document.getElementById('b-password');
    pw.required = !isEdit;
    document.getElementById('pw-hint').textContent = isEdit ? '(leave blank to keep current)' : '';

    document.getElementById('boy-save-btn').disabled = false;
    document.getElementById('boy-save-btn').innerHTML = isEdit
        ? '<i class="fa-solid fa-floppy-disk me-1"></i>Update'
        : '<i class="fa-solid fa-floppy-disk me-1"></i>Create';

    if (!boyModal) boyModal = new bootstrap.Modal(document.getElementById('boyModal'));
    boyModal.show();
    setTimeout(() => document.getElementById('b-name').focus(), 400);
}

async function saveBoy() {
    const name = document.getElementById('b-name').value.trim();
    const email = document.getElementById('b-email').value.trim();
    const phone = document.getElementById('b-phone').value.trim();
    const password = document.getElementById('b-password').value;
    const active = document.getElementById('b-active').checked;
    const isEdit = !!editingBoyId;

    let bad = false;
    if (name.length < 2) { setFieldError('b-name', 'err-name', 'Name must be at least 2 characters.'); bad = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('b-email', 'err-email', 'Enter a valid email address.'); bad = true; }
    if (!/^[6-9][0-9]{9}$/.test(phone)) { setFieldError('b-phone', 'err-phone', 'Enter a valid 10-digit mobile number.'); bad = true; }
    if (!isEdit && password.length < 6) { setFieldError('b-password', 'err-password', 'Password must be at least 6 characters.'); bad = true; }
    if (bad) return;

    const btn = document.getElementById('boy-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    try {
        const payload = { name, email, phone, active };
        if (password) payload.password = password;
        const res = await apiCall(
            isEdit ? '/api/admin/delivery-boys/' + editingBoyId : '/api/admin/delivery-boys',
            { method: isEdit ? 'PUT' : 'POST', body: payload }
        );
        boyModal.hide();
        showToast((res && res.message) || (isEdit ? 'Delivery Boy updated.' : 'Delivery Boy added.'));
        loadBoys();
    } catch (e) {
        if (e.status === 401 || e.status === 403) return Auth.requireAdmin();
        showToast(e.message || 'Could not save the delivery boy.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = isEdit
            ? '<i class="fa-solid fa-floppy-disk me-1"></i>Update'
            : '<i class="fa-solid fa-floppy-disk me-1"></i>Create';
    }
}

function prepareToggle(id, activate) {
    const b = boysCache[id] || {};
    toggleBoyId = id;
    toggleToActive = activate;

    document.getElementById('toggleModalLabel').innerHTML = activate
        ? '<i class="fa-solid fa-user-check text-success me-2"></i>Activate Delivery Boy'
        : '<i class="fa-solid fa-user-slash text-danger me-2"></i>Deactivate Delivery Boy';
    document.getElementById('toggle-msg').textContent = activate
        ? 'This delivery boy will be able to sign in and receive new assignments again.'
        : 'This delivery boy will be signed out and will not appear in the assignment list.';
    document.getElementById('toggle-name').textContent = b.name || '';
    document.getElementById('toggle-meta').textContent = (b.email || '') + (b.phone ? ' - ' + b.phone : '');
    document.getElementById('toggle-note').textContent =
        'Past and in-progress deliveries are kept, so reports and order history stay complete.';

    const btn = document.getElementById('toggle-confirm-btn');
    btn.textContent = activate ? 'Activate' : 'Deactivate';
    btn.style.background = activate ? '' : '#dc3545';
    btn.style.borderColor = activate ? '' : '#dc3545';
    btn.disabled = false;

    if (!toggleModal) toggleModal = new bootstrap.Modal(document.getElementById('toggleModal'));
    toggleModal.show();
}

async function confirmToggle() {
    if (!toggleBoyId) return;
    const btn = document.getElementById('toggle-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Working...';
    try {
        const res = await apiCall('/api/admin/delivery-boys/' + toggleBoyId + '/status', {
            method: 'PUT',
            body: { active: toggleToActive }
        });
        toggleModal.hide();
        toggleBoyId = null;
        showToast((res && res.message) || (toggleToActive ? 'Delivery Boy activated.' : 'Delivery Boy deactivated.'));
        loadBoys();
    } catch (e) {
        if (e.status === 401 || e.status === 403) return Auth.requireAdmin();
        showToast(e.message || 'Could not update the delivery boy.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = toggleToActive ? 'Activate' : 'Deactivate';
    }
}

document.addEventListener('click', function (e) {
    if (e.target.closest('#toggle-confirm-btn')) confirmToggle();
});
