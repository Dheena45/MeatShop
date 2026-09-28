/* FreshMeat — Admin Categories controller */

let editCategoryId = null;
let selectedCategoryId = null;
let categoriesCache = [];
const deletedCategoryIds = new Set();
const CATEGORY_MODAL = new bootstrap.Modal(document.getElementById('categoryModal'));
const DELETE_CATEGORY_MODAL = new bootstrap.Modal(document.getElementById('deleteCategoryModal'));

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('categories', 'Categories', 'Manage product categories')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="search-box">
        <input type="text" id="category-search" placeholder="Search categories...">
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>
      <button class="btn-admin" onclick="openCategoryModal()"><i class="fa-solid fa-plus me-1"></i>Add Category</button>
    </div>
    <div class="admin-card">
      <div id="categories-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    document.getElementById('category-search').addEventListener('input', debounce(() => loadCategories(), 400));
    document.getElementById('save-category-btn').addEventListener('click', saveCategory);
    document.getElementById('delete-category-confirm-btn').addEventListener('click', confirmDeleteCategory);

    loadCategories();
});

async function loadCategories() {
    const q = document.getElementById('category-search').value.trim();
    const body = document.getElementById('categories-body');
    try {
        const res = await apiCall('/api/categories/all');
        const cats = (res.data || []).filter(c => !deletedCategoryIds.has(c.id));
        categoriesCache = cats;

        const filtered = q
            ? cats.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || (c.description || '').toLowerCase().includes(q.toLowerCase()))
            : cats;

        if (!filtered.length) { body.innerHTML = emptyBoxHtml('No categories found'); return; }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead>
            <tr><th>Category</th><th>Description</th><th>Status</th><th class="text-end">Actions</th></tr>
          </thead>
          <tbody>
            ${filtered.map(c => `
            <tr>
              <td><strong class="small">${escapeHtml(c.name)}</strong></td>
              <td class="text-muted">${escapeHtml(c.description || '-')}</td>
              <td>${c.active ? '<span class="badge-status CONFIRMED">ACTIVE</span>' : '<span class="badge-status CANCELLED">INACTIVE</span>'}</td>
              <td class="text-end">
                <button class="btn-icon-xs edit" onclick="openCategoryModal(${c.id})" title="Edit"><i class="fa-regular fa-pen-to-square"></i></button>
                <button class="btn-icon-xs del" onclick="openDeleteCategoryModal(${c.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

function openCategoryModal(id) {
    editCategoryId = id || null;
    document.getElementById('categoryModalLabel').textContent = id ? 'Edit Category' : 'Add Category';
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-desc').value = '';
    document.getElementById('cat-active').checked = true;

    if (id) {
        const c = categoriesCache.find(x => x.id === id) || {};
        document.getElementById('cat-name').value = c.name || '';
        document.getElementById('cat-desc').value = c.description || '';
        document.getElementById('cat-active').checked = c.active !== false;
    }
    CATEGORY_MODAL.show();
}

async function saveCategory() {
    const name = document.getElementById('cat-name').value;
    if (!name || !name.trim()) {
        showToast('Category name is required', 'warning');
        document.getElementById('cat-name').focus();
        return;
    }

    const body = {
        name: name.trim(),
        description: document.getElementById('cat-desc').value.trim() || '',
        active: document.getElementById('cat-active').checked
    };

    const btn = document.getElementById('save-category-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

    try {
        if (editCategoryId) {
            await apiCall('/api/categories/' + editCategoryId, { method: 'PUT', body });
            showToast('Category updated');
        } else {
            await apiCall('/api/categories', { method: 'POST', body });
            showToast('Category added');
        }
        CATEGORY_MODAL.hide();
        loadCategories();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        showToast(e.message || 'Save failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Category';
    }
}

function openDeleteCategoryModal(id) {
    const c = categoriesCache.find(x => x.id === id) || {};
    selectedCategoryId = id;
    document.getElementById('delete-category-name').textContent = c.name || 'this category';
    document.getElementById('delete-category-confirm-btn').disabled = false;
    DELETE_CATEGORY_MODAL.show();
}

async function confirmDeleteCategory() {
    const id = selectedCategoryId;
    if (id == null) return;

    const btn = document.getElementById('delete-category-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...';

    try {
        await apiCall('/api/categories/' + id, { method: 'DELETE' });
        DELETE_CATEGORY_MODAL.hide();
        deletedCategoryIds.add(id);
        showToast('Category deleted successfully.');
        loadCategories();
    } catch (e) {
        let msg = e.message || 'Could not delete category. Please try again.';
        if (e.status === 409) msg = 'Cannot delete this category because products are still using it.';
        else if (e.status === 403) msg = 'You are not authorized to delete this category.';
        else if (e.status === 404) msg = 'Category not found.';
        showToast(msg, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Delete Category';
        selectedCategoryId = null;
    }
}