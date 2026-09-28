/* FreshMeat — Admin Dashboard controller */

let charts = {};
let trendLabels = [];
let trendRanges = [];
let currentPeriod = 'this-month';
let lastRangeLabel = 'This Month';
let lastStatusDist = [];
let lastInventory = null;
let lastCustomers = null;
let orderRows = [];

let revenueModal = null;
let ordersModal = null;
let customersModal = null;
let inventoryModal = null;
let monthModal = null;
let productSalesModal = null;
let yearlyModal = null;

const STATUS_COLORS = {
    CONFIRMED: '#1a56db',
    READY_FOR_PICKUP: '#3b82f6',
    PREPARING: '#b45309',
    OUT_FOR_DELIVERY: '#7c3aed',
    DELIVERED: '#047857',
    CANCELLED: '#b91c1c'
};

const CATEGORY_COLORS = ['#8B0000', '#D4A843', '#1e9e4a', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316'];

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('dashboard', 'Dashboard', 'Business overview & performance')) return;

    injectPage();
    wireEvents();
    loadDashboard();
});

function injectPage() {
    document.getElementById('admin-page-content').innerHTML = `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <select id="dash-period" class="form-select form-control-fm" style="width:auto;">
        <option value="today">Today</option>
        <option value="this-week">This Week</option>
        <option value="this-month" selected>This Month</option>
        <option value="last-3-months">Last 3 Months</option>
        <option value="last-6-months">Last 6 Months</option>
        <option value="this-year">This Year</option>
        <option value="custom">Custom Range</option>
      </select>
      <div class="d-flex gap-2 align-items-center d-none" id="dash-custom-wrap">
        <input type="date" id="dash-from" class="form-control form-control-fm" style="width:auto;">
        <span class="text-muted">to</span>
        <input type="date" id="dash-to" class="form-control form-control-fm" style="width:auto;">
      </div>
      <button class="btn-admin" id="dash-refresh"><i class="fa-solid fa-rotate me-1"></i>Refresh Dashboard</button>
      <span class="text-muted small ms-auto" id="dash-period-label"></span>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-6 col-lg-3">
        <div class="stat-card clickable" id="card-revenue">
          <div class="stat-icon red"><i class="fa-solid fa-sack-dollar"></i></div>
          <div class="stat-meta">
            <h6 id="card-revenue-title">This Month</h6>
            <div class="stat-value" id="card-revenue-value">&mdash;</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card clickable" id="card-orders">
          <div class="stat-icon gold"><i class="fa-solid fa-box-open"></i></div>
          <div class="stat-meta">
            <h6>Total Orders</h6>
            <div class="stat-value" id="card-orders-value">&mdash;</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card clickable" id="card-customers">
          <div class="stat-icon green"><i class="fa-solid fa-users"></i></div>
          <div class="stat-meta">
            <h6>Customers</h6>
            <div class="stat-value" id="card-customers-value">&mdash;</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card clickable" id="card-inventory">
          <div class="stat-icon orange"><i class="fa-solid fa-boxes-stacked"></i></div>
          <div class="stat-meta">
            <h6>Low / Out of Stock</h6>
            <div class="stat-value" id="card-inventory-value">&mdash;</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-8">
        <div class="admin-card">
          <div class="card-title">Revenue Trend <span class="sub" id="trend-subtitle"></span></div>
          <div class="chart-box" id="chart-box-revenue"></div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="admin-card">
          <div class="card-title">Order Status</div>
          <div class="chart-box" id="chart-box-status"></div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="admin-card">
          <div class="card-title d-flex justify-content-between align-items-center">Top Selling Products
            <button class="btn-admin-outline" style="padding:0.3rem 0.8rem;font-size:0.72rem;" id="top-products-view">View Products</button>
          </div>
          <div class="chart-box" id="chart-box-top"></div>
        </div>
      </div>
      <div class="col-lg-7">
        <div class="admin-card">
          <div class="card-title">Category-wise Sales</div>
          <div class="chart-box" id="chart-box-category"></div>
        </div>
      </div>
    </div>`;
}

