/* FreshMeat — Product details controller */

let currentProduct = null;
let selectedCutting = null;
let qty = 1;

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;
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
    const img = p.imageUrl || '/images/default-meat.jpg';

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
            <span class="text-muted">/ ${(p.unit || 'KG').toUpperCase()}</span>
            ${disc > 0 ? `<span class="pd-price-was">${fmtMoney(p.pricePerKg)}</span><span class="pd-price-off">${Math.round(disc)}% OFF</span>` : ''}
          </div>

          <div class="mb-3">
            ${outOfStock
                ? '<span class="badge-fm dark"><i class="fa-solid fa-circle"></i> Out of Stock</span>'
                : (lowStock
                    ? `<span class="badge-fm dark"><i class="fa-solid fa-circle"></i> Only ${p.stockQuantity} ${p.unit || 'KG'} left</span>`
                    : `<span class="badge-fm green" style="position:static;"><i class="fa-solid fa-circle"></i> In Stock — ${p.stockQuantity} ${p.unit || 'KG'} available</span>`)}
          </div>

          ${cuttingHtml ? `
          <div class="mb-3">
            <label class="form-label fw-semibold">Cutting Preference</label>
            <div class="cutting-options">${cuttingHtml}</div>
          </div>` : ''}

          <div class="d-flex align-items-center gap-3 mb-3">
            <label class="fw-semibold mb-0">Quantity (${(p.unit || 'KG').toUpperCase()})</label>
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
    </div>`;

    // set initial cutting
    if ((p.cuttingOptions || []).length) selectedCutting = p.cuttingOptions[0];
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
        showToast('Only ' + p.stockQuantity + ' ' + (p.unit || 'KG') + ' available in stock', 'error');
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