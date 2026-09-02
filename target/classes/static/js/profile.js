/* FreshMeat — Profile page controller */

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;
    loadProfile();
    setupTabs();

    const logoutBtn = document.getElementById('profile-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', e => { e.preventDefault(); Auth.clear(); window.location.href = '/'; });
});

function setupTabs() {
    document.querySelectorAll('.profile-menu .nav-link[data-tab]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const tab = link.dataset.tab;
            document.querySelectorAll('.profile-menu .nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('d-none'));
            const pane = document.getElementById('tab-' + tab);
            if (pane) pane.classList.remove('d-none');
            if (tab === 'orders') loadProfileOrders();
            if (tab === 'addresses') loadAddresses();
        });
    });
}

async function loadProfile() {
    try {
        const res = await apiCall('/api/profile');
        const u = res.data;
        document.getElementById('profile-avatar').textContent = initials(u.name);
        document.getElementById('profile-name').textContent = u.name;
        document.getElementById('profile-email').textContent = u.email;
        document.getElementById('pf-name').value = u.name;
        document.getElementById('pf-phone').value = u.phone;
        document.getElementById('pf-email').value = u.email;
        document.getElementById('profile-loading').classList.add('d-none');
        document.getElementById('profile-content').classList.remove('d-none');
    } catch (e) {
        document.getElementById('profile-loading').innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message)}</h6></div>`;
    }
}

async function saveProfile() {
    const name = document.getElementById('pf-name').value.trim();
    const phone = document.getElementById('pf-phone').value.trim();
    if (name.length < 2) { showToast('Enter a valid name', 'warning'); return; }
    if (!/^\d{10}$/.test(phone)) { showToast('Phone must be 10 digits', 'warning'); return; }

    try {
        const res = await apiCall('/api/profile', { method: 'PUT', body: { name, phone } });
        const user = Auth.getUser();
        Auth.save(Auth.getToken(), { ...user, name });
        document.getElementById('profile-name').textContent = name;
        showToast('Profile updated!');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function changePassword() {
    const current = document.getElementById('pw-current').value;
    const next = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;
    if (!current || !next) { showToast('Please fill all fields', 'warning'); return; }
    if (next.length < 6) { showToast('New password must be at least 6 characters', 'warning'); return; }
    if (next !== confirm) { showToast('Passwords do not match', 'warning'); return; }

    try {
        await apiCall('/api/profile/password', { method: 'PUT', body: { currentPassword: current, newPassword: next } });
        ['pw-current', 'pw-new', 'pw-confirm'].forEach(id => document.getElementById(id).value = '');
        showToast('Password changed successfully');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function loadAddresses() {
    const container = document.getElementById('address-list');
    try {
        const res = await apiCall('/api/addresses');
        const list = res.data || [];
        if (!list.length) {
            container.innerHTML = `<p class="text-muted small">No saved addresses yet.</p>`;
            return;
        }
        container.innerHTML = list.map(a => `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                <div>
                    <strong class="small">${escapeHtml(a.label || 'Address')}</strong>
                    <div class="text-muted small">
                        ${escapeHtml(a.doorNumber)}, ${escapeHtml(a.street)}, ${escapeHtml(a.area)}, ${escapeHtml(a.city)} - ${escapeHtml(a.pincode)}
                        ${a.isDefault ? ' <span class="badge text-bg-primary">Default</span>' : ''}
                    </div>
                </div>
                <button class="btn-icon-xs del" onclick="deleteAddress(${a.id})"><i class="fa-solid fa-trash-can"></i></button>
            </div>`).join('');
    } catch (e) {
        container.innerHTML = `<p class="text-muted small">${escapeHtml(e.message)}</p>`;
    }
}

function deleteAddress(id) {
    if (!confirm('Delete this address?')) return;
    apiCall('/api/addresses/' + id, { method: 'DELETE' })
        .then(() => { showToast('Address deleted'); loadAddresses(); })
        .catch(e => showToast(e.message, 'error'));
}

async function addAddress() {
    const payload = {
        label: document.getElementById('ad-label').value.trim() || 'Home',
        doorNumber: document.getElementById('ad-door').value.trim(),
        street: document.getElementById('ad-street').value.trim(),
        area: document.getElementById('ad-area').value.trim(),
        city: document.getElementById('ad-city').value.trim(),
        state: document.getElementById('ad-state').value.trim(),
        pincode: document.getElementById('ad-pincode').value.trim(),
        isDefault: false
    };
    if (!payload.doorNumber || !payload.city || !payload.pincode) {
        showToast('Door number, city and pincode are required', 'warning'); return;
    }
    if (!/^\d{6}$/.test(payload.pincode)) { showToast('Pincode must be 6 digits', 'warning'); return; }

    try {
        await apiCall('/api/addresses', { method: 'POST', body: payload });
        showToast('Address saved!');
        ['ad-label', 'ad-door', 'ad-street', 'ad-area', 'ad-city', 'ad-state', 'ad-pincode'].forEach(id => document.getElementById(id).value = '');
        loadAddresses();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function loadProfileOrders() {
    const container = document.getElementById('profile-orders');
    try {
        const res = await apiCall('/api/orders/my-orders');
        const orders = res.data || [];
        if (!orders.length) {
            container.innerHTML = `<div class="empty-state">
                <div class="es-icon"><i class="fa-solid fa-box"></i></div>
                <h6>No orders yet</h6></div>`;
            return;
        }
        container.innerHTML = orders.slice(0, 6).map(o => `
            <div class="d-flex flex-wrap justify-content-between align-items-center border-bottom py-2">
                <div>
                    <a href="/order-tracking.html?id=${o.id}" class="fw-bold small">${escapeHtml(o.orderNumber)}</a>
                    <div class="text-muted small">${fmtDate(o.createdAt)} • ${fmtMoney(o.grandTotal)}</div>
                </div>
                <span class="status-badge status-${o.status}">${o.status.replace(/_/g, ' ')}</span>
            </div>`).join('');
    } catch (e) {
        container.innerHTML = `<p class="text-muted small">${escapeHtml(e.message)}</p>`;
    }
}