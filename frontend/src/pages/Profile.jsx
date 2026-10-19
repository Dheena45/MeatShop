import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { fmtMoney, fmtDate, initials } from '../lib/format';
import { showToast } from '../lib/toast';
import { customerOrderStatusClass, customerOrderStatusLabel } from '../lib/orderStatus';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import OrdersList from '../components/OrdersList';
import { useAuth } from '../context/AuthContext';

/* Profile — ported from profile.html + js/profile.js */
export default function Profile() {
  const navigate = useNavigate();
  const { save, token, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('personal');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [addresses, setAddresses] = useState([]);
  const [addrForm, setAddrForm] = useState({ label: '', doorNumber: '', street: '', area: '', city: '', state: '', pincode: '' });

  const [recentOrders, setRecentOrders] = useState(null);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiCall('/api/profile');
      const u = res.data;
      setProfile(u);
      setName(u.name || '');
      setPhone(u.phone || '');
      setEmail(u.email || '');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await apiCall('/api/addresses');
      setAddresses(res.data || []);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, []);

  const loadRecentOrders = useCallback(async () => {
    setRecentOrders(null);
    try {
      const res = await apiCall('/api/orders/my-orders');
      setRecentOrders(res.data || []);
    } catch (e) {
      setRecentOrders([]);
    }
  }, []);

  function openTab(key) {
    setTab(key);
    if (key === 'addresses') loadAddresses();
    if (key === 'orders') loadRecentOrders();
  }

  async function saveProfile() {
    if (name.trim().length < 2) { showToast('Enter a valid name', 'warning'); return; }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) { showToast('Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.', 'warning'); return; }
    try {
      await apiCall('/api/profile', { method: 'PUT', body: { name: name.trim(), phone: phone.trim() } });
      const user = { ...(profile || {}), name: name.trim(), phone: phone.trim() };
      save(token, { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
      setProfile(user);
      showToast('Profile updated!');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function changePassword() {
    if (!pw.current || !pw.next) { showToast('Please fill all fields', 'warning'); return; }
    if (pw.next.length < 6) { showToast('New password must be at least 6 characters', 'warning'); return; }
    if (pw.next !== pw.confirm) { showToast('Passwords do not match', 'warning'); return; }
    try {
      await apiCall('/api/profile/password', { method: 'PUT', body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: '', next: '', confirm: '' });
      showToast('Password changed successfully');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function addAddress() {
    const payload = {
      label: addrForm.label.trim() || 'Home',
      doorNumber: addrForm.doorNumber.trim(),
      street: addrForm.street.trim(),
      area: addrForm.area.trim(),
      city: addrForm.city.trim(),
      state: addrForm.state.trim(),
      pincode: addrForm.pincode.trim(),
      isDefault: false
    };
    if (!payload.doorNumber || !payload.city || !payload.pincode) { showToast('Door number, city and pincode are required', 'warning'); return; }
    if (!/^\d{6}$/.test(payload.pincode)) { showToast('Pincode must be 6 digits', 'warning'); return; }
    try {
      await apiCall('/api/addresses', { method: 'POST', body: payload });
      showToast('Address saved!');
      setAddrForm({ label: '', doorNumber: '', street: '', area: '', city: '', state: '', pincode: '' });
      loadAddresses();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function deleteAddress(id) {
    if (!window.confirm('Delete this address?')) return;
    apiCall('/api/addresses/' + id, { method: 'DELETE' })
      .then(() => { showToast('Address deleted'); loadAddresses(); })
      .catch(e => showToast(e.message, 'error'));
  }

  function onLogout(e) {
    e.preventDefault();
    logout();
    navigate('/');
  }

  if (error) {
    return (
      <section className="section-pad pt-4">
        <div className="container"><EmptyState icon="fa-triangle-exclamation" title={error} /></div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="section-pad pt-4">
        <div className="container"><Spinner /></div>
      </section>
    );
  }

  const menuItems = [
    { key: 'personal', icon: 'fa-user', label: 'Personal Info' },
    { key: 'addresses', icon: 'fa-location-dot', label: 'Saved Addresses' },
    { key: 'orders', icon: 'fa-box', label: 'Order History' },
    { key: 'password', icon: 'fa-key', label: 'Change Password' },
    { key: 'myorders', icon: 'fa-truck', label: 'My Orders' }
  ];

  return (
    <section className="section-pad pt-4">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-3">
            <div className="profile-sidebar">
              <div className="text-center mb-3">
                <div className="profile-avatar">{initials(profile.name)}</div>
                <h6 className="fw-bold mb-0">{profile.name}</h6>
                <small className="text-muted">{profile.email}</small>
              </div>
              <div className="profile-menu">
                {menuItems.map(m => (
                  <a key={m.key} className={'nav-link' + (tab === m.key ? ' active' : '')} href="#"
                    onClick={e => { e.preventDefault(); openTab(m.key); }}>
                    <i className={'fa-solid ' + m.icon + ' me-2'}></i>{m.label}
                  </a>
                ))}
                <hr />
                <a className="nav-link text-danger" href="#" onClick={onLogout}>
                  <i className="fa-solid fa-right-from-bracket me-2"></i>Logout
                </a>
              </div>
            </div>
          </div>

          <div className="col-lg-9">
            {tab === 'personal' ? (
              <div className="card card-fm p-4">
                <h5 style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>Personal Information</h5>
                <div className="row g-3 mt-2">
                  <div className="col-md-6">
                    <label className="form-label">Full Name</label>
                    <input type="text" className="form-control form-control-fm" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Mobile Number</label>
                    <input type="tel" className="form-control form-control-fm" maxLength={10} inputMode="numeric" pattern="[6-9][0-9]{9}"
                      value={phone} onChange={e => setPhone(e.target.value.replace(/\D+/g, '').slice(0, 10))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control form-control-fm" value={email} disabled />
                  </div>
                </div>
                <button className="btn btn-fm mt-4" onClick={saveProfile}><i className="fa-solid fa-floppy-disk me-1"></i>Save Changes</button>
              </div>
            ) : null}

            {tab === 'addresses' ? (
              <div className="card card-fm p-4">
                <h5 style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>Saved Addresses</h5>
                <div className="mt-3">
                  {addresses.length === 0 ? (
                    <p className="text-muted small">No saved addresses yet.</p>
                  ) : addresses.map(a => (
                    <div className="d-flex justify-content-between align-items-center border-bottom py-2" key={a.id}>
                      <div>
                        <strong className="small">{a.label || 'Address'}</strong>
                        <div className="text-muted small">
                          {a.doorNumber}, {a.street}, {a.area}, {a.city} - {a.pincode}
                          {a.isDefault ? ' ' : ''}{a.isDefault ? <span className="badge text-bg-primary">Default</span> : null}
                        </div>
                      </div>
                      <button className="btn-icon-xs del" onClick={() => deleteAddress(a.id)}><i className="fa-solid fa-trash-can"></i></button>
                    </div>
                  ))}
                </div>
                <hr />
                <h6 className="fw-bold">Add New Address</h6>
                <div className="row g-3 mt-1">
                  <div className="col-md-4"><label className="form-label">Label</label>
                    <input type="text" className="form-control form-control-fm" placeholder="Home / Office" value={addrForm.label} onChange={e => setAddrForm({ ...addrForm, label: e.target.value })} /></div>
                  <div className="col-md-4"><label className="form-label">Door No.</label>
                    <input type="text" className="form-control form-control-fm" value={addrForm.doorNumber} onChange={e => setAddrForm({ ...addrForm, doorNumber: e.target.value })} /></div>
                  <div className="col-md-4"><label className="form-label">Street</label>
                    <input type="text" className="form-control form-control-fm" value={addrForm.street} onChange={e => setAddrForm({ ...addrForm, street: e.target.value })} /></div>
                  <div className="col-md-4"><label className="form-label">Area</label>
                    <input type="text" className="form-control form-control-fm" value={addrForm.area} onChange={e => setAddrForm({ ...addrForm, area: e.target.value })} /></div>
                  <div className="col-md-4"><label className="form-label">City</label>
                    <input type="text" className="form-control form-control-fm" value={addrForm.city} onChange={e => setAddrForm({ ...addrForm, city: e.target.value })} /></div>
                  <div className="col-md-4"><label className="form-label">State</label>
                    <input type="text" className="form-control form-control-fm" value={addrForm.state} onChange={e => setAddrForm({ ...addrForm, state: e.target.value })} /></div>
                  <div className="col-md-6"><label className="form-label">Pincode</label>
                    <input type="text" className="form-control form-control-fm" maxLength={6} value={addrForm.pincode} onChange={e => setAddrForm({ ...addrForm, pincode: e.target.value.replace(/\D+/g, '').slice(0, 6) })} /></div>
                  <div className="col-md-6 d-flex align-items-end">
                    <button className="btn btn-fm" onClick={addAddress}><i className="fa-solid fa-plus me-1"></i>Add Address</button></div>
                </div>
              </div>
            ) : null}

            {tab === 'orders' ? (
              <div className="card card-fm p-4">
                {recentOrders === null ? <Spinner /> : recentOrders.length === 0 ? (
                  <EmptyState icon="fa-box" title="No orders yet" />
                ) : recentOrders.slice(0, 6).map(o => (
                  <div className="d-flex flex-wrap justify-content-between align-items-center border-bottom py-2" key={o.id}>
                    <div>
                      <Link to={'/order-tracking?id=' + o.id} className="fw-bold small">{o.orderNumber}</Link>
                      <div className="text-muted small">{fmtDate(o.createdAt)} &bull; {fmtMoney(o.grandTotal)}</div>
                    </div>
                    <span className={'status-badge status-' + customerOrderStatusClass(o.status)}>{customerOrderStatusLabel(o.status)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'password' ? (
              <div className="card card-fm p-4">
                <h5 style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>Change Password</h5>
                <div className="row g-3 mt-2" style={{ maxWidth: 420 }}>
                  <div className="col-12"><label className="form-label">Current Password</label>
                    <input type="password" className="form-control form-control-fm" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></div>
                  <div className="col-12"><label className="form-label">New Password</label>
                    <input type="password" className="form-control form-control-fm" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></div>
                  <div className="col-12"><label className="form-label">Confirm New Password</label>
                    <input type="password" className="form-control form-control-fm" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} /></div>
                </div>
                <button className="btn btn-fm mt-4" onClick={changePassword}><i className="fa-solid fa-key me-1"></i>Update Password</button>
              </div>
            ) : null}

            {tab === 'myorders' ? (
              <div className="card card-fm p-4">
                <h5 style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>My Orders</h5>
                <div className="mt-3"><OrdersList /></div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