function wireEvents() {
    document.getElementById('dash-period').addEventListener('change', function () {
        currentPeriod = this.value;
        document.getElementById('dash-custom-wrap').classList.toggle('d-none', currentPeriod !== 'custom');
        if (currentPeriod === 'custom') {
            const f = document.getElementById('dash-from').value;
            const t = document.getElementById('dash-to').value;
            if (f && t) loadDashboard();
        } else {
            loadDashboard();
        }
    });

    document.getElementById('dash-from').addEventListener('change', maybeLoadCustom);
    document.getElementById('dash-to').addEventListener('change', maybeLoadCustom);
    document.getElementById('dash-refresh').addEventListener('click', () => loadDashboard(true));

    document.getElementById('card-revenue').addEventListener('click', function () {
        if (currentPeriod === 'this-year') {
            openYearlySummaryModal();
        } else {
            openRevenueModal();
        }
    });
    document.getElementById('card-orders').addEventListener('click', openOrdersModal);
    document.getElementById('card-customers').addEventListener('click', openCustomersModal);
    document.getElementById('card-inventory').addEventListener('click', openInventoryModal);

    document.getElementById('customers-view-btn').addEventListener('click', () => { window.location.href = '/admin/customers.html'; });
    document.getElementById('inventory-manage-btn').addEventListener('click', () => { window.location.href = '/admin/inventory.html'; });
    document.getElementById('month-view-orders').addEventListener('click', () => { window.location.href = '/admin/orders.html'; });
    document.getElementById('yearly-view-orders').addEventListener('click', () => { window.location.href = '/admin/orders.html'; });
    document.getElementById('top-products-view').addEventListener('click', () => { window.location.href = '/admin/products.html'; });

    ['revenueModal', 'ordersModal', 'customersModal', 'inventoryModal', 'monthModal', 'productSalesModal', 'yearlyModal'].forEach(id => {
        document.getElementById(id).addEventListener('hidden.bs.modal', () => {
            const el = document.getElementById(id);
            const active = document.activeElement;
            if (el && active && el.contains(active)) active.blur();
        });
    });
}

function maybeLoadCustom() {
    const f = document.getElementById('dash-from').value;
    const t = document.getElementById('dash-to').value;
    if (f && t) loadDashboard();
}

function periodRange() {
    const now = new Date();
    switch (currentPeriod) {
        case 'today':
            return { from: new Date(now), to: new Date(now), label: 'Today' };
        case 'this-week': {
            const from = new Date(now);
            from.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            return { from, to: now, label: 'This Week' };
        }
        case 'last-3-months':
            return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: now, label: 'Last 3 Months' };
        case 'last-6-months':
            return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to: now, label: 'Last 6 Months' };
        case 'this-year':
            return { from: new Date(now.getFullYear(), 0, 1), to: now, label: 'This Year' };
        case 'custom': {
            const f = document.getElementById('dash-from').value;
            const t = document.getElementById('dash-to').value;
            if (!f || !t) return null;
            const from = new Date(f + 'T00:00:00');
            const to = new Date(t + 'T00:00:00');
            if (from > to) return null;
            return { from, to, label: 'Custom Range' };
        }
        default:
            return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, label: 'This Month' };
    }
}

function iso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

