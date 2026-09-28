/* ============================================================
   FRESHMEAT — Admin shared helpers (sidebar + topbar + guards)
   ============================================================ */

const ADMIN_MAIN_MENU = [
    { key: 'dashboard',  href: '/admin/dashboard.html',  icon: 'fa-solid fa-gauge-high',          label: 'Dashboard' },
    { key: 'orders',     href: '/admin/orders.html',     icon: 'fa-solid fa-receipt',              label: 'Orders' },
    { key: 'delivery',   href: '/admin/delivery.html',   icon: 'fa-solid fa-truck-fast',           label: 'Delivery' },
    { key: 'delivery-boys', href: '/admin/delivery-boys.html', icon: 'fa-solid fa-id-badge',       label: 'Delivery Boys' },
    { key: 'products',   href: '/admin/products.html',   icon: 'fa-solid fa-drumstick-bite',       label: 'Products' },
    { key: 'categories', href: '/admin/categories.html', icon: 'fa-solid fa-layer-group',           label: 'Categories' },
    { key: 'inventory',  href: '/admin/inventory.html',  icon: 'fa-solid fa-boxes-stacked',        label: 'Inventory' },
    { key: 'customers',  href: '/admin/customers.html',  icon: 'fa-solid fa-users',                label: 'Customers' },
    { key: 'reviews',    href: '/admin/reviews.html',    icon: 'fa-solid fa-star',                 label: 'Reviews' },
    { key: 'offers',     href: '/admin/offers.html',     icon: 'fa-solid fa-tags',                 label: 'Offers' },
    { key: 'contact-messages', href: '/admin/contact-messages.html', icon: 'fa-solid fa-envelope',  label: 'Messages' }
];

const ADMIN_SETTINGS_MENU = [
    { key: 'site-settings', href: '/admin/site-settings.html', icon: 'fa-solid fa-chart-simple', label: 'Site Settings' },
    { key: 'contact-settings', href: '/admin/contact-settings.html', icon: 'fa-solid fa-address-card', label: 'Contact Settings' }
];

/* Filter order follows the required Admin Orders filter list exactly. PLACED is
   intentionally absent: it is a pre-confirmation payment-pending state, not a
   fulfilment stage the admin filters on. These are backend enum values and are
   what gets sent as ?status=; the human-readable label is derived at render
   time by replacing '_' with ' '. */
const ACTIVE_ORDER_STATUSES = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

function menuLinkHtml(m, activeKey) {
    return `
        <a class="sidebar-link ${activeKey === m.key ? 'active' : ''}" href="${m.href}">
            <i class="${m.icon}"></i>${m.label}
        </a>`;
}

