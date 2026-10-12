/* FreshMeat — Checkout controller */

const WEEKDAY_DELIVERY_SLOTS = [
    '6 AM - 8 AM',
    '8 AM - 10 AM',
    '10 AM - 12 PM'
];

const WEEKEND_DELIVERY_SLOTS = [
    '6 AM - 8 AM',
    '8 AM - 10 AM',
    '10 AM - 12 PM',
    '12 PM - 2 PM',
    '4 PM - 6 PM',
    '6 PM - 8 PM'
];

let selectedSlot = null;
let selectedPay = 'CASH_ON_DELIVERY';
let cartData = null;

/* Saved-address state. selectedAddressId is the saved address currently in use
   for this order; editingAddressId is the one being explicitly edited (null
   while adding a new address). */
let savedAddresses = [];
let selectedAddressId = null;
let editingAddressId = null;
let addressEditorMode = 'idle'; // 'idle' | 'new' | 'edit'

document.addEventListener('DOMContentLoaded', function () {
    if (!Auth.requireLogin()) return;

    renderDeliverySlots();
    wireFieldInputs();

    document.querySelectorAll('.pay-option').forEach(el => {
        el.addEventListener('click', () => selectPay(el));
    });

    loadCheckout();
});

async function loadCheckout() {
    // The profile and cart can load in parallel; both self-handle their errors.
    await Promise.allSettled([loadCustomerProfile(), loadCart()]);

    // The address step only exists when the cart has items (renderSummary swaps
    // the whole panel out for the empty-cart state otherwise).
    if (document.getElementById('co-door')) {
        await loadSavedAddresses();
    }
}

function deliverySlotsForDay(day) {
    return (day === 0 || day === 6) ? WEEKEND_DELIVERY_SLOTS : WEEKDAY_DELIVERY_SLOTS;
}

function slotLabel(slot) {
    return slot.replace(/ - /g, ' \u2013 ');
}

function renderDeliverySlots() {
    const container = document.getElementById('delivery-slots');
    if (!container) return;
    const today = new Date();
    const slots = deliverySlotsForDay(today.getDay());
    container.innerHTML = slots.map(slot => `
        <div class="col-6 col-md-4"><div class="slot-option" data-slot="${slot}">${slotLabel(slot)}</div></div>
    `).join('');
    document.querySelectorAll('.slot-option').forEach(el => {
        el.addEventListener('click', () => selectSlot(el));
    });
}

/* ---------------- Customer information ---------------- */

async function loadCustomerProfile() {
    const cached = Auth.getUser() || {};

    // Seed immediately from the cached user so the form is never blank while
    // the request is in flight.
    setFieldValue('co-name', cached.name || '');
    setFieldValue('co-email', cached.email || '');
    setFieldValue('co-phone', cached.phone || '');

    try {
        const res = await apiCall('/api/profile');
        const p = res.data || {};
        setFieldValue('co-name', p.name || '');
        setFieldValue('co-phone', p.phone || '');
        setFieldValue('co-email', p.email || '');

        // Keep the cached user in sync with the database values.
        Auth.save(Auth.getToken(), {
            id: p.id != null ? p.id : cached.id,
            name: p.name || cached.name,
            email: p.email || cached.email,
            phone: p.phone || cached.phone,
            role: p.role || cached.role
        });
    } catch (e) {
        if (e.status === 401) { handleAuthExpired(); return; }
        setFieldValue('co-phone', cached.phone || '');
        showToast('Could not load your saved details. Please check them before ordering.', 'warning');
    }
}

/* ---------------- Cart summary ---------------- */

