import { useId, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fmtDate, fmtMoney, initials } from '../lib/format';
import { showModal, hideModal } from '../lib/modal';

/* ============================================================
   FRESHMEAT — Admin shell (sidebar + topbar)
   Ported from admin-app.js initAdminPage()/renderAdminShell markup.
   ============================================================ */

const MAIN_MENU = [
  { key: 'dashboard', href: '/admin/dashboard', icon: 'fa-solid fa-gauge-high', label: 'Dashboard' },
  { key: 'orders', href: '/admin/orders', icon: 'fa-solid fa-receipt', label: 'Orders' },
  { key: 'delivery', href: '/admin/delivery', icon: 'fa-solid fa-truck-fast', label: 'Delivery' },
  { key: 'delivery-boys', href: '/admin/delivery-boys', icon: 'fa-solid fa-id-badge', label: 'Delivery Boys' },
  { key: 'products', href: '/admin/products', icon: 'fa-solid fa-drumstick-bite', label: 'Products' },
  { key: 'categories', href: '/admin/categories', icon: 'fa-solid fa-layer-group', label: 'Categories' },
  { key: 'inventory', href: '/admin/inventory', icon: 'fa-solid fa-boxes-stacked', label: 'Inventory' },
  { key: 'customers', href: '/admin/customers', icon: 'fa-solid fa-users', label: 'Customers' },
  { key: 'reviews', href: '/admin/reviews', icon: 'fa-solid fa-star', label: 'Reviews' },
  { key: 'offers', href: '/admin/offers', icon: 'fa-solid fa-tags', label: 'Offers' },
  { key: 'contact-messages', href: '/admin/contact-messages', icon: 'fa-solid fa-envelope', label: 'Messages' }
];

const SETTINGS_MENU = [
  { key: 'site-settings', href: '/admin/site-settings', icon: 'fa-solid fa-chart-simple', label: 'Site Settings' },
  { key: 'contact-settings', href: '/admin/contact-settings', icon: 'fa-solid fa-address-card', label: 'Contact Settings' }
];

