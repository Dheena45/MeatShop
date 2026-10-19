import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { showToast } from '../lib/toast';

/* Reset password — ported from reset-password.html + js/auth.js */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!token) { showToast('This reset link is invalid or incomplete.', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'warning'); return; }
    if (password !== confirm) { showToast('Passwords do not match', 'warning'); return; }
    setBusy(true);
    try {
      await apiCall('/api/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
      showToast('Password reset successfully. Please login with your new password.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      showToast(err.message || 'Unable to reset your password. Please try again.', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <h2 style={{ fontFamily: 'var(--font-head)' }}>Reset <span style={{ color: 'var(--gold-light)' }}>Password</span></h2>
          <p>Choose a new password for your account.</p>
        </div>
        <div className="auth-body">
          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold small">New Password</label>
              <input type="password" className="form-control form-control-fm" placeholder="Min 6 characters" required
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Confirm Password</label>
              <input type="password" className="form-control form-control-fm" placeholder="Re-enter new password" required
                value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            <button className="btn btn-fm w-100 btn-fm-lg" type="submit" disabled={busy}>
              {busy ? <><span className="spinner-border spinner-border-sm me-2"></span>Resetting...</> : <><i className="fa-solid fa-unlock-keyhole me-2"></i>Reset Password</>}
            </button>
          </form>

          <div className="auth-divider"><span>Remembered it?</span></div>
          <Link to="/login" className="btn btn-fm-outline w-100">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
