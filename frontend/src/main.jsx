import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

/* Global styles. Bootstrap first so the app's own stylesheets can override it,
   then the admin/delivery skins, then the shared store theme (last word). */
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/admin.css';
import './styles/delivery.css';
import './styles/style.css';

/* Bootstrap's JS (ESM build) powers the collapse navbar, modals and dropdowns
   via the data-bs-* attributes used throughout the ported markup, and provides
   the Modal class used by lib/modal.js. */
import 'bootstrap';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ToastHost from './components/ToastHost';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <CartProvider>
          <App />
          <ToastHost />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
