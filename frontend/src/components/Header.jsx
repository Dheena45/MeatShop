import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { initials } from '../lib/format';
import { showToast } from '../lib/toast';

/* Shared site header, ported from renderSharedHeader() in app.js. */
export default function Header() {
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const active = location.pathname === '/' ? 'home'
    : location.pathname.startsWith('/shop') ? 'shop'
      : null;

  function onLogout(e) {
    e.preventDefault();
    logout();
    showToast('Logged out successfully');
    navigate('/');
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-fm">
      <div className="container">
        <Link className="navbar-brand" to="/">Fresh<span className="dot">Meat</span></Link>
        <button className="navbar-toggler border-0" type="button"
          data-bs-toggle="collapse" data-bs-target="#fmNavbar">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="fmNavbar">
          <ul className="navbar-nav mx-auto">
            <li className="nav-item">
              <Link className={'nav-link ' + (active === 'home' ? 'active' : '')} to="/">Home</Link>
            </li>
            <li className="nav-item">
              <Link className={'nav-link ' + (active === 'shop' ? 'active' : '')} to="/shop">Shop</Link>
            </li>
          </ul>

          <div className="d-flex align-items-center gap-1 mt-2 mt-lg-0">
            {isLoggedIn ? (
              <>
                <Link className="nav-icon-btn" to="/cart" title="Cart">
                  <i className="fa-solid fa-basket-shopping"></i>
                  <span className="cart-count-badge" style={{ display: count > 0 ? 'flex' : 'none' }}>
                    {count > 99 ? '99+' : count}
                  </span>
                </Link>
                {isAdmin ? (
                  <Link className="nav-icon-btn" to="/admin/dashboard" title="Admin Panel">
                    <i className="fa-solid fa-gauge-high"></i>
                  </Link>
                ) : null}
                <Link className="user-chip" to="/profile">
                  <span className="avatar">{initials(user && user.name)}</span>
                  {user && user.name ? user.name.split(' ')[0] : ''}
                </Link>
                <a className="nav-icon-btn" href="#" onClick={onLogout} title="Logout">
                  <i className="fa-solid fa-right-from-bracket"></i>
                </a>
              </>
            ) : (
              <Link className="btn btn-fm btn-sm rounded-pill px-3" to="/login" title="Login">
                <i className="fa-solid fa-right-to-bracket me-1"></i>Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
