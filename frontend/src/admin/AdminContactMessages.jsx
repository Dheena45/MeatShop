import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { fmtDate } from '../lib/format';
import { showToast } from '../lib/toast';
import { AdminStatusBadge, EmptyBox, SpinnerBox, hideModal, showModal, useModalId } from './AdminLayout';

/* FreshMeat — Admin Contact Messages controller (ported from contact-messages.js) */

function truncate(str, max) {
  str = str || '';
  return str.length > max ? str.slice(0, max) + '\u2026' : str;
}

export default function AdminContactMessages() {
  const [messages, setMessages] = useState(null);

  const [view, setView] = useState(null); /* message object being viewed */
  const [deleteMessage, setDeleteMessage] = useState(null); /* {id, name, email} */
  const [deleting, setDeleting] = useState(false);

  const viewModalId = useModalId('viewMessageModal');
  const deleteModalId = useModalId('deleteMessageModal');

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

  const loadMessages = useCallback(async () => {
    setMessages(null);
    try {
      const res = await apiCall('/api/admin/contact-messages');
      if (!mounted.current) return;
      setMessages(res.data || []);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setMessages([]);
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  function prepareViewMessage(id) {
    const m = (messages || []).find(x => x.id === id);
    if (!m) return;
    setView(m);
    showModal(viewModalId);
  }

  async function markMessageRead(id) {
    try {
      const res = await apiCall('/api/admin/contact-messages/' + id + '/read', { method: 'PUT' });
      showToast((res && res.message) || 'Message marked as read.');
      loadMessages();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not update the message', 'error');
    }
  }

  async function markMessageResolved(id) {
    try {
      const res = await apiCall('/api/admin/contact-messages/' + id + '/resolve', { method: 'PUT' });
      showToast((res && res.message) || 'Message marked as resolved.');
      loadMessages();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not update the message', 'error');
    }
  }

  function prepareDeleteMessage(id) {
    const m = (messages || []).find(x => x.id === id) || {};
    setDeleteMessage({ id, name: m.customerName || 'Guest', email: m.email || '' });
    showModal(deleteModalId);
  }

  async function confirmDeleteMessage() {
    if (!deleteMessage) return;
    setDeleting(true);
    try {
      const res = await apiCall('/api/admin/contact-messages/' + deleteMessage.id, { method: 'DELETE' });
      hideModal(deleteModalId);
      setDeleteMessage(null);
      showToast((res && res.message) || 'Message deleted successfully.');
      loadMessages();
    } catch (e) {
      if (handleAuth(e)) return;
      showToast(e.message || 'Could not delete the message', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="admin-card">
        <div className="table-responsive">
          {messages == null ? <SpinnerBox /> : !messages.length ? (
            <EmptyBox msg="No contact messages yet" />
          ) : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Customer</th><th>Email</th><th>Message</th><th>Date</th><th>Status</th><th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {messages.map(m => (
                  <tr key={m.id}>
                    <td><strong className="small">{m.customerName || 'Guest'}</strong></td>
                    <td className="text-muted">{m.email}</td>
                    <td className="small" style={{ maxWidth: 280 }}>{truncate(m.message, 70)}</td>
                    <td className="text-muted" style={{ fontSize: '0.78rem' }}>{fmtDate(m.createdAt)}</td>
                    <td><AdminStatusBadge status={m.status} /></td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <button className="btn-icon-xs" onClick={() => prepareViewMessage(m.id)} title="View Message">
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        {m.status === 'NEW' ? (
                          <button className="btn-icon-xs edit" onClick={() => markMessageRead(m.id)} title="Mark as Read">
                            <i className="fa-solid fa-envelope-open"></i>
                          </button>
                        ) : null}
                        {m.status !== 'RESOLVED' ? (
                          <button className="btn-icon-xs toggle-on" onClick={() => markMessageResolved(m.id)} title="Mark as Resolved">
                            <i className="fa-solid fa-circle-check"></i>
                          </button>
                        ) : null}
                        <button className="btn-icon-xs del" onClick={() => prepareDeleteMessage(m.id)} title="Delete Message">
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

      {/* View message modal */}
      <div className="modal fade" id={viewModalId} tabIndex="-1" aria-labelledby={viewModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={viewModalId + 'Label'}>
                <i className="fa-regular fa-envelope me-2"></i>Message
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <div className="fw-semibold">{view ? view.customerName || 'Guest' : ''}</div>
                  <div className="text-muted small">{view ? view.email || '' : ''}</div>
                </div>
                <div className="text-end">{view ? <AdminStatusBadge status={view.status} /> : null}</div>
              </div>
              <div className="p-3 rounded small" style={{ background: '#f8f9fa' }}>
                {view ? view.message || '' : ''}
              </div>
              <div className="text-muted mt-3" style={{ fontSize: '0.78rem' }}>
                {view && view.createdAt ? 'Received on ' + fmtDate(view.createdAt) : ''}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete message confirmation modal */}
      <div className="modal fade" id={deleteModalId} tabIndex="-1" aria-labelledby={deleteModalId + 'Label'} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={deleteModalId + 'Label'}>
                <i className="fa-solid fa-trash text-danger me-2"></i>Delete Message
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">Are you sure you want to delete this message?</p>
              <div className="mt-3 p-3 rounded" style={{ background: '#f8f9fa' }}>
                <div className="fw-semibold">{deleteMessage ? deleteMessage.name : ''}</div>
                <div className="text-muted small">{deleteMessage ? deleteMessage.email : ''}</div>
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
                onClick={confirmDeleteMessage}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner-border spinner-border-sm me-1"></span>Deleting...</> : 'Delete Message'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}