async function loadCart() {
    try {
        const res = await apiCall('/api/cart');
        cartData = res.data;
        renderSummary(cartData);
    } catch (e) {
        if (e.status === 401) { handleAuthExpired(); return; }
        const loading = document.getElementById('checkout-loading');
        if (loading) {
            loading.innerHTML = `<div class="empty-state">
                <div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <h6>${escapeHtml(e.message)}</h6></div>`;
        }
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

    const discount = Number(cart.discount || 0);
    const deliveryCharge = Number(cart.deliveryCharge || 0);

    document.getElementById('co-subtotal').textContent = fmtMoney(cart.subtotal);
    document.getElementById('co-discount').textContent = '- ' + fmtMoney(discount);
    document.getElementById('co-delivery').textContent = deliveryCharge > 0 ? fmtMoney(deliveryCharge) : 'FREE';
    document.getElementById('co-total').textContent = fmtMoney(cart.grandTotal);
}

/* ---------------- Saved addresses ---------------- */

async function loadSavedAddresses(preferredId) {
    const container = document.getElementById('saved-addresses');
    const loading = document.getElementById('address-loading');
    if (!container) return;

    try {
        const res = await apiCall('/api/addresses');
        savedAddresses = (res.data || []).filter(a => a && a.city && a.pincode);
        if (loading) loading.classList.add('d-none');

        if (!savedAddresses.length) {
            selectedAddressId = null;
            editingAddressId = null;
            addressEditorMode = 'idle';
            renderAddressSection();
            return;
        }

        let id = preferredId;
        if (id == null) {
            const def = savedAddresses.find(a => a.isDefault);
            if (def) id = def.id;
            else if (savedAddresses.length === 1) id = savedAddresses[0].id;
        }

        if (id != null && savedAddresses.some(a => a.id === id)) {
            selectSavedAddress(id, true);
        } else {
            selectedAddressId = null;
            editingAddressId = null;
            addressEditorMode = 'idle';
            renderAddressSection();
        }
    } catch (e) {
        if (e.status === 401) { handleAuthExpired(); return; }
        if (loading) loading.classList.add('d-none');
        container.innerHTML = `<div class="text-muted small">${escapeHtml(e.message || 'Could not load saved addresses')}</div>`;
    }
}

function renderAddressSection() {
    const list = document.getElementById('saved-addresses');
    if (list) {
        if (!savedAddresses.length) {
            list.innerHTML = '';
        } else {
            list.innerHTML = savedAddresses.map(a => {
                const selected = a.id === selectedAddressId;
                return `
                <div class="saved-address-card ${selected ? 'selected' : ''}" onclick="selectSavedAddress(${a.id})">
                    <div class="saved-address-info">
                        <div><strong>${escapeHtml(a.label || ('Address ' + a.id))}</strong>
                            ${a.isDefault ? '<span class="default-badge">Default</span>' : ''}
                            ${selected && !a.isDefault ? '<span class="default-badge selected-badge">Selected</span>' : ''}
                        </div>
                        <div class="saved-address-meta">${escapeHtml(addressLine(a))}</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-link text-decoration-none"
                            onclick="event.stopPropagation();editSelectedAddress(${a.id})">
                        <i class="fa-solid fa-pen"></i> Edit</button>
                </div>`;
            }).join('');
        }
    }

    const editorActions = document.getElementById('address-editor-actions');
    const editBtn = document.getElementById('addr-edit-btn');
    const saveLabel = document.getElementById('addr-save-label');
    const editing = addressEditorMode === 'edit';
    if (editorActions) editorActions.classList.toggle('d-none', addressEditorMode === 'idle');
    if (saveLabel) saveLabel.textContent = editing ? 'Update Address' : 'Save Address';
    if (editBtn) editBtn.classList.toggle('d-none', !(selectedAddressId != null && addressEditorMode === 'idle'));
}

function selectSavedAddress(id, fill = true) {
    const a = savedAddresses.find(x => x.id === id);
    if (!a) return;
    selectedAddressId = a.id;
    editingAddressId = null;
    addressEditorMode = 'idle';
    if (fill) fillAddressFields(a);
    renderAddressSection();
}

function addNewAddress() {
    selectedAddressId = null;
    editingAddressId = null;
    addressEditorMode = 'new';
    clearAddressFields();
    renderAddressSection();
    const door = document.getElementById('co-door');
    if (door) door.focus();
}

function editSelectedAddress(id) {
    const targetId = id != null ? id : selectedAddressId;
    const a = savedAddresses.find(x => x.id === targetId);
    if (!a) { addNewAddress(); return; }
    selectedAddressId = a.id;
    editingAddressId = a.id;
    addressEditorMode = 'edit';
    fillAddressFields(a);
    renderAddressSection();
    const door = document.getElementById('co-door');
    if (door) door.focus();
}

function cancelAddressEdit() {
    editingAddressId = null;
    addressEditorMode = 'idle';
    if (selectedAddressId != null) {
        const a = savedAddresses.find(x => x.id === selectedAddressId);
        if (a) fillAddressFields(a);
    }
    renderAddressSection();
}

async function saveAddress() {
    const fields = readAddressFields();
    const validation = validateAddressFields(fields);
    if (validation) { showToast(validation, 'warning'); return; }

    const editing = editingAddressId != null;
    const existing = editing ? savedAddresses.find(a => a.id === editingAddressId) : null;
    const payload = {
        ...fields,
        label: (existing && existing.label) ? existing.label : 'Home',
        isDefault: existing ? Boolean(existing.isDefault) : savedAddresses.length === 0
    };

    const saveBtn = document.getElementById('addr-save-btn');
    if (saveBtn) saveBtn.disabled = true;
    try {
        let saved;
        if (editing) {
            const res = await apiCall('/api/addresses/' + editingAddressId, { method: 'PUT', body: payload });
            saved = res.data;
            showToast('Address updated');
        } else {
            const res = await apiCall('/api/addresses', { method: 'POST', body: payload });
            saved = res.data;
            showToast('Address saved');
        }
        editingAddressId = null;
        addressEditorMode = 'idle';
        await loadSavedAddresses(saved && saved.id != null ? saved.id : selectedAddressId);
    } catch (e) {
        if (e.status === 401) { handleAuthExpired(); return; }
        showToast(e.message || 'Could not save the address', 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

/* Reuses an existing saved address for the order. Only creates a new row when
   the customer asked to save an address that is not already stored. */
async function persistAddressAfterOrder(address) {
    const checkbox = document.getElementById('co-save-address');
    if (!checkbox || !checkbox.checked) return;
    if (editingAddressId != null) return; // edits are saved explicitly, never by placing an order
    if (savedAddresses.some(a => matchesSavedAddress(address, a))) return;

    try {
        await apiCall('/api/addresses', {
            method: 'POST',
            body: { ...address, label: 'Home', isDefault: savedAddresses.length === 0 }
        });
    } catch (e) {
        // The order is already placed — never surface a secondary address error.
    }
}

/* ---------------- Delivery slot / payment ---------------- */

function selectSlot(el) {
    document.querySelectorAll('.slot-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedSlot = el.dataset.slot;
}

function selectPay(el) {
    document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedPay = el.dataset.pay;

    const isOnline = selectedPay === 'ONLINE';
    const icon = document.getElementById('co-pay-note-icon');
    const text = document.getElementById('co-pay-note-text');
    if (icon) {
        icon.className = isOnline
            ? 'fa-solid fa-mobile-screen-button me-1'
            : 'fa-solid fa-hand-holding-dollar me-1';
    }
    if (text) {
        text.textContent = isOnline ? 'UPI / Online Payment' : 'Cash on Delivery';
    }
}

/* ---------------- Order placement ---------------- */

async function placeOrder() {
    const btn = document.getElementById('place-order-btn');
    if (!btn || btn.disabled || window._placingOrder) return;

    const name = getFieldValue('co-name');
    const phone = getFieldValue('co-phone');
    const email = getFieldValue('co-email');
    const address = readAddressFields();
    const notes = getFieldValue('co-notes');

    if (name.length < 2) { showToast('Please enter your full name', 'warning'); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) {
        showToast('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.', 'warning'); return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Please enter a valid email', 'warning'); return; }

    const addressError = validateAddressFields(address);
    if (addressError) { showToast(addressError, 'warning'); return; }
    if (!selectedSlot) { showToast('Please select a delivery slot', 'warning'); return; }

    window._placingOrder = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Placing Order...';

    const payload = {
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        deliveryDoor: address.doorNumber,
        deliveryStreet: address.street,
        deliveryArea: address.area,
        deliveryCity: address.city,
        deliveryState: address.state,
        deliveryPincode: address.pincode,
        deliverySlot: selectedSlot,
        paymentMethod: selectedPay,
        notes: notes || null
    };

    try {
        const res = await apiCall('/api/orders', { method: 'POST', body: payload });
        updateCartCount();
        await persistAddressAfterOrder(address);

        const order = res.data || {};
        const orderNumber = order.orderNumber || '';

        if (selectedPay === 'ONLINE') {
            // The order is created but NOT confirmed — it stays in PLACED
            // (payment PENDING) until the customer completes the UPI payment.
            showToast('Order placed. Complete the UPI payment to confirm it.', 'info', { title: 'Payment Required' });
            setTimeout(() => {
                window.location.href = '/payment.html?order=' + order.id +
                    (orderNumber ? '&no=' + encodeURIComponent(orderNumber) : '');
            }, 900);
        } else {
            // COD orders are placed now and confirmed by the store; the admin
            // confirms them before the delivery is prepared.
            showToast('Your order has been placed. The store will confirm it soon.', 'success', { title: 'Order Placed' });
            setTimeout(() => {
                window.location.href = '/order-tracking.html?id=' + order.id +
                    (orderNumber ? '&no=' + encodeURIComponent(orderNumber) : '');
            }, 900);
        }
    } catch (err) {
        if (err.status === 401) { handleAuthExpired(); return; }
        showToast(err.message || 'Order failed', 'error');
        btn.disabled = false;
        window._placingOrder = false;
        btn.innerHTML = '<i class="fa-solid fa-check me-1"></i>Place Order';
    }
}

/* ---------------- Helpers ---------------- */

function validateAddressFields(f) {
    if (!f.doorNumber) return 'Please enter the door / house number';
    if (!f.street) return 'Please enter the street';
    if (!f.area) return 'Please enter the area / locality';
    if (!f.city) return 'Please enter the city';
    if (!f.state) return 'Please enter the state';
    if (!/^\d{6}$/.test(f.pincode)) return 'Please enter a valid 6-digit pincode';
    return '';
}

function matchesSavedAddress(fields, a) {
    const norm = v => (v == null ? '' : String(v).trim().toLowerCase());
    return norm(a.doorNumber) === norm(fields.doorNumber)
        && norm(a.street) === norm(fields.street)
        && norm(a.area) === norm(fields.area)
        && norm(a.city) === norm(fields.city)
        && norm(a.state) === norm(fields.state)
        && norm(a.pincode) === norm(fields.pincode);
}

function addressLine(a) {
    return [a.doorNumber, a.street, a.area, a.city, a.state, a.pincode]
        .filter(v => v != null && String(v).trim() !== '')
        .join(', ');
}

function readAddressFields() {
    return {
        doorNumber: getFieldValue('co-door'),
        street: getFieldValue('co-street'),
        area: getFieldValue('co-area'),
        city: getFieldValue('co-city'),
        state: getFieldValue('co-state'),
        pincode: getFieldValue('co-pincode')
    };
}

function fillAddressFields(a) {
    setFieldValue('co-door', a.doorNumber || '');
    setFieldValue('co-street', a.street || '');
    setFieldValue('co-area', a.area || '');
    setFieldValue('co-city', a.city || '');
    setFieldValue('co-state', a.state || '');
    setFieldValue('co-pincode', a.pincode || '');
}

function clearAddressFields() {
    ['co-door', 'co-street', 'co-area', 'co-city', 'co-state', 'co-pincode']
        .forEach(id => setFieldValue(id, ''));
}

function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? '' : value;
}

function getFieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function wireFieldInputs() {
    const phone = document.getElementById('co-phone');
    if (phone) phone.addEventListener('input', function () {
        this.value = this.value.replace(/\D+/g, '').slice(0, 10);
    });
    const pin = document.getElementById('co-pincode');
    if (pin) pin.addEventListener('input', function () {
        this.value = this.value.replace(/\D+/g, '').slice(0, 6);
    });
}

function handleAuthExpired() {
    Auth.clear();
    showToast('Your session has expired. Please log in again.', 'error', { title: 'Session Expired' });
    setTimeout(() => {
        window.location.href = '/login.html?redirect=' + encodeURIComponent('/checkout.html');
    }, 1000);
}
