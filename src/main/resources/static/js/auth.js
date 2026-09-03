
/* FreshMeat — Auth page controller (login + register) */

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        // Prefill admin hint for demo discoverability
        document.getElementById('email').placeholder = 'you@example.com (admin: admin@freshmeat.com)';
    }

    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', handleRegister);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');

    if (!email || !password) {
        showToast('Please enter email and password', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';

    try {
        const res = await apiCall('/api/auth/login', {
            method: 'POST',
            body: { email, password }
        });
        const { token, id, name, role } = res.data;
        Auth.save(token, { id, name, email, role });

        showToast('Welcome back, ' + name.split(' ')[0] + '!');
        const redirect = new URLSearchParams(window.location.search).get('redirect');
        if (role === 'ADMIN') {
            setTimeout(() => window.location.href = redirect || '/admin/dashboard.html', 600);
        } else {
            setTimeout(() => window.location.href = redirect || '/', 600);
        }
    } catch (err) {
        showToast(err.message || 'Login failed', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-2"></i>Login';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    const btn = document.getElementById('register-btn');

    if (name.length < 2) { showToast('Please enter your full name', 'warning'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Please enter a valid email', 'warning'); return; }
    if (!/^\d{10}$/.test(phone)) { showToast('Phone must be 10 digits', 'warning'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'warning'); return; }
    if (password !== confirm) { showToast('Passwords do not match', 'warning'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';

    try {
        await apiCall('/api/auth/register', {
            method: 'POST',
            body: { name, email, phone, password }
        });
        showToast('Account created! Please login.');
        setTimeout(() => window.location.href = '/login.html', 900);
    } catch (err) {
        showToast(err.message || 'Registration failed', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-plus me-2"></i>Create Account';
    }
}