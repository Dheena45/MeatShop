/* ============================================================
   FRESHMEAT — Admin Site Settings controller
   ============================================================ */

let currentSiteSettings = null;

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('site-settings', 'Site Settings', 'Manage home page hero statistics')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="admin-card">
      <div class="p-4">
        <h5 class="mb-1 fw-bold"><i class="fa-solid fa-chart-simple me-2 text-primary"></i>Hero Statistics</h5>
        <p class="text-muted small mb-4">These values are shown on the store home page hero section.</p>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Premium Cuts</label>
            <input type="text" class="form-control form-control-fm" id="ss-premium-cuts" maxlength="30" placeholder="500+">
            <div class="form-text">Example: 500+, 750+, 1000+</div>
          </div>
          <div class="col-md-6">
            <label class="form-label">Happy Customers</label>
            <input type="text" class="form-control form-control-fm" id="ss-happy-customers" maxlength="30" placeholder="10K+">
            <div class="form-text">Example: 10K+, 15K+, 20K+</div>
          </div>
        </div>
        <div class="d-flex gap-2 mt-4">
          <button class="btn-admin" id="save-site-btn"><i class="fa-solid fa-floppy-disk me-1"></i>Save Changes</button>
          <button class="btn-admin-outline" id="reset-site-btn"><i class="fa-solid fa-rotate-left me-1"></i>Reset</button>
        </div>
      </div>
    </div>`;

    document.getElementById('save-site-btn').addEventListener('click', saveSiteSettings);
    document.getElementById('reset-site-btn').addEventListener('click', fillSiteForm);

    loadSiteSettings();
});

async function loadSiteSettings() {
    try {
        const res = await apiCall('/api/admin/site-settings');
        currentSiteSettings = res && res.data ? res.data : {};
        fillSiteForm();
    } catch (e) {
        if (e && (e.status === 401 || e.status === 403)) Auth.requireAdmin();
        showToast((e && e.message) || 'Could not load site settings', 'error');
    }
}

function fillSiteForm() {
    if (!currentSiteSettings) return;
    document.getElementById('ss-premium-cuts').value = currentSiteSettings.premiumCuts || '';
    document.getElementById('ss-happy-customers').value = currentSiteSettings.happyCustomers || '';
}

function isValidStatValue(value) {
    return /^[0-9]+[Kk]?\+?$/.test(String(value || '').trim());
}

async function saveSiteSettings() {
    const premiumCuts = document.getElementById('ss-premium-cuts').value.trim();
    const happyCustomers = document.getElementById('ss-happy-customers').value.trim();

    if (!isValidStatValue(premiumCuts)) {
        showToast('Enter Premium Cuts as a value like 500+, 750+ or 1000+', 'warning');
        return;
    }
    if (!isValidStatValue(happyCustomers)) {
        showToast('Enter Happy Customers as a value like 10K+, 15K+ or 20K+', 'warning');
        return;
    }

    const btn = document.getElementById('save-site-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    try {
        const res = await apiCall('/api/admin/site-settings', {
            method: 'PUT',
            body: { premiumCuts, happyCustomers }
        });
        currentSiteSettings = (res && res.data) || { premiumCuts, happyCustomers };
        fillSiteForm();
        showToast('Site settings updated successfully.');
    } catch (e) {
        if (e && (e.status === 401 || e.status === 403)) Auth.requireAdmin();
        showToast((e && e.message) || 'Could not update site settings', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i>Save Changes';
    }
}