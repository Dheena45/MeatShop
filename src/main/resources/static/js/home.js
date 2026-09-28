/* FreshMeat — Homepage controller */

function getActiveNavKey() { return 'home'; }

document.addEventListener('DOMContentLoaded', function () {
    loadHeroStats();
    loadReviews();
    initContactForm();
});

async function loadHeroStats() {
    const premiumEl = document.getElementById('stat-premium-cuts');
    const customersEl = document.getElementById('stat-happy-customers');
    if (!premiumEl && !customersEl) return;
    try {
        const res = await apiCall('/api/site-settings');
        const s = (res && res.data) || {};
        if (premiumEl) premiumEl.textContent = escapeHtml(s.premiumCuts || '');
        if (customersEl) customersEl.textContent = escapeHtml(s.happyCustomers || '');
    } catch (e) {
        if (premiumEl) premiumEl.textContent = '—';
        if (customersEl) customersEl.textContent = '—';
    }
}

function initContactForm() {
    const btn = document.getElementById('contact-send-btn');
    if (btn) btn.addEventListener('click', sendContactMessage);
}

async function sendContactMessage() {
    const msgInput = document.getElementById('contact-msg');
    const btn = document.getElementById('contact-send-btn');
    if (!msgInput || !btn) return;

    if (!Auth.isLoggedIn()) {
        showToast('Please login to send a message.', 'warning');
        setTimeout(() => window.location.href = '/login.html?redirect=/index.html', 1400);
        return;
    }

    const message = msgInput.value.trim();

    if (!message) {
        showToast('Please enter your message.', 'warning');
        msgInput.focus();
        return;
    }
    if (message.length > 2000) {
        showToast('Message must be at most 2000 characters.', 'warning');
        msgInput.focus();
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Sending...';

    try {
        await apiCall('/api/contact/messages', { method: 'POST', body: { message } });
        showToast('Message sent successfully.');
        msgInput.value = '';
    } catch (e) {
        if (e.status === 401) {
            showToast('Please login to send a message.', 'warning');
            setTimeout(() => window.location.href = '/login.html?redirect=/index.html', 1400);
        } else {
            let msg = 'Unable to send your message. Please try again.';
            if (e.status === 400 && e.message) msg = e.message;
            showToast(msg, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Send Message';
    }
}

async function loadReviews() {
    const grid = document.getElementById('reviews-grid');
    if (!grid) return;

    let reviews = [];
    try {
        const res = await apiCall('/api/reviews');
        reviews = res.data || [];
    } catch (e) {
        console.error('GET /api/reviews failed:', e);
        grid.innerHTML = `<div class="col-12"><div class="empty-state">
            <div class="es-icon"><i class="fa-regular fa-star"></i></div>
            <h6>Reviews are not available right now</h6>
            <p>Please try again later.</p>
            <a href="#" class="btn btn-fm btn-sm mt-2" onclick="loadReviews();return false;">Retry</a>
        </div></div>`;
        return;
    }

    if (!reviews.length) {
        grid.innerHTML = `<div class="col-12"><div class="empty-state">
            <div class="es-icon"><i class="fa-regular fa-star"></i></div>
            <h6>No reviews yet</h6>
            <p>Be the first customer to share your experience.</p></div></div>`;
        return;
    }

    grid.innerHTML = reviews.slice(0, 3).map(r => `
        <div class="col-md-4">
          <div class="card card-fm testimonial-card">
            <span class="quote-mark">"</span>
            <div class="t-stars">${'★'.repeat(Math.min(5, Math.max(0, r.rating || 0)))}${'☆'.repeat(5 - Math.min(5, Math.max(0, r.rating || 0)))}</div>
            <p>"${escapeHtml(r.comment)}"</p>
            <div class="t-user">
              <div class="avatar">${initials(r.customerName || 'FR')}</div>
              <div><strong>${escapeHtml(r.customerName || 'FreshMeat User')}</strong>
              <span>${r.createdAt ? fmtDateOnly(r.createdAt) : ''}</span></div>
            </div>
          </div>
        </div>`).join('');
}