
/* FreshMeat — Auth page controller (login + register) */

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', handleRegister);
        ['name', 'email', 'phone', 'password', 'confirm'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => clearFieldError(id));
            }
        });
    }

    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', handleForgotPassword);
    }

    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', handleResetPassword);
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
        } else if (role === 'DELIVERY_BOY') {
            // Delivery staff always land on their own dashboard, never the shop
            // or the admin panel.
            setTimeout(() => window.location.href = '/delivery/dashboard.html', 600);
        } else {
            setTimeout(() => window.location.href = redirect || '/', 600);
        }
    } catch (err) {
        showToast(err.message || 'Login failed', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-2"></i>Login';
    }
}

const REG_NAME_RE = /^[\p{L}][\p{L} .'-]{1,99}$/u;
const REG_EMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/;
const REG_PHONE_RE = /^[6-9][0-9]{9}$/;

function showFieldError(id, message) {
    const err = document.getElementById(id + '-error');
    if (err) err.textContent = message;
}

function clearFieldError(id) {
    const err = document.getElementById(id + '-error');
    if (err) err.textContent = '';
}

function clearRegisterErrors() {
    ['name', 'email', 'phone', 'password', 'confirm'].forEach(clearFieldError);
}

async function handleRegister(e) {
    e.preventDefault();
    clearRegisterErrors();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    const btn = document.getElementById('register-btn');

    let valid = true;

    if (!name) { showFieldError('name', 'Full name is required.'); valid = false; }
    else if (name.length < 2 || name.length > 100 || !REG_NAME_RE.test(name)) {
        showFieldError('name', 'Please enter a valid full name (letters and spaces only).'); valid = false;
    }

    if (!email) { showFieldError('email', 'Email address is required.'); valid = false; }
    else if (email.length > 150 || !REG_EMAIL_RE.test(email)) {
        showFieldError('email', 'Email must contain only lowercase letters and use @gmail.com.'); valid = false;
    }

    if (!phone) { showFieldError('phone', 'Mobile number is required.'); valid = false; }
    else if (!REG_PHONE_RE.test(phone)) {
        showFieldError('phone', 'Please enter a valid 10-digit mobile number.'); valid = false;
    }

    if (!password) { showFieldError('password', 'Password is required.'); valid = false; }
    else if (password.length < 6) {
        showFieldError('password', 'Password must contain at least 6 characters.'); valid = false;
    }

    if (!confirm) { showFieldError('confirm', 'Please confirm your password.'); valid = false; }
    else if (password !== confirm) {
        showFieldError('confirm', 'Passwords do not match.'); valid = false;
    }

    if (!valid) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';

    try {
        await apiCall('/api/auth/register', {
            method: 'POST',
            body: { name, email, phone, password, confirmPassword: confirm }
        });
        showToast('Account created! Please login.');
        setTimeout(() => window.location.href = '/login.html', 900);
    } catch (err) {
        const msg = err.message || 'Registration failed';
        if (/email already registered/i.test(msg)) {
            showFieldError('email', 'Email already registered.');
        } else if (/mobile number already registered|phone number is already registered/i.test(msg)) {
            showFieldError('phone', 'Mobile number already registered.');
        } else {
            showToast(msg, 'error');
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-plus me-2"></i>Create Account';
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('forgot-btn');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        showToast('Please enter a valid email address', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

    try {
        await apiCall('/api/auth/forgot-password', {
            method: 'POST',
            body: { email }
        });
        const body = document.getElementById('forgot-form').closest('.auth-body');
        body.innerHTML = `
            <div class="text-center py-3">
                <div class="es-icon"><i class="fa-solid fa-circle-check"></i></div>
                <h6 class="mt-3">If an account exists for this email, a password reset link has been sent.</h6>
                <p class="text-muted small mt-2 mb-3">Development mode: the reset link is printed in the server console.</p>
                <a href="/login.html" class="btn btn-fm w-100">Back to Login</a>
            </div>`;
    } catch (err) {
        showToast(err.message || 'Unable to process your request. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Send Reset Link';
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const token = new URLSearchParams(window.location.search).get('token') || '';
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    const btn = document.getElementById('reset-btn');

    if (!token) {
        showToast('This reset link is invalid or incomplete.', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'warning');
        return;
    }
    if (password !== confirm) {
        showToast('Passwords do not match', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Resetting...';

    try {
        await apiCall('/api/auth/reset-password', {
            method: 'POST',
            body: { token, newPassword: password }
        });
        showToast('Password reset successfully. Please login with your new password.');
        setTimeout(() => window.location.href = '/login.html', 1200);
    } catch (err) {
        showToast(err.message || 'Unable to reset your password. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-unlock-keyhole me-2"></i>Reset Password';
    }
}