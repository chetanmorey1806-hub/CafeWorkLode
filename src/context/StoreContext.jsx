import { createContext, useContext, useEffect, useReducer, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { seedData } from './seed';
import { reducer, migrate } from './reducer';
import { uid } from '../utils/helpers';
import { SYNC_CHANNEL } from '../utils/pwa';

const KEY = 'cafe-software-v1';
const THEME_KEY = 'cafe-theme';
const PIN_KEY = 'cafe-server-pin';
const StoreContext = createContext(null);

const hadLocalData = (() => { try { return !!localStorage.getItem(KEY); } catch { return false; } })();

const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* ignore */ }
  return migrate(seedData());
};

const loadTheme = () => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t) return t;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Give new records their id up-front so the server and every device agree on it. */
const withIds = (a) => {
  if (a.type === 'ADD' && !a.item.id) return { ...a, item: { ...a.item, id: uid() } };
  if (a.type === 'CREATE_ORDER' && !a.order.id) return { ...a, order: { ...a.order, id: uid() } };
  if ((a.type === 'WALLET_TOPUP' || a.type === 'SELL_PASS') && !a.id) return { ...a, id: uid() };
  return a;
};

const TOAST_ICON = { ok: CheckCircle2, danger: AlertCircle, info: Info };

export function StoreProvider({ children }) {
  const [state, localDispatch] = useReducer(reducer, undefined, load);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(loadTheme);
  const [locked, setLocked] = useState(() => !!load().settings.lockEnabled);
  // 'connecting' | 'online' | 'offline' | 'auth'
  const [conn, setConn] = useState('connecting');

  const stateRef = useRef(state);
  stateRef.current = state;
  const connRef = useRef(conn);
  connRef.current = conn;
  const bcRef = useRef(null);

  /* ---------------- same-browser tab sync (no server needed) ----------------
     When the server isn't reachable, every tab of this browser (POS, kitchen screen,
     customer QR page) shares changes instantly through the BroadcastChannel API. */
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const bc = new BroadcastChannel(SYNC_CHANNEL);
    bc.onmessage = (e) => {
      const m = e.data;
      if (m?.type === 'action' && m.action && connRef.current !== 'online') localDispatch(m.action);
    };
    bcRef.current = bc;
    return () => { bc.close(); bcRef.current = null; };
  }, []);
  const wsRef = useRef(null);
  const pending = useRef([]); // actions sent but not yet confirmed by the server
  const seq = useRef(0);
  const pinRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full */ }
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  /* ---------------- live sync with the server ---------------- */
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const pin = pinRef.current ?? (localStorage.getItem(PIN_KEY) || stateRef.current.settings.pin || '');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws;
    try {
      ws = new WebSocket(`${proto}://${location.host}/ws?role=staff&pin=${encodeURIComponent(pin)}`);
    } catch {
      setConn('offline');
      return;
    }
    wsRef.current = ws;
    let opened = false;

    ws.onopen = () => { opened = true; };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'auth-failed') {
        ws.authFailed = true;
        setConn('auth');
        return;
      }
      if (msg.type === 'hello') {
        try { localStorage.setItem(PIN_KEY, pin); } catch { /* ignore */ }
        everOnline.current = true;
        setConn('online');
        // First device to connect to a brand-new server uploads its existing local data.
        if (msg.fresh && hadLocalData) {
          ws.send(JSON.stringify({ type: 'import', state: stateRef.current }));
          return;
        }
        // re-send anything that was done while offline / not yet confirmed
        const unsent = pending.current;
        pending.current = [];
        localDispatch({ type: 'REPLACE', state: migrate(msg.state) });
        unsent.forEach((p) => send(p.action));
        return;
      }
      if (msg.type === 'state') {
        pending.current = pending.current.filter((p) => p.seq > (msg.ack || 0));
        // rebase: server state + my actions that the server hasn't confirmed yet
        const next = pending.current.reduce((s, p) => reducer(s, p.action), msg.state);
        localDispatch({ type: 'REPLACE', state: next });
      }
    };
    ws.onclose = () => {
      wsRef.current = null;
      if (ws.authFailed) return; // wait for the user to enter the PIN
      setConn(opened ? 'connecting' : 'offline');
      setTimeout(connect, opened ? 1500 : 8000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const everOnline = useRef(false);
  const send = (action) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) {
      // server temporarily unreachable: queue it, re-sent on reconnect (see 'hello')
      if (everOnline.current) pending.current.push({ seq: Infinity, action });
      return false;
    }
    seq.current += 1;
    pending.current.push({ seq: seq.current, action });
    ws.send(JSON.stringify({ type: 'action', seq: seq.current, action }));
    return true;
  };

  useEffect(() => {
    connect();
    return () => { const ws = wsRef.current; wsRef.current = null; if (ws) { ws.onclose = null; ws.close(); } };
  }, [connect]);

  const dispatch = useCallback((action) => {
    const a = withIds(action);
    localDispatch(a); // instant UI
    const sent = send(a); // server sync (no-op when offline: data still saved locally)
    if (!sent && connRef.current !== 'online') {
      try { bcRef.current?.postMessage({ type: 'action', action: a }); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryWithPin = (pin) => {
    pinRef.current = pin;
    setConn('connecting');
    connect();
  };

  const notify = useCallback((msg, kind = 'ok') => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 2800);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3150);
  }, []);

  const api = {
    state,
    dispatch,
    notify,
    theme,
    conn,
    retryWithPin,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    locked,
    setLocked,
    add: (col, item) => dispatch({ type: 'ADD', col, item }),
    update: (col, id, patch) => dispatch({ type: 'UPDATE', col, id, patch }),
    remove: (col, id) => dispatch({ type: 'DELETE', col, id }),
    set: (key, value) => dispatch({ type: 'SET', key, value }),
    cur: state.settings.currency,
  };

  return (
    <StoreContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.kind] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.kind} ${t.leaving ? 'leaving' : ''}`}>
              <Icon size={18} />
              <span>{t.msg}</span>
              <span className="toast-bar" />
            </div>
          );
        })}
      </div>
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
