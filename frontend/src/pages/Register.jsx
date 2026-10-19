import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { showToast } from '../lib/toast';

/* Register — ported from register.html + js/auth.js handleRegister */
const REG_NAME_RE = /^[\p{L}][\p{L} .'-]{1,99}$/u;
const REG_EMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/;
const REG_PHONE_RE = /^[6-9][0-9]{9}$/;

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function setField(id, value) {
    setForm(f => ({ ...f, [id]: value }));
    setErrors(e => ({ ...e, [id]: '' }));
  }

  function showError(id, message) {
    setErrors(e => ({ ...e, [id]: message }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErrors({});
    const { name, email, phone, password, confirm } = form;
    const errs = {};
    let valid = true;

    if (!name) { errs.name = 'Full name is required.'; valid = false; }
    else if (name.length < 2 || name.length > 100 || !REG_NAME_RE.test(name)) {
      errs.name = 'Please enter a valid full name (letters and spaces only).'; valid = false;
    }

    if (!email) { errs.email = 'Email address is required.'; valid = false; }
    else if (email.length > 150 || !REG_EMAIL_RE.test(email)) {
      errs.email = 'Email must contain only lowercase letters and use @gmail.com.'; valid = false;
    }

    if (!phone) { errs.phone = 'Mobile number is required.'; valid = false; }
    else if (!REG_PHONE_RE.test(phone)) { errs.phone = 'Please enter a valid 10-digit mobile number.'; valid = false; }

    if (!password) { errs.password = 'Password is required.'; valid = false; }
    else if (password.length < 6) { errs.password = 'Password must contain at least 6 characters.'; valid = false; }

    if (!confirm) { errs.confirm = 'Please confirm your password.'; valid = false; }
    else if (password !== confirm) { errs.confirm = 'Passwords do not match.'; valid = false; }

    if (!valid) { setErrors(errs); return; }

    setBusy(true);
    try {
      await apiCall('/api/auth/register', {
        method: 'POST',
        body: { name, email, phone, password, confirmPassword: confirm }
      });
      showToast('Account created! Please login.');
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      const msg = err.message || 'Registration failed';
      if (/email already registered/i.test(msg)) showError('email', 'Email already registered.');
      else if (/mobile number already registered|phone number is already registered/i.test(msg)) showError('phone', 'Mobile number already registered.');
      else showToast(msg, 'error');
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <h2 style={{ fontFamily: 'var(--font-head)' }}>Join <span style={{ color: 'var(--gold-light)' }}>FreshMeat</span></h2>
          <p>Create your account to start ordering fresh.</p>
        </div>
        <div className="auth-body">
          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Full Name</label>
              <input type="text" className="form-control form-control-fm" placeholder="Your full name" required
                value={form.name} onChange={e => setField('name', e.target.value)} />
              <div className="auth-field-error">{errors.name}</div>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Email Address</label>
              <input type="email" className="form-control form-control-fm" placeholder="you@example.com" required
                value={form.email} onChange={e => setField('email', e.target.value)} />
              <div className="auth-field-error">{errors.email}</div>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Mobile Number</label>
              <input type="tel" className="form-control form-control-fm" placeholder="10-digit mobile" maxLength={10} required
                value={form.phone} onChange={e => setField('phone', e.target.value.replace(/\D+/g, '').slice(0, 10))} />
              <div className="auth-field-error">{errors.phone}</div>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Password</label>
              <input type="password" className="form-control form-control-fm" placeholder="Min 6 characters" required
                value={form.password} onChange={e => setField('password', e.target.value)} />
              <div className="auth-field-error">{errors.password}</div>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Confirm Password</label>
              <input type="password" className="form-control form-control-fm" placeholder="Re-enter password" required
                value={form.confirm} onChange={e => setField('confirm', e.target.value)} />
              <div className="auth-field-error">{errors.confirm}</div>
            </div>
            <button className="btn btn-fm w-100 btn-fm-lg" type="submit" disabled={busy}>
              {busy ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating account...</> : <><i className="fa-solid fa-user-plus me-2"></i>Create Account</>}
            </button>
          </form>

          <div className="auth-divider"><span>Already have an account?</span></div>
          <Link to="/login" className="btn btn-fm-outline w-100">Login Instead</Link>
          <p className="text-center mt-3 small text-muted mb-0">By creating an account you agree to our Terms &amp; Privacy Policy.</p>
        </div>
      </div>
    </div>
  );
}
