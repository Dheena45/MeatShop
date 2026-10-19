import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { showToast } from '../lib/toast';

/* Forgot password — ported from forgot-password.html + js/auth.js */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }
    setBusy(true);
    try {
      await apiCall('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      showToast(err.message || 'Unable to process your request. Please try again.', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <h2 style={{ fontFamily: 'var(--font-head)' }}>Forgot <span style={{ color: 'var(--gold-light)' }}>Password</span></h2>
          <p>Enter your registered email address.</p>
        </div>
        <div className="auth-body">
          {sent ? (
            <div className="text-center py-3">
              <div className="es-icon"><i className="fa-solid fa-circle-check"></i></div>
              <h6 className="mt-3">If an account exists for this email, a password reset link has been sent.</h6>
              <p className="text-muted small mt-2 mb-3">Development mode: the reset link is printed in the server console.</p>
              <Link to="/login" className="btn btn-fm w-100">Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Email Address</label>
                <input type="email" className="form-control form-control-fm" placeholder="you@example.com" required
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <button className="btn btn-fm w-100 btn-fm-lg" type="submit" disabled={busy}>
                {busy ? <><span className="spinner-border spinner-border-sm me-2"></span>Sending...</> : <><i className="fa-solid fa-paper-plane me-2"></i>Send Reset Link</>}
              </button>
            </form>
          )}

          <div className="auth-divider"><span>Remembered it?</span></div>
          <Link to="/login" className="btn btn-fm-outline w-100">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
