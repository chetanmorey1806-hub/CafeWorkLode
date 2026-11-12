import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu as MenuIcon, Bell, Sun, Moon,
  Maximize, Minimize, Lock, Search, MoreHorizontal, BellRing, PackageX, X, Wifi, WifiOff, KeyRound, Smartphone,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { PrintHost } from './Billing';
import CommandPalette from './CommandPalette';
import LockScreen from './LockScreen';
import { chime, minutesAgo } from '../utils/helpers';
import { NAV } from './nav';



const BOTTOM = ['/', '/pos', '/orders', '/kitchen'];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <span className="clock-time">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="clock-date">{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
    </div>
  );
}

export default function Layout() {
  const { state, theme, toggleTheme, locked, setLocked, notify, conn, retryWithPin } = useStore();
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [fs, setFs] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const bellRef = useRef();

  const kitchen = state.orders.filter((o) => ['pending', 'preparing'].includes(o.status));
  const ready = state.orders.filter((o) => o.status === 'ready');
  const lowStock = state.inventory.filter((i) => i.qty <= i.minQty);
  const qrPending = state.orders.filter((o) => o.source === 'qr' && o.status === 'pending').length;
  const notifCount = ready.length + lowStock.length + qrPending;
  const badge = (to) => (to === '/kitchen' ? kitchen.length : to === '/inventory' ? lowStock.length : 0);
  const current = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));

  // Chime when a new KOT arrives or an order becomes ready
  const prev = useRef({ pending: null, ready: null });
  const pendingCount = state.orders.filter((o) => o.status === 'pending').length;
  useEffect(() => {
    const p = prev.current;
    if (p.pending !== null && state.settings.sound !== false) {
      if (pendingCount > p.pending) chime();
      else if (ready.length > p.ready) { chime(); notify(`${ready.length} order(s) ready to serve`, 'info'); }
    }
    prev.current = { pending: pendingCount, ready: ready.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, ready.length]);

  // Desktop notification (if the owner enabled it in Settings)
  const desktop = (title, body) => {
    if (!state.settings.desktopAlerts || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try { new Notification(title, { body, icon: 'logo.svg', tag: title + body }); } catch { /* ignore */ }
  };

  // New QR orders (or extra rounds added from the table)
  const seenQr = useRef(null);
  useEffect(() => {
    const keys = state.orders.filter((o) => o.source === 'qr' && o.status === 'pending').map((o) => `${o.id}:${o.round || 1}`);
    if (seenQr.current) {
      keys.filter((k) => !seenQr.current.has(k)).forEach((k) => {
        const o = state.orders.find((x) => x.id === k.split(':')[0]);
        const tname = state.tables.find((t) => t.id === o?.tableId)?.name || '';
        const msg = `${(o?.round || 1) > 1 ? 'More items' : 'New QR order'} · Table ${tname} · #${o?.no}`;
        notify(msg, 'info');
        desktop('New table order', msg);
      });
    }
    seenQr.current = new Set(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.orders]);

  // Auto stock alert when an item drops to / below its minimum level
  const seenLow = useRef(null);
  useEffect(() => {
    const ids = lowStock.map((i) => i.id);
    if (seenLow.current) {
      lowStock.filter((i) => !seenLow.current.has(i.id)).forEach((i) => {
        const msg = `${i.name} is low — ${i.qty} ${i.unit} left (min ${i.minQty})`;
        notify(msg, 'danger');
        desktop('Low stock alert', msg);
      });
    }
    seenLow.current = new Set(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowStock.map((i) => i.id).join()]);

  const askPin = () => {
    const pin = prompt('Enter the café PIN to connect this device to the server:');
    if (pin) retryWithPin(pin);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close the bell dropdown on outside click
  useEffect(() => {
    if (!bellOpen) return;
    const h = (e) => bellRef.current && !bellRef.current.contains(e.target) && setBellOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [bellOpen]);

  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => notify('Fullscreen not supported', 'danger'));
  };

  const lock = () => {
    if (!state.settings.pin) return notify('Set a PIN in Settings first', 'danger');
    setLocked(true);
  };

  if (locked) return <LockScreen />;

  const groups = [...new Set(NAV.map((n) => n.group))];
  const CurrentIcon = current?.icon;

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="logo.svg" alt="Logo" className="brand-logo-img" />
          <div className="grow">
            <div className="brand-name">{state.settings.cafeName}</div>
            <div className="brand-sub">Cafe Manager</div>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <button className="sb-search" onClick={() => { setOpen(false); setPalette(true); }}>
          <Search size={15} /> <span>Quick search</span> <kbd>Ctrl K</kbd>
        </button>
        <nav>
          {groups.map((g) => (
            <div key={g} className="nav-group">
              <div className="nav-group-title">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className="nav-link">
                  <n.icon size={18} className="nav-icon" />
                  <span>{n.label}</span>
                  {badge(n.to) > 0 && <span className="nav-badge">{badge(n.to)}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sb-foot">
          <div className="sb-user">
            <div className="avatar">{state.settings.cafeName.charAt(0)}</div>
            <div className="grow">
              <div className="sb-user-name">Admin</div>
              <div className="sb-user-role">Owner</div>
            </div>
            <button className="icon-btn" title="Lock" onClick={lock}><Lock size={16} /></button>
          </div>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Menu"><MenuIcon size={20} /></button>
          <div className="topbar-title">
            {CurrentIcon && <CurrentIcon size={18} />} <span>{current?.label}</span>
          </div>
          <button className="topbar-search" onClick={() => setPalette(true)}>
            <Search size={15} /><span>Search pages, orders, actions…</span><kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-actions">
            <button
              className={`conn conn-${conn}`}
              onClick={conn === 'auth' ? askPin : undefined}
              title={{ online: 'Connected to the café server — all devices are in sync', connecting: 'Connecting to the server…', offline: 'Server not running — data is saved on this device only', auth: 'Wrong PIN — click to enter the café PIN' }[conn]}
            >
              {conn === 'online' ? <Wifi size={14} /> : conn === 'auth' ? <KeyRound size={14} /> : <WifiOff size={14} />}
              <span>{{ online: 'Live', connecting: 'Connecting', offline: 'Offline', auth: 'Enter PIN' }[conn]}</span>
            </button>
            <Clock />
            <button className="icon-btn tb-btn search-mobile" onClick={() => setPalette(true)} title="Search"><Search size={18} /></button>
            <div className="bell-wrap" ref={bellRef}>
              <button className={`icon-btn tb-btn ${notifCount ? 'ring' : ''}`} onClick={() => setBellOpen(!bellOpen)} title="Notifications">
                <Bell size={18} />
                {notifCount > 0 && <span className="dot-count">{notifCount}</span>}
              </button>
              {bellOpen && (
                <div className="dropdown">
                  <div className="dropdown-head">Notifications</div>
                  {!notifCount && <div className="dropdown-empty">You're all caught up</div>}
                  {state.orders.filter((o) => o.source === 'qr' && o.status === 'pending').map((o) => (
                    <button key={'q' + o.id} className="dropdown-item" onClick={() => { setBellOpen(false); nav('/kitchen'); }}>
                      <span className="di-icon"><Smartphone size={16} /></span>
                      <span className="grow">QR order #{o.no} · Table {state.tables.find((t) => t.id === o.tableId)?.name}<small>{minutesAgo(o.updatedAt || o.createdAt)} min ago · waiting for kitchen</small></span>
                    </button>
                  ))}
                  {ready.map((o) => (
                    <button key={o.id} className="dropdown-item" onClick={() => { setBellOpen(false); nav('/orders'); }}>
                      <span className="di-icon ok"><BellRing size={16} /></span>
                      <span className="grow">Order #{o.no} is ready to serve<small>{minutesAgo(o.createdAt)} min ago</small></span>
                    </button>
                  ))}
                  {lowStock.map((i) => (
                    <button key={i.id} className="dropdown-item" onClick={() => { setBellOpen(false); nav('/inventory'); }}>
                      <span className="di-icon danger"><PackageX size={16} /></span>
                      <span className="grow">{i.name} running low<small>{i.qty} {i.unit} left (min {i.minQty})</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="icon-btn tb-btn" onClick={toggleTheme} title="Toggle theme">
              <span key={theme} className="spin-in">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</span>
            </button>
            <button className="icon-btn tb-btn hide-sm" onClick={toggleFs} title="Fullscreen">
              {fs ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </header>
        <main className="content">
          <div key={loc.pathname} className="page-anim">
            <Outlet />
          </div>
        </main>
      </div>

      <PrintHost />
      {palette && <CommandPalette onClose={() => setPalette(false)} onLock={lock} />}

      <nav className="bottom-nav">
        {NAV.filter((n) => BOTTOM.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="bottom-link">
            <span className="bn-icon">
              <n.icon size={21} />
              {badge(n.to) > 0 && <span className="nav-badge small">{badge(n.to)}</span>}
            </span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button className="bottom-link" onClick={() => setOpen(true)}>
          <span className="bn-icon"><MoreHorizontal size={21} /></span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
