/* FreshMeat — Shop page controller */

function getActiveNavKey() { return 'shop'; }

const state = {
    page: 0,
    size: 12,
    totalPages: 0,
    sort: 'default'
};

document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('shop-search');
    searchInput.value = getUrlParam('search') || '';
    searchInput.addEventListener('input', debounce(() => {
        state.page = 0;
        applyFilters();
    }, 500));

    loadCategories();
    loadProducts();

    // update URL query string to reflect search for shareability
    const priceSlider = document.getElementById('price-slider');
    if (priceSlider) {
        priceSlider.addEventListener('input', () => {
            document.getElementById('max-price').value = priceSlider.value;
        });
    }
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

function buildRatingFilters() {
    const container = document.getElementById('rating-filters');
    [4, 3, 2, 0].forEach(r => {
        const label = r === 0 ? 'Any Rating' : `${r}+ ★`;
        container.innerHTML += `
            <div class="form-check">
              <input class="form-check-input rating-filter" type="radio" name="ratingFilter" value="${r}" ${r === 0 ? 'checked' : ''}>
              <label class="form-check-label" for="">${label}</label>
            </div>`;
    });
    document.querySelectorAll('.rating-filter').forEach(el => {
        el.addEventListener('change', () => { state.page = 0; applyFilters(); });
    });
}
buildRatingFilters();

function buildParams() {
    const params = new URLSearchParams();
    const search = document.getElementById('shop-search').value.trim();
    if (search) params.set('search', search);

    const cat = document.querySelector('input[name="catFilter"]:checked');
    if (cat && cat.value) params.set('categoryId', cat.value);

    const minPrice = document.getElementById('min-price').value;
    const maxPrice = document.getElementById('max-price').value;
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);

    const rating = document.querySelector('input[name="ratingFilter"]:checked');
    if (rating && rating.value && Number(rating.value) > 0) params.set('minRating', rating.value);

    const inStock = document.getElementById('in-stock').checked;
    if (inStock) params.set('inStock', 'true');

    const sort = document.getElementById('sort-select').value;
    if (sort && sort !== 'default') params.set('sort', sort);

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

function renderPagination() {
    const el = document.getElementById('shop-pagination');
    if (state.totalPages <= 1) { el.innerHTML = ''; return; }
    let html = `<button ${state.page === 0 ? 'disabled' : ''} onclick="goPage(${state.page - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    for (let i = 0; i < state.totalPages; i++) {
        if (i >= state.page - 2 && i <= state.page + 2) {
            html += `<button class="${i === state.page ? 'active' : ''}" onclick="goPage(${i})">${i + 1}</button>`;
        }
    }
    html += `<button ${state.page >= state.totalPages - 1 ? 'disabled' : ''} onclick="goPage(${state.page + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    el.innerHTML = html;
}

function goPage(page) {
    state.page = page;
    loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFilters() {
    document.getElementById('shop-search').value = '';
    document.querySelectorAll('input[name="catFilter"]').forEach(el => { el.checked = el.value === ''; });
    document.querySelectorAll('input[name="ratingFilter"]').forEach(el => { el.checked = Number(el.value) === 0; });
    document.getElementById('in-stock').checked = false;
    document.getElementById('min-price').value = '';
    document.getElementById('max-price').value = '';
    document.getElementById('price-slider').value = '1000';
    document.getElementById('sort-select').value = 'default';
    history.replaceState(null, '', '/shop.html');
    state.page = 0;
    loadProducts();
}

