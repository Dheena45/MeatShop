/* FreshMeat — Admin Offers controller */

let editOfferId = null;
let offersCache = [];
const OFFER_MODAL = new bootstrap.Modal(document.getElementById('offerModal'));

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('offers', 'Offers', 'Discounts, coupons & promotions')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <span class="text-muted small">Promotions shown on the storefront banners & product cards.</span>
      <button class="btn-admin" onclick="openOfferModal()"><i class="fa-solid fa-plus me-1"></i>Add Offer</button>
    </div>
    <div class="admin-card">
      <div id="offers-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    loadOffers();
    loadSelects();

    document.getElementById('of-target').addEventListener('change', e => {
        const val = e.target.value;
        document.getElementById('of-category-wrap').classList.toggle('d-none', val !== 'category');
        document.getElementById('of-product-wrap').classList.toggle('d-none', val !== 'product');
    });

    document.getElementById('save-offer-btn').addEventListener('click', saveOffer);
});

async function loadSelects() {
    try {
        const cats = (await apiCall('/api/categories')).data || [];
        const prods = (await apiCall('/api/admin/products')).data || [];
        document.getElementById('of-category').innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') || '<option value="">None</option>';
        document.getElementById('of-product').innerHTML = prods.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('') || '<option value="">None</option>';
    } catch (e) { showToast(e.message, 'error'); }
}

async function loadOffers() {
    const body = document.getElementById('offers-body');
    try {
        const res = await apiCall('/api/offers');
        offersCache = res.data || [];
        if (!offersCache.length) { body.innerHTML = emptyBoxHtml('No offers created yet'); return; }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead><tr><th>Title</th><th>Discount</th><th>Code</th><th>Target</th><th>Valid Until</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody>
            ${offersCache.map(o => `
            <tr>
              <td>
                <strong class="small">${escapeHtml(o.title)}</strong>
                ${o.description ? `<div class="text-muted" style="font-size:0.75rem;">${escapeHtml(o.description)}</div>` : ''}
              </td>
              <td><span class="text-success fw-semibold">${o.discountPercent}%</span></td>
              <td>${o.code ? '<span class="badge-status badge-toogle">' + escapeHtml(o.code) + '</span>' : '-'}</td>
              <td class="text-muted" style="font-size:0.78rem;">${offerTargetLabel(o)}</td>
              <td class="text-muted" style="font-size:0.78rem;">${o.endDate ? fmtDateOnly(o.endDate) : 'No end date'}</td>
              <td>${o.active ? '<span class="badge-status CONFIRMED">Active</span>' : '<span class="badge-status CANCELLED">Inactive</span>'}</td>
              <td class="text-end">
                <button class="btn-icon-xs edit" onclick="openOfferModal(${o.id})" title="Edit"><i class="fa-regular fa-pen-to-square"></i></button>
                <button class="btn-icon-xs ${o.active ? '' : 'toggle-off'}" onclick="toggleOffer(${o.id})" title="Toggle">
                  <i class="fa-solid ${o.active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
                <button class="btn-icon-xs del" onclick="deleteOffer(${o.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

function offerTargetLabel(o) {
    if (o.productId) return 'Product #' + o.productId;
    if (o.categoryId) return 'Category #' + o.categoryId;
    return 'Whole store';
}

function openOfferModal(id) {
    editOfferId = id || null;
    document.getElementById('offerModalTitle').textContent = id ? 'Edit Offer' : 'Add Offer';

    const o = id ? offersCache.find(x => x.id === id) : null;
    document.getElementById('of-title').value = o ? o.title || '' : '';
    document.getElementById('of-desc').value = o ? o.description || '' : '';
    document.getElementById('of-discount').value = o ? o.discountPercent : '';
    document.getElementById('of-code').value = o ? o.code || '' : '';
    document.getElementById('of-active').checked = o ? o.active : true;
    document.getElementById('of-start').value = o && o.startDate ? o.startDate : '';
    document.getElementById('of-end').value = o && o.endDate ? o.endDate : '';

    let target = '';
    if (o && o.productId) target = 'product';
    else if (o && o.categoryId) target = 'category';
    document.getElementById('of-target').value = target;
    document.getElementById('of-category-wrap').classList.toggle('d-none', target !== 'category');
    document.getElementById('of-product-wrap').classList.toggle('d-none', target !== 'product');
    if (o) {
        document.getElementById('of-category').value = o.categoryId || '';
        document.getElementById('of-product').value = o.productId || '';
    } else {
        document.getElementById('of-category').value = '';
        document.getElementById('of-product').value = '';
    }

    OFFER_MODAL.show();
}

async function saveOffer() {
    const target = document.getElementById('of-target').value;
    const payload = {
        title: document.getElementById('of-title').value.trim(),
        description: document.getElementById('of-desc').value.trim() || null,
        discountPercent: document.getElementById('of-discount').value,
        code: document.getElementById('of-code').value.trim().toUpperCase() || null,
        productId: target === 'product' ? Number(document.getElementById('of-product').value) || null : null,
        categoryId: target === 'category' ? Number(document.getElementById('of-category').value) || null : null,
        startDate: document.getElementById('of-start').value || null,
        endDate: document.getElementById('of-end').value || null,
        active: document.getElementById('of-active').checked
    };

    if (!payload.title) { showToast('Offer title is required', 'warning'); return; }
    if (!(Number(payload.discountPercent) > 0)) { showToast('Valid discount % required', 'warning'); return; }

    const btn = document.getElementById('save-offer-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

    try {
        if (editOfferId) {
            await apiCall('/api/offers/' + editOfferId, { method: 'PUT', body: payload });
            showToast('Offer updated');
        } else {
            await apiCall('/api/offers', { method: 'POST', body: payload });
            showToast('Offer created');
        }
        OFFER_MODAL.hide();
        loadOffers();
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Offer';
    }
}

async function toggleOffer(id) {
    try {
        await apiCall('/api/offers/' + id + '/toggle', { method: 'PUT' });
        showToast('Offer status updated');
        loadOffers();
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteOffer(id) {
    if (!confirm('Delete this offer?')) return;
    try {
        await apiCall('/api/offers/' + id, { method: 'DELETE' });
        showToast('Offer deleted');
        loadOffers();
    } catch (e) { showToast(e.message, 'error'); }
}