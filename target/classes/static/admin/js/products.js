/* FreshMeat — Admin Products controller */

let editProductId = null;
const PRODUCT_MODAL = new bootstrap.Modal(document.getElementById('productModal'));

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('products', 'Products', 'Manage catalog, pricing & availability')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="search-box">
        <input type="text" id="product-search" placeholder="Search products...">
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>
      <button class="btn-admin" onclick="openProductModal()"><i class="fa-solid fa-plus me-1"></i>Add Product</button>
    </div>
    <div class="admin-card">
      <div id="products-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    document.getElementById('product-search').addEventListener('input', debounce(() => loadProducts(), 400));
    loadProducts();
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
});

async function loadCategories() {
    try {
        const res = await apiCall('/api/categories');
        const cats = res.data || [];
        document.getElementById('p-category').innerHTML = cats.length
            ? cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
            : '<option value="">No categories</option>';
    } catch (e) { showToast(e.message, 'error'); }
}

async function loadProducts() {
    const q = document.getElementById('product-search').value.trim();
    const body = document.getElementById('products-body');
    try {
        const res = await apiCall('/api/admin/products' + (q ? '?search=' + encodeURIComponent(q) : ''));
        const products = res.data || [];
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
                  <img class="tbl-img" src="${escapeHtml(p.imageUrl || 'https://placehold.co/600x600/2d2d2d/f5f0e8?text=IMG')}">
                  <div>
                    <strong class="small">${escapeHtml(p.name)}</strong>
                    <div class="text-muted" style="font-size:0.72rem;">${p.available ? 'In stock' : 'Hidden'}</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(p.categoryName || '-')}</td>
              <td><strong>${fmtMoney(p.pricePerKg)}</strong><div class="text-muted" style="font-size:0.72rem;">per KG</div></td>
              <td>${Number(p.discountPercent || 0) > 0 ? '<span class="text-success fw-semibold">' + Number(p.discountPercent) + '%</span>' : '-'}</td>
              <td>${Number(p.stockQuantity) <= 0 ? '<span class="badge-status OUT_OF_STOCK">Out</span>' : p.stockQuantity + ' KG'}</td>
              <td>${(Number(p.avgRating) || 0).toFixed(1)} <span class="text-muted" style="font-size:0.72rem;">(${p.reviewCount || 0})</span></td>
              <td>${p.available ? '<span class="badge-status CONFIRMED">Active</span>' : '<span class="badge-status CANCELLED">Hidden</span>'}</td>
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
    document.getElementById('p-available').checked = true;
    document.getElementById('p-fresh').checked = true;
    document.getElementById('p-category').value = '';
    document.getElementById('p-img-preview').src = 'https://placehold.co/600x600/2d2d2d/f5f0e8?text=IMG';
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
            document.getElementById('p-cuts').value = (p.cuttingOptions || []).join(', ');
            document.getElementById('p-category').value = p.categoryId || '';
            document.getElementById('p-available').checked = p.available !== false;
            document.getElementById('p-fresh').checked = p.freshToday !== false;
            document.getElementById('p-img-preview').src = p.imageUrl || 'https://placehold.co/600x600/2d2d2d/f5f0e8?text=IMG';
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

    if (!name) { showToast('Product name is required', 'warning'); return; }
    if (!(Number(pricePerKg) > 0)) { showToast('Valid price required', 'warning'); return; }
    if (!categoryId) { showToast('Please select a category', 'warning'); return; }
    if (stockQuantity === '' || Number(stockQuantity) < 0) { showToast('Valid stock required', 'warning'); return; }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('shortDescription', document.getElementById('p-short').value.trim() || '');
    fd.append('description', document.getElementById('p-desc').value.trim() || '');
    fd.append('pricePerKg', pricePerKg);
    fd.append('discountPercent', document.getElementById('p-discount').value || 0);
    fd.append('stockQuantity', stockQuantity);
    fd.append('minOrderQty', document.getElementById('p-minqty').value || 1);
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

async function deleteProduct(id) {
    if (!confirm('Delete this product permanently?')) return;
    try {
        await apiCall('/api/admin/products/' + id, { method: 'DELETE' });
        showToast('Product deleted');
        loadProducts();
    } catch (e) { showToast(e.message, 'error'); }
}