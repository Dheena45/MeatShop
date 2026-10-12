/* ============================================================
   FRESHMEAT — Admin shared helpers (sidebar + topbar + guards)
   ============================================================ */

// Every admin page operates on the ADMIN session (freshmeat_admin_* keys),
// independent of any customer or delivery session in the same browser.
Auth.setRole('admin');

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

/* Filter order follows the required Admin Orders filter list exactly. PLACED now
   leads the list: every order is created PLACED and stays there until the store
   confirms it (COD) or the payment gateway confirms payment (online), so this
   is the queue where the admin picks up new orders to confirm. These are
   backend enum values sent as ?status=; the label is derived at render time. */
const ACTIVE_ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

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
      <div class="sidebar-scroll">
        <div class="sidebar-label">Main</div>
        <nav>
          ${mainLinks}
        </nav>
        <div class="sidebar-label">Settings</div>
        <nav>
          ${settingsLinks}
        </nav>
      </div>
      <div class="sidebar-footer">
        <a class="view-site" href="/"><i class="fa-solid fa-store me-2"></i>View Store</a>
        <a class="logout-btn mt-2" href="#" id="admin-logout"><i class="fa-solid fa-right-from-bracket me-2"></i>Logout</a>
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

    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        // The sidebar is rebuilt from innerHTML on every page, so guard against
        // a second initAdminPage call ever double-binding the handler.
        if (!logoutBtn.dataset.logoutBound) {
            logoutBtn.dataset.logoutBound = '1';
            logoutBtn.addEventListener('click', logoutAdmin);
        }
    }

    return true;
}

/**
 * Logout: clear the exact JWT/user keys the login flow writes (fm_token +
 * fm_user), then send the admin back to the login page in the same tab.
 *
 * Authentication is a stateless JWT (SessionCreationPolicy.STATELESS) — there
 * is no server session to invalidate. Dropping the client token is what makes
 * every /api/admin/** call fail 401 and every admin page redirect again via
 * Auth.requireAdmin(), so the old session can no longer be used.
 */
