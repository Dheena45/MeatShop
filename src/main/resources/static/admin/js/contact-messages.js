/* FreshMeat — Admin Contact Messages controller */

let messagesCache = {};
let deleteMessageId = null;
let deleteMessageModal = null;
let viewMessageModal = null;

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('contact-messages', 'Contact Messages', 'Customer enquiries from the Get in Touch form')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="admin-card">
      <div id="messages-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    document.getElementById('confirm-delete-message-btn').addEventListener('click', confirmDeleteMessage);

    // Clean focus before Bootstrap toggles aria-hidden on hide, so no element
    // inside the hidden modal keeps focus (prevents the blocked aria-hidden warning).
    document.getElementById('deleteMessageModal').addEventListener('hidden.bs.modal', () => {
        const modalEl = document.getElementById('deleteMessageModal');
        const active = document.activeElement;
        if (modalEl && active && modalEl.contains(active)) active.blur();
    });
    document.getElementById('viewMessageModal').addEventListener('hidden.bs.modal', () => {
        const modalEl = document.getElementById('viewMessageModal');
        const active = document.activeElement;
        if (modalEl && active && modalEl.contains(active)) active.blur();
    });

    loadMessages();
});

async function loadMessages() {
    const body = document.getElementById('messages-body');
    try {
        const res = await apiCall('/api/admin/contact-messages');
        const messages = res.data || [];
        messagesCache = {};
        messages.forEach(m => { messagesCache[m.id] = m; });
        if (!messages.length) { body.innerHTML = emptyBoxHtml('No contact messages yet'); return; }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead><tr><th>Customer</th><th>Email</th><th>Message</th><th>Date</th><th>Status</th><th class="text-end">Action</th></tr></thead>
          <tbody>
            ${messages.map(m => `
            <tr>
              <td><strong class="small">${escapeHtml(m.customerName || 'Guest')}</strong></td>
              <td class="text-muted">${escapeHtml(m.email)}</td>
              <td class="small" style="max-width:280px;">${escapeHtml(truncate(m.message, 70))}</td>
              <td class="text-muted" style="font-size:0.78rem;">${fmtDate(m.createdAt)}</td>
              <td>${adminStatusBadge(m.status)}</td>
              <td>
                <div class="d-flex justify-content-end gap-1">
                  <button class="btn-icon-xs" onclick="prepareViewMessage(${m.id})" title="View Message">
                    <i class="fa-solid fa-eye"></i>
                  </button>
                  ${m.status === 'NEW' ? `
                  <button class="btn-icon-xs edit" onclick="markMessageRead(${m.id})" title="Mark as Read">
                    <i class="fa-solid fa-envelope-open"></i>
                  </button>` : ''}
                  ${m.status !== 'RESOLVED' ? `
                  <button class="btn-icon-xs toggle-on" onclick="markMessageResolved(${m.id})" title="Mark as Resolved">
                    <i class="fa-solid fa-circle-check"></i>
                  </button>` : ''}
                  <button class="btn-icon-xs del" onclick="prepareDeleteMessage(${m.id})" title="Delete Message">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

function truncate(str, max) {
    str = str || '';
    return str.length > max ? str.slice(0, max) + '…' : str;
}

function prepareViewMessage(id) {
    const m = messagesCache[id];
    if (!m) return;

    document.getElementById('vm-name').textContent = m.customerName || 'Guest';
    document.getElementById('vm-email').textContent = m.email || '';
    document.getElementById('vm-message').textContent = m.message || '';
    document.getElementById('vm-date').textContent = m.createdAt ? 'Received on ' + fmtDate(m.createdAt) : '';
    document.getElementById('vm-status').innerHTML = adminStatusBadge(m.status);

    if (!viewMessageModal) viewMessageModal = new bootstrap.Modal(document.getElementById('viewMessageModal'));
    viewMessageModal.show();
}

async function markMessageRead(id) {
    try {
        const res = await apiCall('/api/admin/contact-messages/' + id + '/read', { method: 'PUT' });
        showToast((res && res.message) || 'Message marked as read.');
        loadMessages();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        showToast(e.message || 'Could not update the message', 'error');
    }
}

async function markMessageResolved(id) {
    try {
        const res = await apiCall('/api/admin/contact-messages/' + id + '/resolve', { method: 'PUT' });
        showToast((res && res.message) || 'Message marked as resolved.');
        loadMessages();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        showToast(e.message || 'Could not update the message', 'error');
    }
}

function prepareDeleteMessage(id) {
    const m = messagesCache[id] || {};
    deleteMessageId = id;
    document.getElementById('dm-name').textContent = m.customerName || 'Guest';
    document.getElementById('dm-email').textContent = m.email || '';

    const btn = document.getElementById('confirm-delete-message-btn');
    btn.disabled = false;
    btn.innerHTML = 'Delete Message';

    if (!deleteMessageModal) deleteMessageModal = new bootstrap.Modal(document.getElementById('deleteMessageModal'));
    deleteMessageModal.show();
}

async function confirmDeleteMessage() {
    if (!deleteMessageId) return;
    const btn = document.getElementById('confirm-delete-message-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...';
    try {
        const res = await apiCall('/api/admin/contact-messages/' + deleteMessageId, { method: 'DELETE' });
        deleteMessageModal.hide();
        deleteMessageId = null;
        showToast((res && res.message) || 'Message deleted successfully.');
        loadMessages();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        btn.disabled = false;
        btn.innerHTML = 'Delete Message';
        showToast(e.message || 'Could not delete the message', 'error');
    }
}
