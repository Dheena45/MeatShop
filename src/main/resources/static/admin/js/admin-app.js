/* ============================================================
   FRESHMEAT — Admin shared helpers (sidebar + topbar + guards)
   ============================================================ */

const ADMIN_MENU = [
    { key: 'dashboard',  href: '/admin/dashboard.html',  icon: 'fa-solid fa-gauge-high',          label: 'Dashboard' },
    { key: 'orders',     href: '/admin/orders.html',     icon: 'fa-solid fa-truck-fast',           label: 'Orders' },
    { key: 'products',   href: '/admin/products.html',   icon: 'fa-solid fa-drumstick-bite',       label: 'Products' },
    { key: 'inventory',  href: '/admin/inventory.html',  icon: 'fa-solid fa-boxes-stacked',        label: 'Inventory' },
    { key: 'customers',  href: '/admin/customers.html',  icon: 'fa-solid fa-users',                label: 'Customers' },
    { key: 'offers',     href: '/admin/offers.html',     icon: 'fa-solid fa-tags',                 label: 'Offers' }
];

const ACTIVE_ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

function initAdminPage(activeKey, pageTitle, pageSubtitle) {
    if (!Auth.requireAdmin()) return false;

    const user = Auth.getUser();
    const shell = document.getElementById('admin-shell');
    if (!shell) return false;

    const links = ADMIN_MENU.map(m => `
        <a class="sidebar-link ${activeKey === m.key ? 'active' : ''}" href="${m.href}">
            <i class="${m.icon}"></i>${m.label}
        </a>`).join('');

    shell.innerHTML = `
    <aside class="admin-sidebar" id="admin-sidebar">
      <a class="sidebar-brand" href="/admin/dashboard.html">Fresh<span class="dot">Meat</span></a>
      <div class="sidebar-label">Main</div>
      <nav>
        ${links}
      </nav>
      <div class="sidebar-footer">
        <a class="view-site" href="/"><i class="fa-solid fa-store me-2"></i>View Store</a>
        <a class="view-site mt-2" href="#" id="admin-logout"><i class="fa-solid fa-right-from-bracket me-2"></i>Logout</a>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <main class="admin-main">
      <div class="admin-topbar">
        <div class="d-flex align-items-center gap-2">
          <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
          <div>
            <h4>${pageTitle}</h4>
            <small class="text-muted">${pageSubtitle || ''}</small>
          </div>
        </div>
        <div class="admin-top-right">
          <span class="admin-user-chip">
            <span class="avatar">${initials(user ? user.name : 'A')}</span>${escapeHtml(user ? user.name.split(' ')[0] : 'Admin')}
          </span>
        </div>
      </div>
      <div id="admin-page-content"></div>
    </main>`;

    document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
    document.getElementById('admin-logout').addEventListener('click', e => {
        e.preventDefault();
        Auth.clear();
        window.location.href = '/login.html';
    });

    return true;
}

function toggleSidebar() {
    const sb = document.getElementById('admin-sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.toggle('open');
    if (ov) ov.classList.toggle('show');
}

function closeSidebar() {
    const sb = document.getElementById('admin-sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('show');
}

function adminStatusBadge(status) {
    const label = String(status || '').replace(/_/g, ' ');
    return `<span class="badge-status ${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function spinnerHtml() {
    return `<div class="empty-box"><i class="fa-solid fa-circle-notch fa-spin"></i><div>Loading...</div></div>`;
}

function emptyBoxHtml(msg) {
    return `<div class="empty-box"><i class="fa-regular fa-folder-open"></i><div>${escapeHtml(msg || 'Nothing here yet')}</div></div>`;
}