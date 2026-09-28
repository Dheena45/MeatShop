/* FreshMeat — Admin Products controller */

let editProductId = null;
let deleteProductId = null;
let productsCache = [];
let pendingCategoryFilter = null;
const PRODUCT_MODAL = new bootstrap.Modal(document.getElementById('productModal'));
const DELETE_MODAL = new bootstrap.Modal(document.getElementById('deleteProductModal'));

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('products', 'Products', 'Manage catalog, pricing & availability')) return;

    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    const categoryParam = params.get('category');
    if (categoryParam) pendingCategoryFilter = categoryParam;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <div class="search-box">
          <input type="text" id="product-search" placeholder="Search products...">
          <i class="fa-solid fa-magnifying-glass"></i>
        </div>
        <select id="product-category" class="form-select form-control-fm" style="width:auto;">
          <option value="">All Categories</option>
        </select>
      </div>
      <button class="btn-admin" onclick="openProductModal()"><i class="fa-solid fa-plus me-1"></i>Add Product</button>
    </div>
    <div class="admin-card">
      <div id="products-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    if (searchParam) document.getElementById('product-search').value = searchParam;

    document.getElementById('product-search').addEventListener('input', debounce(() => loadProducts(), 400));
    document.getElementById('product-category').addEventListener('change', loadProducts);
    if (!categoryParam) loadProducts();
    loadCategories();

    document.getElementById('p-img-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('p-img-preview').src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('save-product-btn').addEventListener('click', saveProduct);
    document.getElementById('delete-confirm-btn').addEventListener('click', confirmDeleteProduct);

    // Clean focus before Bootstrap toggles aria-hidden on hide, so no element
    // inside the hidden modal keeps focus (prevents the blocked aria-hidden warning).
    document.getElementById('deleteProductModal').addEventListener('hidden.bs.modal', () => {
        const modalEl = document.getElementById('deleteProductModal');
        const active = document.activeElement;
        if (modalEl && active && modalEl.contains(active)) active.blur();
    });
});

async function loadCategories() {
    try {
        const res = await apiCall('/api/categories');
        const cats = res.data || [];
        document.getElementById('p-category').innerHTML = cats.length
            ? cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
            : '<option value="">No categories</option>';
        document.getElementById('product-category').innerHTML = '<option value="">All Categories</option>' +
            cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

        if (pendingCategoryFilter != null) {
            applyCategoryFilter(pendingCategoryFilter, cats);
            pendingCategoryFilter = null;
        }
    } catch (e) { showToast(e.message, 'error'); }
}

function applyCategoryFilter(value, cats) {
    const sel = document.getElementById('product-category');
    const numeric = /^\d+$/.test(value);
    if (numeric) {
        if (sel.querySelector(`option[value="${value}"]`)) sel.value = value;
    } else {
        const cat = cats.find(c => c.name.toLowerCase() === value.toLowerCase());
        if (cat) sel.value = String(cat.id);
        else document.getElementById('product-search').value = value;
    }
    loadProducts();
}

