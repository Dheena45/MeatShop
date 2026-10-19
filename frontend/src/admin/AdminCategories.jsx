import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { showToast } from '../lib/toast';
import { EmptyBox, SpinnerBox, hideModal, showModal, useModalId } from './AdminLayout';

/* FreshMeat — Admin Categories controller (ported from categories.js) */

export default function AdminCategories() {
  const [categories, setCategories] = useState(null);
  const [search, setSearch] = useState('');
  const deletedIds = useRef(new Set());

  const [form, setForm] = useState({ name: '', description: '', active: true });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const categoryModalId = useModalId('categoryModal');
  const deleteModalId = useModalId('deleteCategoryModal');

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function handleAuth(e) {
    if (e && (e.status === 401 || e.status === 403)) {
      showToast('Your session has expired. Please login again.', 'error', { title: 'Session Expired' });
      return true;
    }
    return false;
  }

  const loadCategories = useCallback(async () => {
    const q = search.trim();
    setCategories(null);
    try {
      const res = await apiCall('/api/categories/all');
      if (!mounted.current) return;
      const cats = (res.data || []).filter(c => !deletedIds.current.has(c.id));
      setCategories(q
        ? cats.filter(c =>
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            (c.description || '').toLowerCase().includes(q.toLowerCase()))
        : cats);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setCategories([]);
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => loadCategories(), 400);
    return () => clearTimeout(t);
  }, [loadCategories]);

  function openCategoryModal(id) {
    setEditingId(id || null);
    if (!id) {
      setForm({ name: '', description: '', active: true });
    } else {
      const c = (categories || []).find(x => x.id === id) || {};
      setForm({
        name: c.name || '',
        description: c.description || '',
        active: c.active !== false
      });
    }
    showModal(categoryModalId);
  }

  async function saveCategory() {
    const name = form.name;
    if (!name || !name.trim()) {
      showToast('Category name is required', 'warning');
      document.getElementById('cat-name') && document.getElementById('cat-name').focus();
      return;
    }

    const body = {
      name: name.trim(),
      description: form.description.trim() || '',
      active: form.active
    };

    setSaving(true);
    try {
      if (editingId) {
        await apiCall('/api/categories/' + editingId, { method: 'PUT', body });
        showToast('Category updated');
      } else {
        await apiCall('/api/categories', { method: 'POST', body });
        showToast('Category added');
      }
      hideModal(categoryModalId);
      loadCategories();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openDeleteCategoryModal(id) {
    const c = (categories || []).find(x => x.id === id) || {};
    setDeleteTarget({ id, name: c.name || 'this category' });
    showModal(deleteModalId);
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiCall('/api/categories/' + deleteTarget.id, { method: 'DELETE' });
      hideModal(deleteModalId);
      deletedIds.current.add(deleteTarget.id);
      setDeleteTarget(null);
      showToast('Category deleted successfully.');
      loadCategories();
    } catch (e) {
      let msg = e.message || 'Could not delete category. Please try again.';
      if (e.status === 409) msg = 'Cannot delete this category because products are still using it.';
      else if (e.status === 403) msg = 'You are not authorized to delete this category.';
      else if (e.status === 404) msg = 'Category not found.';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="search-box">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories..."
          />
          <i className="fa-solid fa-magnifying-glass"></i>
        </div>
        <button className="btn-admin" onClick={() => openCategoryModal(null)}>
          <i className="fa-solid fa-plus me-1"></i>Add Category
        </button>
      </div>

      <div className="admin-card">
        <div className="table-responsive">
          {categories == null ? <SpinnerBox /> : !categories.length ? (
            <EmptyBox msg="No categories found" />
          ) : (
            <table className="table table-fm align-middle">
              <thead>
                <tr><th>Category</th><th>Description</th><th>Status</th><th className="text-end">Actions</th></tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <tr key={c.id}>
                    <td><strong className="small">{c.name}</strong></td>
                    <td className="text-muted">{c.description || '-'}</td>
                    <td>
                      {c.active
                        ? <span className="badge-status CONFIRMED">ACTIVE</span>
                        : <span className="badge-status CANCELLED">INACTIVE</span>}
                    </td>
                    <td className="text-end">
                      <button className="btn-icon-xs edit" onClick={() => openCategoryModal(c.id)} title="Edit">
                        <i className="fa-regular fa-pen-to-square"></i>
                      </button>
                      <button className="btn-icon-xs del" onClick={() => openDeleteCategoryModal(c.id)} title="Delete">
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit category modal */}
      <div className="modal fade" id={categoryModalId} tabIndex="-1" aria-labelledby={categoryModalId + 'Label'}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={categoryModalId + 'Label'}>
                {editingId ? 'Edit Category' : 'Add Category'}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <form onSubmit={e => { e.preventDefault(); saveCategory(); }}>
                <div className="mb-3">
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    className="form-control form-control-fm"
                    id="cat-name"
                    maxLength="100"
                    placeholder="e.g. Chicken"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control form-control-fm"
                    rows="2"
                    maxLength="300"
                    placeholder="Short description of this category"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  ></textarea>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="cat-active"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  />
                  <label className="form-check-label small" htmlFor="cat-active">Active / Available</label>
                </div>
                <div className="modal-footer px-0 pb-0">
                  <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" className="btn-admin" disabled={saving}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : 'Save Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Delete category confirmation modal */}
      <div className="modal fade" id={deleteModalId} tabIndex="-1" aria-labelledby={deleteModalId + 'Label'}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={deleteModalId + 'Label'}>
                <i className="fa-solid fa-triangle-exclamation text-danger me-2"></i>Delete Category
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-2">
                Are you sure you want to delete "<strong>{deleteTarget ? deleteTarget.name : 'this category'}</strong>"?
              </p>
              <p className="text-muted small mb-0" style={{ fontSize: '0.8rem' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-admin-outline" data-bs-dismiss="modal">Keep Category</button>
              <button
                className="btn-admin"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={confirmDeleteCategory}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner-border spinner-border-sm me-1"></span>Deleting...</> : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}