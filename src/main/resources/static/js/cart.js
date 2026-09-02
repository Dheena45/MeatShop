/* FreshMeat — Cart page controller */

let cartData = null;
const DELIVERY_CHARGE = 40;
const FREE_DELIVERY_ABOVE = 499;

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;
    loadCart();
});

async function loadCart() {
    try {
        const res = await apiCall('/api/cart');
        cartData = res.data;
        renderCart(cartData);
    } catch (e) {
        if (e.status === 401) {
            window.location.href = '/login.html?redirect=%2Fcart.html';
            return;
        }
        document.getElementById('cart-loading').innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message)}</h6></div>`;
    }
}

function renderCart(cart) {
    const items = cart.items || [];
    document.getElementById('cart-loading').classList.add('d-none');
    document.getElementById('cart-content').classList.remove('d-none');

    const container = document.getElementById('cart-items');
    if (!items.length) {
        container.innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-basket-shopping"></i></div>
            <h6>Your cart is empty</h6>
            <p>Add some fresh cuts to get started.</p>
            <a href="/shop.html" class="btn btn-fm mt-2">Browse Products</a>
        </div>`;
        updateSummary(0, 0, 0);
        return;
    }

    container.innerHTML = items.map(item => {
        const eff = Number(item.effectiveUnitPrice || item.unitPrice);
        const discounted = Number(item.unitPrice) > eff;
        const outStock = !item.available || Number(item.availableStock) <= 0;
        const img = item.productImage || 'https://placehold.co/600x600/2d2d2d/f5f0e8?text=FreshMeat';
        return `
        <div class="cart-line" data-id="${item.id}">
          <a href="/product-details.html?id=${item.productId}">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(item.productName)}">
          </a>
          <div class="cl-info flex-grow-1">
            <h6><a href="/product-details.html?id=${item.productId}" class="text-dark">${escapeHtml(item.productName)}</a></h6>
            <div class="cl-meta">
              ${item.cuttingOption ? `<span class="badge text-bg-light me-2">${item.cuttingOption.replace(/_/g, ' ')}</span>` : ''}
              Rate: <strong>${fmtMoney(eff)}</strong>/KG
              ${discounted ? `<span class="text-muted text-decoration-line-through">${fmtMoney(item.unitPrice)}</span>` : ''}
            </div>
            ${outStock ? `<div class="text-danger small mt-1">Only ${item.availableStock} KG left — update quantity</div>` : ''}
          </div>
          <div class="d-flex flex-column align-items-end gap-2">
            <button class="cl-remove" onclick="removeItem(${item.id})" title="Remove"><i class="fa-solid fa-trash-can"></i></button>
            <div class="qty-stepper">
              <button onclick="changeQty(${item.id}, -1)"><i class="fa-solid fa-minus"></i></button>
              <input type="number" value="${item.quantity}" readonly>
              <button onclick="changeQty(${item.id}, 1)"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
          <div class="text-end" style="min-width:100px">
            <strong>${fmtMoney(item.subtotal)}</strong>
            <div class="text-muted small">${item.quantity} KG</div>
          </div>
        </div>`;
    }).join('');

    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const discount = items.reduce((s, i) =>
        s + (Number(i.unitPrice) - Number(i.effectiveUnitPrice || i.unitPrice)) * Number(i.quantity), 0);
    const delivery = subtotal === 0 ? 0 : (subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE);
    updateSummary(subtotal, discount, delivery);
}

function changeQty(itemId, delta) {
    const item = cartData.items.find(i => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    if (newQty > Number(item.availableStock)) {
        showToast('Only ' + item.availableStock + ' KG available', 'error');
        return;
    }
    updateCart(itemId, { quantity: newQty });
}

function updateCart(itemId, payload) {
    apiCall('/api/cart/items/' + itemId, { method: 'PUT', body: payload })
        .then(res => { cartData = res.data; renderCart(cartData); updateCartCount(); })
        .catch(err => showToast(err.message, 'error'));
}

function removeItem(itemId) {
    apiCall('/api/cart/items/' + itemId, { method: 'DELETE' })
        .then(res => { cartData = res.data; renderCart(cartData); updateCartCount(); showToast('Item removed'); })
        .catch(err => showToast(err.message, 'error'));
}

function clearCart() {
    if (!confirm('Are you sure you want to clear your cart?')) return;
    apiCall('/api/cart', { method: 'DELETE' })
        .then(() => { cartData = { items: [] }; renderCart(cartData); updateCartCount(); showToast('Cart cleared'); })
        .catch(err => showToast(err.message, 'error'));
}

function updateSummary(subtotal, discount, delivery) {
    document.getElementById('sum-items').textContent = cartData ? cartData.totalItems : 0;
    document.getElementById('sum-subtotal').textContent = fmtMoney(subtotal);
    document.getElementById('sum-discount').textContent = '- ' + fmtMoney(discount);
    document.getElementById('sum-delivery').textContent = delivery === 0 ? 'FREE' : fmtMoney(delivery);
    document.getElementById('sum-total').textContent = fmtMoney(subtotal + delivery);
}

function goCheckout() {
    if (!cartData || !cartData.items.length) { showToast('Your cart is empty', 'warning'); return; }
    window.location.href = '/checkout.html';
}