async function loadProducts() {
    const q = document.getElementById('product-search').value.trim();
    const selectedCatId = document.getElementById('product-category').value;
    const body = document.getElementById('products-body');
    try {
        const res = await apiCall('/api/admin/products' + (q ? '?search=' + encodeURIComponent(q) : ''));
        const all = res.data || [];
        const products = selectedCatId ? all.filter(p => Number(p.categoryId) === Number(selectedCatId)) : all;
        productsCache = products;
        if (!products.length) { body.innerHTML = emptyBoxHtml('No products found'); return; }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead>
            <tr><th>Product</th><th>Category</th><th>Price</th><th>Discount</th><th>Stock</th><th>Rating</th><th>Status</th><th class="text-end">Actions</th></tr>
          </thead>
          <tbody>
            ${products.map(p => `
            <tr>
              <td>
                <div class="d-flex align-items-center gap-2">
                  <img class="tbl-img" src="${escapeHtml(p.imageUrl || '/images/default-meat.jpg')}">
                  <div>
                    <strong class="small">${escapeHtml(p.name)}</strong>
                    <div class="text-muted" style="font-size:0.72rem;">${p.available ? 'In stock' : 'Hidden'}</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(p.categoryName || '-')}</td>
              <td><strong>${fmtMoney(p.pricePerKg)}</strong><div class="text-muted" style="font-size:0.72rem;">per ${escapeHtml((p.unit || 'KG').toUpperCase())}</div></td>
              <td>${Number(p.discountPercent || 0) > 0 ? '<span class="text-success fw-semibold">' + Number(p.discountPercent) + '%</span>' : '-'}</td>
              <td>${Number(p.stockQuantity) <= 0 ? '<span class="badge-status OUT_OF_STOCK">Out</span>' : p.stockQuantity + ' ' + escapeHtml((p.unit || 'KG').toUpperCase())}</td>
              <td>${(Number(p.avgRating) || 0).toFixed(1)} <span class="text-muted" style="font-size:0.72rem;">(${p.reviewCount || 0})</span></td>
              <td>${p.available ? '<span class="badge-status CONFIRMED">ACTIVE</span>' : '<span class="badge-status CANCELLED">INACTIVE</span>'}</td>
              <td class="text-end">
                <button class="btn-icon-xs edit" onclick="openProductModal(${p.id})" title="Edit"><i class="fa-regular fa-pen-to-square"></i></button>
                <button class="btn-icon-xs ${p.available ? '' : 'toggle-off'}" onclick="toggleProduct(${p.id})" title="Toggle availability">
                  <i class="fa-solid ${p.available ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
                <button class="btn-icon-xs del" onclick="deleteProduct(${p.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

async function openProductModal(id) {
    editProductId = id || null;
    document.getElementById('productModalTitle').textContent = id ? 'Edit Product' : 'Add Product';

    ['p-name', 'p-short', 'p-desc', 'p-price', 'p-discount', 'p-stock', 'p-minqty', 'p-cuts'].forEach(x => {
        const el = document.getElementById(x);
        el.value = (x === 'p-discount') ? '0' : (x === 'p-minqty') ? '1' : '';
    });
    document.getElementById('p-unit').value = 'KG';
    document.getElementById('p-available').checked = true;
    document.getElementById('p-fresh').checked = true;
    document.getElementById('p-category').value = '';
    document.getElementById('p-img-preview').src = '/images/default-meat.jpg';
    document.getElementById('p-img-input').value = '';

    if (id) {
        try {
            const res = await apiCall('/api/products/' + id);
            const p = res.data;
            document.getElementById('p-name').value = p.name || '';
            document.getElementById('p-short').value = p.shortDescription || '';
            document.getElementById('p-desc').value = p.description || '';
            document.getElementById('p-price').value = p.pricePerKg;
            document.getElementById('p-discount').value = p.discountPercent || 0;
            document.getElementById('p-stock').value = p.stockQuantity;
            document.getElementById('p-minqty').value = p.minOrderQty || 1;
            document.getElementById('p-unit').value = (p.unit || 'KG').toUpperCase();
            document.getElementById('p-cuts').value = (p.cuttingOptions || []).join(', ');
            document.getElementById('p-category').value = p.categoryId || '';
            document.getElementById('p-available').checked = p.available !== false;
            document.getElementById('p-fresh').checked = p.freshToday !== false;
            document.getElementById('p-img-preview').src = p.imageUrl || '/images/default-meat.jpg';
        } catch (e) {
            showToast(e.message, 'error');
            return;
        }
    }
    PRODUCT_MODAL.show();
}

async function saveProduct() {
    const name = document.getElementById('p-name').value.trim();
    const pricePerKg = document.getElementById('p-price').value;
    const categoryId = document.getElementById('p-category').value;
    const stockQuantity = document.getElementById('p-stock').value;
    const discount = document.getElementById('p-discount').value;

    if (!name) { showToast('Product name is required', 'warning'); return; }
    if (!(Number(pricePerKg) > 0)) { showToast('Valid price required', 'warning'); return; }
    if (!categoryId) { showToast('Please select a category', 'warning'); return; }
    if (stockQuantity === '' || Number(stockQuantity) < 0) { showToast('Valid stock required', 'warning'); return; }
    if (discount !== '' && (Number(discount) < 0 || Number(discount) > 100)) { showToast('Discount must be between 0 and 100', 'warning'); return; }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('shortDescription', document.getElementById('p-short').value.trim() || '');
    fd.append('description', document.getElementById('p-desc').value.trim() || '');
    fd.append('pricePerKg', pricePerKg);
    fd.append('discountPercent', discount || 0);
    fd.append('stockQuantity', stockQuantity);
    fd.append('minOrderQty', document.getElementById('p-minqty').value || 1);
    fd.append('unit', document.getElementById('p-unit').value || 'KG');
    fd.append('available', document.getElementById('p-available').checked);
    fd.append('freshToday', document.getElementById('p-fresh').checked);
    fd.append('categoryId', categoryId);
    fd.append('cuttingOptions', document.getElementById('p-cuts').value);

    const fileInput = document.getElementById('p-img-input');
    if (fileInput && fileInput.files.length > 0) {
        fd.append('image', fileInput.files[0]);
    }

    const btn = document.getElementById('save-product-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

    try {
        const token = Auth.getToken();
        const headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const method = editProductId ? 'PUT' : 'POST';
        const url = API_BASE + (editProductId ? '/api/admin/products/' + editProductId : '/api/admin/products');

        const response = await fetch(url, { method, headers, body: fd });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw { message: (data && (data.message || data.error)) || 'Request failed' };
        }
        showToast(editProductId ? 'Product updated' : 'Product added');
        PRODUCT_MODAL.hide();
        loadProducts();
    } catch (e) {
        showToast(e.message || 'Save failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Product';
    }
}

async function toggleProduct(id) {
    try {
        await apiCall('/api/admin/products/' + id + '/toggle', { method: 'PUT' });
        showToast('Availability updated');
        loadProducts();
    } catch (e) { showToast(e.message, 'error'); }
}

function deleteProduct(id) {
    const p = (productsCache || []).find(x => x.id === id) || {};
    deleteProductId = id;
    document.getElementById('delete-product-name').textContent = p.name || 'this product';
    DELETE_MODAL.show();
}

async function confirmDeleteProduct() {
    const id = deleteProductId;
    if (id == null) return;

    const btn = document.getElementById('delete-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...';

    try {
        await apiCall('/api/admin/products/' + id, { method: 'DELETE' });
        btn.blur();
        DELETE_MODAL.hide();
        showToast('Product deleted successfully.');
        loadProducts();
    } catch (e) {
        if (e.status === 401) {
            showToast('Your session has expired. Please login again.', 'error', { title: 'Cannot Delete Product' });
            Auth.requireAdmin();
        } else if (e.status === 403) {
            showToast('You do not have permission to delete this product.', 'error', { title: 'Cannot Delete Product' });
        } else if (e.status === 404) {
            showToast('Product not found.', 'error', { title: 'Cannot Delete Product' });
        } else if (e.status === 409) {
            let msg = (e.message && e.message !== 'Request failed')
                ? e.message
                : 'This product cannot be deleted because it is already used in an existing order. Please deactivate the product instead.';
            if (!/deactivate/i.test(msg) && /(used|references|order)/i.test(msg)) {
                msg += ' Please deactivate the product instead.';
            }
            showToast(msg, 'error', { title: 'Cannot Delete Product' });
        } else if (e.status === 500) {
            showToast('Unable to delete the product right now. Please try again.', 'error', { title: 'Cannot Delete Product' });
        } else {
            showToast(e.message || 'Unable to delete the product right now. Please try again.', 'error', { title: 'Cannot Delete Product' });
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Delete';
        deleteProductId = null;
    }
}