/* FreshMeat — Product details controller */

let currentProduct = null;
let selectedCutting = null;
let qty = 1;

document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        window.location.href = '/shop.html';
        return;
    }
    loadProduct(id);
});

async function loadProduct(id) {
    try {
        const res = await apiCall('/api/products/' + id);
        currentProduct = res.data;
        renderProduct(currentProduct);
        document.getElementById('product-loading').classList.add('d-none');
        document.getElementById('product-detail').classList.remove('d-none');
    } catch (e) {
        document.getElementById('product-loading').innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message || 'Product not found')}</h6>
            <a href="/shop.html" class="btn btn-fm mt-2">Back to Shop</a></div>`;
    }
}

function renderProduct(p) {
    const eff = Number(p.effectivePrice) || (Number(p.pricePerKg) - Number(p.pricePerKg) * Number(p.discountPercent) / 100);
    const disc = Number(p.discountPercent || 0);
    const outOfStock = !p.available || Number(p.stockQuantity) <= 0;
    const lowStock = !outOfStock && Number(p.stockQuantity) <= 8;
    const img = p.imageUrl || 'https://placehold.co/600x600/2d2d2d/f5f0e8?text=FreshMeat';

    document.getElementById('pd-breadcrumb-cat').textContent = p.categoryName || 'Product';

    const cuttingHtml = (p.cuttingOptions || []).map((opt, idx) =>
        `<button class="cutting-option ${idx === 0 ? 'selected' : ''}" onclick="selectCutting(this, '${opt}')">${opt.replace(/_/g, ' ')}</button>`).join('');

    document.getElementById('product-detail').innerHTML = `
    <div class="row g-5">
      <div class="col-lg-6">
        <div class="pd-gallery position-relative">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}">
          ${p.freshToday ? '<span class="badge-fm green position-absolute" style="top:16px;left:16px;"><i class="fa-solid fa-leaf"></i> Freshly Prepared Today</span>' : ''}
        </div>
      </div>
      <div class="col-lg-6">
        <div class="pd-info">
          <span class="pd-cat-tag">${escapeHtml(p.categoryName)}</span>
          <h1 class="fw-bold mt-1">${escapeHtml(p.name)}</h1>
          <div class="d-flex align-items-center gap-2 mb-3">
            ${starsHtml(p.avgRating)}
            <span class="rating-val">${(Number(p.avgRating)||0).toFixed(1)} (${p.reviewCount||0} reviews)</span>
          </div>
          <p class="text-muted">${escapeHtml(p.description || p.shortDescription || '')}</p>

          <div class="d-flex align-items-center gap-3 mb-3">
            <span class="pd-price">${fmtMoney(eff)}</span>
            <span class="text-muted">/ KG</span>
            ${disc > 0 ? `<span class="pd-price-was">${fmtMoney(p.pricePerKg)}</span><span class="pd-price-off">${Math.round(disc)}% OFF</span>` : ''}
          </div>

          <div class="mb-3">
            ${outOfStock
                ? '<span class="badge-fm dark"><i class="fa-solid fa-circle"></i> Out of Stock</span>'
                : (lowStock
                    ? `<span class="badge-fm dark"><i class="fa-solid fa-circle"></i> Only ${p.stockQuantity} KG left</span>`
                    : `<span class="badge-fm green" style="position:static;"><i class="fa-solid fa-circle"></i> In Stock — ${p.stockQuantity} KG available</span>`)}
          </div>

          ${cuttingHtml ? `
          <div class="mb-3">
            <label class="form-label fw-semibold">Cutting Preference</label>
            <div class="cutting-options">${cuttingHtml}</div>
          </div>` : ''}

          <div class="d-flex align-items-center gap-3 mb-3">
            <label class="fw-semibold mb-0">Quantity (KG)</label>
            <div class="qty-stepper">
              <button onclick="changeQty(-1)"><i class="fa-solid fa-minus"></i></button>
              <input id="qty-input" type="number" value="1" min="1" readonly>
              <button onclick="changeQty(1)"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>

          <div class="total-price-bar">
            <div>
              <small class="text-muted d-block">Total Price</small>
              <strong class="fs-5" id="total-price">${fmtMoney(eff * qty)}</strong>
            </div>
            <div class="d-flex gap-2">
              ${outOfStock ? '' : `
                <button class="btn btn-fm-outline" onclick="addToCart(false)"><i class="fa-solid fa-basket-shopping me-1"></i>Add to Cart</button>
                <button class="btn btn-fm" onclick="addToCart(true)"><i class="fa-solid fa-bolt me-1"></i>Buy Now</button>`}
            </div>
          </div>

          <div class="d-flex gap-4 flex-wrap mt-4 text-muted small">
            <span><i class="fa-solid fa-shield-halved text-gold me-1"></i>100% Fresh</span>
            <span><i class="fa-solid fa-droplet text-gold me-1"></i>Hygienically Processed</span>
            <span><i class="fa-solid fa-truck-fast text-gold me-1"></i>Fast Delivery</span>
          </div>
        </div>
      </div>
    </div>

    <hr class="my-5">

    <h3 class="fs-4 fw-bold mb-1">Customer Reviews</h3>
    <div id="reviews-section" class="row g-3 mt-1"></div>
    ${Auth.isLoggedIn() && !Auth.isAdmin() ? `
    <div class="card card-fm p-4 mt-4">
      <h5 style="font-family:var(--font-body);font-weight:600;">Write a Review</h5>
      <p class="text-muted small">You can review this product after delivery.</p>
      <div class="mb-2">
        <div class="rating-input d-flex gap-1 fs-4" id="rating-input" style="cursor:pointer;color:var(--gold)">
          <i data-v="1" class="fa-regular fa-star"></i><i data-v="2" class="fa-regular fa-star"></i>
          <i data-v="3" class="fa-regular fa-star"></i><i data-v="4" class="fa-regular fa-star"></i>
          <i data-v="5" class="fa-regular fa-star"></i>
        </div>
      </div>
      <textarea class="form-control form-control-fm mb-2" id="review-comment" rows="2" placeholder="Share your experience..."></textarea>
      <button class="btn btn-fm" style="width:auto" onclick="submitReview()">Submit Review</button>
    </div>` : ''}`;

    // set initial cutting
    if ((p.cuttingOptions || []).length) selectedCutting = p.cuttingOptions[0];
    renderReviews(p);
    updateTotal();
}

function selectCutting(el, option) {
    document.querySelectorAll('.cutting-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedCutting = option;
}

function changeQty(delta) {
    qty = Math.max(currentProduct.minOrderQty || 1, qty + delta);
    document.getElementById('qty-input').value = qty;
    updateTotal();
}

function updateTotal() {
    if (!currentProduct) return;
    const eff = Number(currentProduct.effectivePrice) || Number(currentProduct.pricePerKg);
    document.getElementById('total-price').textContent = fmtMoney(eff * qty);
}

async function addToCart(buyNow) {
    if (!Auth.requireLogin()) return;

    const p = currentProduct;
    if (qty > Number(p.stockQuantity)) {
        showToast('Only ' + p.stockQuantity + ' KG available in stock', 'error');
        return;
    }
    const payload = { productId: p.id, quantity: qty, cuttingOption: selectedCutting };

    try {
        await apiCall('/api/cart/items', { method: 'POST', body: payload });
        updateCartCount();
        showToast('Added to cart!');
        if (buyNow) window.location.href = '/checkout.html';
    } catch (e) {
        showToast(e.message || 'Failed to add to cart', 'error');
    }
}

/* ---- Reviews ---- */
function renderReviews(detail) {
    const section = document.getElementById('reviews-section');
    const reviews = detail.reviews || [];

    if (!reviews.length) {
        section.innerHTML = `<div class="col-12"><div class="empty-state">
            <div class="es-icon"><i class="fa-regular fa-star"></i></div>
            <h6>No reviews yet</h6><p>Be the first to review this product.</p>
        </div></div>`;
        return;
    }

    section.innerHTML = reviews.map(r => `
        <div class="col-md-6">
          <div class="card card-fm testimonial-card">
            <div class="t-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <p>"${escapeHtml(r.comment)}"</p>
            <div class="t-user">
              <div class="avatar">${initials((r.userEmail || 'U').split('@')[0])}</div>
              <div><strong>${escapeHtml((r.userEmail || 'FreshMeat User').split('@')[0])}</strong>
              <span>${r.createdAt ? fmtDate(r.createdAt) : ''}</span></div>
            </div>
          </div>
        </div>`).join('');

    // rating input handler
    const ratingInput = document.getElementById('rating-input');
    if (ratingInput) {
        let selectedRating = 0;
        document.querySelectorAll('#rating-input i').forEach(star => {
            star.addEventListener('mouseenter', () => {
                const v = Number(star.dataset.v);
                document.querySelectorAll('#rating-input i').forEach(s => {
                    s.className = Number(s.dataset.v) <= v ? 'fa-solid fa-star' : 'fa-regular fa-star';
                });
            });
            star.addEventListener('click', () => {
                selectedRating = Number(star.dataset.v);
                document.querySelectorAll('#rating-input i').forEach(s => {
                    s.className = Number(s.dataset.v) <= selectedRating ? 'fa-solid fa-star' : 'fa-regular fa-star';
                });
                window._selectedRating = selectedRating;
            });
        });
        ratingInput.addEventListener('mouseleave', () => {
            document.querySelectorAll('#rating-input i').forEach(s => {
                s.className = Number(s.dataset.v) <= (window._selectedRating || 0) ? 'fa-solid fa-star' : 'fa-regular fa-star';
            });
        });
    }
}

async function submitReview() {
    const rating = window._selectedRating || 0;
    if (!rating) { showToast('Please select a rating', 'warning'); return; }
    const comment = document.getElementById('review-comment').value.trim();
    if (!comment) { showToast('Please write a review', 'warning'); return; }

    try {
        await apiCall('/api/reviews', {
            method: 'POST',
            body: { productId: currentProduct.id, rating, comment }
        });
        showToast('Review submitted. Thank you!');
        setTimeout(() => loadProduct(currentProduct.id), 800);
    } catch (e) {
        showToast(e.message || 'Could not submit review', 'error');
    }
}