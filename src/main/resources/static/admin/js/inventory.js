/* FreshMeat — Admin Inventory controller */

let editInventoryProductId = null;
const INVENTORY_MODAL = new bootstrap.Modal(document.getElementById('inventoryModal'));

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('inventory', 'Inventory', 'Stock levels & reorder alerts')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="admin-card">
      <div id="inventory-body" class="table-responsive">${spinnerHtml()}</div>
    </div>`;

    loadInventory();

    document.getElementById('inv-save-btn').addEventListener('click', saveInventory);
});

async function loadInventory() {
    const body = document.getElementById('inventory-body');
    try {
        const res = await apiCall('/api/admin/inventory');
        const items = res.data || [];
        window._inventoryCache = items;
        if (!items.length) { body.innerHTML = emptyBoxHtml('No inventory records yet'); return; }

        body.innerHTML = `
        <table class="table table-fm align-middle">
          <thead><tr><th>Product</th><th>Category</th><th>Price/KG</th><th>Current Stock</th><th>Min Stock</th><th>Status</th><th>Last Restocked</th><th class="text-end">Action</th></tr></thead>
          <tbody>
            ${items.map(i => `
            <tr>
              <td><strong class="small">${escapeHtml(i.productName)}</strong></td>
              <td class="text-muted">${escapeHtml(i.categoryName || '-')}</td>
              <td>${fmtMoney(i.pricePerKg)}</td>
              <td><strong>${i.currentStock} KG</strong></td>
              <td>${i.minStock} KG</td>
              <td>${adminStatusBadge(i.stockStatus)}</td>
              <td class="text-muted" style="font-size:0.78rem;">${fmtDate(i.lastRestockedAt)}</td>
              <td class="text-end">
                <button class="btn-icon-xs edit" onclick="openInventoryModal(${i.productId})" title="Update stock"><i class="fa-solid fa-pen-to-square"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        body.innerHTML = emptyBoxHtml(e.message);
    }
}

function openInventoryModal(productId) {
    editInventoryProductId = productId;
    const items = window._inventoryCache || [];
    const item = items.find(i => i.productId === productId);
    if (item) {
        document.getElementById('inv-product-name').textContent = item.productName;
        document.getElementById('inv-stock').value = item.currentStock;
        document.getElementById('inv-min').value = item.minStock;
    }
    INVENTORY_MODAL.show();
}

async function saveInventory() {
    const stock = document.getElementById('inv-stock').value;
    const minStock = document.getElementById('inv-min').value;
    if (stock === '' || Number(stock) < 0) { showToast('Valid stock required', 'warning'); return; }
    if (minStock === '' || Number(minStock) < 0) { showToast('Valid min stock required', 'warning'); return; }

    try {
        await apiCall('/api/admin/inventory/' + editInventoryProductId, {
            method: 'PUT', body: { stock: Number(stock), minStock: Number(minStock) }
        });
        showToast('Inventory updated');
        INVENTORY_MODAL.hide();
        loadInventory();
    } catch (e) { showToast(e.message, 'error'); }
}