function initAdminPage(activeKey, pageTitle, pageSubtitle) {
    if (!Auth.requireAdmin()) return false;

    const user = Auth.getUser();
    const shell = document.getElementById('admin-shell');
    if (!shell) return false;

    const mainLinks = ADMIN_MAIN_MENU.map(m => menuLinkHtml(m, activeKey)).join('');
    const settingsLinks = ADMIN_SETTINGS_MENU.map(m => menuLinkHtml(m, activeKey)).join('');

    shell.innerHTML = `
    <aside class="admin-sidebar" id="admin-sidebar">
      <a class="sidebar-brand" href="/admin/dashboard.html">Fresh<span class="dot">Meat</span></a>
      <div class="sidebar-label">Main</div>
      <nav>
        ${mainLinks}
      </nav>
      <div class="sidebar-label">Settings</div>
      <nav>
        ${settingsLinks}
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

/* ---------- Delivery helpers (shared by the Orders and Delivery pages) ---------- */

const DELIVERY_STATE_LABELS = {
    PENDING_ASSIGNMENT: 'Pending Assignment',
    ASSIGNED: 'Assigned',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED: 'Delivered'
};

function deliveryStateBadge(state) {
    const key = state || 'PENDING_ASSIGNMENT';
    return `<span class="badge-status ${key}">${escapeHtml(DELIVERY_STATE_LABELS[key] || key.replace(/_/g, ' '))}</span>`;
}

/** Payment status pill. Payment status is always shown separately from order status. */
function paymentBadgeHtml(o) {
    const map = {
        PAID: 'background:#e7f6ec;color:#047857;',
        CANCELLED: 'background:#fee2e2;color:#b91c1c;',
        FAILED: 'background:#fee2e2;color:#b91c1c;',
        PENDING: 'background:#fff4e0;color:#b45309;'
    };
    const key = (o.paymentStatus || 'PENDING');
    return `<span class="badge" style="${map[key] || map.PENDING}font-size:0.7rem;font-weight:600;text-transform:uppercase;">${escapeHtml(key)}</span>`;
}

/** Payment cell: "ONLINE / PAID" style, as required by the Delivery page. */
function paymentCellHtml(o) {
    return `<div style="font-size:0.78rem;">${escapeHtml((o.paymentMethod || '-').replace(/_/g, ' '))}</div>
            <div class="mt-1">${paymentBadgeHtml(o)}</div>`;
}

/** Compact one-line delivery address taken from the snapshot stored on the order. */
function addressOneLine(o) {
    return [o.deliveryDoor, o.deliveryStreet, o.deliveryArea, o.deliveryCity, o.deliveryPincode]
        .filter(Boolean).join(', ') || '-';
}

function addressBlockHtml(o) {
    const line1 = [o.deliveryDoor, o.deliveryStreet, o.deliveryArea].filter(Boolean).join(', ');
    const line2 = [o.deliveryCity, o.deliveryPincode].filter(Boolean).join(' - ');
    return `${escapeHtml(line1 || '-')}${line2 ? '<br>' + escapeHtml(line2) + (o.deliveryState ? ', ' + escapeHtml(o.deliveryState) : '') : ''}`;
}

/**
 * Delivery block for the admin order modal. Shows the assignment, the delivery
 * timestamps and the full handover history so nothing about a past delivery is
 * lost — including after the delivery boy has been deactivated.
 */
function deliveryPanelHtml(o) {
    const d = o.delivery;
    if (!d) return '';

    // The Delivery Boy is confirmed on a CONFIRMED order, and that is what
    // unlocks CONFIRMED -> PREPARING. PREPARING stays assignable/reassignable
    // because the parcel has not left the store yet.
    const assignable = o.status === 'CONFIRMED' || o.status === 'PREPARING';
    const canAssign = assignable && !d.deliveryBoyId;
    const canReassign = assignable && !!d.deliveryBoyId;
    const isCancelled = o.status === 'CANCELLED';
    const needsBoy = o.status === 'CONFIRMED' && !d.deliveryBoyId;

    let assignControls = '';
    if (canAssign) {
        assignControls = `<button class="btn-admin" data-delivery-assign="${o.id}">
            <i class="fa-solid fa-user-plus me-1"></i>${needsBoy ? 'Confirm Delivery Boy' : 'Assign'}</button>`;
    } else if (canReassign) {
        assignControls = `<button class="btn-admin-outline" data-delivery-reassign="${o.id}">
            <i class="fa-solid fa-user-clock me-1"></i>Reassign</button>`;
    }

    const history = (d.history || []).slice().reverse().map(h => `
        <li class="mb-1">
            <strong>${escapeHtml(h.deliveryBoyName || '-')}</strong>
            <span class="badge-status ${h.status === 'COMPLETED' ? 'DELIVERED' : (h.status === 'REASSIGNED' ? 'CANCELLED' : 'CONFIRMED')}"
                  style="font-size:0.62rem;">${escapeHtml(String(h.status || '').replace(/_/g, ' '))}</span>
            <div class="text-muted" style="font-size:0.72rem;">
                Assigned ${fmtDate(h.assignedAt)}
                ${h.startedAt ? ' &middot; Started ' + fmtDate(h.startedAt) : ''}
                ${h.completedAt ? ' &middot; Delivered ' + fmtDate(h.completedAt) : ''}
                ${h.assignedBy ? ' &middot; by ' + escapeHtml(h.assignedBy) : ''}
            </div>
        </li>`).join('');

    return `
    <div class="mt-3 pt-3 border-top">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <label class="form-label mb-0"><i class="fa-solid fa-truck-fast me-1"></i>Delivery Boy</label>
        ${deliveryStateBadge(d.state)}
      </div>
      ${isCancelled
        ? '<p class="text-muted mb-0" style="font-size:0.82rem;">This order was cancelled, so it is not part of delivery management.</p>'
        : `<div class="d-flex flex-wrap gap-2 align-items-center">
             <div style="font-size:0.9rem;min-width:180px;">
               ${d.deliveryBoyName
                 ? '<strong>' + escapeHtml(d.deliveryBoyName) + '</strong>' + (d.deliveryBoyPhone ? ' <span class="text-muted" style="font-size:0.78rem;">' + escapeHtml(d.deliveryBoyPhone) + '</span>' : '')
                 : '<span class="text-muted">Not assigned yet</span>'}
             </div>
             ${assignControls}
           </div>
            ${needsBoy ? '<div class="form-text mt-2 mb-0" style="font-size:0.78rem;color:#b45309;"><i class="fa-solid fa-circle-exclamation me-1"></i>Confirm a Delivery Boy to start preparation.</div>' : ''}
           <div class="text-muted mt-2" style="font-size:0.76rem;">
             ${d.assignedAt ? '<div><i class="fa-solid fa-user-check me-1"></i>Assigned: ' + fmtDate(d.assignedAt) + '</div>' : ''}
             ${d.startedAt ? '<div><i class="fa-solid fa-location-arrow me-1"></i>Started Delivery: ' + fmtDate(d.startedAt) + '</div>' : ''}
             ${d.completedAt ? '<div><i class="fa-solid fa-circle-check me-1"></i>Delivered At: ' + fmtDate(d.completedAt) + '</div>' : ''}
             ${o.status === 'DELIVERED' && d.deliveryBoyName ? '<div><i class="fa-solid fa-award me-1"></i>Delivered By: ' + escapeHtml(d.deliveryBoyName) + '</div>' : ''}
           </div>`}
      ${history ? `<details class="mt-2"><summary style="cursor:pointer;font-size:0.78rem;font-weight:600;">Delivery history (${history.split('</li>').length - 1})</summary><ul class="mb-0 mt-2 ps-3">${history}</ul></details>` : ''}
    </div>`;
}

function spinnerHtml() {
    return `<div class="empty-box"><i class="fa-solid fa-circle-notch fa-spin"></i><div>Loading...</div></div>`;
}

function emptyBoxHtml(msg) {
    return `<div class="empty-box"><i class="fa-regular fa-folder-open"></i><div>${escapeHtml(msg || 'Nothing here yet')}</div></div>`;
}