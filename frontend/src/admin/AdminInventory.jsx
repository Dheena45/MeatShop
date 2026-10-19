import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { fmtDate, fmtMoney } from '../lib/format';
import { showToast } from '../lib/toast';
import { AdminStatusBadge, EmptyBox, SpinnerBox, hideModal, showModal, useModalId } from './AdminLayout';

/* FreshMeat — Admin Inventory controller (ported from inventory.js) */

export default function AdminInventory() {
  const [items, setItems] = useState(null);

  const [editProductId, setEditProductId] = useState(null);
  const [invName, setInvName] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [saving, setSaving] = useState(false);

  const inventoryModalId = useModalId('inventoryModal');

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

  const loadInventory = useCallback(async () => {
    setItems(null);
    try {
      const res = await apiCall('/api/admin/inventory');
      if (!mounted.current) return;
      setItems(res.data || []);
    } catch (e) {
      if (!mounted.current) return;
      if (handleAuth(e)) return;
      setItems([]);
      showToast(e.message, 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  function openInventoryModal(productId) {
    const item = (items || []).find(i => i.productId === productId);
    setEditProductId(productId);
    setInvName(item ? item.productName : '');
    setStock(item ? item.currentStock : '');
    setMinStock(item ? item.minStock : '');
    showModal(inventoryModalId);
  }

  async function saveInventory() {
    if (stock === '' || Number(stock) < 0) { showToast('Valid stock required', 'warning'); return; }
    if (minStock === '' || Number(minStock) < 0) { showToast('Valid min stock required', 'warning'); return; }

    setSaving(true);
    try {
      await apiCall('/api/admin/inventory/' + editProductId, {
        method: 'PUT', body: { stock: Number(stock), minStock: Number(minStock) }
      });
      showToast('Inventory updated');
      hideModal(inventoryModalId);
      loadInventory();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-card">
        <div className="table-responsive">
          {items == null ? <SpinnerBox /> : !items.length ? (
            <EmptyBox msg="No inventory records yet" />
          ) : (
            <table className="table table-fm align-middle">
              <thead>
                <tr>
                  <th>Product</th><th>Category</th><th>Price/KG</th><th>Current Stock</th>
                  <th>Min Stock</th><th>Status</th><th>Last Restocked</th><th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.productId}>
                    <td><strong className="small">{i.productName}</strong></td>
                    <td className="text-muted">{i.categoryName || '-'}</td>
                    <td>{fmtMoney(i.pricePerKg)}</td>
                    <td><strong>{i.currentStock} KG</strong></td>
                    <td>{i.minStock} KG</td>
                    <td><AdminStatusBadge status={i.stockStatus} /></td>
                    <td className="text-muted" style={{ fontSize: '0.78rem' }}>{fmtDate(i.lastRestockedAt)}</td>
                    <td className="text-end">
                      <button className="btn-icon-xs edit" onClick={() => openInventoryModal(i.productId)} title="Update stock">
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Inventory edit modal */}
      <div className="modal fade" id={inventoryModalId} tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Update Stock</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              <p className="fw-semibold">{invName}</p>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Current Stock (KG)</label>
                  <input
                    type="number"
                    className="form-control form-control-fm"
                    min="0"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Min Stock Alert (KG)</label>
                  <input
                    type="number"
                    className="form-control form-control-fm"
                    min="0"
                    value={minStock}
                    onChange={e => setMinStock(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-admin-outline" data-bs-dismiss="modal">Cancel</button>
              <button className="btn-admin" onClick={saveInventory} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : 'Save Stock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}