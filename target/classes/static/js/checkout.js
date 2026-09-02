/* FreshMeat — Checkout controller */

let selectedSlot = null;
let selectedPay = 'CASH_ON_DELIVERY';
let cartData = null;

const DELIVERY_CHARGE = 40;
const FREE_DELIVERY_ABOVE = 499;

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;
    loadCart();
    hydrateUserInfo();

    document.querySelectorAll('.slot-option').forEach(el => {
        el.addEventListener('click', () => selectSlot(el));
    });
    document.querySelectorAll('.pay-option').forEach(el => {
        el.addEventListener('click', () => selectPay(el));
    });
});

function hydrateUserInfo() {
    const user = Auth.getUser();
    if (!user) return;
    if (document.getElementById('co-name') && !document.getElementById('co-name').value) {
        document.getElementById('co-name').value = user.name || '';
    }
    if (document.getElementById('co-email') && !document.getElementById('co-email').value) {
        document.getElementById('co-email').value = user.email || '';
    }
}

async function loadCart() {
    try {
        const res = await apiCall('/api/cart');
        cartData = res.data;
        renderSummary(cartData);
        loadSavedAddresses();
    } catch (e) {
        document.getElementById('checkout-loading').innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h6>${escapeHtml(e.message)}</h6></div>`;
    }
}

function renderSummary(cart) {
    const items = cart.items || [];
    if (!items.length) {
        document.getElementById('checkout-content').innerHTML = `<div class="empty-state">
            <div class="es-icon"><i class="fa-solid fa-basket-shopping"></i></div>
            <h6>Your cart is empty</h6>
            <a href="/shop.html" class="btn btn-fm mt-2">Go to Shop</a></div>`;
        return;
    }

    document.getElementById('checkout-loading').classList.add('d-none');
    document.getElementById('checkout-content').classList.remove('d-none');

    document.getElementById('co-items').innerHTML = items.map(item => `
        <div class="d-flex justify-content-between align-items-center small mb-2">
          <span>${escapeHtml(item.productName.split(' ').slice(0,3).join(' '))} <span class="text-muted">× ${item.quantity} KG</span></span>
          <span>${fmtMoney(item.subtotal)}</span>
        </div>`).join('');

    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const discount = items.reduce((s, i) =>
        s + (Number(i.unitPrice) - Number(i.effectiveUnitPrice || i.unitPrice)) * Number(i.quantity), 0);
    const delivery = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE;

    document.getElementById('co-subtotal').textContent = fmtMoney(subtotal);
    document.getElementById('co-discount').textContent = '- ' + fmtMoney(discount);
    document.getElementById('co-delivery').textContent = delivery === 0 ? 'FREE' : fmtMoney(delivery);
    document.getElementById('co-total').textContent = fmtMoney(subtotal + delivery);
}

function selectSlot(el) {
    document.querySelectorAll('.slot-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedSlot = el.dataset.slot;
}

function selectPay(el) {
    document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedPay = el.dataset.pay;
}

async function loadSavedAddresses() {
    const container = document.getElementById('saved-addresses');
    if (!container) return;
    try {
        const res = await apiCall('/api/addresses');
        const addresses = (res.data || []).filter(a => a.doorNumber && a.city);
        if (!addresses.length) { container.innerHTML = ''; return; }

        container.innerHTML = `<div class="mb-3"><div class="small text-muted mb-1">Saved addresses:</div>
            <div class="d-flex flex-wrap gap-2">
            ${addresses.map((a, i) => `
                <button class="btn btn-sm btn-fm-outline" onclick="fillSavedAddress(${i})">
                  <i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(a.label || ('Address ' + (i + 1)))}
                </button>`).join('')}
            </div></div>`;
        window._savedAddresses = addresses;
    } catch (e) { /* no addresses */ }
}

function fillSavedAddress(idx) {
    const a = window._savedAddresses[idx];
    if (!a) return;
    document.getElementById('co-door').value = a.doorNumber || '';
    document.getElementById('co-street').value = a.street || '';
    document.getElementById('co-area').value = a.area || '';
    document.getElementById('co-city').value = a.city || '';
    document.getElementById('co-state').value = a.state || '';
    document.getElementById('co-pincode').value = a.pincode || '';
    showToast('Address filled');
}

function placeOrder() {
    const name = document.getElementById('co-name').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const email = document.getElementById('co-email').value.trim();
    const door = document.getElementById('co-door').value.trim();
    const street = document.getElementById('co-street').value.trim();
    const area = document.getElementById('co-area').value.trim();
    const city = document.getElementById('co-city').value.trim();
    const state = document.getElementById('co-state').value.trim();
    const pincode = document.getElementById('co-pincode').value.trim();
    const notes = document.getElementById('co-notes').value.trim();

    if (name.length < 2) { showToast('Please enter your full name', 'warning'); return; }
    if (!/^\d{10}$/.test(phone)) { showToast('Please enter a valid 10-digit mobile number', 'warning'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Please enter a valid email', 'warning'); return; }
    if (!door || !street || !area) { showToast('Please complete the delivery address', 'warning'); return; }
    if (!city) { showToast('Please enter city', 'warning'); return; }
    if (!/^\d{6}$/.test(pincode)) { showToast('Please enter a valid 6-digit pincode', 'warning'); return; }
    if (!selectedSlot) { showToast('Please select a delivery slot', 'warning'); return; }

    const btn = document.getElementById('place-order-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Placing Order...';

    const payload = {
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        deliveryDoor: door,
        deliveryStreet: street,
        deliveryArea: area,
        deliveryCity: city,
        deliveryState: state,
        deliveryPincode: pincode,
        deliverySlot: selectedSlot,
        paymentMethod: selectedPay,
        notes: notes || null
    };

    apiCall('/api/orders', { method: 'POST', body: payload })
        .then(res => {
            updateCartCount();
            showToast('Order placed successfully!');
            const orderNumber = res.data ? res.data.orderNumber : '';
            setTimeout(() => {
                window.location.href = '/order-tracking.html?id=' + res.data.id + (orderNumber ? '&no=' + encodeURIComponent(orderNumber) : '');
            }, 900);

            // save address if requested
            if (document.getElementById('co-save-address') && document.getElementById('co-save-address').checked) {
                const addrPayload = { doorNumber: door, street, area, city, state, pincode, label: 'Home', isDefault: false };
                apiCall('/api/addresses', { method: 'POST', body: addrPayload }).catch(() => {});
            }
        })
        .catch(err => {
            showToast(err.message || 'Order failed', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check me-1"></i>Place Order';
        });
}