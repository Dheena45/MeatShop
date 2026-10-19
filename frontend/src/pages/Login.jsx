import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { showToast } from '../lib/toast';
import { useAuth } from '../context/AuthContext';

/* Login — ported from login.html + js/auth.js handleLogin + applyRoleHint */
export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { save } = useAuth();
  const roleHint = searchParams.get('role');
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const subText = roleHint === 'admin'    ? 'Admin login. Use your staff account to manage FreshMeat.'
    : roleHint === 'delivery'
      ? 'Delivery partner login. Sign in to view your assigned deliveries.'
      : 'Welcome back! Login to your account.';
  const headingAccent = roleHint === 'admin' ? 'Meat Admin' : roleHint === 'delivery' ? 'Meat Delivery' : 'Meat';

  async function onSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) { showToast('Please enter email and password', 'warning'); return; }
    setBusy(true);
    try {
      const res = await apiCall('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password }
      });
      const { token, id, name, role } = res.data;
      save(token, { id, name, email: email.trim(), role });
      showToast('Welcome back, ' + String(name).split(' ')[0] + '!');
      const dest = (role === 'ADMIN' || role === 'ROLE_ADMIN' || String(role).toUpperCase() === 'ADMIN')
        ? (redirect || '/admin/dashboard')
        : (role === 'DELIVERY_BOY' || role === 'ROLE_DELIVERY_BOY' || String(role).toUpperCase() === 'DELIVERY_BOY')
          ? '/delivery/dashboard'
          : (redirect || '/');
      setTimeout(() => navigate(dest), 200);
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <h2 style={{ fontFamily: 'var(--font-head)' }}>
            Fresh<span style={{ color: 'var(--gold-light)' }}>{headingAccent}</span>
          </h2>
          <p>{subText}</p>
        </div>
        <div className="auth-body">
          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Email Address</label>
              <input type="email" className="form-control form-control-fm" placeholder="you@example.com" required
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Password</label>
              <input type="password" className="form-control form-control-fm" placeholder="Enter your password" required
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="remember" />
                <label className="form-check-label small" htmlFor="remember">Remember me</label>
              </div>
              <Link to="/forgot-password" className="small">Forgot password?</Link>
            </div>
            <button className="btn btn-fm w-100 btn-fm-lg" type="submit" disabled={busy}>
              {busy ? <><span className="spinner-border spinner-border-sm me-2"></span>Logging in...</> : <><i className="fa-solid fa-right-to-bracket me-2"></i>Login</>}
            </button>
          </form>

          <div className="auth-divider"><span>New to FreshMeat?</span></div>
          <Link to="/register" className="btn btn-fm-outline w-100">Create an Account</Link>
        </div>
      </div>
    </div>
  );
}