async function loadDashboard(showToast) {
    const range = periodRange();
    if (!range) {
        showToast('Please select a valid start and end date for the custom range.', 'warning');
        return;
    }
    lastRangeLabel = range.label;
    const q = '?from=' + iso(range.from) + '&to=' + iso(range.to);
    const refreshBtn = document.getElementById('dash-refresh');
    refreshBtn.disabled = true;

    document.getElementById('card-revenue-title').textContent = range.label;
    document.getElementById('dash-period-label').textContent = range.label + ' — ' + iso(range.from) + ' to ' + iso(range.to);
    document.getElementById('trend-subtitle').textContent = range.label.toLowerCase();

    try {
        const [summary, trend, status, top, category, inventory, customers] = await Promise.all([
            apiCall('/api/admin/dashboard/summary' + q),
            apiCall('/api/admin/dashboard/revenue-trend' + q),
            apiCall('/api/admin/dashboard/order-status' + q),
            apiCall('/api/admin/dashboard/top-products' + q),
            apiCall('/api/admin/dashboard/category-sales' + q),
            apiCall('/api/admin/dashboard/inventory-summary'),
            apiCall('/api/admin/dashboard/customer-summary' + q)
        ]);

        lastStatusDist = status.data || [];
        lastInventory = inventory.data;
        lastCustomers = customers.data;

        renderCards(summary.data, inventory.data, customers.data);
        renderRevenueTrend(trend.data || [], range);
        renderOrderStatus(lastStatusDist);
        renderTopProducts(top.data || []);
        renderCategorySales(category.data || []);
        if (showToast) showToast('Dashboard updated.');
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        showToast('Unable to load dashboard data. Please try again.', 'error');
    } finally {
        refreshBtn.disabled = false;
    }
}

function renderCards(summary, inventory, customers) {
    document.getElementById('card-revenue-value').textContent = fmtMoney(summary.revenue);
    document.getElementById('card-orders-value').textContent = summary.totalOrders;
    document.getElementById('card-customers-value').textContent = customers.total;
    document.getElementById('card-inventory-value').textContent = Number(summary.lowStock) + Number(summary.outOfStock);
}

/* ---------- charts ---------- */

function mount(boxId) {
    const box = document.getElementById(boxId);
    box.innerHTML = '<canvas></canvas>';
    return box.querySelector('canvas');
}

function emptyChart(boxId, msg) {
    const box = document.getElementById(boxId);
    box.innerHTML = '<div class="empty-box"><i class="fa-regular fa-chart-bar"></i><div>' + escapeHtml(msg || 'No sales data available') + '</div></div>';
}

function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

function renderRevenueTrend(points, range) {
    destroyChart('revenue');
    trendLabels = points.map(p => p.label);
    trendRanges = computeTrendRanges(points.length, range);

    const hasData = points.some(p => p.revenue > 0 || p.orders > 0);
    if (!points.length || !hasData) { emptyChart('chart-box-revenue', 'No sales data available'); return; }

    const orders = points.map(p => p.orders);
    const canvas = mount('chart-box-revenue');
    charts.revenue = new Chart(canvas, {
        type: 'line',
        data: {
            labels: points.map(p => p.shortLabel),
            datasets: [{
                label: 'Revenue (₹)',
                data: points.map(p => p.revenue),
                borderColor: '#8B0000',
                backgroundColor: 'rgba(139,0,0,0.08)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#D4A843',
                pointRadius: 4,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: items => items.length ? trendLabels[items[0].dataIndex] : '',
                        label: ctx => ['Revenue: ' + fmtMoney(ctx.parsed.y), 'Orders: ' + orders[ctx.dataIndex]]
                    }
                }
            },
            scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + (v >= 1000 ? (v / 1000) + 'k' : v) } } },
            onClick: (e, els) => {
                if (!els.length) return;
                openMonthModal(trendRanges[els[0].index], trendLabels[els[0].index]);
            }
        }
    });
}

function computeTrendRanges(length, range) {
    const ranges = [];
    const days = Math.round((range.to - range.from) / 86400000);
    if (days <= 32) {
        for (let i = 0; i < length; i++) {
            const d = new Date(range.from);
            d.setDate(d.getDate() + i);
            ranges.push({ from: d, to: d });
        }
    } else {
        const start = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
        for (let i = 0; i < length; i++) {
            const from = new Date(start.getFullYear(), start.getMonth() + i, 1);
            const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
            ranges.push({ from, to });
        }
    }
    return ranges;
}

