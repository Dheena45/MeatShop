import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCall, resolveImage } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { showToast } from '../lib/toast';
import { EmptyBox, SpinnerBox, hideModal, showModal, useModalId } from './AdminLayout';

/* FreshMeat — Admin Products controller (ported from products.js) */

const BLANK_FORM = {
  name: '',
  shortDescription: '',
  description: '',
  pricePerKg: '',
  discountPercent: '0',
  stockQuantity: '',
  minOrderQty: '1',
  unit: 'KG',
  available: true,
  freshToday: true,
  categoryId: '',
  cuttingOptions: ''
};

export default function AdminProducts() {
  const [searchParams] = useSearchParams();
  const pendingCategoryFilter = useRef(searchParams.get('category'));

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryId, setCategoryId] = useState('');

  const [form, setForm] = useState({ ...BLANK_FORM });
  const [editingId, setEditingId] = useState(null);
  const [imgPreview, setImgPreview] = useState('/images/default-meat.jpg');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const productModalId = useModalId('productModal');
  const deleteModalId = useModalId('deleteProductModal');
  const fileInputRef = useRef(null);

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
    try {
      const res = await apiCall('/api/categories');
      const cats = res.data || [];
      if (!mounted.current) return;
      setCategories(cats);
      if (pendingCategoryFilter.current != null) {
        applyCategoryFilter(pendingCategoryFilter.current, cats);
        pendingCategoryFilter.current = null;
      }
    } catch (e) {
      if (!mounted.current) return;
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const loadProducts = useCallback(async () => {
    const q = search.trim();
    setProducts(null);
    try {
      const res = await apiCall('/api/admin/products' + (q ? '?search=' + encodeURIComponent(q) : ''));
      if (!mounted.current) return;
      const all = res.data || [];
      setProducts(categoryId ? all.filter(p => Number(p.categoryId) === Number(categoryId)) : all);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setProducts([]);
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [search, categoryId]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  useEffect(() => {
    const t = setTimeout(() => loadProducts(), 400);
    return () => clearTimeout(t);
  }, [loadProducts]);

  function applyCategoryFilter(value, cats) {
    const numeric = /^\d+$/.test(value);
    if (numeric) {
      if (cats.some(c => String(c.id) === value)) setCategoryId(value);
    } else {
      const cat = cats.find(c => c.name.toLowerCase() === value.toLowerCase());
      if (cat) setCategoryId(String(cat.id));
      else setSearch(value);
    }
  }

  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function openProductModal(id) {
    setEditingId(id || null);
    if (!id) {
      setForm({ ...BLANK_FORM });
      setImgPreview('/images/default-meat.jpg');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showModal(productModalId);
      return;
    }
    try {
      const res = await apiCall('/api/products/' + id);
      const p = res.data;
      if (!mounted.current) return;
      setForm({
        name: p.name || '',
        shortDescription: p.shortDescription || '',
        description: p.description || '',
        pricePerKg: p.pricePerKg,
        discountPercent: p.discountPercent || 0,
        stockQuantity: p.stockQuantity,
        minOrderQty: p.minOrderQty || 1,
        unit: (p.unit || 'KG').toUpperCase(),
        available: p.available !== false,
        freshToday: p.freshToday !== false,
        categoryId: p.categoryId || '',
        cuttingOptions: (p.cuttingOptions || []).join(', ')
      });
      setImgPreview(p.imageUrl || '/images/default-meat.jpg');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showModal(productModalId);
    } catch (e) {
      if (!mounted.current) return;
      showToast(e.message, 'error');
    }
  }

  async function saveProduct() {
    const name = form.name.trim();
    const pricePerKg = form.pricePerKg;
    const categoryId = form.categoryId;
    const stockQuantity = form.stockQuantity;
    const discount = form.discountPercent;

    if (!name) { showToast('Product name is required', 'warning'); return; }
    if (!(Number(pricePerKg) > 0)) { showToast('Valid price required', 'warning'); return; }
    if (!categoryId) { showToast('Please select a category', 'warning'); return; }
    if (stockQuantity === '' || Number(stockQuantity) < 0) { showToast('Valid stock required', 'warning'); return; }
    if (discount !== '' && (Number(discount) < 0 || Number(discount) > 100)) {
      showToast('Discount must be between 0 and 100', 'warning'); return;
    }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('shortDescription', form.shortDescription.trim() || '');
    fd.append('description', form.description.trim() || '');
    fd.append('pricePerKg', pricePerKg);
    fd.append('discountPercent', discount || 0);
    fd.append('stockQuantity', stockQuantity);
    fd.append('minOrderQty', form.minOrderQty || 1);
    fd.append('unit', form.unit || 'KG');
    fd.append('available', form.available);
    fd.append('freshToday', form.freshToday);
    fd.append('categoryId', categoryId);
    fd.append('cuttingOptions', form.cuttingOptions);

    if (fileInputRef.current && fileInputRef.current.files.length > 0) {
      fd.append('image', fileInputRef.current.files[0]);
    }

    setSaving(true);
    try {
      await apiCall(
        editingId ? '/api/admin/products/' + editingId : '/api/admin/products',
        { method: editingId ? 'PUT' : 'POST', formData: fd }
      );
      showToast(editingId ? 'Product updated' : 'Product added');
      hideModal(productModalId);
      loadProducts();
    } catch (e) {
      showToast(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
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
    const p = (products || []).find(x => x.id === id) || {};
    setDeleteTarget({ id, name: p.name || 'this product' });
    showModal(deleteModalId);
  }

  async function confirmDeleteProduct() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      await apiCall('/api/admin/products/' + id, { method: 'DELETE' });
      hideModal(deleteModalId);
      setDeleteTarget(null);
      showToast('Product deleted successfully.');
      loadProducts();
    } catch (e) {
      if (e.status === 401) {
        showToast('Your session has expired. Please login again.', 'error', { title: 'Cannot Delete Product' });
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
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <div className="search-box">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
            />
            <i className="fa-solid fa-magnifying-glass"></i>
          </div>
          <select
            id="product-category"
            className="form-select form-control-fm"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn-admin" onClick={() => openProductModal(null)}>
          <i className="fa-solid fa-plus me-1"></i>Add Product
        </button>
      </div>

      <div className="admin-card">
        <div className="table-responsive">
          {products == null ? <SpinnerBox /> : !products.length ? (
            <EmptyBox msg="No products found" />
          ) : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Product</th><th>Category</th><th>Price</th><th>Discount</th>
                  <th>Stock</th><th>Rating</th><th>Status</th><th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <img className="tbl-img" src={resolveImage(p.imageUrl)} alt={p.name} />
                        <div>
                          <strong className="small">{p.name}</strong>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                            {p.available ? 'In stock' : 'Hidden'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{p.categoryName || '-'}</td>
                    <td>
                      <strong>{fmtMoney(p.pricePerKg)}</strong>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        per {String(p.unit || 'KG').toUpperCase()}
                      </div>
                    </td>
                    <td>
                      {Number(p.discountPercent || 0) > 0
                        ? <span className="text-success fw-semibold">{Number(p.discountPercent)}%</span>
                        : '-'}
                    </td>
                    <td>
                      {Number(p.stockQuantity) <= 0
                        ? <span className="badge-status OUT_OF_STOCK">Out</span>
                        : p.stockQuantity + ' ' + String(p.unit || 'KG').toUpperCase()}
                    </td>
                    <td>
                      {(Number(p.avgRating) || 0).toFixed(1)}{' '}
                      <span className="text-muted" style={{ fontSize: '0.72rem' }}>({p.reviewCount || 0})</span>
                    </td>
                    <td>
                      {p.available
                        ? <span className="badge-status CONFIRMED">ACTIVE</span>
                        : <span className="badge-status CANCELLED">INACTIVE</span>}
                    </td>
                    <td className="text-end">
                      <button className="btn-icon-xs edit" onClick={() => openProductModal(p.id)} title="Edit">
                        <i className="fa-regular fa-pen-to-square"></i>
                      </button>
                      <button
                        className={'btn-icon-xs ' + (p.available ? '' : 'toggle-off')}
                        onClick={() => toggleProduct(p.id)}
                        title="Toggle availability"
                      >
                        <i className={'fa-solid ' + (p.available ? 'fa-eye-slash' : 'fa-eye')}></i>
                      </button>
                      <button className="btn-icon-xs del" onClick={() => deleteProduct(p.id)} title="Delete">
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

      {/* Product edit modal */}
      <div className="modal fade" id={productModalId} tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editingId ? 'Edit Product' : 'Add Product'}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-control form-control-fm"
                    maxLength="150"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select form-control-fm"
                    value={form.categoryId}
                    onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  >
                    {categories.length ? (
                      <>
                        <option value="">Select category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </>
                    ) : (
                      <option value="">No categories</option>
                    )}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Short Description</label>
                  <input
                    type="text"
                    className="form-control form-control-fm"
                    maxLength="40"
                    placeholder="e.g. Farm fresh, cleaned & cut"
                    value={form.shortDescription}
                    onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Full Description</label>
                  <textarea
                    className="form-control form-control-fm"
                    rows="2"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  ></textarea>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Price (₹) *</label>
                  <input
                    type="number"
                    className="form-control form-control-fm"
                    min="0"
                    step="0.01"
                    value={form.pricePerKg}
                    onChange={e => setForm(f => ({ ...f, pricePerKg: e.target.value }))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Discount %</label>
                  <input
                    type="number"
                    className="form-control form-control-fm"
                    min="0"
                    max="100"
                    value={form.discountPercent}
                    onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Stock Qty *</label>
                  <input
                    type="number"
                    className="form-control form-control-fm"
                    min="0"
                    value={form.stockQuantity}
                    onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Unit</label>
                  <select
                    className="form-select form-control-fm"
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  >
                    <option value="KG">KG</option>
                    <option value="PACK">PACK</option>
                    <option value="DOZEN">DOZEN</option>
                    <option value="GM">GM</option>
                    <option value="PIECE">PIECE</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Min Order</label>
                  <input
                    type="number"
                    className="form-control form-control-fm"
                    min="1"
                    value={form.minOrderQty}
                    onChange={e => setForm(f => ({ ...f, minOrderQty: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Cutting Options (comma separated)</label>
                  <input
                    type="text"
                    className="form-control form-control-fm"
                    placeholder="e.g. CURRY_CUT, BONELESS, WITH_SKIN"
                    value={form.cuttingOptions}
                    onChange={e => setForm(f => ({ ...f, cuttingOptions: e.target.value }))}
                  />
                </div>
                <div className="col-md-8">
                  <div className="d-flex align-items-end gap-3">
                    <div style={{ width: 90, height: 90, borderRadius: 10, overflow: 'hidden', background: 'var(--bg)', flexShrink: 0 }}>
                      <img src={imgPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div className="flex-grow-1">
                      <label className="form-label">Product Image</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="form-control form-control-fm"
                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        onChange={onFileChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-md-4 d-flex align-items-end gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="p-available"
                      checked={form.available}
                      onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
                    />
                    <label className="form-check-label small" htmlFor="p-available">Available for sale</label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="p-fresh"
                      checked={form.freshToday}
                      onChange={e => setForm(f => ({ ...f, freshToday: e.target.checked }))}
                    />
                    <label className="form-check-label small" htmlFor="p-fresh">Fresh Today</label>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button className="btn-admin" onClick={saveProduct} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <div className="modal fade" id={deleteModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Delete Product</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              <p className="mb-2">
                Are you sure you want to delete <strong>{deleteTarget ? deleteTarget.name : 'this product'}</strong>?
              </p>
              <p className="text-muted small mb-0" style={{ fontSize: '0.8rem' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button
                className="btn-admin"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={confirmDeleteProduct}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner-border spinner-border-sm me-1"></span>Deleting...</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}