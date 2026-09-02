/* FreshMeat — Admin Dashboard controller */

document.addEventListener('DOMContentLoaded', async function () {
    if (!initAdminPage('dashboard', 'Dashboard', 'Business overview & performance')) return;

    const content = document.getElementById('admin-page-content');
    content.innerHTML = spinnerHtml();

    try {
        const res = await apiCall('/api/admin/dashboard');
        renderDashboard(res.data);
    } catch (e) {
        content.innerHTML = `<div class="empty-box"><i class="fa-solid fa-triangle-exclamation"></i><div>${escapeHtml(e.message)}</div></div>`;
        if (e.status === 401 || e.status === 403) {
            Auth.requireAdmin();
        }
    }
});

function renderDashboard(d) {
    document.getElementById('admin-page-content').innerHTML = `
    <div class="row g-3 mb-4">
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="stat-icon red"><i class="fa-solid fa-sack-dollar"></i></div>
          <div class="stat-meta">
            <h6>This Month</h6>
            <div class="stat-value">${fmtMoney(d.monthlyRevenue)}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="stat-icon gold"><i class="fa-solid fa-box-open"></i></div>
          <div class="stat-meta">
            <h6>Total Orders</h6>
            <div class="stat-value">${d.totalOrders}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="stat-icon green"><i class="fa-solid fa-users"></i></div>
          <div class="stat-meta">
            <h6>Customers</h6>
            <div class="stat-value">${d.totalCustomers}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="stat-icon orange"><i class="fa-solid fa-boxes-stacked"></i></div>
          <div class="stat-meta">
            <h6>Low / Out of Stock</h6>
            <div class="stat-value">${d.lowStockProducts}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-8">
        <div class="admin-card">
          <div class="card-title">Revenue Trend <span class="sub">last 6 months</span></div>
          <div class="chart-box"><canvas id="chart-revenue"></canvas></div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="admin-card">
          <div class="card-title">Order Status</div>
          <div class="chart-box"><canvas id="chart-status"></canvas></div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="admin-card">
          <div class="card-title">Top Selling Products</div>
          <div class="chart-box"><canvas id="chart-top"></canvas></div>
        </div>
      </div>
      <div class="col-lg-7">
        <div class="admin-card">
          <div class="card-title">Category-wise Sales</div>
          <div class="chart-box"><canvas id="chart-category"></canvas></div>
        </div>
      </div>
    </div>`;

    new Chart(document.getElementById('chart-revenue'), {
        type: 'line',
        data: {
            labels: d.monthlySales.map(m => m.month),
            datasets: [{
                label: 'Revenue (₹)',
                data: d.monthlySales.map(m => m.revenue),
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
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => '\u20B9' + (v >= 1000 ? (v / 1000) + 'k' : v) } } }
        }
    });

    new Chart(document.getElementById('chart-status'), {
        type: 'doughnut',
        data: {
            labels: d.orderStatusDistribution.map(s => s.status),
            datasets: [{
                data: d.orderStatusDistribution.map(s => s.count),
                backgroundColor: ['#1a56db', '#1e9e4a', '#b45309', '#7c3aed', '#047857', '#b91c1c'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
        }
    });

    new Chart(document.getElementById('chart-top'), {
        type: 'bar',
        data: {
            labels: d.topSellingProducts.map(p => (p.name || '').length > 16 ? p.name.slice(0, 15) + '\u2026' : p.name),
            datasets: [{
                label: 'KG Sold',
                data: d.topSellingProducts.map(p => p.quantity),
                backgroundColor: '#D4A843',
                borderRadius: 6,
                barThickness: 22
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });

    new Chart(document.getElementById('chart-category'), {
        type: 'pie',
        data: {
            labels: d.categoryWiseSales.map(c => c.category),
            datasets: [{
                data: d.categoryWiseSales.map(c => c.sales),
                backgroundColor: ['#8B0000', '#D4A843', '#1e9e4a', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
        }
    });
}