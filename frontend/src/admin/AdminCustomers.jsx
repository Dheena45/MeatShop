import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { fmtDateOnly } from '../lib/format';
import { showToast } from '../lib/toast';
import { EmptyBox, SpinnerBox, hideModal, showModal, useModalId } from './AdminLayout';

/* FreshMeat — Admin Customers controller (ported from customers.js) */

export default function AdminCustomers() {
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');

  const [toggleCustomer, setToggleCustomer] = useState(null); /* {id, name, email, toActive} */
  const [toggling, setToggling] = useState(false);

  const [deleteCustomer, setDeleteCustomer] = useState(null); /* {id, name, email} */
  const [deleting, setDeleting] = useState(false);

  const deleteModalId = useModalId('deleteCustomerModal');
  const toggleModalId = useModalId('toggleCustomerModal');

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

  const loadCustomers = useCallback(async () => {
    const q = search.trim();
    setCustomers(null);
    try {
      const res = await apiCall('/api/admin/customers' + (q ? '?search=' + encodeURIComponent(q) : ''));
      if (!mounted.current) return;
      setCustomers(res.data || []);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setCustomers([]);
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => loadCustomers(), 400);
    return () => clearTimeout(t);
  }, [loadCustomers]);

  function prepareToggleCustomer(id, toActive) {
    const c = (customers || []).find(x => x.id === id) || {};
    setToggleCustomer({ id, name: c.name || '', email: c.email || '', toActive });
    showModal(toggleModalId);
  }

  async function confirmToggleCustomer() {
    if (!toggleCustomer) return;
    const toActive = toggleCustomer.toActive;
    setToggling(true);
    try {
      await apiCall('/api/admin/customers/' + toggleCustomer.id + '/toggle', { method: 'PUT' });
      hideModal(toggleModalId);
      setToggleCustomer(null);
      showToast(toActive ? 'Customer activated successfully.' : 'Customer deactivated successfully.');
      loadCustomers();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not update customer status', 'error');
    } finally {
      setToggling(false);
    }
  }

  function prepareDeleteCustomer(id) {
    const c = (customers || []).find(x => x.id === id) || {};
    setDeleteCustomer({ id, name: c.name || '', email: c.email || '' });
    showModal(deleteModalId);
  }

  async function confirmDeleteCustomer() {
    if (!deleteCustomer) return;
    setDeleting(true);
    try {
      const res = await apiCall('/api/admin/customers/' + deleteCustomer.id, { method: 'DELETE' });
      hideModal(deleteModalId);
      setDeleteCustomer(null);
      showToast((res && res.message) || 'Customer deleted successfully.');
      loadCustomers();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not delete customer', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="search-box">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers..."
          />
          <i className="fa-solid fa-magnifying-glass"></i>
        </div>
      </div>

      <div className="admin-card">
        <div className="table-responsive">
          {customers == null ? <SpinnerBox /> : !customers.length ? (
            <EmptyBox msg="No customers found" />
          ) : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Customer</th><th>Email</th><th>Phone</th><th>Joined</th><th>Status</th><th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td><strong className="small">{c.name}</strong></td>
                    <td className="text-muted">{c.email}</td>
                    <td>{c.phone || '-'}</td>
                    <td className="text-muted" style={{ fontSize: '0.78rem' }}>{fmtDateOnly(c.createdAt)}</td>
                    <td>
                      {c.enabled
                        ? <span className="badge-status CONFIRMED">Active</span>
                        : <span className="badge-status CANCELLED">Inactive</span>}
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <button
                          className={'btn-icon-xs ' + (c.enabled ? 'toggle-on' : 'toggle-off')}
                          onClick={() => prepareToggleCustomer(c.id, !c.enabled)}
                          title={c.enabled ? 'Deactivate' : 'Activate'}
                        >
                          <i className={'fa-solid ' + (c.enabled ? 'fa-user-slash' : 'fa-user-check')}></i>
                        </button>
                        <button className="btn-icon-xs del" onClick={() => prepareDeleteCustomer(c.id)} title="Delete Customer">
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

      {/* Delete customer confirmation modal */}
      <div className="modal fade" id={deleteModalId} tabIndex="-1" aria-labelledby={deleteModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={deleteModalId + 'Label'}>
                <i className="fa-solid fa-trash text-danger me-2"></i>Delete Customer
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">Are you sure you want to delete this customer?</p>
              <div className="mt-3 p-3 rounded" style={{ background: '#f8f9fa' }}>
                <div className="fw-semibold">{deleteCustomer ? deleteCustomer.name : ''}</div>
                <div className="text-muted small">{deleteCustomer ? deleteCustomer.email : ''}</div>
              </div>
              <p className="text-danger small mt-3 mb-0">
                <i className="fa-solid fa-triangle-exclamation me-1"></i>This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn-admin"
                style={{ background: '#dc3545', borderColor: '#dc3545' }}
                onClick={confirmDeleteCustomer}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner-border spinner-border-sm me-1"></span>Deleting...</> : 'Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deactivate / Activate customer confirmation modal */}
      <div className="modal fade" id={toggleModalId} tabIndex="-1" aria-labelledby={toggleModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={toggleModalId + 'Label'}>
                {toggleCustomer && !toggleCustomer.toActive ? 'Deactivate Customer' : 'Activate Customer'}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">
                {toggleCustomer && !toggleCustomer.toActive
                  ? 'Are you sure you want to deactivate this customer?'
                  : 'Are you sure you want to activate this customer?'}
              </p>
              <div className="mt-3 p-3 rounded" style={{ background: '#f8f9fa' }}>
                <div className="fw-semibold">{toggleCustomer ? toggleCustomer.name : ''}</div>
                <div className="text-muted small">{toggleCustomer ? toggleCustomer.email : ''}</div>
              </div>
              {toggleCustomer && !toggleCustomer.toActive ? (
                <p className="text-danger small mt-3 mb-0">
                  <i className="fa-solid fa-triangle-exclamation me-1"></i>
                  The customer will not be able to use the account while inactive.
                </p>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn-admin"
                style={toggleCustomer && !toggleCustomer.toActive ? { background: '#dc3545', borderColor: '#dc3545' } : {}}
                onClick={confirmToggleCustomer}
                disabled={toggling}
              >
                {toggling ? (
                  <><span className="spinner-border spinner-border-sm me-1"></span>
                    {toggleCustomer && !toggleCustomer.toActive ? 'Deactivating...' : 'Activating...'}</>
                ) : (
                  toggleCustomer && !toggleCustomer.toActive ? 'Deactivate Customer' : 'Activate Customer'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}