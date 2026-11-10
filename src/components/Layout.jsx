import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { PrintHost } from './Billing';

export const NAV = [
  { to: '/', icon: '📊', label: 'Dashboard', end: true },
  { to: '/pos', icon: '🧾', label: 'New Order' },
  { to: '/orders', icon: '📋', label: 'Orders' },
  { to: '/kitchen', icon: '👨‍🍳', label: 'Kitchen' },
  { to: '/tables', icon: '🪑', label: 'Tables' },
  { to: '/menu', icon: '🍽️', label: 'Menu' },
  { to: '/inventory', icon: '📦', label: 'Inventory' },
  { to: '/customers', icon: '👥', label: 'Customers' },
  { to: '/staff', icon: '🧑‍💼', label: 'Staff' },
  { to: '/expenses', icon: '💸', label: 'Expenses' },
  { to: '/reports', icon: '📈', label: 'Reports' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

const BOTTOM = ['/', '/pos', '/orders', '/kitchen'];

export default function Layout() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const kitchenCount = state.orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length;
  const lowStock = state.inventory.filter((i) => i.qty <= i.minQty).length;
  const badge = (to) => (to === '/kitchen' ? kitchenCount : to === '/inventory' ? lowStock : 0);
  const current = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="logo.svg" alt="Logo" className="brand-logo-img" />
          <div>
            <div className="brand-name">{state.settings.cafeName}</div>
            <div className="brand-sub">Cafe Manager</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className="nav-link">
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {badge(n.to) > 0 && <span className="nav-badge">{badge(n.to)}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
          <div className="topbar-title">{current?.icon} {current?.label}</div>
          <div className="topbar-date">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <PrintHost />
      <nav className="bottom-nav">
        {NAV.filter((n) => BOTTOM.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="bottom-link">
            <span className="bn-icon">
              {n.icon}
              {badge(n.to) > 0 && <span className="nav-badge small">{badge(n.to)}</span>}
            </span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button className="bottom-link" onClick={() => setOpen(true)}>
          <span className="bn-icon">☰</span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
