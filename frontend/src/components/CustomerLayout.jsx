import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import QuickViewModal from './QuickViewModal';

/* Customer-facing shell: shared header, page content and shared footer, plus
   the global Quick View modal. Scrolls to the top on navigation. */
export default function CustomerLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <>
      <div id="shared-header"><Header /></div>
      <Outlet />
      <div id="shared-footer"><Footer /></div>
      <QuickViewModal />
    </>
  );
}
