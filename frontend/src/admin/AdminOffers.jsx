import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { fmtDateOnly } from '../lib/format';
import { showToast } from '../lib/toast';
import { EmptyBox, SpinnerBox, hideModal, showModal, useModalId } from './AdminLayout';

/* FreshMeat — Admin Offers controller (ported from offers.js) */

function offerTargetLabel(o) {
  if (o.productId) return 'Product #' + o.productId;
  if (o.categoryId) return 'Category #' + o.categoryId;
  return 'Whole store';
}

const BLANK_FORM = {
  title: '',
  description: '',
  discountPercent: '',
  code: '',
  target: '',
  categoryId: '',
  productId: '',
  startDate: '',
  endDate: '',
  active: true
};

export default function AdminOffers() {
  const [offers, setOffers] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [form, setForm] = useState({ ...BLANK_FORM });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const offerModalId = useModalId('offerModal');

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

  const loadOffers = useCallback(async () => {
    setOffers(null);
    try {
      const res = await apiCall('/api/offers');
      if (!mounted.current) return;
      setOffers(res.data || []);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setOffers([]);
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const loadSelects = useCallback(async () => {
    try {
      const [catsRes, prodsRes] = await Promise.all([
        apiCall('/api/categories'),
        apiCall('/api/admin/products')
      ]);
      if (!mounted.current) return;
      setCategories(catsRes.data || []);
      setProducts(prodsRes.data || []);
    } catch (e) {
      if (!mounted.current) return;
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    loadOffers();
    loadSelects();
  }, [loadOffers, loadSelects]);

  function openOfferModal(id) {
    setEditingId(id || null);
    const o = id ? (offers || []).find(x => x.id === id) : null;
    let target = '';
    if (o && o.productId) target = 'product';
    else if (o && o.categoryId) target = 'category';
    setForm({
      title: o ? o.title || '' : '',
      description: o ? o.description || '' : '',
      discountPercent: o ? o.discountPercent : '',
      code: o ? o.code || '' : '',
      target,
      categoryId: o ? o.categoryId || '' : '',
      productId: o ? o.productId || '' : '',
      startDate: o && o.startDate ? String(o.startDate).slice(0, 10) : '',
      endDate: o && o.endDate ? String(o.endDate).slice(0, 10) : '',
      active: o ? o.active : true
    });
    showModal(offerModalId);
  }

  async function saveOffer() {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      discountPercent: form.discountPercent,
      code: form.code.trim().toUpperCase() || null,
      productId: form.target === 'product' ? Number(form.productId) || null : null,
      categoryId: form.target === 'category' ? Number(form.categoryId) || null : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      active: form.active
    };

    if (!payload.title) { showToast('Offer title is required', 'warning'); return; }
    if (!(Number(payload.discountPercent) > 0)) { showToast('Valid discount % required', 'warning'); return; }

    setSaving(true);
    try {
      if (editingId) {
        await apiCall('/api/offers/' + editingId, { method: 'PUT', body: payload });
        showToast('Offer updated');
      } else {
        await apiCall('/api/offers', { method: 'POST', body: payload });
        showToast('Offer created');
      }
      hideModal(offerModalId);
      loadOffers();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
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
    if (!window.confirm('Delete this offer?')) return;
    try {
      await apiCall('/api/offers/' + id, { method: 'DELETE' });
      showToast('Offer deleted');
      loadOffers();
    } catch (e) { showToast(e.message, 'error'); }
  }

  const showTargetWrap = f => (
    <div className={'col-md-6' + (f ? '' : ' d-none')}>
      {f === 'category' ? (
        <>
          <label className="form-label">Category</label>
          <select
            className="form-select form-control-fm"
            value={form.categoryId}
            onChange={e => setForm(x => ({ ...x, categoryId: e.target.value }))}
          >
            {categories.length ? (
              <>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </>
            ) : <option value="">None</option>}
          </select>
        </>
      ) : (
        <>
          <label className="form-label">Product</label>
          <select
            className="form-select form-control-fm"
            value={form.productId}
            onChange={e => setForm(x => ({ ...x, productId: e.target.value }))}
          >
            {products.length ? (
              <>
                <option value="">Select product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </>
            ) : <option value="">None</option>}
          </select>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <span className="text-muted small">Promotions shown on the storefront banners & product cards.</span>
        <button className="btn-admin" onClick={() => openOfferModal(null)}>
          <i className="fa-solid fa-plus me-1"></i>Add Offer
        </button>
      </div>

      <div className="admin-card">
        <div className="table-responsive">
          {offers == null ? <SpinnerBox /> : !offers.length ? (
            <EmptyBox msg="No offers created yet" />
          ) : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Title</th><th>Discount</th><th>Code</th><th>Target</th>
                  <th>Valid Until</th><th>Status</th><th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {offers.map(o => (
                  <tr key={o.id}>
                    <td>
                      <strong className="small">{o.title}</strong>
                      {o.description ? (
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{o.description}</div>
                      ) : null}
                    </td>
                    <td><span className="text-success fw-semibold">{o.discountPercent}%</span></td>
                    <td>{o.code ? <span className="badge-status badge-toogle">{o.code}</span> : '-'}</td>
                    <td className="text-muted" style={{ fontSize: '0.78rem' }}>{offerTargetLabel(o)}</td>
                    <td className="text-muted" style={{ fontSize: '0.78rem' }}>
                      {o.endDate ? fmtDateOnly(o.endDate) : 'No end date'}
                    </td>
                    <td>
                      {o.active
                        ? <span className="badge-status CONFIRMED">Active</span>
                        : <span className="badge-status CANCELLED">Inactive</span>}
                    </td>
                    <td className="text-end">
                      <button className="btn-icon-xs edit" onClick={() => openOfferModal(o.id)} title="Edit">
                        <i className="fa-regular fa-pen-to-square"></i>
                      </button>
                      <button
                        className={'btn-icon-xs ' + (o.active ? '' : 'toggle-off')}
                        onClick={() => toggleOffer(o.id)}
                        title="Toggle"
                      >
                        <i className={'fa-solid ' + (o.active ? 'fa-eye-slash' : 'fa-eye')}></i>
                      </button>
                      <button className="btn-icon-xs del" onClick={() => deleteOffer(o.id)} title="Delete">
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

      {/* Offer edit modal */}
      <div className="modal fade" id={offerModalId} tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editingId ? 'Edit Offer' : 'Add Offer'}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-control form-control-fm"
                    maxLength="150"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Discount % *</label>
                  <input
                    type="number"
                    className="form-control form-control-fm"
                    min="1"
                    max="90"
                    step="0.5"
                    value={form.discountPercent}
                    onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-control form-control-fm"
                    maxLength="300"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Coupon Code</label>
                  <input
                    type="text"
                    className="form-control form-control-fm"
                    maxLength="20"
                    placeholder="e.g. FRESH10"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Target</label>
                  <select
                    className="form-select form-control-fm"
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  >
                    <option value="">Whole Store</option>
                    <option value="category">Specific Category</option>
                    <option value="product">Specific Product</option>
                  </select>
                </div>
                {form.target === 'category' ? showTargetWrap('category') : null}
                {form.target === 'product' ? showTargetWrap('product') : null}
                <div className="col-md-6">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control form-control-fm"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control form-control-fm"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <div className="col-12 d-flex align-items-center gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="of-active"
                      checked={form.active}
                      onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    />
                    <label className="form-check-label small" htmlFor="of-active">Active</label>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button className="btn-admin" onClick={saveOffer} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : 'Save Offer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}