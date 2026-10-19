import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { apiCall } from '../lib/api';
import { fmtDate, fmtDateOnly, fmtMoney } from '../lib/format';
import { showToast } from '../lib/toast';
import {
  AdminStatusBadge,
  EmptyBox,
  SpinnerBox,
  StatTile,
  hideModal,
  showModal,
  useModalId
} from './AdminLayout';

/* FreshMeat — Admin Dashboard controller (ported from dashboard.js) */

const STATUS_COLORS = {
  CONFIRMED: '#1a56db',
  READY_FOR_PICKUP: '#3b82f6',
  PREPARING: '#b45309',
  OUT_FOR_DELIVERY: '#7c3aed',
  DELIVERED: '#047857',
  CANCELLED: '#b91c1c'
};

const CATEGORY_COLORS = ['#8B0000', '#D4A843', '#1e9e4a', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316'];

function iso(d) {
  const p = x => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function computeTrendRanges(length, range) {
  const ranges = [];
  if (!range) return ranges;
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

function countStatus(dist, status) {
  const row = (dist || []).find(d => d.status === status);
  return row ? row.count : 0;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [period, setPeriod] = useState('this-month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [statusDist, setStatusDist] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [categorySales, setCategorySales] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [rangeUsed, setRangeUsed] = useState(null);

  // Modals
  const revenueModalId = useModalId('revenueModal');
  const yearlyModalId = useModalId('yearlyModal');
  const ordersModalId = useModalId('ordersModal');
  const customersModalId = useModalId('customersModal');
  const inventoryModalId = useModalId('inventoryModal');
  const monthModalId = useModalId('monthModal');
  const productSalesModalId = useModalId('productSalesModal');

  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueAmount, setRevenueAmount] = useState('—');
  const [revenueTiles, setRevenueTiles] = useState([]);

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersTiles, setOrdersTiles] = useState([]);

  const [customerTiles, setCustomerTiles] = useState([]);

  const [inventoryTiles, setInventoryTiles] = useState([]);
  const [inventoryLow, setInventoryLow] = useState([]);
  const [inventoryOut, setInventoryOut] = useState([]);

  const [monthPeriod, setMonthPeriod] = useState('');
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState('');
  const [monthTiles, setMonthTiles] = useState([]);

  const [psName, setPsName] = useState('');
  const [psMeta, setPsMeta] = useState(null);
  const [psLoading, setPsLoading] = useState(false);
  const [psError, setPsError] = useState('');
  const [psTiles, setPsTiles] = useState([]);
  const [psOrders, setPsOrders] = useState([]);
  const [psHasOrders, setPsHasOrders] = useState(false);

  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyError, setYearlyError] = useState('');
  const [yearlySubtitle, setYearlySubtitle] = useState('Business overview');
  const [yearlySales, setYearlySales] = useState([]);
  const [yearlyStatus, setYearlyStatus] = useState([]);
  const [yearlyCustomers, setYearlyCustomers] = useState([]);
  const [yearlyInventory, setYearlyInventory] = useState([]);
  const [yearlyExtra, setYearlyExtra] = useState([]);

  const chartsRef = useRef({});
  const revenueRef = useRef(null);
  const statusRef = useRef(null);
  const topRef = useRef(null);
  const categoryRef = useRef(null);

  function periodRange() {
    const now = new Date();
    switch (period) {
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
        if (!fromDate || !toDate) return null;
        const from = new Date(fromDate + 'T00:00:00');
        const to = new Date(toDate + 'T00:00:00');
        if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return null;
        return { from, to, label: 'Custom Range' };
      }
      default:
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, label: 'This Month' };
    }
  }

  function handleAuth(e) {
    if (e && (e.status === 401 || e.status === 403)) {
      navigate('/login?role=admin');
      return true;
    }
    return false;
  }

  const loadDashboard = useCallback(async (refresh) => {
    const range = periodRange();
    if (!range) {
      if (period === 'custom' && fromDate && toDate) {
        showToast('Please select a valid start and end date for the custom range.', 'warning');
      }
      return;
    }
    setRangeUsed(range);
    setLoading(true);
    const q = '?from=' + iso(range.from) + '&to=' + iso(range.to);
    try {
      const [summaryRes, trendRes, statusRes, topRes, categoryRes, inventoryRes, customersRes] = await Promise.all([
        apiCall('/api/admin/dashboard/summary' + q),
        apiCall('/api/admin/dashboard/revenue-trend' + q),
        apiCall('/api/admin/dashboard/order-status' + q),
        apiCall('/api/admin/dashboard/top-products' + q),
        apiCall('/api/admin/dashboard/category-sales' + q),
        apiCall('/api/admin/dashboard/inventory-summary'),
        apiCall('/api/admin/dashboard/customer-summary' + q)
      ]);
      setSummary(summaryRes.data || {});
      setTrend(trendRes.data || []);
      setStatusDist(statusRes.data || []);
      setTopProducts(topRes.data || []);
      setCategorySales(categoryRes.data || []);
      setInventory(inventoryRes.data || null);
      setCustomers(customersRes.data || null);
      if (refresh) showToast('Dashboard updated.');
    } catch (e) {
      if (!handleAuth(e)) showToast('Unable to load dashboard data. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [period, fromDate, toDate]);

  useEffect(() => { loadDashboard(false); }, [loadDashboard]);

  /* ---------- charts ---------- */

  useEffect(() => {
    const key = 'revenue';
    if (chartsRef.current[key]) { chartsRef.current[key].destroy(); chartsRef.current[key] = null; }
    const points = trend || [];
    const hasData = points.some(p => p.revenue > 0 || p.orders > 0);
    const canvas = revenueRef.current;
    if (!points.length || !hasData || !canvas) return;
    const labels = points.map(p => p.label);
    const ranges = computeTrendRanges(points.length, rangeUsed);
    const orders = points.map(p => p.orders);
    chartsRef.current[key] = new Chart(canvas, {
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
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => (items.length ? labels[items[0].dataIndex] : ''),
              label: ctx => ['Revenue: ' + fmtMoney(ctx.parsed.y), 'Orders: ' + orders[ctx.dataIndex]]
            }
          }
        },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + (v >= 1000 ? (v / 1000) + 'k' : v) } } },
        onClick: (e, els) => {
          if (!els.length) return;
          openMonthModal(ranges[els[0].index], labels[els[0].index]);
        }
      }
    });
    return () => { if (chartsRef.current[key]) { chartsRef.current[key].destroy(); chartsRef.current[key] = null; } };
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [trend, rangeUsed]);

  useEffect(() => {
    const key = 'status';
    if (chartsRef.current[key]) { chartsRef.current[key].destroy(); chartsRef.current[key] = null; }
    const data = statusDist || [];
    const total = data.reduce((s, d) => s + d.count, 0);
    const canvas = statusRef.current;
    if (!total || !canvas) return;
    chartsRef.current[key] = new Chart(canvas, {
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
        responsive: true,
        maintainAspectRatio: false,
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
          if (status) navigate('/admin/orders?status=' + encodeURIComponent(status));
        }
      }
    });
    return () => { if (chartsRef.current[key]) { chartsRef.current[key].destroy(); chartsRef.current[key] = null; } };
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [statusDist]);

  useEffect(() => {
    const key = 'top';
    if (chartsRef.current[key]) { chartsRef.current[key].destroy(); chartsRef.current[key] = null; }
    const data = topProducts || [];
    const hasData = data.some(p => p.soldQuantity > 0);
    const canvas = topRef.current;
    if (!data.length || !hasData || !canvas) return;
    const ranked = data.map((p, i) => ({ ...p, rank: i + 1 })).reverse();
    chartsRef.current[key] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ranked.map(p => ((p.productName || '').length > 16 ? p.productName.slice(0, 15) + '…' : p.productName)),
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
        responsive: true,
        maintainAspectRatio: false,
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
    return () => { if (chartsRef.current[key]) { chartsRef.current[key].destroy(); chartsRef.current[key] = null; } };
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [topProducts]);

  useEffect(() => {
    const key = 'category';
    if (chartsRef.current[key]) { chartsRef.current[key].destroy(); chartsRef.current[key] = null; }
    const data = categorySales || [];
    const hasData = data.some(c => c.revenue > 0 || c.quantity > 0);
    const canvas = categoryRef.current;
    if (!data.length || !hasData || !canvas) return;
    chartsRef.current[key] = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: data.map(c => c.category),
        datasets: [{ data: data.map(c => c.revenue), backgroundColor: CATEGORY_COLORS, borderWidth: 2 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
          if (c && c.category) navigate('/admin/products?category=' + encodeURIComponent(c.category));
        }
      }
    });
    return () => { if (chartsRef.current[key]) { chartsRef.current[key].destroy(); chartsRef.current[key] = null; } };
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [categorySales]);

  /* ---------- modals ---------- */

  async function openRevenueModal() {
    const range = periodRange();
    if (!range) return;
    setRevenueLoading(true);
    setRevenueAmount('—');
    setRevenueTiles([]);
    showModal(revenueModalId);
    try {
      const res = await apiCall('/api/admin/dashboard/orders?from=' + iso(range.from) + '&to=' + iso(range.to));
      const all = res.data || [];
      const rows = all.filter(r => r.status !== 'CANCELLED');
      const totalSales = rows.reduce((s, r) => s + Number(r.grandTotal || 0), 0);
      const confirmed = all.filter(r => r.status === 'CONFIRMED').length;
      const preparing = all.filter(r => r.status === 'PREPARING').length;
      const outForDelivery = all.filter(r => r.status === 'OUT_FOR_DELIVERY' || r.status === 'READY_FOR_PICKUP').length;
      const delivered = all.filter(r => r.status === 'DELIVERED').length;
      const cancelled = all.length - rows.length;
      const totalItemsSold = rows.reduce((s, r) =>
        s + (r.items || []).reduce((si, i) => si + Number(i.quantity || 0), 0), 0);

      setRevenueAmount(fmtMoney(totalSales));
      setRevenueTiles([
        { label: 'Total Orders', value: all.length, tone: '' },
        { label: 'Total Quantity Sold', value: totalItemsSold, tone: 'red' },
        { label: 'Confirmed Orders', value: confirmed, tone: 'blue' },
        { label: 'Preparing Orders', value: preparing, tone: '' },
        { label: 'Out for Delivery', value: outForDelivery, tone: '' },
        { label: 'Delivered Orders', value: delivered, tone: 'green' },
        { label: 'Cancelled Orders', value: cancelled, tone: '' }
      ]);
    } catch (e) {
      if (!handleAuth(e)) { setRevenueAmount('—'); setRevenueTiles(null); }
    } finally {
      setRevenueLoading(false);
    }
  }

  async function openOrdersModal() {
    const range = periodRange();
    if (!range) return;
    setOrdersLoading(true);
    setOrdersError('');
    setOrdersTotal(0);
    setOrdersTiles([]);
    showModal(ordersModalId);
    try {
      const res = await apiCall('/api/admin/dashboard/orders?from=' + iso(range.from) + '&to=' + iso(range.to));
      const orderRows = res.data || [];
      const total = orderRows.length;
      const confirmed = orderRows.filter(o => o.status === 'CONFIRMED').length;
      const preparing = orderRows.filter(o => o.status === 'PREPARING').length;
      const outForDelivery = orderRows.filter(o => o.status === 'OUT_FOR_DELIVERY' || o.status === 'READY_FOR_PICKUP').length;
      const delivered = orderRows.filter(o => o.status === 'DELIVERED').length;
      const cancelled = orderRows.filter(o => o.status === 'CANCELLED').length;
      const totalValue = orderRows.filter(o => o.status !== 'CANCELLED')
        .reduce((s, r) => s + Number(r.grandTotal || 0), 0);
      setOrdersTotal(total);
      setOrdersTiles([
        { label: 'Confirmed Orders', value: confirmed, tone: 'blue' },
        { label: 'Preparing Orders', value: preparing, tone: '' },
        { label: 'Out for Delivery', value: outForDelivery, tone: '' },
        { label: 'Delivered Orders', value: delivered, tone: 'green' },
        { label: 'Cancelled Orders', value: cancelled, tone: '' },
        { label: 'Total Order Value', value: fmtMoney(totalValue), tone: 'red' }
      ]);
    } catch (e) {
      if (!handleAuth(e)) setOrdersError(e.message || 'Unable to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }

  function openCustomersModal() {
    const c = customers;
    if (!c) return;
    setCustomerTiles([
      { label: 'Total Customers', value: c.total, tone: '' },
      { label: 'Active Customers', value: c.active, tone: 'green' },
      { label: 'Inactive Customers', value: c.inactive, tone: '' },
      { label: 'New This Month', value: c.newThisMonth, tone: 'blue' }
    ]);
    showModal(customersModalId);
  }

  function openInventoryModal() {
    const inv = inventory;
    if (!inv) return;
    setInventoryTiles([
      { label: 'Total Products', value: inv.totalProducts, tone: 'blue' },
      { label: 'In Stock', value: inv.inStock, tone: 'green' },
      { label: 'Low Stock', value: inv.lowStock, tone: 'orange' },
      { label: 'Out of Stock', value: inv.outOfStock, tone: 'red' }
    ]);
    setInventoryLow(inv.lowStockItems || []);
    setInventoryOut(inv.outOfStockItems || []);
    showModal(inventoryModalId);
  }

  async function openMonthModal(range, monthLabel) {
    setMonthPeriod(monthLabel);
    setMonthLoading(true);
    setMonthError('');
    setMonthTiles([]);
    showModal(monthModalId);
    try {
      const q = '?from=' + iso(range.from) + '&to=' + iso(range.to);
      const [summaryRes, statusRes] = await Promise.all([
        apiCall('/api/admin/dashboard/summary' + q),
        apiCall('/api/admin/dashboard/order-status' + q)
      ]);
      const s = summaryRes.data || {};
      const delivered = countStatus(statusRes.data, 'DELIVERED');
      const cancelled = countStatus(statusRes.data, 'CANCELLED');
      const nonCancelled = s.totalOrders - cancelled;
      const avg = nonCancelled > 0 ? s.revenue / nonCancelled : 0;
      setMonthTiles([
        { label: 'Total Revenue', value: fmtMoney(s.revenue), tone: 'red' },
        { label: 'Total Orders', value: s.totalOrders, tone: '' },
        { label: 'Delivered Orders', value: delivered, tone: 'green' },
        { label: 'Cancelled Orders', value: cancelled, tone: '' },
        { label: 'Average Order Value', value: fmtMoney(avg), tone: 'gold' }
      ]);
    } catch (e) {
      if (!handleAuth(e)) setMonthError(e.message || 'Unable to load data');
    } finally {
      setMonthLoading(false);
    }
  }

  async function openProductSalesModal(productId, productName) {
    const range = periodRange();
    if (!range) return;
    setPsName(productName + ' — Sales Details');
    setPsMeta(null);
    setPsLoading(true);
    setPsError('');
    setPsTiles([]);
    setPsOrders([]);
    setPsHasOrders(false);
    showModal(productSalesModalId);
    try {
      const res = await apiCall('/api/admin/dashboard/products/' + productId +
        '/sales?from=' + iso(range.from) + '&to=' + iso(range.to));
      const s = res.data || {};
      const unit = (s.unit || 'KG').toUpperCase();
      const disc = Number(s.discountPercent);
      const discTxt = disc % 1 === 0 ? String(Math.round(disc)) : disc.toFixed(1);
      const lastSold = s.lastSoldDate ? fmtDateOnly(s.lastSoldDate) : 'No sales yet';
      setPsMeta({ categoryName: s.categoryName, unit, available: s.available });
      setPsTiles([
        { label: 'Total Sold', value: s.totalQuantitySold + ' ' + unit, tone: 'gold' },
        { label: 'Total Orders', value: s.totalOrders + (s.totalOrders === 1 ? ' Order' : ' Orders'), tone: '' },
        { label: 'Total Sales', value: fmtMoney(s.totalSalesAmount), tone: 'red' },
        { label: 'Average Price', value: '₹' + Number(s.averageSellingPrice).toFixed(2) + ' / ' + unit, tone: '' },
        { label: 'Current Stock', value: s.currentStock + ' ' + unit, tone: '' },
        { label: 'Last Sold', value: lastSold, tone: 'blue' },
        { label: 'Discount', value: discTxt + '%', tone: '' }
      ]);
      const recent = s.recentOrders || [];
      setPsOrders(recent);
      setPsHasOrders(recent.length > 0);
    } catch (e) {
      if (!handleAuth(e)) {
        setPsError('Unable to load sales details. Please try again.');
        showToast('Unable to load sales details. Please try again.', 'error');
      }
    } finally {
      setPsLoading(false);
    }
  }

  async function openYearlySummaryModal() {
    const range = periodRange();
    if (!range) return;
    const year = range.to.getFullYear();
    setYearlySubtitle('Business overview for ' + year);
    setYearlyLoading(true);
    setYearlyError('');
    setYearlySales([]); setYearlyStatus([]); setYearlyCustomers([]); setYearlyInventory([]); setYearlyExtra([]);
    showModal(yearlyModalId);
    try {
      const res = await apiCall('/api/admin/dashboard/yearly-summary?from=' + iso(range.from) + '&to=' + iso(range.to));
      const s = res.data || {};
      setYearlySales([
        { label: 'Total Sales', value: fmtMoney(s.totalSales), tone: 'red' },
        { label: 'Total Orders', value: s.totalOrders, tone: '' },
        { label: 'Average Order Value', value: fmtMoney(s.averageOrderValue), tone: 'gold' },
        { label: 'Total Items Sold', value: s.totalItemsSold + ' units', tone: '' }
      ]);
      setYearlyStatus([
        { label: 'Confirmed', value: s.confirmedOrders, tone: 'blue' },
        { label: 'Preparing', value: s.preparingOrders, tone: '' },
        { label: 'Out for Delivery', value: s.outForDeliveryOrders, tone: '' },
        { label: 'Delivered', value: s.deliveredOrders, tone: 'green' },
        { label: 'Cancelled', value: s.cancelledOrders, tone: 'red' }
      ]);
      setYearlyCustomers([
        { label: 'Total Customers', value: s.totalCustomers, tone: '' },
        { label: 'New Customers', value: s.newCustomers, tone: 'blue' },
        { label: 'Active Customers', value: s.activeCustomers, tone: 'green' },
        { label: 'Inactive Customers', value: s.inactiveCustomers, tone: '' }
      ]);
      setYearlyInventory([
        { label: 'Total Products', value: s.totalProducts, tone: '' },
        { label: 'Active Products', value: s.activeProducts, tone: 'green' },
        { label: 'Inactive Products', value: s.inactiveProducts, tone: '' },
        { label: 'Low Stock', value: s.lowStockProducts, tone: 'orange' },
        { label: 'Out of Stock', value: s.outOfStockProducts, tone: 'red' }
      ]);
      const extra = [];
      if (s.bestSellingProduct) extra.push({ label: 'Best Selling Product', value: s.bestSellingProduct, tone: 'gold' });
      if (s.topCategory) extra.push({ label: 'Top Category', value: s.topCategory, tone: 'blue' });
      if (Number(s.highestOrderValue) > 0) extra.push({ label: 'Highest Order Value', value: fmtMoney(s.highestOrderValue), tone: 'red' });
      setYearlyExtra(extra);
    } catch (e) {
      if (!handleAuth(e)) setYearlyError(e.message || 'Unable to load yearly summary. Please try again.');
    } finally {
      setYearlyLoading(false);
    }
  }

  const trendHasData = (trend || []).some(p => p.revenue > 0 || p.orders > 0);
  const statusTotal = (statusDist || []).reduce((s, d) => s + d.count, 0);
  const topHasData = (topProducts || []).some(p => p.soldQuantity > 0);
  const categoryHasData = (categorySales || []).some(c => c.revenue > 0 || c.quantity > 0);

  const range = periodRange();

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <select
          className="form-select form-control-fm"
          style={{ width: 'auto' }}
          value={period}
          onChange={e => setPeriod(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="this-week">This Week</option>
          <option value="this-month">This Month</option>
          <option value="last-3-months">Last 3 Months</option>
          <option value="last-6-months">Last 6 Months</option>
          <option value="this-year">This Year</option>
          <option value="custom">Custom Range</option>
        </select>
        <div className={'d-flex gap-2 align-items-center' + (period === 'custom' ? '' : ' d-none')}>
          <input type="date" className="form-control form-control-fm" style={{ width: 'auto' }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span className="text-muted">to</span>
          <input type="date" className="form-control form-control-fm" style={{ width: 'auto' }} value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <button className="btn-admin" disabled={loading} onClick={() => loadDashboard(true)}>
          <i className="fa-solid fa-rotate me-1"></i>Refresh Dashboard
        </button>
        <span className="text-muted small ms-auto">
          {range ? range.label + ' — ' + iso(range.from) + ' to ' + iso(range.to) : ''}
        </span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="stat-card clickable" onClick={() => (period === 'this-year' ? openYearlySummaryModal() : openRevenueModal())}>
            <div className="stat-icon red"><i className="fa-solid fa-sack-dollar"></i></div>
            <div className="stat-meta">
              <h6>{range ? range.label : 'This Month'}</h6>
              <div className="stat-value">{summary ? fmtMoney(summary.revenue) : '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="stat-card clickable" onClick={openOrdersModal}>
            <div className="stat-icon gold"><i className="fa-solid fa-box-open"></i></div>
            <div className="stat-meta">
              <h6>Total Orders</h6>
              <div className="stat-value">{summary ? summary.totalOrders : '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="stat-card clickable" onClick={openCustomersModal}>
            <div className="stat-icon green"><i className="fa-solid fa-users"></i></div>
            <div className="stat-meta">
              <h6>Customers</h6>
              <div className="stat-value">{customers ? customers.total : '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="stat-card clickable" onClick={openInventoryModal}>
            <div className="stat-icon orange"><i className="fa-solid fa-boxes-stacked"></i></div>
            <div className="stat-meta">
              <h6>Low / Out of Stock</h6>
              <div className="stat-value">{summary ? Number(summary.lowStock) + Number(summary.outOfStock) : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="admin-card">
            <div className="card-title">Revenue Trend <span className="sub">{range ? range.label.toLowerCase() : ''}</span></div>
            <div className="chart-box">
              {trendHasData ? <canvas ref={revenueRef}></canvas> : <EmptyBox msg="No sales data available" icon="fa-regular fa-chart-bar" />}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="admin-card">
            <div className="card-title">Order Status</div>
            <div className="chart-box">
              {statusTotal ? <canvas ref={statusRef}></canvas> : <EmptyBox msg="No sales data available" icon="fa-regular fa-chart-bar" />}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="admin-card">
            <div className="card-title d-flex justify-content-between align-items-center">Top Selling Products
              <button className="btn-admin-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.72rem' }} onClick={() => navigate('/admin/products')}>View Products</button>
            </div>
            <div className="chart-box">
              {topHasData ? <canvas ref={topRef}></canvas> : <EmptyBox msg="No sales data available" icon="fa-regular fa-chart-bar" />}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="admin-card">
            <div className="card-title">Category-wise Sales</div>
            <div className="chart-box">
              {categoryHasData ? <canvas ref={categoryRef}></canvas> : <EmptyBox msg="No sales data available" icon="fa-regular fa-chart-bar" />}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly sales summary modal (THIS MONTH card click) */}
      <div className="modal fade" id={revenueModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-sack-dollar me-2 text-primary"></i>Monthly Sales Summary</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <div className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {range ? range.label : 'This Month'}
                </div>
                <div className="fs-3 fw-bold" style={{ color: 'var(--primary)' }}>{revenueAmount}</div>
              </div>
              {revenueLoading ? <SpinnerBox /> : (!revenueTiles ? <EmptyBox msg="Unable to load monthly sales summary. Please try again." /> : (
                <div className="row g-2">{revenueTiles.map((t, i) => <StatTile key={i} {...t} />)}</div>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>

      {/* Yearly Business Summary modal */}
      <div className="modal fade" id={yearlyModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-calendar me-2 text-primary"></i>Yearly Business Summary</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="text-muted small mb-3">{yearlySubtitle}</div>
              {yearlyLoading ? <SpinnerBox /> : yearlyError ? <EmptyBox msg={yearlyError} /> : (
                <>
                  <label className="form-label d-block">Sales Summary</label>
                  <div className="row g-2 mb-3">{yearlySales.map((t, i) => <StatTile key={i} {...t} />)}</div>
                  <label className="form-label d-block">Order Status</label>
                  <div className="row g-2 mb-3">{yearlyStatus.map((t, i) => <StatTile key={i} {...t} />)}</div>
                  <label className="form-label d-block">Customers</label>
                  <div className="row g-2 mb-3">{yearlyCustomers.map((t, i) => <StatTile key={i} {...t} />)}</div>
                  <label className="form-label d-block">Inventory</label>
                  <div className="row g-2 mb-3">{yearlyInventory.map((t, i) => <StatTile key={i} {...t} />)}</div>
                  {yearlyExtra.length ? (
                    <>
                      <label className="form-label d-block">Additional Metrics</label>
                      <div className="row g-2 mb-3">{yearlyExtra.map((t, i) => <StatTile key={i} {...t} />)}</div>
                    </>
                  ) : null}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Close</button>
              <button type="button" className="btn-admin" onClick={() => { hideModal(yearlyModalId); navigate('/admin/orders'); }}>
                <i className="fa-solid fa-truck-fast me-1"></i>View Orders
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order statistics modal */}
      <div className="modal fade" id={ordersModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-box-open me-2" style={{ color: 'var(--gold)' }}></i>Order Summary</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <div className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Orders</div>
                <div className="fs-3 fw-bold" style={{ color: 'var(--gold)' }}>{ordersTotal}</div>
              </div>
              {ordersLoading ? <SpinnerBox /> : ordersError ? <EmptyBox msg={ordersError} /> : (
                <div className="row g-2">{ordersTiles.map((t, i) => <StatTile key={i} {...t} />)}</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer summary modal */}
      <div className="modal fade" id={customersModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-users me-2" style={{ color: 'var(--success)' }}></i>Customer Summary</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="row g-2">{customerTiles.map((t, i) => <StatTile key={i} {...t} />)}</div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Close</button>
              <button type="button" className="btn-admin" onClick={() => { hideModal(customersModalId); navigate('/admin/customers'); }}>
                <i className="fa-solid fa-users me-1"></i>View Customers
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory alert modal */}
      <div className="modal fade" id={inventoryModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-boxes-stacked me-2" style={{ color: '#f97316' }}></i>Inventory Alert</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="row g-2 mb-3">{inventoryTiles.map((t, i) => <StatTile key={i} {...t} />)}</div>
              {inventoryLow.length || inventoryOut.length ? (
                <>
                  {inventoryLow.length ? (
                    <>
                      <p className="fw-semibold small mb-1"><i className="fa-solid fa-triangle-exclamation me-1" style={{ color: '#b45309' }}></i>Low Stock</p>
                      {inventoryLow.map((i, idx) => (
                        <div className="d-flex justify-content-between align-items-center border-bottom py-2" style={{ fontSize: '0.85rem' }} key={idx}>
                          <span>{i.productName}</span><strong>{i.stockQuantity} &nbsp;KG</strong>
                        </div>
                      ))}
                    </>
                  ) : null}
                  {inventoryOut.length ? (
                    <>
                      <p className="fw-semibold small mb-1 mt-3"><i className="fa-solid fa-circle-xmark me-1" style={{ color: '#b91c1c' }}></i>Out of Stock</p>
                      {inventoryOut.map((i, idx) => (
                        <div className="d-flex justify-content-between align-items-center border-bottom py-2" style={{ fontSize: '0.85rem' }} key={idx}>
                          <span>{i.productName}</span><strong className="text-danger">{i.stockQuantity} &nbsp;KG</strong>
                        </div>
                      ))}
                    </>
                  ) : null}
                </>
              ) : <EmptyBox msg="All products are sufficiently stocked" />}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Close</button>
              <button type="button" className="btn-admin" onClick={() => { hideModal(inventoryModalId); navigate('/admin/inventory'); }}>
                <i className="fa-solid fa-boxes-stacked me-1"></i>Manage Inventory
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Month detail modal */}
      <div className="modal fade" id={monthModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-calendar-day me-2 text-primary"></i>Month Details</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3"><strong className="fs-5">{monthPeriod}</strong></div>
              {monthLoading ? <SpinnerBox /> : monthError ? <EmptyBox msg={monthError} /> : (
                <div className="row g-2">{monthTiles.map((t, i) => <StatTile key={i} {...t} />)}</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Close</button>
              <button type="button" className="btn-admin" onClick={() => { hideModal(monthModalId); navigate('/admin/orders'); }}>
                <i className="fa-solid fa-truck-fast me-1"></i>View Orders
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product sales details modal */}
      <div className="modal fade" id={productSalesModalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa-solid fa-drumstick-bite me-2" style={{ color: 'var(--primary)' }}></i>{psName || 'Product Sales Details'}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {psMeta ? (
                <div className="mb-3">
                  <strong className="fs-5">{psName.replace(' — Sales Details', '')}</strong>
                  <div className="text-muted small mt-1">
                    <span className="me-3"><i className="fa-solid fa-tag fa-fw me-1" style={{ color: 'var(--primary)' }}></i>Category: <strong>{psMeta.categoryName || '—'}</strong></span>
                    <span className="me-3"><i className="fa-solid fa-weight-hanging fa-fw me-1" style={{ color: 'var(--primary)' }}></i>Unit: <strong>{psMeta.unit}</strong></span>
                    <span>Product Status: <span className={'badge-status ' + (psMeta.available ? 'ACTIVE' : 'INACTIVE')}>{psMeta.available ? 'ACTIVE' : 'INACTIVE'}</span></span>
                  </div>
                </div>
              ) : null}
              {psLoading ? (
                <div className="empty-box"><i className="fa-solid fa-circle-notch fa-spin"></i><div>Loading sales details...</div></div>
              ) : psError ? <EmptyBox msg={psError} /> : (
                <>
                  <div className="row g-2 mb-3">{psTiles.map((t, i) => <StatTile key={i} {...t} />)}</div>
                  <label className="form-label">Recent Orders</label>
                  <div className="table-responsive" style={{ maxHeight: '40vh', overflow: 'auto' }}>
                    {!psHasOrders ? <EmptyBox msg="No sales data available for this product." /> : (
                      <table className="table table-fm align-middle">
                        <thead><tr><th>Order No.</th><th>Quantity</th><th className="text-end">Amount</th><th>Order Date</th><th>Status</th></tr></thead>
                        <tbody>
                          {psOrders.map((r, idx) => (
                            <tr key={idx}>
                              <td><strong className="small">{r.orderNumber}</strong></td>
                              <td>{Number(r.quantity)} {psMeta ? psMeta.unit : 'KG'}</td>
                              <td className="text-end">{fmtMoney(r.amount)}</td>
                              <td className="text-muted" style={{ fontSize: '0.78rem' }}>{fmtDate(r.orderDate)}</td>
                              <td><AdminStatusBadge status={r.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-admin-outline" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
