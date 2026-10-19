import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../lib/api';
import { showToast } from '../lib/toast';

/* FreshMeat — Admin Site Settings controller (ported from site-settings.js) */

const isValidStatValue = value => /^[0-9]+[Kk]?\+?$/.test(String(value || '').trim());

export default function AdminSiteSettings() {
  const [settings, setSettings] = useState(null);
  const [premiumCuts, setPremiumCuts] = useState('');
  const [happyCustomers, setHappyCustomers] = useState('');
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
      const res = await apiCall('/api/admin/site-settings');
      setSettings(res && res.data ? res.data : {});
    } catch (e) {
      if (handleAuth(e)) return;
      showToast((e && e.message) || 'Could not load site settings', 'error');
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    if (!settings) return;
    setPremiumCuts(settings.premiumCuts || '');
    setHappyCustomers(settings.happyCustomers || '');
  }, [settings]);

  async function saveSiteSettings() {
    const premium = premiumCuts.trim();
    const happy = happyCustomers.trim();

    if (!isValidStatValue(premium)) {
      showToast('Enter Premium Cuts as a value like 500+, 750+ or 1000+', 'warning');
      return;
    }
    if (!isValidStatValue(happy)) {
      showToast('Enter Happy Customers as a value like 10K+, 15K+ or 20K+', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await apiCall('/api/admin/site-settings', {
        method: 'PUT',
        body: { premiumCuts: premium, happyCustomers: happy }
      });
      setSettings((res && res.data) || { premiumCuts: premium, happyCustomers: happy });
      showToast('Site settings updated successfully.');
    } catch (e) {
      if (handleAuth(e)) return;
      showToast((e && e.message) || 'Could not update site settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card">
      <div className="p-4">
        <h5 className="mb-1 fw-bold"><i className="fa-solid fa-chart-simple me-2 text-primary"></i>Hero Statistics</h5>
        <p className="text-muted small mb-4">These values are shown on the store home page hero section.</p>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Premium Cuts</label>
            <input
              type="text"
              className="form-control form-control-fm"
              maxLength="30"
              placeholder="500+"
              value={premiumCuts}
              onChange={e => setPremiumCuts(e.target.value)}
            />
            <div className="form-text">Example: 500+, 750+, 1000+</div>
          </div>
          <div className="col-md-6">
            <label className="form-label">Happy Customers</label>
            <input
              type="text"
              className="form-control form-control-fm"
              maxLength="30"
              placeholder="10K+"
              value={happyCustomers}
              onChange={e => setHappyCustomers(e.target.value)}
            />
            <div className="form-text">Example: 10K+, 15K+, 20K+</div>
          </div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn-admin" onClick={saveSiteSettings} disabled={saving}>
            {saving ? (
              <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
            ) : (
              <><i className="fa-solid fa-floppy-disk me-1"></i>Save Changes</>
            )}
          </button>
          <button
            className="btn-admin-outline"
            onClick={() => {
              setPremiumCuts(settings && settings.premiumCuts ? settings.premiumCuts : '');
              setHappyCustomers(settings && settings.happyCustomers ? settings.happyCustomers : '');
            }}
          >
            <i className="fa-solid fa-rotate-left me-1"></i>Reset
          </button>
        </div>
      </div>
    </div>
  );
}