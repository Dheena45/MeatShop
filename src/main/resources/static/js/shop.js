/* FreshMeat — Shop page controller */

function getActiveNavKey() { return 'shop'; }

// Sticky bottom cart bar — refreshed from the existing /api/cart response.
// UpdateCartCount() in app.js calls this on every successful cart fetch, so the
// bar stays in sync with adds, the header badge, and page reloads.
window.refreshCartBar = function (cart, opts) {
    const bar = document.getElementById('cart-bar');
    if (!bar) return;
    const items = (cart && cart.items) || [];
    if (!cart || items.length === 0) {
        bar.style.display = 'none';
        document.body.classList.remove('has-cart-bar');
        return;
    }
    const count = Number(cart.totalItems || 0);
    const total = cart.grandTotal != null ? cart.grandTotal : (cart.subtotal || 0);
    const added = !!(opts && opts.added);
    const label = count + ' ' + (count === 1 ? 'item' : 'items') + (added ? ' added to cart' : ' in your cart');
    const countEl = document.getElementById('cart-bar-count');
    const totalEl = document.getElementById('cart-bar-total');
    if (countEl) countEl.textContent = label;
    if (totalEl) totalEl.textContent = 'Total: ' + fmtMoney(total);
    bar.style.display = 'block';
    document.body.classList.add('has-cart-bar');
};

const state = {
    page: 0,
    size: 12,
    totalPages: 0
};

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;
    const searchInput = document.getElementById('shop-search');
    searchInput.value = getUrlParam('search') || '';
    searchInput.addEventListener('input', debounce(() => {
        state.page = 0;
        applyFilters();
    }, 500));

    loadCategories();
    loadProducts();
});

function getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

async function loadCategories() {
    const container = document.getElementById('filter-categories');
    try {
        const res = await apiCall('/api/categories');
        const cats = res.data || [];
        const activeCat = getUrlParam('category');
        container.innerHTML = `
            <div class="form-check">
              <input class="form-check-input cat-filter" type="radio" name="catFilter" value="" id="cat-none" ${!activeCat ? 'checked' : ''}>
              <label class="form-check-label" for="cat-none">All Categories</label>
            </div>` +
            cats.map(c => `
            <div class="form-check">
              <input class="form-check-input cat-filter" type="radio" name="catFilter" value="${c.id}" id="cat-${c.id}" ${String(activeCat) === String(c.id) ? 'checked' : ''}>
              <label class="form-check-label" for="cat-${c.id}">${escapeHtml(c.name)}</label>
            </div>`).join('');

        document.querySelectorAll('.cat-filter').forEach(el => {
            el.addEventListener('change', () => { state.page = 0; applyFilters(); });
        });
    } catch (e) {
        container.innerHTML = '<span class="text-muted small">Could not load categories</span>';
    }
}

function buildParams() {
    const params = new URLSearchParams();
    const search = document.getElementById('shop-search').value.trim();
    if (search) params.set('search', search);

    const cat = document.querySelector('input[name="catFilter"]:checked');
    if (cat && cat.value) params.set('categoryId', cat.value);

    params.set('page', state.page);
    params.set('size', state.size);
    return params;
}

async function applyFilters() {
    state.page = 0;
    await loadProducts();
}

async function loadProducts() {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '<div class="col-12 text-center"><div class="loader-spinner"></div></div>';

    let url = '/api/products?' + buildParams().toString();
    try {
        const res = await apiCall(url);
        const data = res.data;
        state.totalPages = data.totalPages || 1;
        const list = data.content || [];

        document.getElementById('result-count').textContent = data.totalElements || list.length;

        if (!list.length) {
            grid.innerHTML = `<div class="col-12"><div class="empty-state">
                <div class="es-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
                <h6>No products found</h6>
                <p>Try adjusting your filters or search keywords.</p>
            </div></div>`;
        } else {
            grid.innerHTML = list.map(p => productCardHtml(p)).join('');
        }
        renderPagination();
    } catch (e) {
        grid.innerHTML = `<div class="col-12"><div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message || 'Error loading products')}</h6>
        </div></div>`;
    }
}

function pagerItems(current, totalPages) {
    const candidates = new Set([0, totalPages - 1, current - 1, current, current + 1]);
    const pages = [...candidates].filter(p => p >= 0 && p < totalPages).sort((a, b) => a - b);
    const items = [];
    let prev = -1;
    for (const p of pages) {
        if (prev !== -1 && p - prev > 1) items.push('...');
        items.push(p);
        prev = p;
    }
    return items;
}

function renderPagination() {
    const el = document.getElementById('shop-pagination');
    if (state.totalPages <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="page-btn prev" ${state.page === 0 ? 'disabled' : ''} onclick="goPage(${state.page - 1})" aria-label="Previous page">&#8249;</button>`;
    for (const item of pagerItems(state.page, state.totalPages)) {
        if (item === '...') {
            html += '<span class="page-dots">&#8230;</span>';
        } else {
            html += `<button class="page-btn${item === state.page ? ' active' : ''}" onclick="goPage(${item})">${item + 1}</button>`;
        }
    }
    html += `<button class="page-btn next" ${state.page >= state.totalPages - 1 ? 'disabled' : ''} onclick="goPage(${state.page + 1})" aria-label="Next page">&#8250;</button>`;
    el.innerHTML = html;
}

function goPage(page) {
    state.page = page;
    loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

