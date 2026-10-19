import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../lib/api';
import { showToast } from '../lib/toast';

/* FreshMeat — Admin Contact Settings controller (ported from contact-settings.js) */

const BLANK = {
  businessDescription: '',
  address: '',
  phone: '',
  email: '',
  businessHours: '',
  facebookUrl: '',
  instagramUrl: '',
  twitterUrl: '',
  youtubeUrl: ''
};

export default function AdminContactSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);

  const handleAuth = e => {
    if (e && (e.status === 401 || e.status === 403)) {
      showToast('Your session has expired. Please login again.', 'error', { title: 'Session Expired' });
      return true;
    }
    return false;
  };

  const loadSettings = useCallback(async () => {
    try {
      const res = await apiCall('/api/admin/contact-settings');
      setSettings(res && res.data ? res.data : {});
    } catch (e) {
      if (handleAuth(e)) return;
      showToast((e && e.message) || 'Could not load contact settings', 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    if (!settings) return;
    setForm({
      businessDescription: settings.businessDescription || '',
      address: settings.address || '',
      phone: settings.phone || '',
      email: settings.email || '',
      businessHours: settings.businessHours || '',
      facebookUrl: settings.facebookUrl || '',
      instagramUrl: settings.instagramUrl || '',
      twitterUrl: settings.twitterUrl || '',
      youtubeUrl: settings.youtubeUrl || ''
    });
  }, [settings]);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  async function saveSettings() {
    const payload = {};
    Object.keys(BLANK).forEach(k => { payload[k] = form[k].trim(); });

    setSaving(true);
    try {
      const res = await apiCall('/api/admin/contact-settings', { method: 'PUT', body: payload });
      setSettings((res && res.data) || payload);
      showToast('Contact details updated successfully.');
    } catch (e) {
      if (handleAuth(e)) return;
      showToast((e && e.message) || 'Could not update contact settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card">
      <div className="p-4">
        <h5 className="mb-1 fw-bold"><i className="fa-solid fa-address-card me-2 text-primary"></i>Contact Details</h5>
        <p className="text-muted small mb-4">These details are displayed on the store footer for all customers.</p>
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">Business Description</label>
            <textarea
              className="form-control form-control-fm"
              rows="3"
              maxLength="2000"
              placeholder="Short tagline shown in the footer"
              value={form.businessDescription}
              onChange={set('businessDescription')}
            ></textarea>
          </div>
          <div className="col-md-8">
            <label className="form-label">Address *</label>
            <textarea
              className="form-control form-control-fm"
              rows="2"
              maxLength="2000"
              placeholder="Store address"
              value={form.address}
              onChange={set('address')}
            ></textarea>
          </div>
          <div className="col-md-4">
            <label className="form-label">Phone *</label>
            <input
              type="text"
              className="form-control form-control-fm"
              maxLength="30"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={set('phone')}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Email *</label>
            <input
              type="email"
              className="form-control form-control-fm"
              maxLength="150"
              placeholder="support@freshmeat.com"
              value={form.email}
              onChange={set('email')}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Business Hours *</label>
            <input
              type="text"
              className="form-control form-control-fm"
              maxLength="100"
              placeholder="Mon–Sun, 6 AM – 9 PM"
              value={form.businessHours}
              onChange={set('businessHours')}
            />
          </div>
          <div className="col-12"><hr className="my-2" /></div>
          <div className="col-12">
            <h6 className="fw-bold small text-muted text-uppercase mb-1">Social Media Links</h6>
            <p className="text-muted small mb-0">Leave a field blank to hide that social icon from the footer.</p>
          </div>
          <div className="col-md-6">
            <label className="form-label">Facebook URL</label>
            <input
              type="url"
              className="form-control form-control-fm"
              maxLength="300"
              placeholder="https://facebook.com/freshmeat"
              value={form.facebookUrl}
              onChange={set('facebookUrl')}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Instagram URL</label>
            <input
              type="url"
              className="form-control form-control-fm"
              maxLength="300"
              placeholder="https://instagram.com/freshmeat"
              value={form.instagramUrl}
              onChange={set('instagramUrl')}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">X / Twitter URL</label>
            <input
              type="url"
              className="form-control form-control-fm"
              maxLength="300"
              placeholder="https://twitter.com/freshmeat"
              value={form.twitterUrl}
              onChange={set('twitterUrl')}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">YouTube URL</label>
            <input
              type="url"
              className="form-control form-control-fm"
              maxLength="300"
              placeholder="https://youtube.com/@freshmeat"
              value={form.youtubeUrl}
              onChange={set('youtubeUrl')}
            />
          </div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn-admin" onClick={saveSettings} disabled={saving}>
            {saving ? (
              <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
            ) : (
              <><i className="fa-solid fa-floppy-disk me-1"></i>Save Changes</>
            )}
          </button>
          <button
            className="btn-admin-outline"
            onClick={() => {
              setForm({
                businessDescription: settings && settings.businessDescription || '',
                address: settings && settings.address || '',
                phone: settings && settings.phone || '',
                email: settings && settings.email || '',
                businessHours: settings && settings.businessHours || '',
                facebookUrl: settings && settings.facebookUrl || '',
                instagramUrl: settings && settings.instagramUrl || '',
                twitterUrl: settings && settings.twitterUrl || '',
                youtubeUrl: settings && settings.youtubeUrl || ''
              });
            }}
          >
            <i className="fa-solid fa-rotate-left me-1"></i>Reset
          </button>
        </div>
      </div>
    </div>
  );
}