/* Topbar title/subtitle per page (mirrors each initAdminPage() call). */
const PAGE_META = {
  dashboard: ['Dashboard', 'Business overview & performance'],
  orders: ['Orders', 'Track & manage customer orders'],
  delivery: ['Delivery Management', 'Assign delivery boys and track every order'],
  'delivery-boys': ['Delivery Boys', 'Manage your delivery team'],
  products: ['Products', 'Manage catalog, pricing & availability'],
  categories: ['Categories', 'Manage product categories'],
  inventory: ['Inventory', 'Stock levels & reorder alerts'],
  customers: ['Customers', 'Registered customer accounts'],
  reviews: ['Reviews', 'Moderate customer feedback'],
  offers: ['Offers', 'Discounts, coupons & promotions'],
  'contact-messages': ['Contact Messages', 'Customer enquiries from the Get in Touch form'],
  'site-settings': ['Site Settings', 'Manage home page hero statistics'],
  'contact-settings': ['Contact Settings', 'Manage store-wide contact & footer details']
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const parts = location.pathname.split('/').filter(Boolean);
  const key = parts[1] || 'dashboard';
  const [title, subtitle] = PAGE_META[key] || ['Admin', ''];

  function closeMobile() {
    setOpen(false);
  }

  function onLogout(e) {
    e.preventDefault();
    logout();
    navigate('/login?role=admin');
  }

  return (
    <>
      <aside className={'admin-sidebar' + (open ? ' open' : '')} id="admin-sidebar">
        <Link className="sidebar-brand" to="/admin/dashboard" onClick={closeMobile}>
          Fresh<span className="dot">Meat</span>
        </Link>
        <div className="sidebar-scroll">
          <div className="sidebar-label">Main</div>
          <nav>
            {MAIN_MENU.map(m => (
              <SidebarLink key={m.key} item={m} onNavigate={closeMobile} />
            ))}
          </nav>
          <div className="sidebar-label">Settings</div>
          <nav>
            {SETTINGS_MENU.map(m => (
              <SidebarLink key={m.key} item={m} onNavigate={closeMobile} />
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <Link className="view-site" to="/"><i className="fa-solid fa-store me-2"></i>View Store</Link>
          <a className="logout-btn mt-2" href="#" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket me-2"></i>Logout
          </a>
        </div>
      </aside>
      <div className={'sidebar-overlay' + (open ? ' show' : '')} onClick={closeMobile}></div>
      <main className="admin-main">
        <div className="admin-topbar">
          <div className="d-flex align-items-center gap-2">
            <button className="sidebar-toggle" onClick={() => setOpen(o => !o)} aria-label="Menu">
              <i className="fa-solid fa-bars"></i>
            </button>
            <div>
              <h4>{title}</h4>
              <small className="text-muted">{subtitle}</small>
            </div>
          </div>
          <div className="admin-top-right">
            <span className="admin-user-chip">
              <span className="avatar">{initials(user ? user.name : 'A')}</span>
              {user ? String(user.name || 'Admin').split(' ')[0] : 'Admin'}
            </span>
          </div>
        </div>
        <div id="admin-page-content"><Outlet /></div>
      </main>
    </>
  );
}

function SidebarLink({ item, onNavigate }) {
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
      onClick={onNavigate}
    >
      <i className={item.icon}></i>{item.label}
    </NavLink>
  );
}

/* ============================================================
   Shared admin helpers (ported from admin-app.js)
   ============================================================ */

/* Unique modal id per component instance so lib/modal.js never reuses a
   Bootstrap instance bound to an unmounted (stale) element after navigating
   between admin pages and back. */
export function useModalId(prefix) {
  const id = useId();
  return prefix + '-' + id.replace(/[^a-zA-Z0-9]/g, '');
}

export function AdminStatusBadge({ status }) {
  const label = String(status || '').replace(/_/g, ' ');
  return <span className={'badge-status ' + (status || '')}>{label}</span>;
}

const DELIVERY_STATE_LABELS = {
  PENDING_ASSIGNMENT: 'Pending Assignment',
  ASSIGNED: 'Assigned',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered'
};

export function DeliveryStateBadge({ state }) {
  const key = state || 'PENDING_ASSIGNMENT';
  return (
    <span className={'badge-status ' + key}>
      {DELIVERY_STATE_LABELS[key] || key.replace(/_/g, ' ')}
    </span>
  );
}

const PAYMENT_STYLES = {
  PAID: { background: '#e7f6ec', color: '#047857' },
  CANCELLED: { background: '#fee2e2', color: '#b91c1c' },
  FAILED: { background: '#fee2e2', color: '#b91c1c' },
  PENDING: { background: '#fff4e0', color: '#b45309' }
};

export function PaymentBadge({ order }) {
  const key = order.paymentStatus || 'PENDING';
  const tone = PAYMENT_STYLES[key] || PAYMENT_STYLES.PENDING;
  return (
    <span
      className="badge"
      style={{ ...tone, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}
    >
      {key}
    </span>
  );
}

/* Payment cell: "ONLINE / PAID" style used by the Delivery page. */
export function PaymentCell({ order }) {
  return (
    <>
      <div style={{ fontSize: '0.78rem' }}>
        {String(order.paymentMethod || '-').replace(/_/g, ' ')}
      </div>
      <div className="mt-1"><PaymentBadge order={order} /></div>
    </>
  );
}

const TILE_BORDERS = {
  red: '#8B0000',
  green: '#1e9e4a',
  orange: '#f97316',
  blue: '#3b82f6',
  gold: '#D4A843'
};

export function StatTile({ label, value, tone = '' }) {
  const border = TILE_BORDERS[tone] || 'transparent';
  return (
    <div className="col-6 col-lg-4">
      <div
        className="p-3 rounded"
        style={{ background: '#f8f5f0', borderLeft: `3px solid ${border}`, height: '100%' }}
      >
        <div
          className="text-muted"
          style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}
        >
          {label}
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

export function SpinnerBox({ msg = 'Loading...' }) {
  return (
    <div className="empty-box">
      <i className="fa-solid fa-circle-notch fa-spin"></i>
      <div>{msg}</div>
    </div>
  );
}

export function EmptyBox({ msg = 'Nothing here yet', icon = 'fa-regular fa-folder-open' }) {
  return (
    <div className="empty-box">
      <i className={icon}></i>
      <div>{msg}</div>
    </div>
  );
}

/* Compact one-line delivery address taken from the snapshot stored on the order. */
export function addressOneLine(o) {
  return [o.deliveryDoor, o.deliveryStreet, o.deliveryArea, o.deliveryCity, o.deliveryPincode]
    .filter(Boolean).join(', ') || '-';
}

/* Delivery block for the admin order modal (assignment, timestamps, history). */
export function DeliveryPanel({ order, onAssign, onReassign }) {
  const o = order;
  const d = o.delivery;
  if (!d) return null;

  const assignable = o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY_FOR_PICKUP';
  const canAssign = assignable && !d.deliveryBoyId;
  const canReassign = assignable && !!d.deliveryBoyId;
  const isCancelled = o.status === 'CANCELLED';
  const needsBoy = canAssign;

  let assignControls = null;
  if (canAssign) {
    assignControls = (
      <button className="btn-admin" onClick={onAssign}>
        <i className="fa-solid fa-user-plus me-1"></i>{needsBoy ? 'Assign Delivery Boy' : 'Assign'}
      </button>
    );
  } else if (canReassign) {
    assignControls = (
      <button className="btn-admin-outline" onClick={onReassign}>
        <i className="fa-solid fa-user-clock me-1"></i>Reassign
      </button>
    );
  }

  const history = (d.history || []).slice().reverse();

  return (
    <div className="mt-3 pt-3 border-top">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <label className="form-label mb-0"><i className="fa-solid fa-truck-fast me-1"></i>Delivery Boy</label>
        <DeliveryStateBadge state={d.state} />
      </div>
      {isCancelled ? (
        <p className="text-muted mb-0" style={{ fontSize: '0.82rem' }}>
          This order was cancelled, so it is not part of delivery management.
        </p>
      ) : (
        <>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <div style={{ fontSize: '0.9rem', minWidth: 180 }}>
              {d.deliveryBoyName ? (
                <>
                  <strong>{d.deliveryBoyName}</strong>
                  {d.deliveryBoyPhone ? (
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}> {d.deliveryBoyPhone}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted">Not assigned yet</span>
              )}
            </div>
            {assignControls}
          </div>
          {needsBoy ? (
            <div className="form-text mt-2 mb-0" style={{ fontSize: '0.78rem', color: '#b45309' }}>
              <i className="fa-solid fa-circle-exclamation me-1"></i>
              Assign an active Delivery Boy (with a date + slot) so they can confirm the pickup.
            </div>
          ) : null}
          <div className="text-muted mt-2" style={{ fontSize: '0.76rem' }}>
            {d.deliveryDate && d.deliverySlot ? (
              <div><i className="fa-solid fa-calendar-days me-1"></i>Scheduled: {d.deliveryDate} &middot; {d.deliverySlot}</div>
            ) : null}
            {d.assignedAt ? <div><i className="fa-solid fa-user-check me-1"></i>Assigned: {fmtDate(d.assignedAt)}</div> : null}
            {d.startedAt ? <div><i className="fa-solid fa-location-arrow me-1"></i>Picked Up: {fmtDate(d.startedAt)}</div> : null}
            {d.completedAt ? <div><i className="fa-solid fa-circle-check me-1"></i>Delivered At: {fmtDate(d.completedAt)}</div> : null}
            {o.status === 'DELIVERED' && d.deliveryBoyName
              ? <div><i className="fa-solid fa-award me-1"></i>Delivered By: {d.deliveryBoyName}</div>
              : null}
          </div>
        </>
      )}
      {history.length ? (
        <details className="mt-2">
          <summary style={{ cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
            Delivery history ({history.length})
          </summary>
          <ul className="mb-0 mt-2 ps-3">
            {history.map((h, idx) => (
              <li className="mb-1" key={idx}>
                <strong>{h.deliveryBoyName || '-'}</strong>{' '}
                <span
                  className={'badge-status ' + (h.status === 'COMPLETED' ? 'DELIVERED' : (h.status === 'REASSIGNED' ? 'CANCELLED' : 'CONFIRMED'))}
                  style={{ fontSize: '0.62rem' }}
                >
                  {String(h.status || '').replace(/_/g, ' ')}
                </span>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                  Assigned {fmtDate(h.assignedAt)}
                  {h.deliveryDate && h.deliverySlot ? ` \u00B7 for ${h.deliveryDate} ${h.deliverySlot}` : ''}
                  {h.startedAt ? ` \u00B7 Picked Up ${fmtDate(h.startedAt)}` : ''}
                  {h.completedAt ? ` \u00B7 Delivered ${fmtDate(h.completedAt)}` : ''}
                  {h.assignedBy ? ` \u00B7 by ${h.assignedBy}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/* Shared Order Details body used by both the Orders and Delivery pages
   (ported from admin-app.js orderDetailSectionsHtml()). */
export function OrderDetailSections({ order, paymentActions, onMarkReceived, onViewInvoice, onPrint, onDownload, onAssign, onReassign }) {
  const o = order;
  const showPaymentActions = paymentActions && o.status !== 'CANCELLED';

  return (
    <>
      <table className="table table-fm align-middle">
        <thead>
          <tr>
            <th>Product</th><th>Qty</th><th>Cutting</th><th>Price/KG</th><th className="text-end">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(o.items || []).map((i, idx) => (
            <tr key={idx}>
              <td><strong className="small">{i.productName}</strong></td>
              <td>{i.quantity} KG</td>
              <td className="text-muted" style={{ fontSize: '0.78rem' }}>
                {String(i.cuttingOption || '').replace(/_/g, ' ')}
              </td>
              <td>{fmtMoney(i.pricePerKg)}</td>
              <td className="text-end">{fmtMoney(i.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row g-2 mt-1">
        <div className="col-md-7">
          <label className="form-label">Customer</label>
          <p className="mb-1">{o.customerName} &nbsp; {o.customerPhone || ''}</p>
          <label className="form-label">Delivery Address</label>
          <p className="mb-1" style={{ fontSize: '0.85rem' }}>
            {o.deliveryDoor}, {o.deliveryStreet}, {o.deliveryArea},<br />
            {o.deliveryCity} - {o.deliveryPincode}, {o.deliveryState}
          </p>
          <p className="text-muted" style={{ fontSize: '0.82rem' }}>
            <i className="fa-solid fa-clock me-1"></i>Slot: {o.deliverySlot || '-'}<br />
            <i className="fa-solid fa-note-sticky me-1"></i>Notes: {o.notes || '-'}
          </p>
        </div>
        <div className="col-md-5">
          <label className="form-label">Summary</label>
          <div className="small">
            <div className="d-flex justify-content-between"><span>Subtotal</span><span>{fmtMoney(o.subtotal)}</span></div>
            <div className="d-flex justify-content-between"><span>Discount</span><span className="text-success">-{fmtMoney(o.discountAmount)}</span></div>
            <div className="d-flex justify-content-between"><span>Tax</span><span>{fmtMoney(o.tax)}</span></div>
            <div className="d-flex justify-content-between">
              <span>Delivery</span>
              <span>{Number(o.deliveryCharge) === 0 ? 'FREE' : fmtMoney(o.deliveryCharge)}</span>
            </div>
            <hr className="my-1" />
            <div className="d-flex justify-content-between fw-bold"><span>Grand Total</span><span>{fmtMoney(o.grandTotal)}</span></div>
            <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.78rem' }}>
              <span>Payment</span><span>{String(o.paymentMethod || '').replace(/_/g, ' ')}</span>
            </div>
            <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.78rem' }}>
              <span>Payment Status</span><span>{String(o.paymentStatus || '').replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center mt-3 pt-2 border-top" style={{ borderTopColor: 'var(--bg-alt)' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Payment:</span>
        <PaymentBadge order={o} />
        {o.paymentStatus === 'PAID' ? (
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Paid {fmtMoney(o.paidAmount || o.grandTotal)}{o.paidAt ? ' on ' + fmtDate(o.paidAt) : ''}
          </span>
        ) : null}
        {o.transactionRef ? (
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Ref: {o.transactionRef}</span>
        ) : null}
        {showPaymentActions ? (
          <div className="ms-auto d-flex flex-wrap gap-2">
            {o.paymentMethod === 'CASH_ON_DELIVERY' && o.paymentStatus !== 'PAID' ? (
              <button className="btn-admin-outline" onClick={onMarkReceived} title="Mark cash as collected">
                <i className="fa-solid fa-money-bill-wave me-1"></i>Mark Received
              </button>
            ) : null}
            <button className="btn-admin-outline" onClick={onViewInvoice}>
              <i className="fa-solid fa-file-invoice me-1"></i>View Invoice
            </button>
            <button className="btn-admin-outline" onClick={onPrint}>
              <i className="fa-solid fa-print me-1"></i>Print Bill
            </button>
            <button className="btn-admin-outline" onClick={onDownload}>
              <i className="fa-solid fa-download me-1"></i>PDF
            </button>
          </div>
        ) : null}
      </div>

      <DeliveryPanel order={o} onAssign={onAssign} onReassign={onReassign} />
    </>
  );
}

export { showModal, hideModal };
