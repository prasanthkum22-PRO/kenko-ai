import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

/**
 * Main authenticated app shell.
 * Desktop: fixed sidebar (collapsible rail). Mobile: off-canvas drawer.
 */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMenuToggle = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar open={mobileOpen} onClose={closeMobile} />
      <div className="app-main">
        <Navbar onMenuToggle={handleMenuToggle} sidebarOpen={mobileOpen} />
        <main className="app-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}