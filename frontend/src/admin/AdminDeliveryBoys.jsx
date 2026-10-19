import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { fmtDateOnly } from '../lib/format';
import { showToast } from '../lib/toast';
import { EmptyBox, SpinnerBox, hideModal, showModal, useModalId } from './AdminLayout';

/* FreshMeat — Admin Delivery Boy Management (ported from delivery-boys.js)
   Delivery boys are users. An account with delivery history is never deleted,
   only deactivated, so past deliveries keep their handler; the guarded delete
   below is reserved for accounts the backend confirms have no delivery records. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9][0-9]{9}$/;

/* blank form used for both add and edit */
const BLANK_FORM = { name: '', email: '', phone: '', password: '', active: true };

export default function AdminDeliveryBoys() {
  const [boys, setBoys] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [form, setForm] = useState({ ...BLANK_FORM });
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toggleBoy, setToggleBoy] = useState(null); /* {id, name, email, phone, toActive} */
  const [toggleSaving, setToggleSaving] = useState(false);

  const [deleteBoy, setDeleteBoy] = useState(null); /* {id, name, email, phone} */
  const [deleting, setDeleting] = useState(false);

  const boyModalId = useModalId('boyModal');
  const toggleModalId = useModalId('toggleModal');
  const deleteModalId = useModalId('deleteModal');
  const nameInputRef = useRef(null);

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

  const loadBoys = useCallback(async () => {
    const q = new URLSearchParams();
    q.set('search', search.trim());
    if (activeFilter) q.set('active', activeFilter);
    setBoys(null);
    try {
      const res = await apiCall('/api/admin/delivery-boys?' + q.toString());
      if (!mounted.current) return;
      setBoys(res.data || []);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setBoys([]);
      showToast(e.message || 'Could not load delivery boys.', 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [search, activeFilter]);

  useEffect(() => {
    const t = setTimeout(() => loadBoys(), 350);
    return () => clearTimeout(t);
  }, [loadBoys]);

  function openBoyModal(id) {
    setEditingId(id || null);
    setErrors({});
    if (!id) {
      setForm({ ...BLANK_FORM });
    } else {
      const b = (boys || []).find(x => x.id === id);
      setForm({
        name: b ? b.name || '' : '',
        email: b ? b.email || '' : '',
        phone: b ? b.phone || '' : '',
        password: '',
        active: b ? !!b.active : true
      });
    }
    setOpenForm(true);
    showModal(boyModalId);
    setTimeout(() => { if (nameInputRef.current) nameInputRef.current.focus(); }, 400);
  }

  async function saveBoy() {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const password = form.password;
    const isEdit = !!editingId;

    const errs = {};
    if (name.length < 2) errs.name = 'Name must be at least 2 characters.';
    if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email address.';
    if (!PHONE_RE.test(phone)) errs.phone = 'Enter a valid 10-digit mobile number.';
    if (!isEdit && password.length < 6) errs.password = 'Password must be at least 6 characters.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = { name, email, phone, active: form.active };
      if (password) payload.password = password;
      const res = await apiCall(
        isEdit ? '/api/admin/delivery-boys/' + editingId : '/api/admin/delivery-boys',
        { method: isEdit ? 'PUT' : 'POST', body: payload }
      );
      hideModal(boyModalId);
      setOpenForm(false);
      showToast((res && res.message) || (isEdit ? 'Delivery Boy updated.' : 'Delivery Boy added.'));
      loadBoys();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not save the delivery boy.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function prepareToggle(id, toActive) {
    const b = (boys || []).find(x => x.id === id) || {};
    setToggleBoy({ id, name: b.name || '', email: b.email || '', phone: b.phone || '', toActive });
    showModal(toggleModalId);
  }

  async function confirmToggle() {
    if (!toggleBoy) return;
    setToggleSaving(true);
    try {
      const res = await apiCall('/api/admin/delivery-boys/' + toggleBoy.id + '/status', {
        method: 'PUT',
        body: { active: toggleBoy.toActive }
      });
      hideModal(toggleModalId);
      const wasActive = toggleBoy.toActive;
      setToggleBoy(null);
      showToast((res && res.message) || (wasActive ? 'Delivery Boy activated.' : 'Delivery Boy deactivated.'));
      loadBoys();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not update the delivery boy.', 'error');
    } finally {
      setToggleSaving(false);
    }
  }

  function prepareDelete(id) {
    const b = (boys || []).find(x => x.id === id) || {};
    setDeleteBoy({ id, name: b.name || '', email: b.email || '', phone: b.phone || '' });
    showModal(deleteModalId);
  }

  async function confirmDelete() {
    if (!deleteBoy || deleting) return;
    setDeleting(true);
    try {
      const res = await apiCall('/api/admin/delivery-boys/' + deleteBoy.id, { method: 'DELETE' });
      hideModal(deleteModalId);
      setDeleteBoy(null);
      showToast((res && res.message) || 'Delivery Boy deleted successfully.');
      // Only refresh from the server after a confirmed delete, so the row (and
      // the Total/Active/Inactive counts) never change on a failed request.
      loadBoys();
    } catch (e) {
      if (handleAuth(e)) return;
      // A 409 means the account has delivery history; keep the row in place and
      // explain that the account should be deactivated instead.
      showToast(
        e.message || 'Could not delete the delivery boy.',
        'error',
        { title: e.status === 409 ? 'Cannot Delete Delivery Boy' : 'Delete Failed' }
      );
    } finally {
      setDeleting(false);
    }
  }

  const total = (boys || []).length;
  const activeCount = (boys || []).filter(b => b.active).length;

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-4">
          <div className="stat-card h-100">
            <div className="stat-icon blue"><i className="fa-solid fa-id-badge"></i></div>
            <div className="stat-meta">
              <h6>Total Boys</h6>
              <div className="stat-value">{boys == null ? '-' : total}</div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="stat-card h-100">
            <div className="stat-icon green"><i className="fa-solid fa-circle-check"></i></div>
            <div className="stat-meta">
              <h6>Active</h6>
              <div className="stat-value">{boys == null ? '-' : activeCount}</div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="stat-card h-100">
            <div className="stat-icon red"><i className="fa-solid fa-circle-xmark"></i></div>
            <div className="stat-meta">
              <h6>Inactive</h6>
              <div className="stat-value">{boys == null ? '-' : total - activeCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="card-title mb-0"><i className="fa-solid fa-id-badge text-primary me-2"></i>Delivery Team</div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="search-box">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email or phone"
              />
              <i className="fa-solid fa-magnifying-glass"></i>
            </div>
            <select
              className="form-select form-control-fm"
              value={activeFilter}
              onChange={e => setActiveFilter(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">All</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
            <button className="btn-admin" onClick={() => openBoyModal(null)}>
              <i className="fa-solid fa-plus me-1"></i>Add Delivery Boy
            </button>
          </div>
        </div>
        <div className="table-responsive">
          {boys == null ? <SpinnerBox /> : !boys.length ? (
            <EmptyBox msg="No delivery boys found. Add one to start assigning deliveries." />
          ) : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th className="text-center">Active Deliveries</th>
                  <th className="text-center">Completed Today</th>
                  <th className="text-center">Total Completed</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {boys.map(b => (
                  <tr key={b.id}>
                    <td>
                      <strong className="small">{b.name}</strong>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>Since {fmtDateOnly(b.createdAt)}</div>
                    </td>
                    <td className="text-muted small">{b.email}</td>
                    <td className="small">{b.phone || '-'}</td>
                    <td className="text-center">
                      {Number(b.assignedCount) > 0
                        ? <span className="badge-status ASSIGNED">{b.assignedCount}</span>
                        : <span className="text-muted">0</span>}
                    </td>
                    <td className="text-center">
                      {Number(b.completedTodayCount) > 0
                        ? <span className="badge-status DELIVERED">{b.completedTodayCount}</span>
                        : <span className="text-muted">0</span>}
                    </td>
                    <td className="text-center text-muted">{b.completedCount}</td>
                    <td>
                      {b.active
                        ? <span className="badge-status CONFIRMED">Active</span>
                        : <span className="badge-status INACTIVE">Inactive</span>}
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <button className="btn-icon-xs edit" onClick={() => openBoyModal(b.id)} title="Edit Delivery Boy">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          className={'btn-icon-xs ' + (b.active ? 'toggle-on' : 'toggle-off')}
                          onClick={() => prepareToggle(b.id, !b.active)}
                          title={b.active ? 'Deactivate' : 'Activate'}
                        >
                          <i className={'fa-solid ' + (b.active ? 'fa-user-slash' : 'fa-user-check')}></i>
                        </button>
                        <button
                          className="btn-icon-xs del"
                          onClick={() => prepareDelete(b.id)}
                          title="Delete Delivery Boy"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Delivery Boy */}
      <div className="modal fade" id={boyModalId} tabIndex="-1" aria-labelledby={boyModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={boyModalId + 'Label'}>
                {editingId ? (
                  <><i className="fa-solid fa-id-badge text-primary me-2"></i>Edit Delivery Boy</>
                ) : (
                  <><i className="fa-solid fa-id-badge text-primary me-2"></i>Add Delivery Boy</>
                )}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <form noValidate onSubmit={e => { e.preventDefault(); saveBoy(); }}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="b-name">Full Name</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    className={'form-control form-control-fm' + (errors.name ? ' is-invalid' : '')}
                    id="b-name"
                    maxLength="100"
                    placeholder="e.g. Ravi Kumar"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                  <div className="invalid-feedback">{errors.name || 'Name is required.'}</div>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="b-email">Email</label>
                    <input
                      type="email"
                      className={'form-control form-control-fm' + (errors.email ? ' is-invalid' : '')}
                      id="b-email"
                      maxLength="150"
                      placeholder="ravi@freshmeat.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                    <div className="invalid-feedback">{errors.email || 'Enter a valid email address.'}</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="b-phone">Mobile Number</label>
                    <input
                      type="tel"
                      className={'form-control form-control-fm' + (errors.phone ? ' is-invalid' : '')}
                      id="b-phone"
                      maxLength="10"
                      inputMode="numeric"
                      placeholder="9876543210"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    />
                    <div className="invalid-feedback">{errors.phone || 'Enter a valid 10-digit mobile number.'}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label" htmlFor="b-password">
                    Password <span className="text-muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
                      {editingId ? '(leave blank to keep current)' : ''}
                    </span>
                  </label>
                  <input
                    type="password"
                    className={'form-control form-control-fm' + (errors.password ? ' is-invalid' : '')}
                    id="b-password"
                    maxLength="100"
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <div className="invalid-feedback">{errors.password || 'Password must be at least 6 characters.'}</div>
                  <div className="form-text text-muted" style={{ fontSize: '0.75rem' }}>
                    Stored BCrypt-hashed. Used to sign in on the Delivery Boy dashboard.
                  </div>
                </div>
                <div className="form-check form-switch mt-3" id="b-active-wrap">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="b-active"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="b-active" style={{ fontSize: '0.85rem' }}>
                    Active — can be assigned deliveries and sign in
                  </label>
                </div>
                <div className="modal-footer px-0 pb-0">
                  <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" className="btn-admin" disabled={saving}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : (
                      editingId
                        ? <><i className="fa-solid fa-floppy-disk me-1"></i>Update</>
                        : <><i className="fa-solid fa-floppy-disk me-1"></i>Create</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Activate / Deactivate confirmation */}
      <div className="modal fade" id={toggleModalId} tabIndex="-1" aria-labelledby={toggleModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={toggleModalId + 'Label'}>
                {toggleBoy && toggleBoy.toActive ? (
                  <><i className="fa-solid fa-user-check text-success me-2"></i>Activate Delivery Boy</>
                ) : (
                  <><i className="fa-solid fa-user-slash text-danger me-2"></i>Deactivate Delivery Boy</>
                )}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">
                {toggleBoy && toggleBoy.toActive
                  ? 'This delivery boy will be able to sign in and receive new assignments again.'
                  : 'This delivery boy will be signed out and will not appear in the assignment list.'}
              </p>
              <div className="mt-3 p-3 rounded" style={{ background: '#f8f9fa' }}>
                <div className="fw-semibold">{toggleBoy ? toggleBoy.name : ''}</div>
                <div className="text-muted small">
                  {toggleBoy ? toggleBoy.email + (toggleBoy.phone ? ' - ' + toggleBoy.phone : '') : ''}
                </div>
              </div>
              <p className="text-muted small mt-3 mb-0">
                Past and in-progress deliveries are kept, so reports and order history stay complete.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn-admin"
                style={toggleBoy && !toggleBoy.toActive ? { background: '#dc3545', borderColor: '#dc3545' } : {}}
                onClick={confirmToggle}
                disabled={toggleSaving}
              >
                {toggleSaving ? <><span className="spinner-border spinner-border-sm me-1"></span>Working...</> : (
                  toggleBoy && toggleBoy.toActive ? 'Activate' : 'Deactivate'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <div className="modal fade" id={deleteModalId} tabIndex="-1" aria-labelledby={deleteModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={deleteModalId + 'Label'}>
                <i className="fa-solid fa-trash text-danger me-2"></i>Delete Delivery Boy
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">
                Are you sure you want to delete {deleteBoy ? deleteBoy.name : 'this delivery boy'}?
              </p>
              <div className="mt-3 p-3 rounded" style={{ background: '#f8f9fa' }}>
                <div className="fw-semibold">{deleteBoy ? deleteBoy.name : ''}</div>
                <div className="text-muted small">
                  {deleteBoy ? deleteBoy.email + (deleteBoy.phone ? ' - ' + deleteBoy.phone : '') : ''}
                </div>
              </div>
              <p className="text-danger small mt-3 mb-0">
                <i className="fa-solid fa-triangle-exclamation me-1"></i>
                This permanently removes the account and cannot be undone. If the delivery boy has any
                delivery history, deletion is blocked and you should deactivate the account instead.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn-admin"
                style={{ background: '#dc3545', borderColor: '#dc3545' }}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner-border spinner-border-sm me-1"></span>Deleting...</> : 'Delete Delivery Boy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* keep open-form state in sync when the modal is closed */}
      {openForm && (
        <ModalHiddenWatcher id={boyModalId} onHidden={() => setOpenForm(false)} />
      )}
    </>
  );
}

/* Hidden watcher: mirrors the original hidden.bs.modal focus-cleanup by just
   syncing React state when the modal fully closes. */
function ModalHiddenWatcher({ id, onHidden }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return undefined;
    const handler = () => {
      if (el.contains(document.activeElement)) document.activeElement.blur();
      onHidden();
    };
    el.addEventListener('hidden.bs.modal', handler);
    return () => el.removeEventListener('hidden.bs.modal', handler);
  }, [id, onHidden]);
  return null;
}