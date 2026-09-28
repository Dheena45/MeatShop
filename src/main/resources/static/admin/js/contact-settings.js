/* ============================================================
   FRESHMEAT — Admin Contact Settings controller
   ============================================================ */

let currentSettings = null;

document.addEventListener('DOMContentLoaded', function () {
    if (!initAdminPage('contact-settings', 'Contact Settings', 'Manage store-wide contact & footer details')) return;

    document.getElementById('admin-page-content').innerHTML = `
    <div class="admin-card">
      <div class="p-4">
        <h5 class="mb-1 fw-bold"><i class="fa-solid fa-address-card me-2 text-primary"></i>Contact Details</h5>
        <p class="text-muted small mb-4">These details are displayed on the store footer for all customers.</p>
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label">Business Description</label>
            <textarea class="form-control form-control-fm" id="cs-description" rows="3" maxlength="2000" placeholder="Short tagline shown in the footer"></textarea>
          </div>
          <div class="col-md-8">
            <label class="form-label">Address *</label>
            <textarea class="form-control form-control-fm" id="cs-address" rows="2" maxlength="2000" placeholder="Store address"></textarea>
          </div>
          <div class="col-md-4">
            <label class="form-label">Phone *</label>
            <input type="text" class="form-control form-control-fm" id="cs-phone" maxlength="30" placeholder="+91 98765 43210">
          </div>
          <div class="col-md-6">
            <label class="form-label">Email *</label>
            <input type="email" class="form-control form-control-fm" id="cs-email" maxlength="150" placeholder="support@freshmeat.com">
          </div>
          <div class="col-md-6">
            <label class="form-label">Business Hours *</label>
            <input type="text" class="form-control form-control-fm" id="cs-hours" maxlength="100" placeholder="Mon–Sun, 6 AM – 9 PM">
          </div>
          <div class="col-12"><hr class="my-2"></div>
          <div class="col-12">
            <h6 class="fw-bold small text-muted text-uppercase mb-1">Social Media Links</h6>
            <p class="text-muted small mb-0">Leave a field blank to hide that social icon from the footer.</p>
          </div>
          <div class="col-md-6">
            <label class="form-label">Facebook URL</label>
            <input type="url" class="form-control form-control-fm" id="cs-facebook" maxlength="300" placeholder="https://facebook.com/freshmeat">
          </div>
          <div class="col-md-6">
            <label class="form-label">Instagram URL</label>
            <input type="url" class="form-control form-control-fm" id="cs-instagram" maxlength="300" placeholder="https://instagram.com/freshmeat">
          </div>
          <div class="col-md-6">
            <label class="form-label">X / Twitter URL</label>
            <input type="url" class="form-control form-control-fm" id="cs-twitter" maxlength="300" placeholder="https://twitter.com/freshmeat">
          </div>
          <div class="col-md-6">
            <label class="form-label">YouTube URL</label>
            <input type="url" class="form-control form-control-fm" id="cs-youtube" maxlength="300" placeholder="https://youtube.com/@freshmeat">
          </div>
        </div>
        <div class="d-flex gap-2 mt-4">
          <button class="btn-admin" id="save-contact-btn"><i class="fa-solid fa-floppy-disk me-1"></i>Save Changes</button>
          <button class="btn-admin-outline" id="reset-contact-btn"><i class="fa-solid fa-rotate-left me-1"></i>Reset</button>
        </div>
      </div>
    </div>`;

    document.getElementById('save-contact-btn').addEventListener('click', saveSettings);
    document.getElementById('reset-contact-btn').addEventListener('click', fillForm);

    loadSettings();
});

async function loadSettings() {
    try {
        const res = await apiCall('/api/admin/contact-settings');
        currentSettings = res && res.data ? res.data : {};
        fillForm();
    } catch (e) {
        if (e && (e.status === 401 || e.status === 403)) Auth.requireAdmin();
        showToast((e && e.message) || 'Could not load contact settings', 'error');
    }
}

function fillForm() {
    if (!currentSettings) return;
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = (value == null ? '' : value);
    };
    setVal('cs-description', currentSettings.businessDescription);
    setVal('cs-address', currentSettings.address);
    setVal('cs-phone', currentSettings.phone);
    setVal('cs-email', currentSettings.email);
    setVal('cs-hours', currentSettings.businessHours);
    setVal('cs-facebook', currentSettings.facebookUrl);
    setVal('cs-instagram', currentSettings.instagramUrl);
    setVal('cs-twitter', currentSettings.twitterUrl);
    setVal('cs-youtube', currentSettings.youtubeUrl);
}

async function saveSettings() {
    const value = id => document.getElementById(id).value.trim();

    const payload = {
        businessDescription: value('cs-description'),
        address: value('cs-address'),
        phone: value('cs-phone'),
        email: value('cs-email'),
        businessHours: value('cs-hours'),
        facebookUrl: value('cs-facebook'),
        instagramUrl: value('cs-instagram'),
        twitterUrl: value('cs-twitter'),
        youtubeUrl: value('cs-youtube')
    };

    const btn = document.getElementById('save-contact-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    try {
        const res = await apiCall('/api/admin/contact-settings', { method: 'PUT', body: payload });
        currentSettings = (res && res.data) || payload;
        fillForm();
        showToast('Contact details updated successfully.');
    } catch (e) {
        if (e && (e.status === 401 || e.status === 403)) Auth.requireAdmin();
        showToast((e && e.message) || 'Could not update contact settings', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i>Save Changes';
    }
}