import { Navigate, Route, Routes } from 'react-router-dom';

import CustomerLayout from './components/CustomerLayout';
import ProtectedRoute from './components/ProtectedRoute';
import NotFound from './components/NotFound';

/* Customer pages */
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import Orders from './pages/Orders';
import OrderTracking from './pages/OrderTracking';
import Invoice from './pages/Invoice';
import Profile from './pages/Profile';

/* Auth pages */
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

/* Admin */
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import AdminOrders from './admin/AdminOrders';
import AdminDelivery from './admin/AdminDelivery';
import AdminDeliveryBoys from './admin/AdminDeliveryBoys';
import AdminProducts from './admin/AdminProducts';
import AdminCategories from './admin/AdminCategories';
import AdminInventory from './admin/AdminInventory';
import AdminCustomers from './admin/AdminCustomers';
import AdminReviews from './admin/AdminReviews';
import AdminOffers from './admin/AdminOffers';
import AdminContactMessages from './admin/AdminContactMessages';
import AdminSiteSettings from './admin/AdminSiteSettings';
import AdminContactSettings from './admin/AdminContactSettings';

/* Delivery */
import DeliveryDashboard from './delivery/DeliveryDashboard';

export default function App() {
  return (
    <Routes>
      {/* Standalone auth pages (no site chrome) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Standalone printable bill */}
      <Route path="/invoice" element={<Invoice />} />

      {/* Delivery partner */}
      <Route
        path="/delivery/dashboard"
        element={<ProtectedRoute role="delivery"><DeliveryDashboard /></ProtectedRoute>}
      />

      {/* Admin panel */}
      <Route
        path="/admin"
        element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="delivery" element={<AdminDelivery />} />
        <Route path="delivery-boys" element={<AdminDeliveryBoys />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="offers" element={<AdminOffers />} />
        <Route path="contact-messages" element={<AdminContactMessages />} />
        <Route path="site-settings" element={<AdminSiteSettings />} />
        <Route path="contact-settings" element={<AdminContactSettings />} />
      </Route>

      {/* Customer site */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<ProtectedRoute><Shop /></ProtectedRoute>} />
        <Route path="/product-details" element={<ProtectedRoute><ProductDetails /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/order-tracking" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
