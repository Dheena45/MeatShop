/* ============================================================
   FRESHMEAT — Shared JS: API client, auth, toasts, utils
   ============================================================ */

const API_BASE = '';

const Auth = {
    getToken() { return localStorage.getItem('fm_token'); },
    getUser() {
        try { return JSON.parse(localStorage.getItem('fm_user')); }
        catch (e) { return null; }
    },
    isLoggedIn() { return !!this.getToken(); },
    isAdmin() {
        const u = this.getUser();
        return u && u.role === 'ADMIN';
    },
    isDeliveryBoy() {
        const u = this.getUser();
        return u && u.role === 'DELIVERY_BOY';
    },
    save(token, user) {
        localStorage.setItem('fm_token', token);
        localStorage.setItem('fm_user', JSON.stringify(user));
    },
    clear() {
        localStorage.removeItem('fm_token');
        localStorage.removeItem('fm_user');
    },
    requireLogin() {
        if (!this.isLoggedIn()) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return false;
        }
        return true;
    },
    requireAdmin() {
        if (!this.isLoggedIn() || !this.isAdmin()) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin/dashboard.html');
            return false;
        }
        return true;
    },
    /**
     * Delivery staff land on their own dashboard. This is only a UX redirect —
     * the real protection is Spring Security rejecting every non-delivery API
     * for a DELIVERY_BOY token.
     */
    requireDeliveryBoy() {
        if (!this.isLoggedIn()) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent('/delivery/dashboard.html');
            return false;
        }
        if (this.isAdmin()) {
            window.location.href = '/admin/dashboard.html';
            return false;
        }
        if (!this.isDeliveryBoy()) {
            window.location.href = '/';
            return false;
        }
        return true;
    }
};

