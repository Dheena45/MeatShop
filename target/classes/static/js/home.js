/* FreshMeat — Homepage controller */

function getActiveNavKey() { return 'home'; }

document.addEventListener('DOMContentLoaded', function () {
    loadCategories();
    loadBestSellers();
    loadOffers();
    loadPopular();
    loadReviews();
});

async function loadCategories() {
    const grid = document.getElementById('categories-grid');
    try {
        const res = await apiCall('/api/categories');
        const cats = res.data || [];
        if (!cats.length) {
            grid.innerHTML = emptyState('No categories yet');
            return;
        }
        grid.innerHTML = cats.map(c => `
            <div class="col-6 col-md-4 col-lg-3">
              <a href="/shop.html?category=${c.id}" class="text-decoration-none">
                <div class="card card-fm cat-card">
                  <div class="cat-icon"><i class="fa-solid fa-drumstick-bite"></i></div>
                  <h6>${escapeHtml(c.name)}</h6>
                  <small>Fresh ready-to-cook</small>
                </div>
              </a>
            </div>`).join('');
    } catch (e) {
        grid.innerHTML = emptyState('Could not load categories.<br><button class="btn btn-fm btn-sm mt-2" onclick="loadCategories()">Retry</button>');
    }
}

async function loadBestSellers() {
    const grid = document.getElementById('bestsellers-grid');
    try {
        const res = await apiCall('/api/products?sort=popularity&size=8');
        const list = res.data.content || [];
        if (!list.length) {
            grid.innerHTML = emptyState('Products coming soon');
            return;
        }
        grid.innerHTML = list.map(p => productCardHtml(p)).join('');
    } catch (e) {
        grid.innerHTML = emptyState('Could not load products.<br><button class="btn btn-fm btn-sm mt-2" onclick="loadBestSellers()">Retry</button>');
    }
}

async function loadOffers() {
    const grid = document.getElementById('offers-products');
    try {
        // Show fresh and discounted products as offers
        const res = await apiCall('/api/products?size=8&sort=popularity');
        const list = res.data.content || [];
        if (!list.length) {
            grid.innerHTML = emptyState('Check back soon for offers');
            return;
        }
        grid.innerHTML = list.map(p => productCardHtml(p)).join('');
    } catch (e) {
        grid.innerHTML = '';
    }
}

async function loadPopular() {
    const grid = document.getElementById('popular-grid');
    try {
        const res = await apiCall('/api/products/list/popular');
        const list = res.data || [];
        if (!list.length) {
            grid.innerHTML = '';
            return;
        }
        grid.innerHTML = list.map(p => productCardHtml(p)).join('');
    } catch (e) {
        grid.innerHTML = '';
    }
}

async function loadReviews() {
    const grid = document.getElementById('reviews-grid');
    const defaultReviews = [
        { userEmail: 'Priya S.', rating: 5, comment: 'The mutton was so fresh and the biryani cut was perfect. Delivery was on time!', createdAt: new Date().toISOString() },
        { userEmail: 'Rahul K.', rating: 4, comment: 'Great quality chicken, clean packing. Slightly late delivery but the product was excellent.', createdAt: new Date().toISOString() },
        { userEmail: 'Deepa R.', rating: 5, comment: 'Finally a meat shop I can trust. Hygienic, fresh and fair prices. Highly recommend!', createdAt: new Date().toISOString() }
    ];
    let reviews = defaultReviews;
    try {
        const res = await apiCall('/api/reviews/recent');
        if (res.data && res.data.length >= 3) reviews = res.data;
    } catch (e) { /* keep defaults */ }

    grid.innerHTML = reviews.slice(0, 3).map(r => `
        <div class="col-md-4">
          <div class="card card-fm testimonial-card">
            <span class="quote-mark">"</span>
            <div class="t-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <p>"${escapeHtml(r.comment)}"</p>
            <div class="t-user">
              <div class="avatar">${initials((r.userEmail || 'FR').split('@')[0])}</div>
              <div><strong>${escapeHtml((r.userEmail || 'FreshMeat User').split('@')[0])}</strong>
              <span>${r.createdAt ? fmtDateOnly(r.createdAt) : ''}</span></div>
            </div>
          </div>
        </div>`).join('');
}

function emptyState(msg) {
    return `<div class="col-12"><div class="empty-state"><div class="es-icon"><i class="fa-solid fa-store"></i></div><h6>${msg}</h6></div></div>`;
}