function renderOrderStatus(data) {
    destroyChart('status');
    const total = data.reduce((s, d) => s + d.count, 0);
    if (!total) { emptyChart('chart-box-status', 'No sales data available'); return; }
    const canvas = mount('chart-box-status');
    charts.status = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.status.replace(/_/g, ' ')),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: data.map(d => STATUS_COLORS[d.status] || '#6b7280'),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.label + ': ' + ctx.parsed + ' (' + Math.round(ctx.parsed / total * 100) + '%)'
                    }
                }
            },
            onClick: (e, els) => {
                if (!els.length) return;
                const status = data[els[0].index].status;
                if (status) window.location.href = '/admin/orders.html?status=' + encodeURIComponent(status);
            }
        }
    });
}

function renderTopProducts(data) {
    destroyChart('top');
    const hasData = data.some(p => p.soldQuantity > 0);
    if (!data.length || !hasData) { emptyChart('chart-box-top', 'No sales data available'); return; }

    const ranked = data.map((p, i) => ({ ...p, rank: i + 1 })).reverse();
    const canvas = mount('chart-box-top');
    charts.top = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ranked.map(p => (p.productName || '').length > 16 ? p.productName.slice(0, 15) + '…' : p.productName),
            datasets: [{
                label: 'KG Sold',
                data: ranked.map(p => p.soldQuantity),
                backgroundColor: '#D4A843',
                borderRadius: 6,
                barThickness: 22
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        afterLabel: ctx => ['Rank: ' + ranked[ctx.dataIndex].rank, 'Revenue: ' + fmtMoney(ranked[ctx.dataIndex].revenue),
                            'Click to view ' + ranked[ctx.dataIndex].productName]
                    }
                }
            },
            scales: { x: { beginAtZero: true } },
            onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
            onClick: (e, els) => {
                if (!els.length) return;
                const p = ranked[els[0].index];
                if (!p || p.productId == null) return;
                openProductSalesModal(p.productId, p.productName);
            }
        }
    });
}

function renderCategorySales(data) {
    destroyChart('category');
    const hasData = data.some(c => c.revenue > 0 || c.quantity > 0);
    if (!data.length || !hasData) { emptyChart('chart-box-category', 'No sales data available'); return; }
    const canvas = mount('chart-box-category');
    charts.category = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: data.map(c => c.category),
            datasets: [{
                data: data.map(c => c.revenue),
                backgroundColor: CATEGORY_COLORS,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.label + ': ' + fmtMoney(ctx.parsed) + ' (' + data[ctx.dataIndex].percentage + '%)',
                        afterLabel: () => 'Click to view this category'
                    }
                }
            },
            onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
            onClick: (e, els) => {
                if (!els.length) return;
                const c = data[els[0].index];
                if (c && c.category) window.location.href = '/admin/products.html?category=' + encodeURIComponent(c.category);
            }
        }
    });
}

/* ---------- modals ---------- */

function countStatus(dist, status) {
    const row = dist.find(d => d.status === status);
    return row ? row.count : 0;
}

function statTile(label, value, tone) {
    const border = { red: '#8B0000', green: '#1e9e4a', orange: '#f97316', blue: '#3b82f6', gold: '#D4A843' }[tone] || 'transparent';
    return `<div class="col-6 col-lg-4"><div class="p-3 rounded" style="background:#f8f5f0;border-left:3px solid ${border};height:100%;">
        <div class="text-muted" style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">${escapeHtml(label)}</div>
        <div style="font-size:1.05rem;font-weight:700;">${value}</div>
    </div></div>`;
}