async function apiCall(url, options = {}) {
    const method = options.method || 'GET';
    const headers = {};
    if (options.headers) Object.assign(headers, options.headers);

    const token = Auth.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(API_BASE + url, {
            method,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
    } catch (err) {
        throw { message: 'Network error. Is the server running?', status: 0 };
    }

    let data = null;
    try { data = await response.json(); } catch (e) { /* ignore */ }

    if (!response.ok) {
        const msg = (data && (data.message || data.error)) ? (data.message || data.error) : 'Request failed';
        throw { message: msg, status: response.status, data };
    }
    return data;
}

async function downloadFile(url, filename) {
    const token = Auth.getToken();
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const response = await fetch(API_BASE + url, { headers });
    if (!response.ok) {
        let message = 'Download failed';
        try {
            const d = await response.json();
            message = d.message || d.error || message;
        } catch (e) { /* ignore */ }
        throw { message, status: response.status };
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename || 'download.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const token = Auth.getToken();
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const response = await fetch(API_BASE + '/api/files/upload', {
        method: 'POST',
        headers,
        body: formData
    });
    const data = await response.json();
    if (!response.ok) throw { message: (data && data.message) || 'Upload failed' };
    return data.data.url;
}

function showToast(message, type = 'success', options = {}) {
    const opts = options || {};
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'fm-toast ' + type + (opts.title ? ' fm-toast-titled' : '');
    const iconMap = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };
    const icon = `<i class="fa-solid ${iconMap[type] || iconMap.info}"></i>`;
    const body = opts.title
        ? `<div class="fm-toast-body"><strong class="fm-toast-title">${escapeHtml(opts.title)}</strong><span>${escapeHtml(message)}</span></div>`
        : `<span>${escapeHtml(message)}</span>`;
    el.innerHTML = icon + body;
    container.appendChild(el);
    const timeout = opts.title ? (opts.duration || 6000) : (opts.duration || 3200);
    setTimeout(() => {
        el.style.transition = 'opacity .3s, transform .3s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(30px)';
        setTimeout(() => el.remove(), 300);
    }, timeout);
}

function fmtMoney(n) {
    const num = Number(n || 0);
    return '\u20B9' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------- Customer-facing order status (shared by the order list, the order
   details timeline and the profile's recent orders) ----------

   The customer sees exactly five milestones. The backend still uses
   READY_FOR_PICKUP as an internal handover status between PREPARING and
   OUT_FOR_DELIVERY, so it is mapped onto the Preparing step (preparation is
   finished, the order has not left the store yet) instead of being shown as a
   sixth stage of its own. The internal value itself is never displayed. */
const CUSTOMER_ORDER_STEPS = [
    { key: 'PLACED',         label: 'Order Placed' },
    { key: 'CONFIRMED',      label: 'Confirmed' },
    { key: 'PREPARING',      label: 'Preparing' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { key: 'DELIVERED',      label: 'Delivered' }
];

/** Internal order status -> the customer stage key it is shown as. */
const CUSTOMER_STATUS_STAGE = {
    PLACED: 'PLACED',
    CONFIRMED: 'CONFIRMED',
    PREPARING: 'PREPARING',
    READY_FOR_PICKUP: 'PREPARING',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED'
};

/** Customer stage index for an order status, or -1 for CANCELLED/unknown. */
function customerOrderStepIndex(status) {
    const stage = CUSTOMER_STATUS_STAGE[status];
    if (!stage) return -1;
    return CUSTOMER_ORDER_STEPS.findIndex(s => s.key === stage);
}

/** Human-readable status label, never leaking the internal status name. */
function customerOrderStatusLabel(status) {
    const idx = customerOrderStepIndex(status);
    return idx >= 0 ? CUSTOMER_ORDER_STEPS[idx].label : String(status || '').replace(/_/g, ' ');
}

/** Badge modifier class matching the displayed stage, for status-badge styling. */
function customerOrderStatusClass(status) {
    const stage = CUSTOMER_STATUS_STAGE[status];
    return stage || 'CANCELLED';
}

function fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateOnly(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function starsHtml(rating) {
    const r = Math.round(Number(rating || 0));
    let html = '<span class="stars">';
    for (let i = 1; i <= 5; i++) {
        html += i <= r
            ? '<i class="fa-solid fa-star"></i>'
            : '<i class="fa-solid fa-star empty-star"></i>';
    }
    html += '</span>';
    return html;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function debounce(fn, delay = 400) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

async function updateCartCount() {
    const badge = document.querySelectorAll('.cart-count-badge');
    const hasBar = typeof window.refreshCartBar === 'function';
    if (badge.length === 0 && !hasBar) return null;
    if (!Auth.isLoggedIn()) {
        badge.forEach(b => b.style.display = 'none');
        if (hasBar) window.refreshCartBar(null);
        return null;
    }
    try {
        const res = await apiCall('/api/cart');
        const count = res.data.totalItems || 0;
        badge.forEach(b => {
            b.textContent = count > 99 ? '99+' : count;
            b.style.display = count > 0 ? 'flex' : 'none';
        });
        if (hasBar) window.refreshCartBar(res.data);
        return res.data;
    } catch (e) {
        if (e.status === 401) Auth.clear();
        badge.forEach(b => b.style.display = 'none');
        if (hasBar) window.refreshCartBar(null);
        return null;
    }
}

function renderSharedHeader(active) {
    const header = document.getElementById('shared-header');
    if (!header) return;

    const user = Auth.getUser();
    const loggedIn = Auth.isLoggedIn();
    const isAdmin = loggedIn && Auth.isAdmin();

    const navLink = (href, label, key) => `
        <li class="nav-item">
            <a class="nav-link ${active === key ? 'active' : ''}" href="${href}">${label}</a>
        </li>`;

    let accountHtml = '';
    if (loggedIn) {
        const cartHtml = `
            <a class="nav-icon-btn" href="/cart.html" title="Cart">
              <i class="fa-solid fa-basket-shopping"></i>
              <span class="cart-count-badge" style="display:none">0</span>
            </a>`;
        const adminHtml = isAdmin
            ? `<a class="nav-icon-btn" href="/admin/dashboard.html" title="Admin Panel"><i class="fa-solid fa-gauge-high"></i></a>`
            : '';
        accountHtml = `
            ${cartHtml}
            ${adminHtml}
            <a class="user-chip" href="/profile.html"><span class="avatar">${initials(user.name)}</span>${escapeHtml(user.name.split(' ')[0])}</a>
            <a class="nav-icon-btn" href="#" id="logout-btn" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></a>`;
    } else {
        accountHtml = `
            <a class="btn btn-fm btn-sm rounded-pill px-3" href="/login.html" title="Login">
              <i class="fa-solid fa-right-to-bracket me-1"></i>Login
            </a>`;
    }

    header.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-fm">
      <div class="container">
        <a class="navbar-brand" href="/">Fresh<span class="dot">Meat</span></a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#fmNavbar">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="fmNavbar">
          <ul class="navbar-nav mx-auto">
            ${navLink('/', 'Home', 'home')}
            
          </ul>
          
          <div class="d-flex align-items-center gap-1 mt-2 mt-lg-0">
            ${accountHtml}
          </div>
        </div>
      </div>
    </nav>`;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.clear();
            showToast('Logged out successfully');
            updateCartCount();
            window.location.href = '/';
        });
    }

    updateCartCount();
}

function gotoSearch() {
    const q = document.getElementById('nav-search').value.trim();
    window.location.href = '/shop.html' + (q ? '?search=' + encodeURIComponent(q) : '');
}

async function renderSharedFooter() {
    const footer = document.getElementById('shared-footer');
    if (!footer) return;

    let cs = null;
    try {
        const res = await apiCall('/api/contact-settings');
        cs = res && res.data ? res.data : null;
    } catch (e) {
        cs = null;
    }

    const fallbackDescription = 'Fresh Cuts. Honest Prices. Delivered Fast. We bring premium quality meat, hygienically processed and delivered fresh to your doorstep.';
    const description = cs && cs.businessDescription ? cs.businessDescription : fallbackDescription;
    const address = cs && cs.address ? cs.address : '12, Meat Market Road, Chennai, Tamil Nadu 600001';
    const phone = cs && cs.phone ? cs.phone : '+91 98765 43210';
    const email = cs && cs.email ? cs.email : 'support@freshmeat.com';
    const hours = cs && cs.businessHours ? cs.businessHours : 'Mon–Sun, 6 AM – 9 PM';

    const socials = [
        { url: cs ? cs.facebookUrl : '', icon: 'fa-brands fa-facebook-f' },
        { url: cs ? cs.instagramUrl : '', icon: 'fa-brands fa-instagram' },
        { url: cs ? cs.twitterUrl : '', icon: 'fa-brands fa-x-twitter' },
        { url: cs ? cs.youtubeUrl : '', icon: 'fa-brands fa-youtube' }
    ].filter(s => s.url);
    const socialHtml = socials.length
        ? `<div class="social-icons mt-3">${socials.map(s => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener"><i class="${s.icon}"></i></a>`).join('')}</div>`
        : '';

    footer.innerHTML = `
      <footer class="footer-fm">
        <div class="container">
          <div class="row g-4 align-items-start footer-main">
            <div class="col-lg-7 col-md-12">
              <h5 class="fw-bold" style="font-family:var(--font-head);font-size:1.4rem;">Fresh<span style="color:var(--gold)">Meat</span></h5>
              <p class="mt-2" style="font-size:0.88rem;">${escapeHtml(description)}</p>
              ${socialHtml}
            </div>
            <div class="col-lg-5 col-md-12 footer-contact-col">
              <h5>Contact</h5>
              <ul class="list-unstyled f-contact">
                <li><i class="fa-solid fa-location-dot"></i><span>${escapeHtml(address)}</span></li>
                <li><i class="fa-solid fa-phone"></i><span>${escapeHtml(phone)}</span></li>
                <li><i class="fa-solid fa-envelope"></i><span>${escapeHtml(email)}</span></li>
                <li><i class="fa-solid fa-clock"></i><span>${escapeHtml(hours)}</span></li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom d-flex flex-wrap justify-content-between align-items-center">
            <span>&copy; ${new Date().getFullYear()} FreshMeat. All rights reserved.</span>
            <span>
              <a href="#">Terms &amp; Conditions</a> &nbsp;|&nbsp;
              <a href="#">Privacy Policy</a>
            </span>
          </div>
        </div>
      </footer>`;
}

document.addEventListener('DOMContentLoaded', function () {
    renderSharedHeader(getActiveNavKey());
    renderSharedFooter();
});

function getActiveNavKey() { return null; }

/* ---------- Shared product helpers ---------- */

function effectivePrice(p) {
    const price = Number(p.pricePerKg || 0);
    const disc = Number(p.discountPercent || 0);
    if (disc > 0) return price - (price * disc / 100);
    return price;
}

function productCardHtml(p) {
    const eff = effectivePrice(p);
    const disc = Number(p.discountPercent || 0);
    const outOfStock = !p.available || Number(p.stockQuantity) <= 0;
    const lowStock = !outOfStock && Number(p.stockQuantity) <= 8;
    const img = p.imageUrl || '/images/default-meat.jpg';

    let stockHtml;
    if (outOfStock) stockHtml = '<span class="out-stock"><i class="fa-solid fa-circle"></i> Out of Stock</span>';
    else if (lowStock) stockHtml = `<span class="low-stock"><i class="fa-solid fa-circle"></i> Only ${p.stockQuantity} ${p.unit || 'KG'} left</span>`;
    else stockHtml = '<span class="in-stock"><i class="fa-solid fa-circle"></i> In Stock</span>';

    return `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="card card-fm product-card">
        <div class="product-img">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy">
          <div class="product-badges">
            ${disc > 0 ? `<span class="badge-fm gold">${Math.round(disc)}% OFF</span>` : ''}
            ${p.freshToday ? '<span class="badge-fm green"><i class="fa-solid fa-leaf"></i> Fresh Today</span>' : ''}
            ${outOfStock ? '<span class="badge-fm dark">Out of Stock</span>' : ''}
          </div>
          <button class="quick-view-btn" onclick="openQuickView(${p.id})" title="Quick View"><i class="fa-solid fa-eye"></i></button>
        </div>
        <div class="product-body">
          <span class="cat-tag">${escapeHtml(p.categoryName || 'Premium')}</span>
          <h6 title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h6>
          <div>${starsHtml(p.avgRating)}<span class="rating-val">${(Number(p.avgRating)||0).toFixed(1)} (${p.reviewCount || 0})</span></div>
          <div class="price-row">
            <span class="price-now">${fmtMoney(eff)}</span>
            ${disc > 0 ? `<span class="price-was">${fmtMoney(p.pricePerKg)}</span>` : ''}
            <span class="price-off">/${escapeHtml((p.unit || 'KG').toUpperCase())}</span>
          </div>
          <div class="stock-inline">${stockHtml}</div>
          <div class="product-actions">
            <button class="btn btn-fm-outline" onclick="window.location.href='/product-details.html?id=${p.id}'">
              <i class="fa-regular fa-eye me-1"></i>Details</button>
            ${outOfStock
                ? '<button class="btn btn-fm" disabled><i class="fa-solid fa-cart-plus me-1"></i>Sold Out</button>'
                : `<button class="btn btn-fm" onclick="quickAddToCart(event, ${p.id})"><i class="fa-solid fa-cart-plus me-1"></i>Add</button>`}
          </div>
        </div>
      </div>
    </div>`;
}

async function quickAddToCart(event, productId) {
    event.preventDefault();
    event.stopPropagation();
    if (!Auth.requireLogin()) return;

    let cuttingOption;
    try {
        const detail = await apiCall('/api/products/' + productId);
        const options = detail.data.cuttingOptions || [];
        cuttingOption = options.length > 0 ? options[0] : undefined;
    } catch (e) {}

    try {
        const res = await apiCall('/api/cart/items', {
            method: 'POST',
            body: { productId, quantity: 1, cuttingOption }
        });
        showToast('Added to cart!');
        if (typeof window.refreshCartBar === 'function') {
            const cart = await updateCartCount();
            window.refreshCartBar(cart, { added: true });
        } else {
            updateCartCount();
        }
    } catch (err) {
        showToast(err.message || 'Could not add to cart', 'error');
    }
}

function openQuickView(id) {
    fetch('/api/products/' + id)
        .then(r => r.json())
        .then(res => {
            const p = res.data;
            const eff = effectivePrice(p);
            const disc = Number(p.discountPercent || 0);
            const outOfStock = !p.available || Number(p.stockQuantity) <= 0;
            const img = p.imageUrl || '/images/default-meat.jpg';

            document.getElementById('quick-view-body').innerHTML = `
            <div class="row g-0">
              <div class="col-md-5">
                <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;min-height:300px;object-fit:cover;border-radius:0;">
              </div>
              <div class="col-md-7">
                <div class="p-4">
                  <span class="pd-cat-tag">${escapeHtml(p.categoryName)}</span>
                  <h4 class="fw-bold mt-1">${escapeHtml(p.name)}</h4>
                  <div class="mb-2">${starsHtml(p.avgRating)}<span class="rating-val">${(Number(p.avgRating)||0).toFixed(1)} (${p.reviewCount||0} reviews)</span></div>
                  <p class="text-muted small">${escapeHtml(p.shortDescription || p.description || '')}</p>
                  <div class="price-row mb-3">
                    <span class="pd-price">${fmtMoney(eff)}</span>
                    ${disc > 0 ? `<span class="pd-price-was">${fmtMoney(p.pricePerKg)}</span><span class="pd-price-off">${Math.round(disc)}% OFF</span>` : ''}
                    <span class="ms-1 text-muted small">${'/' + (p.unit || 'KG').toUpperCase()}</span>
                  </div>
                  ${outOfStock
                    ? '<span class="badge-fm dark">Out of Stock</span>'
                    : `<span class="badge-fm green"><i class="fa-solid fa-circle"></i> ${p.stockQuantity > 8 ? 'In Stock' : 'Only ' + p.stockQuantity + ' ' + (p.unit || 'KG') + ' left'}</span>`}
                  <div class="d-flex gap-2 mt-4">
                    <button class="btn btn-fm-outline" onclick="window.location.href='/product-details.html?id=${p.id}';">
                      <i class="fa-regular fa-eye me-1"></i>Full Details</button>
                    ${outOfStock ? '' : `<button class="btn btn-fm" onclick="quickAddToCart(event, ${p.id})"><i class="fa-solid fa-cart-plus me-1"></i>Add to Cart</button>`}
                  </div>
                </div>
              </div>
            </div>`;

            new bootstrap.Modal(document.getElementById('quickViewModal')).show();
        })
        .catch(() => showToast('Could not load product', 'error'));
}