function logoutAdmin(e) {
    e.preventDefault();
    // Only the ADMIN keys are removed; customer/delivery sessions stay intact.
    Auth.clear();
    window.location.href = '/login.html?role=admin';
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

/* Weekday/weekend delivery-slot rules, mirrored from checkout.js so the
   assignment dropdown offers exactly the slots a customer could have picked.
   Weekday = Mon-Fri, weekend = Sat/Sun. Built with a local 'T00:00:00' string so
   no UTC timezone shift can move the date to the previous/next day. */
const FM_WEEKDAY_SLOTS = ['6 AM - 8 AM', '8 AM - 10 AM', '10 AM - 12 PM'];
const FM_WEEKEND_SLOTS = ['6 AM - 8 AM', '8 AM - 10 AM', '10 AM - 12 PM',
    '12 PM - 2 PM', '4 PM - 6 PM', '6 PM - 8 PM'];

function fmSlotsForDate(dateStr) {
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (isNaN(d.getTime())) return FM_WEEKDAY_SLOTS;
    return (day === 0 || day === 6) ? FM_WEEKEND_SLOTS : FM_WEEKDAY_SLOTS;
}

/** Today's date as a local yyyy-MM-dd string (no toISOString / UTC shift). */
function fmTodayInput() {
    const d = new Date();
    const p = x => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** Wires one date input to one slot dropdown and defaults it to today. */
function setupAssignSchedule(dateId, slotId) {
    const dateInput = document.getElementById(dateId);
    const slotSelect = document.getElementById(slotId);
    if (!dateInput || !slotSelect) return;
    const fill = () => {
        const slots = fmSlotsForDate(dateInput.value);
        slotSelect.innerHTML = slots.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    };
    dateInput.value = fmTodayInput();
    dateInput.min = fmTodayInput();
    dateInput.addEventListener('change', fill);
    fill();
}

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

    // The Delivery Boy is assigned while the parcel is still in the store
    // (CONFIRMED / PREPARING / READY_FOR_PICKUP). READY_FOR_PICKUP does not
    // require an assignment yet, so an unassigned ready order still surfaces the
    // assign button; the pickup action itself requires an active assignment.
    const assignable = o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY_FOR_PICKUP';
    const canAssign = assignable && !d.deliveryBoyId;
    const canReassign = assignable && !!d.deliveryBoyId;
    const isCancelled = o.status === 'CANCELLED';
    const needsBoy = canAssign;

    let assignControls = '';
    if (canAssign) {
        assignControls = `<button class="btn-admin" data-delivery-assign="${o.id}">
            <i class="fa-solid fa-user-plus me-1"></i>${needsBoy ? 'Assign Delivery Boy' : 'Assign'}</button>`;
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
                ${h.deliveryDate && h.deliverySlot ? ' &middot; for ' + escapeHtml(h.deliveryDate) + ' ' + escapeHtml(h.deliverySlot) : ''}
                ${h.startedAt ? ' &middot; Picked Up ' + fmtDate(h.startedAt) : ''}
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
            ${needsBoy ? '<div class="form-text mt-2 mb-0" style="font-size:0.78rem;color:#b45309;"><i class="fa-solid fa-circle-exclamation me-1"></i>Assign an active Delivery Boy (with a date + slot) so they can confirm the pickup.</div>' : ''}
           <div class="text-muted mt-2" style="font-size:0.76rem;">
             ${d.deliveryDate && d.deliverySlot
                ? '<div><i class="fa-solid fa-calendar-days me-1"></i>Scheduled: ' + escapeHtml(d.deliveryDate) + ' &middot; ' + escapeHtml(d.deliverySlot) + '</div>'
                : ''}
             ${d.assignedAt ? '<div><i class="fa-solid fa-user-check me-1"></i>Assigned: ' + fmtDate(d.assignedAt) + '</div>' : ''}
             ${d.startedAt ? '<div><i class="fa-solid fa-location-arrow me-1"></i>Picked Up: ' + fmtDate(d.startedAt) + '</div>' : ''}
             ${d.completedAt ? '<div><i class="fa-solid fa-circle-check me-1"></i>Delivered At: ' + fmtDate(d.completedAt) + '</div>' : ''}
             ${o.status === 'DELIVERED' && d.deliveryBoyName ? '<div><i class="fa-solid fa-award me-1"></i>Delivered By: ' + escapeHtml(d.deliveryBoyName) + '</div>' : ''}
           </div>`}
      ${history ? `<details class="mt-2"><summary style="cursor:pointer;font-size:0.78rem;font-weight:600;">Delivery history (${history.split('</li>').length - 1})</summary><ul class="mb-0 mt-2 ps-3">${history}</ul></details>` : ''}
    </div>`;
}

/**
 * Shared Order Details body used by both the admin Orders page and the admin
 * Delivery page, so one implementation renders the products (with cutting
 * option), the customer + address snapshot, the bill summary, the payment line
 * and the delivery/assignment block. `opts.paymentActions` adds the admin-only
 * Mark Received / Invoice / Print / PDF controls (Orders page only). It is
 * deliberately free of any page-specific state; callers set the modal title and
 * wire the [data-delivery-assign] / [data-delivery-reassign] buttons.
 */
function orderDetailSectionsHtml(o, opts) {
    opts = opts || {};

    const items = (o.items || []).map(i => `
              <tr>
                <td><strong class="small">${escapeHtml(i.productName)}</strong></td>
                <td>${i.quantity} KG</td>
                <td class="text-muted" style="font-size:0.78rem;">${escapeHtml((i.cuttingOption || '').replace(/_/g, ' '))}</td>
                <td>${fmtMoney(i.pricePerKg)}</td>
                <td class="text-end">${fmtMoney(i.subtotal)}</td>
              </tr>`).join('');

    const paymentActions = opts.paymentActions && o.status !== 'CANCELLED'
        ? `<div class="ms-auto d-flex flex-wrap gap-2">
              ${o.paymentMethod === 'CASH_ON_DELIVERY' && o.paymentStatus !== 'PAID'
                ? `<button class="btn-admin-outline" onclick="markPaymentReceived()" title="Mark cash as collected">
                     <i class="fa-solid fa-money-bill-wave me-1"></i>Mark Received</button>`
                : ''}
              <button class="btn-admin-outline" onclick="openInvoice()"><i class="fa-solid fa-file-invoice me-1"></i>View Invoice</button>
              <button class="btn-admin-outline" onclick="printBill()"><i class="fa-solid fa-print me-1"></i>Print Bill</button>
              <button class="btn-admin-outline" onclick="downloadInvoice()"><i class="fa-solid fa-download me-1"></i>PDF</button>
            </div>`
        : '';

    return `
    <table class="table table-fm align-middle">
      <thead><tr><th>Product</th><th>Qty</th><th>Cutting</th><th>Price/KG</th><th class="text-end">Subtotal</th></tr></thead>
      <tbody>${items}</tbody>
    </table>

    <div class="row g-2 mt-1">
      <div class="col-md-7">
        <label class="form-label">Customer</label>
        <p class="mb-1">${escapeHtml(o.customerName)} &nbsp; ${escapeHtml(o.customerPhone || '')}</p>
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
    </div>

    <div class="d-flex flex-wrap gap-2 align-items-center mt-3 pt-2 border-top" style="border-top-color:var(--bg-alt) !important;">
      <span style="font-size:0.78rem;font-weight:600;">Payment:</span>
      ${paymentBadgeHtml(o)}
      ${o.paymentStatus === 'PAID'
        ? `<span class="text-muted" style="font-size:0.75rem;">Paid ${fmtMoney(o.paidAmount || o.grandTotal)}${o.paidAt ? ' on ' + fmtDate(o.paidAt) : ''}</span>`
        : ''}
      ${o.transactionRef ? `<span class="text-muted" style="font-size:0.75rem;">Ref: ${escapeHtml(o.transactionRef)}</span>` : ''}
      ${paymentActions}
    </div>

    ${deliveryPanelHtml(o)}`;
}

function spinnerHtml() {
    return `<div class="empty-box"><i class="fa-solid fa-circle-notch fa-spin"></i><div>Loading...</div></div>`;
}

function emptyBoxHtml(msg) {
    return `<div class="empty-box"><i class="fa-regular fa-folder-open"></i><div>${escapeHtml(msg || 'Nothing here yet')}</div></div>`;
}