async function openRevenueModal() {
    if (!revenueModal) revenueModal = new bootstrap.Modal(document.getElementById('revenueModal'));
    const range = periodRange();
    if (!range) return;

    document.getElementById('revenueModalLabel').innerHTML = '<i class="fa-solid fa-sack-dollar me-2 text-primary"></i>Monthly Sales Summary';
    document.getElementById('sales-summary-period').textContent = range.label;

    const grid = document.getElementById('revenue-summary-grid');
    grid.innerHTML = spinnerHtml();
    document.getElementById('sales-summary-amount').textContent = '—';
    revenueModal.show();

    try {
        const res = await apiCall('/api/admin/dashboard/orders?from=' + iso(range.from) + '&to=' + iso(range.to));
        const all = res.data || [];
        const rows = all.filter(r => r.status !== 'CANCELLED');

        const totalSales = rows.reduce((s, r) => s + Number(r.grandTotal || 0), 0);
        // READY_FOR_PICKUP sits between PREPARING and OUT_FOR_DELIVERY, so it is
        // counted with the orders going out instead of vanishing from the tiles.
        const confirmed = all.filter(r => r.status === 'CONFIRMED').length;
        const preparing = all.filter(r => r.status === 'PREPARING').length;
        const outForDelivery = all.filter(r => r.status === 'OUT_FOR_DELIVERY' || r.status === 'READY_FOR_PICKUP').length;
        const delivered = all.filter(r => r.status === 'DELIVERED').length;
        const cancelled = all.length - rows.length;
        const totalItemsSold = rows.reduce((s, r) =>
            s + (r.items || []).reduce((si, i) => si + Number(i.quantity || 0), 0), 0);

        document.getElementById('sales-summary-amount').textContent = fmtMoney(totalSales);

        grid.innerHTML = `<div class="row g-2">` +
            statTile('Total Orders', all.length, '') +
            statTile('Total Quantity Sold', totalItemsSold, 'red') +
            statTile('Confirmed Orders', confirmed, 'blue') +
            statTile('Preparing Orders', preparing, '') +
            statTile('Out for Delivery', outForDelivery, '') +
            statTile('Delivered Orders', delivered, 'green') +
            statTile('Cancelled Orders', cancelled, '') +
            `</div>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        document.getElementById('sales-summary-amount').textContent = '—';
        grid.innerHTML = emptyBoxHtml('Unable to load monthly sales summary. Please try again.');
    }
}

async function openOrdersModal() {
    if (!ordersModal) ordersModal = new bootstrap.Modal(document.getElementById('ordersModal'));
    const range = periodRange();
    if (!range) return;
    ordersModal.show();
    await loadOrdersIntoModal(range);
}

async function loadOrdersIntoModal(range) {
    const grid = document.getElementById('orders-stat-grid');
    grid.innerHTML = spinnerHtml();
    document.getElementById('orders-summary-total').textContent = '—';
    try {
        const res = await apiCall('/api/admin/dashboard/orders?from=' + iso(range.from) + '&to=' + iso(range.to));
        orderRows = res.data || [];
        renderOrdersStats();
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        grid.innerHTML = emptyBoxHtml(e.message || 'Unable to load orders');
    }
}

function renderOrdersStats() {
    const total = orderRows.length;
    const confirmed = orderRows.filter(o => o.status === 'CONFIRMED').length;
    const preparing = orderRows.filter(o => o.status === 'PREPARING').length;
    const outForDelivery = orderRows.filter(o => o.status === 'OUT_FOR_DELIVERY' || o.status === 'READY_FOR_PICKUP').length;
    const delivered = orderRows.filter(o => o.status === 'DELIVERED').length;
    const cancelled = orderRows.filter(o => o.status === 'CANCELLED').length;
    const totalValue = orderRows.filter(o => o.status !== 'CANCELLED')
        .reduce((s, r) => s + Number(r.grandTotal || 0), 0);

    document.getElementById('orders-summary-total').textContent = total;

    document.getElementById('orders-stat-grid').innerHTML =
        `<div class="row g-2">` +
        statTile('Confirmed Orders', confirmed, 'blue') +
        statTile('Preparing Orders', preparing, '') +
        statTile('Out for Delivery', outForDelivery, '') +
        statTile('Delivered Orders', delivered, 'green') +
        statTile('Cancelled Orders', cancelled, '') +
        statTile('Total Order Value', fmtMoney(totalValue), 'red') +
        `</div>`;
}

function openCustomersModal() {
    if (!customersModal) customersModal = new bootstrap.Modal(document.getElementById('customersModal'));
    const c = lastCustomers;
    if (!c) return;
    document.getElementById('customer-summary-grid').innerHTML = `<div class="row g-2">` +
        statTile('Total Customers', c.total, '') +
        statTile('Active Customers', c.active, 'green') +
        statTile('Inactive Customers', c.inactive, '') +
        statTile('New This Month', c.newThisMonth, 'blue') +
        `</div>`;
    customersModal.show();
}

function openInventoryModal() {
    if (!inventoryModal) inventoryModal = new bootstrap.Modal(document.getElementById('inventoryModal'));
    const inv = lastInventory;
    if (!inv) return;

    document.getElementById('inventory-summary-grid').innerHTML = `<div class="row g-2">` +
        statTile('Total Products', inv.totalProducts, 'blue') +
        statTile('In Stock', inv.inStock, 'green') +
        statTile('Low Stock', inv.lowStock, 'orange') +
        statTile('Out of Stock', inv.outOfStock, 'red') +
        `</div>`;

    const low = inv.lowStockItems || [];
    const out = inv.outOfStockItems || [];
    let html = '';
    if (low.length) {
        html += `<p class="fw-semibold small mb-1"><i class="fa-solid fa-triangle-exclamation me-1" style="color:#b45309;"></i>Low Stock</p>`;
        html += low.map(i =>
            `<div class="d-flex justify-content-between align-items-center border-bottom py-2" style="font-size:0.85rem;">
                <span>${escapeHtml(i.productName)}</span><strong>${i.stockQuantity} &nbsp;KG</strong>
             </div>`).join('');
    }
    if (out.length) {
        html += `<p class="fw-semibold small mb-1 mt-3"><i class="fa-solid fa-circle-xmark me-1" style="color:#b91c1c;"></i>Out of Stock</p>`;
        html += out.map(i =>
            `<div class="d-flex justify-content-between align-items-center border-bottom py-2" style="font-size:0.85rem;">
                <span>${escapeHtml(i.productName)}</span><strong class="text-danger">${i.stockQuantity} &nbsp;KG</strong>
             </div>`).join('');
    }
    if (!html) html = emptyBoxHtml('All products are sufficiently stocked');
    document.getElementById('inventory-lists').innerHTML = html;
    inventoryModal.show();
}

async function openMonthModal(range, monthLabel) {
    if (!monthModal) monthModal = new bootstrap.Modal(document.getElementById('monthModal'));
    document.getElementById('month-modal-period').textContent = monthLabel;
    document.getElementById('month-modal-grid').innerHTML = spinnerHtml();
    monthModal.show();

    try {
        const q = '?from=' + iso(range.from) + '&to=' + iso(range.to);
        const [summary, status] = await Promise.all([
            apiCall('/api/admin/dashboard/summary' + q),
            apiCall('/api/admin/dashboard/order-status' + q)
        ]);
        const s = summary.data;
        const delivered = countStatus(status.data, 'DELIVERED');
        const cancelled = countStatus(status.data, 'CANCELLED');
        const nonCancelled = s.totalOrders - cancelled;
        const avg = nonCancelled > 0 ? s.revenue / nonCancelled : 0;
        document.getElementById('month-modal-grid').innerHTML = `<div class="row g-2">` +
            statTile('Total Revenue', fmtMoney(s.revenue), 'red') +
            statTile('Total Orders', s.totalOrders, '') +
            statTile('Delivered Orders', delivered, 'green') +
            statTile('Cancelled Orders', cancelled, '') +
            statTile('Average Order Value', fmtMoney(avg), 'gold') +
            `</div>`;
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        document.getElementById('month-modal-grid').innerHTML = emptyBoxHtml(e.message || 'Unable to load data');
    }
}

async function openProductSalesModal(productId, productName) {
    if (!productSalesModal) productSalesModal = new bootstrap.Modal(document.getElementById('productSalesModal'));

    const range = periodRange();
    if (!range) return;

    const title = document.getElementById('productSalesModalLabel');
    title.innerHTML = '<i class="fa-solid fa-drumstick-bite me-2" style="color:var(--primary);"></i>' +
        escapeHtml(productName) + ' — Sales Details';
    document.getElementById('ps-product-name').textContent = productName;
    document.getElementById('ps-product-meta').textContent = '';

    const grid = document.getElementById('ps-summary-grid');
    const body = document.getElementById('ps-orders-body');
    grid.innerHTML = '<div class="empty-box"><i class="fa-solid fa-circle-notch fa-spin"></i><div>Loading sales details...</div></div>';
    body.innerHTML = '';
    productSalesModal.show();

    try {
        const res = await apiCall('/api/admin/dashboard/products/' + productId +
            '/sales?from=' + iso(range.from) + '&to=' + iso(range.to));
        renderProductSales(res.data);
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        grid.innerHTML = emptyBoxHtml('Unable to load sales details. Please try again.');
        body.innerHTML = '';
        showToast('Unable to load sales details. Please try again.', 'error');
    }
}

function renderProductSales(s) {
    const grid = document.getElementById('ps-summary-grid');
    const body = document.getElementById('ps-orders-body');
    const unit = (s.unit || 'KG').toUpperCase();
    const disc = Number(s.discountPercent);
    const discTxt = disc % 1 === 0 ? String(Math.round(disc)) : disc.toFixed(1);

    document.getElementById('ps-product-meta').innerHTML =
        `<span class="me-3"><i class="fa-solid fa-tag fa-fw me-1" style="color:var(--primary);"></i>Category: <strong>${escapeHtml(s.categoryName || '—')}</strong></span>` +
        `<span class="me-3"><i class="fa-solid fa-weight-hanging fa-fw me-1" style="color:var(--primary);"></i>Unit: <strong>${escapeHtml(unit)}</strong></span>` +
        `<span>Product Status: <span class="badge-status ${s.available ? 'ACTIVE' : 'INACTIVE'}">${s.available ? 'ACTIVE' : 'INACTIVE'}</span></span>`;

    const lastSold = s.lastSoldDate ? fmtDateOnly(s.lastSoldDate) : 'No sales yet';

    grid.innerHTML = `<div class="row g-2">` +
        statTile('Total Sold', s.totalQuantitySold + ' ' + unit, 'gold') +
        statTile('Total Orders', s.totalOrders + (s.totalOrders === 1 ? ' Order' : ' Orders'), '') +
        statTile('Total Sales', fmtMoney(s.totalSalesAmount), 'red') +
        statTile('Average Price', '₹' + Number(s.averageSellingPrice).toFixed(2) + ' / ' + unit, '') +
        statTile('Current Stock', s.currentStock + ' ' + unit, '') +
        statTile('Last Sold', lastSold, 'blue') +
        statTile('Discount', discTxt + '%', '') +
        `</div>`;

    const orders = s.recentOrders || [];
    body.innerHTML = !orders.length
        ? emptyBoxHtml('No sales data available for this product.')
        : `<table class="table table-fm align-middle">
            <thead><tr><th>Order No.</th><th>Quantity</th><th class="text-end">Amount</th><th>Order Date</th><th>Status</th></tr></thead>
            <tbody>
              ${orders.map(r => `
              <tr>
                <td><strong class="small">${escapeHtml(r.orderNumber)}</strong></td>
                <td>${Number(r.quantity)} ${unit}</td>
                <td class="text-end">${fmtMoney(r.amount)}</td>
                <td class="text-muted" style="font-size:0.78rem;">${fmtDate(r.orderDate)}</td>
                <td>${adminStatusBadge(r.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>`;
}

async function openYearlySummaryModal() {
    if (!yearlyModal) yearlyModal = new bootstrap.Modal(document.getElementById('yearlyModal'));
    const range = periodRange();
    if (!range) return;

    const year = range.to.getFullYear();
    document.getElementById('yearly-modal-subtitle').textContent = 'Business overview for ' + year;

    document.getElementById('yearly-sales-grid').innerHTML = spinnerHtml();
    document.getElementById('yearly-status-grid').innerHTML = spinnerHtml();
    document.getElementById('yearly-customers-grid').innerHTML = spinnerHtml();
    document.getElementById('yearly-inventory-grid').innerHTML = spinnerHtml();
    document.getElementById('yearly-extra-grid').innerHTML = '';
    document.getElementById('yearly-extra-wrap').classList.add('d-none');
    yearlyModal.show();

    try {
        const res = await apiCall('/api/admin/dashboard/yearly-summary?from=' + iso(range.from) + '&to=' + iso(range.to));
        renderYearlySummary(res.data || {});
    } catch (e) {
        if (e.status === 401 || e.status === 403) Auth.requireAdmin();
        document.getElementById('yearly-sales-grid').innerHTML = emptyBoxHtml(e.message || 'Unable to load yearly summary. Please try again.');
        document.getElementById('yearly-status-grid').innerHTML = '';
        document.getElementById('yearly-customers-grid').innerHTML = '';
        document.getElementById('yearly-inventory-grid').innerHTML = '';
        document.getElementById('yearly-extra-wrap').classList.add('d-none');
    }
}

function renderYearlySummary(s) {
    document.getElementById('yearly-sales-grid').innerHTML = `<div class="row g-2">` +
        statTile('Total Sales', fmtMoney(s.totalSales), 'red') +
        statTile('Total Orders', s.totalOrders, '') +
        statTile('Average Order Value', fmtMoney(s.averageOrderValue), 'gold') +
        statTile('Total Items Sold', s.totalItemsSold + ' units', '') +
        `</div>`;

    document.getElementById('yearly-status-grid').innerHTML = `<div class="row g-2">` +
        statTile('Confirmed', s.confirmedOrders, 'blue') +
        statTile('Preparing', s.preparingOrders, '') +
        statTile('Out for Delivery', s.outForDeliveryOrders, '') +
        statTile('Delivered', s.deliveredOrders, 'green') +
        statTile('Cancelled', s.cancelledOrders, 'red') +
        `</div>`;

    document.getElementById('yearly-customers-grid').innerHTML = `<div class="row g-2">` +
        statTile('Total Customers', s.totalCustomers, '') +
        statTile('New Customers', s.newCustomers, 'blue') +
        statTile('Active Customers', s.activeCustomers, 'green') +
        statTile('Inactive Customers', s.inactiveCustomers, '') +
        `</div>`;

    document.getElementById('yearly-inventory-grid').innerHTML = `<div class="row g-2">` +
        statTile('Total Products', s.totalProducts, '') +
        statTile('Active Products', s.activeProducts, 'green') +
        statTile('Inactive Products', s.inactiveProducts, '') +
        statTile('Low Stock', s.lowStockProducts, 'orange') +
        statTile('Out of Stock', s.outOfStockProducts, 'red') +
        `</div>`;

    const extra = [];
    if (s.bestSellingProduct) extra.push(statTile('Best Selling Product', escapeHtml(s.bestSellingProduct), 'gold'));
    if (s.topCategory) extra.push(statTile('Top Category', escapeHtml(s.topCategory), 'blue'));
    if (Number(s.highestOrderValue) > 0) extra.push(statTile('Highest Order Value', fmtMoney(s.highestOrderValue), 'red'));

    const wrap = document.getElementById('yearly-extra-wrap');
    if (extra.length) {
        document.getElementById('yearly-extra-grid').innerHTML = `<div class="row g-2">` + extra.join('') + `</div>`;
        wrap.classList.remove('d-none');
    } else {
        document.getElementById('yearly-extra-grid').innerHTML = '';
        wrap.classList.add('d-none');
    }
}