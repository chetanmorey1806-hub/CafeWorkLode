/**
 * Customer QR ordering page — opened by scanning a table QR code: <site>/#/order/<tableId>
 * Mobile-first, no login.
 *
 * Connection modes:
 *   server  – normal: public API + live tracking over WebSocket
 *   local   – no server, but the staff app is open in this same browser → orders go to the
 *             kitchen tab instantly through BroadcastChannel (great for a single-device café / demo)
 *   offline – no internet: browse the cached menu, build the cart; the order is queued and sent
 *             automatically when the connection returns
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, Minus, ShoppingBag, X, ChefHat, Clock3, CheckCircle2, ConciergeBell, Receipt, Sparkles,
  RotateCcw, Smartphone, Store, StickyNote, WifiOff, ChevronRight, Flame, BadgeCheck, Tag, PartyPopper,
  Download, MessageCircle, HandPlatter, ScanLine, Settings2, CloudOff, Send,
} from 'lucide-react';
import { money, orderTotals } from '../utils/helpers';
import { reducer, migrate } from '../context/reducer';
import { buildQrOrder, publicMenu, publicOrder } from '../utils/qrOrder';
import { checkPromo, happyHourAmount } from '../utils/offers';
import { lineKey, modsPrice, modsLabel } from '../utils/menuOptions';
import { billFromPublic, downloadBillPdf, shareOnWhatsApp } from '../utils/receiptShare';
import { useInstallPrompt, SYNC_CHANNEL, STAFF_STORE_KEY } from '../utils/pwa';
import { CustomizerSheet } from '../components/Customizer';
import SplitCalculator from '../components/SplitCalculator';
import UpiQr, { upiLink } from '../components/UpiQr';
import './customer.css';

const tableIdFromHash = () => decodeURIComponent((location.hash.split('/order/')[1] || '').split(/[?/]/)[0]);
const HIST_KEY = 'cx-history';
const ACTIVE_KEY = (t) => `cx-active-${t}`;
const CART_KEY = (t) => `cx-cart-${t}`;
const MENU_KEY = (t) => `cx-menu-${t}`;
const QUEUE_KEY = (t) => `cx-queue-${t}`;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const localStaffState = () => { try { const raw = localStorage.getItem(STAFF_STORE_KEY); return raw ? migrate(JSON.parse(raw)) : null; } catch { return null; } };

/** Apply an action to the staff data saved in this browser and tell open staff tabs about it. */
function localApply(action) {
  const st = localStaffState();
  if (!st) return null;
  const next = reducer(st, action);
  write(STAFF_STORE_KEY, next);
  try { const bc = new BroadcastChannel(SYNC_CHANNEL); bc.postMessage({ type: 'action', action, from: 'customer' }); bc.close(); } catch { /* old browser */ }
  return next;
}

const STEPS = [
  { key: 'pending', label: 'Order placed', icon: Receipt },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: ConciergeBell },
  { key: 'served', label: 'Served', icon: CheckCircle2 },
  { key: 'paid', label: 'Paid', icon: BadgeCheck },
];

const toServerMods = (mods) => {
  const g = {};
  mods.forEach((m) => { (g[m.groupId] ||= []).push(m.optionId); });
  return Object.entries(g).map(([groupId, optionIds]) => ({ groupId, optionIds }));
};

export default function CustomerApp() {
  const tableId = tableIdFromHash();
  const [mode, setMode] = useState(null); // 'server' | 'local' | 'offline'
  const [data, setData] = useState(() => read(MENU_KEY(tableId), null));
  const [error, setError] = useState('');
  const [cart, setCart] = useState(() => read(CART_KEY(tableId), [])); // {key, menuId, qty, note, mods}
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  const [custom, setCustom] = useState(null); // menu item being customised
  const [upsell, setUpsell] = useState(null);
  const [seenUpsell, setSeenUpsell] = useState(() => new Set());
  const [name, setName] = useState(() => read('cx-name', ''));
  const [phone, setPhone] = useState(() => read('cx-phone', ''));
  const [payment, setPayment] = useState('counter');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null); // {code, amount, desc}
  const [promoErr, setPromoErr] = useState('');
  const [placing, setPlacing] = useState(false);
  const [queued, setQueued] = useState(() => read(QUEUE_KEY(tableId), null));
  const [active, setActive] = useState(() => read(ACTIVE_KEY(tableId), null)); // {id, token, local?}
  const [order, setOrder] = useState(null);
  const [view, setView] = useState(active ? 'track' : 'menu');
  const [history, setHistory] = useState(() => read(HIST_KEY, []));
  const { canInstall, install } = useInstallPrompt();
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /* ---------------- menu loading (server → same-browser staff data → cached copy) ---------------- */
  const loadMenu = useCallback(() => {
    fetch(`/api/public/menu?table=${encodeURIComponent(tableId)}`, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setData(d); write(MENU_KEY(tableId), d); setMode('server'); setError(''); })
      .catch(() => {
        const st = localStaffState();
        if (st) { const d = publicMenu(st, tableId); setData(d); write(MENU_KEY(tableId), d); setMode('local'); setError(''); return; }
        if (read(MENU_KEY(tableId), null)) { setMode('offline'); return; }
        setError('offline');
      });
  }, [tableId]);

  useEffect(() => {
    loadMenu();
    const t = setInterval(loadMenu, 30000);
    window.addEventListener('online', loadMenu);
    return () => { clearInterval(t); window.removeEventListener('online', loadMenu); };
  }, [loadMenu]);

  useEffect(() => write(CART_KEY(tableId), cart), [cart, tableId]);

  /* ---------------- live order tracking ---------------- */
  useEffect(() => {
    if (!active) return undefined;
    // local mode: read the order straight from this browser's staff data, live via BroadcastChannel
    if (active.local) {
      const refresh = () => {
        const st = localStaffState();
        const o = st?.orders.find((x) => x.id === active.id);
        if (o) setOrder(publicOrder(st, o));
      };
      refresh();
      let bc;
      try { bc = new BroadcastChannel(SYNC_CHANNEL); bc.onmessage = () => setTimeout(refresh, 60); } catch { /* ignore */ }
      window.addEventListener('storage', refresh);
      const t = setInterval(refresh, 4000);
      return () => { bc?.close(); window.removeEventListener('storage', refresh); clearInterval(t); };
    }
    let ws; let closed = false;
    const fetchOnce = () =>
      fetch(`/api/public/orders/${active.id}?token=${active.token}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(setOrder)
        .catch((s) => { if (s === 404) { write(ACTIVE_KEY(tableId), null); setActive(null); setView('menu'); } });
    fetchOnce();
    const open = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?role=track&order=${active.id}&token=${active.token}`);
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'order') setOrder(m.order); };
      ws.onclose = () => { if (!closed) setTimeout(open, 3000); };
    };
    open();
    const poll = setInterval(fetchOnce, 20000);
    return () => { closed = true; ws?.close(); clearInterval(poll); };
  }, [active, tableId]);

  useEffect(() => {
    if (order?.status === 'paid' || order?.status === 'cancelled') write(ACTIVE_KEY(tableId), null);
  }, [order?.status, tableId]);

  /* ---------------- cart maths ---------------- */
  const menu = data?.menu || [];
  const cur = data?.cafe.currency || '₹';
  const byId = useMemo(() => Object.fromEntries(menu.map((m) => [m.id, m])), [menu]);
  const groupsOf = (m) => (m?.groups || []).map((id) => data.modifiers.find((g) => g.id === id)).filter(Boolean);
  const lines = cart.filter((c) => byId[c.menuId]).map((c) => {
    const m = byId[c.menuId];
    return { ...c, name: m.name, veg: m.veg, available: m.available, price: m.price + modsPrice(c.mods) };
  });
  const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const hh = data?.happyHourNow || null;
  const hhAmt = happyHourAmount(hh, lines, menu);
  const promoAmt = promo ? Math.min(promo.amount, sub - hhAmt) : 0;
  const totals = orderTotals({ items: lines, discount: hhAmt + promoAmt, taxPercent: data?.cafe.taxPercent || 0 });
  const count = cart.reduce((s, c) => s + c.qty, 0);
  const qtyOf = (id) => cart.filter((c) => c.menuId === id).reduce((s, c) => s + c.qty, 0);

  // re-check the promo when the cart changes (minimum order etc.)
  useEffect(() => {
    if (!promo) return;
    validatePromo(promo.code, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  const favourites = useMemo(() => {
    const cnt = {};
    history.forEach((h) => h.items.forEach((i) => { cnt[i.menuId] = (cnt[i.menuId] || 0) + i.qty; }));
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([id]) => byId[id]).filter(Boolean).slice(0, 8);
  }, [history, byId]);
  const lastOrder = history[0];

  const addLine = (m, mods = [], qty = 1, note = '') => {
    const key = lineKey(m.id, mods);
    setCart((c) => {
      const ex = c.find((x) => x.key === key && x.note === note);
      return ex ? c.map((x) => (x === ex ? { ...x, qty: Math.min(20, x.qty + qty) } : x)) : [...c, { key, menuId: m.id, qty, note, mods }];
    });
    navigator.vibrate?.(15);
  };

  const maybeUpsell = (m) => {
    if (seenUpsell.has(m.id)) return;
    const recs = (data.recommendations[m.id] || []).map((id) => byId[id]).filter((x) => x?.available && !qtyOf(x.id));
    if (recs.length) {
      setSeenUpsell((s) => new Set(s).add(m.id));
      setTimeout(() => setUpsell({ trigger: m, items: recs.slice(0, 3) }), 250);
    }
  };

  /** ADD button: customisable items open the customiser first */
  const add = (m, silent = false) => {
    if (!m?.available) return;
    if (groupsOf(m).length) { setCustom(m); return; }
    addLine(m);
    if (!silent) maybeUpsell(m);
  };

  const change = (key, d) => setCart((c) => c.map((x) => (x.key === key ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));
  const reorder = (h) => {
    h.items.forEach((i) => { const m = byId[i.menuId]; if (m?.available) addLine(m, i.mods || [], i.qty); });
    setSheet(true);
  };

  async function validatePromo(code, quiet = false) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return;
    const amount = sub - hhAmt;
    let r;
    if (modeRef.current === 'server') {
      r = await fetch('/api/public/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c, amount }) })
        .then((x) => x.json()).catch(() => ({ ok: false, error: 'Could not check the code' }));
    } else if (modeRef.current === 'local') {
      r = checkPromo(localStaffState()?.settings, c, amount);
    } else {
      r = { ok: true, code: c, amount: 0, desc: 'Will be applied when you are back online' };
    }
    if (r.ok) { setPromo({ code: r.code, amount: r.amount, desc: r.desc }); setPromoErr(''); if (!quiet) setPromoInput(''); } else { setPromo(null); setPromoErr(r.error); }
  }

  /* ---------------- placing orders ---------------- */
  const payload = () => ({
    tableId, customerName: name, phone, payment, promoCode: promo?.code || '',
    items: cart.map((c) => ({ menuId: c.menuId, qty: c.qty, note: c.note, mods: toServerMods(c.mods) })),
  });

  const sendPayload = async (body) => {
    if (modeRef.current === 'local') {
      const st = localStaffState();
      const r = buildQrOrder(st, body);
      if (r.error) throw new Error(r.error);
      const next = localApply(r.action);
      const o = next.orders.find((x) => x.id === r.id);
      return { id: o.id, no: o.no, token: o.trackToken || r.token, local: true };
    }
    const r = await fetch('/api/public/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const res = await r.json();
    if (!r.ok) throw new Error(res.error || 'Could not place the order');
    return res;
  };

  const afterPlaced = (res, body) => {
    write('cx-name', name); write('cx-phone', phone);
    const hist = [{ date: new Date().toISOString(), items: cart.map(({ menuId, qty, mods }) => ({ menuId, qty, mods })) }, ...read(HIST_KEY, [])].slice(0, 12);
    write(HIST_KEY, hist);
    setHistory(hist);
    const a = { id: res.id, token: res.token, local: !!res.local };
    write(ACTIVE_KEY(body.tableId), a);
    setActive(a);
    setCart([]); setPromo(null); setSheet(false); setView('track');
    window.scrollTo({ top: 0 });
  };

  const place = async () => {
    if (!cart.length || placing) return;
    if (phone && !/^\d{10}$/.test(phone)) { alert('Please enter a valid 10-digit mobile number, or leave it empty.'); return; }
    const body = payload();
    if (mode === 'offline' || !navigator.onLine) {
      write(QUEUE_KEY(tableId), body);
      setQueued(body);
      setSheet(false);
      return;
    }
    setPlacing(true);
    try {
      afterPlaced(await sendPayload(body), body);
    } catch (e) {
      alert(e.message);
      loadMenu();
    } finally {
      setPlacing(false);
    }
  };

  // queued (offline) order → send as soon as we're connected again
  const [netTick, setNetTick] = useState(0);
  useEffect(() => {
    const on = () => setNetTick((t) => t + 1);
    window.addEventListener('online', on);
    const t = setInterval(on, 15000); // also retry periodically (some phones miss the 'online' event)
    return () => { window.removeEventListener('online', on); clearInterval(t); };
  }, []);
  useEffect(() => {
    if (!queued || (mode !== 'server' && mode !== 'local') || !navigator.onLine) return;
    sendPayload(queued)
      .then((res) => { write(QUEUE_KEY(tableId), null); setQueued(null); afterPlaced(res, queued); })
      .catch((e) => {
        if (e instanceof TypeError) return; // still no network → keep it queued for the next try
        write(QUEUE_KEY(tableId), null); setQueued(null);
        alert(`Your saved order could not be sent: ${e.message}`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, queued, netTick]);

  const requestBill = async () => {
    if (!active) return;
    if (active.local) {
      localApply({ type: 'UPDATE', col: 'orders', id: active.id, patch: { billRequested: true, billRequestedAt: new Date().toISOString() } });
      setOrder((o) => o && { ...o, billRequested: true });
      return;
    }
    const r = await fetch(`/api/public/orders/${active.id}/bill?token=${active.token}`, { method: 'POST' });
    if (r.ok) setOrder(await r.json());
  };

  /* ---------------- render ---------------- */
  if (error && !data) {
    return (
      <div className="cx cx-center">
        <WifiOff size={42} />
        <h2>Ordering is offline</h2>
        <p>We couldn't reach the café system. Please ask our staff to take your order.</p>
        <button className="cx-btn" onClick={loadMenu}><RotateCcw size={16} /> Try again</button>
      </div>
    );
  }
  if (!data) return <div className="cx cx-center"><div className="cx-spinner" /><p>Loading menu…</p></div>;
  if (!data.table) {
    return (
      <div className="cx cx-center">
        <Store size={42} />
        <h2>Table not found</h2>
        <p>Please scan the QR code on your table again.</p>
        <a className="cx-btn" href="#/scan" onClick={() => setTimeout(() => location.reload(), 50)}><ScanLine size={16} /> Scan table QR</a>
      </div>
    );
  }

  const cats = ['All', ...data.categories.filter((c) => menu.some((m) => m.category === c))];
  const shown = menu.filter((m) => (cat === 'All' || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase()));
  const groups = (cat === 'All' ? cats.slice(1) : [cat]).map((c) => [c, shown.filter((m) => m.category === c)]).filter(([, l]) => l.length);

  return (
    <div className="cx">
      <header className="cx-head">
        <img src="logo.svg" alt="" className="cx-logo" />
        <div className="cx-brand">
          <div className="cx-name">{data.cafe.name}</div>
          <div className="cx-sub">{data.cafe.address}</div>
        </div>
        {canInstall && <button className="cx-install" onClick={install}><Download size={14} /> App</button>}
        <span className="cx-table">Table {data.table.name}</span>
      </header>

      {mode === 'offline' && (
        <div className="cx-offline"><CloudOff size={16} /> You're offline — browse & build your cart. We'll send the order when you're back online.</div>
      )}
      {queued && (
        <div className="cx-queued"><Send size={16} /> Your order is saved and will be sent automatically as soon as you're online.</div>
      )}

      {active && view === 'menu' && order && order.status !== 'paid' && (
        <button className="cx-active-banner" onClick={() => setView('track')}>
          <span className="cx-pulse" />
          <span className="grow">Order #{order.no} · <b>{STEPS.find((s) => s.key === order.status)?.label || order.status}</b></span>
          Track <ChevronRight size={16} />
        </button>
      )}

      {view === 'track' && active ? (
        <Tracker order={order} cur={cur} cafe={data.cafe} onMore={() => setView('menu')} onBill={requestBill} />
      ) : (
        <>
          <section className="cx-hero">
            <h1>What would you like today? <Sparkles size={20} /></h1>
            <p>Order from your table — we'll bring it to you.</p>
          </section>

          {hh && (
            <div className="cx-hh">
              <PartyPopper size={20} />
              <div className="grow"><b>{hh.name} is on — {hh.percent}% off!</b><div>{hh.categories?.length ? `On ${hh.categories.join(', ')}` : 'On everything'} · till {hh.end}</div></div>
            </div>
          )}

          {(lastOrder || favourites.length > 0) && (
            <section className="cx-again">
              <div className="cx-sec-head"><RotateCcw size={16} /> Order again</div>
              <div className="cx-hscroll">
                {lastOrder && (
                  <button className="cx-again-card last" onClick={() => reorder(lastOrder)}>
                    <b>Your last order</b>
                    <span>{lastOrder.items.map((i) => `${i.qty}× ${byId[i.menuId]?.name || ''}`).join(', ')}</span>
                    <em><Plus size={14} /> Add all</em>
                  </button>
                )}
                {favourites.map((m) => (
                  <button key={m.id} className="cx-again-card" disabled={!m.available} onClick={() => add(m)}>
                    <b>{m.name}</b>
                    <span>{money(m.price, cur)}</span>
                    <em>{m.available ? <><Plus size={14} /> Add</> : 'Sold out'}</em>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="cx-sticky">
            <div className="cx-search">
              <Search size={16} />
              <input placeholder="Search the menu" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="cx-chips">
              {cats.map((c) => <button key={c} className={`cx-chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
            </div>
          </div>

          <main className="cx-menu">
            {groups.map(([c, list]) => (
              <section key={c}>
                <h2 className="cx-cat">{c}</h2>
                {list.map((m) => {
                  const customisable = groupsOf(m).length > 0;
                  const plain = cart.find((x) => x.menuId === m.id && !customisable);
                  return (
                    <div key={m.id} className={`cx-item ${!m.available ? 'off' : ''}`}>
                      <div className="grow">
                        <div className="cx-item-name"><span className={`veg-dot ${m.veg ? 'veg' : 'nonveg'}`} /> {m.name}</div>
                        <div className="cx-item-price">{money(m.price, cur)}</div>
                        {customisable && m.available && <div className="cx-item-pair"><Settings2 size={11} /> Customisable{qtyOf(m.id) ? ` · ${qtyOf(m.id)} in cart` : ''}</div>}
                        {!customisable && (data.recommendations[m.id] || []).length > 0 && m.available && (
                          <div className="cx-item-pair">Goes well with {byId[data.recommendations[m.id][0]]?.name}</div>
                        )}
                      </div>
                      {!m.available ? <span className="cx-soldout">Sold out</span> : plain ? (
                        <div className="cx-stepper">
                          <button onClick={() => change(plain.key, -1)} aria-label="Remove one"><Minus size={16} /></button>
                          <span key={plain.qty} className="pop">{plain.qty}</span>
                          <button onClick={() => add(m, true)} aria-label="Add one"><Plus size={16} /></button>
                        </div>
                      ) : (
                        <button className="cx-add" onClick={() => add(m)}>ADD <Plus size={14} /></button>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
            {!groups.length && <p className="cx-empty">No items match “{q}”.</p>}
          </main>

          {count > 0 && (
            <button key={count} className="cx-cartbar" onClick={() => setSheet(true)}>
              <span className="cx-cartbar-count"><ShoppingBag size={18} /> {count}</span>
              <span className="grow">View cart{hhAmt + promoAmt > 0 ? ` · you save ${money(hhAmt + promoAmt, cur)}` : ''}</span>
              <b>{money(totals.total, cur)}</b>
              <ChevronRight size={18} />
            </button>
          )}
        </>
      )}

      <CustomizerSheet
        item={custom}
        groups={custom ? groupsOf(custom) : []}
        cur={cur}
        onClose={() => setCustom(null)}
        onAdd={({ mods, qty, note }) => { const m = custom; setCustom(null); addLine(m, mods, qty, note); maybeUpsell(m); }}
      />

      {upsell && (
        <div className="cx-backdrop" onClick={() => setUpsell(null)}>
          <div className="cx-sheet cx-upsell" onClick={(e) => e.stopPropagation()}>
            <div className="cx-grab" />
            <div className="cx-upsell-head"><Sparkles size={18} /><span>Would you like something with your <b>{upsell.trigger.name}</b>?</span></div>
            {upsell.items.map((m) => (
              <div key={m.id} className="cx-item">
                <div className="grow">
                  <div className="cx-item-name"><span className={`veg-dot ${m.veg ? 'veg' : 'nonveg'}`} /> {m.name}</div>
                  <div className="cx-item-price">{money(m.price, cur)}</div>
                </div>
                {qtyOf(m.id) ? <span className="cx-added"><CheckCircle2 size={16} /> Added</span> : (
                  <button className="cx-add" onClick={() => { if (groupsOf(m).length) { setUpsell(null); setCustom(m); } else addLine(m); }}>ADD <Plus size={14} /></button>
                )}
              </div>
            ))}
            <button className="cx-btn ghost" onClick={() => setUpsell(null)}>No thanks, continue</button>
          </div>
        </div>
      )}

      {sheet && (
        <div className="cx-backdrop" onClick={() => setSheet(false)}>
          <div className="cx-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cx-grab" />
            <div className="cx-sheet-head">
              <h3>Your order · Table {data.table.name}</h3>
              <button className="cx-icon" onClick={() => setSheet(false)} aria-label="Close"><X size={20} /></button>
            </div>
            {!lines.length && <p className="cx-empty">Your cart is empty.</p>}
            {lines.map((l) => (
              <div key={l.key + l.note} className="cx-line">
                <div className="grow">
                  <div className="cx-item-name"><span className={`veg-dot ${l.veg ? 'veg' : 'nonveg'}`} /> {l.name}</div>
                  {modsLabel(l.mods) && <div className="cx-mods">{modsLabel(l.mods)}</div>}
                  <div className="cx-item-price">{money(l.price * l.qty, cur)}</div>
                  <div className="cx-note"><StickyNote size={13} /><input placeholder="Add a note (less ice…)" maxLength={100} value={l.note}
                    onChange={(e) => setCart((c) => c.map((x) => (x.key === l.key && x.note === l.note ? { ...x, note: e.target.value } : x)))} /></div>
                </div>
                <div className="cx-stepper">
                  <button onClick={() => change(l.key, -1)}><Minus size={16} /></button>
                  <span>{l.qty}</span>
                  <button onClick={() => change(l.key, 1)}><Plus size={16} /></button>
                </div>
              </div>
            ))}

            {lines.length > 0 && (
              <>
                <div className="cx-promo">
                  <Tag size={16} />
                  {promo ? (
                    <div className="grow cx-promo-on"><b>{promo.code}</b> applied{promo.amount ? ` · you save ${money(promoAmt, cur)}` : ''}<div>{promo.desc}</div></div>
                  ) : (
                    <input className="grow" placeholder="Promo code (e.g. WELCOME50)" value={promoInput} onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoErr(''); }} />
                  )}
                  {promo ? <button onClick={() => setPromo(null)}>Remove</button> : <button onClick={() => validatePromo(promoInput)} disabled={!promoInput}>Apply</button>}
                </div>
                {promoErr && <div className="cx-promo-err">{promoErr}</div>}

                <div className="cx-fields">
                  <input placeholder="Your name (optional)" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                  <input placeholder="Mobile no. — earn reward points" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
                </div>

                <div className="cx-label">How would you like to pay?</div>
                <div className="cx-pay">
                  <button className={payment === 'counter' ? 'on' : ''} onClick={() => setPayment('counter')}><Store size={18} /> At counter / cash</button>
                  {data.cafe.upiId && <button className={payment === 'upi' ? 'on' : ''} onClick={() => setPayment('upi')}><Smartphone size={18} /> UPI (GPay / PhonePe)</button>}
                </div>

                <div className="cx-totals">
                  <div><span>Item total</span><span>{money(sub, cur)}</span></div>
                  {hhAmt > 0 && <div className="ok"><span>{hh.name} ({hh.percent}%)</span><span>-{money(hhAmt, cur)}</span></div>}
                  {promoAmt > 0 && <div className="ok"><span>Promo {promo.code}</span><span>-{money(promoAmt, cur)}</span></div>}
                  <div><span>GST ({data.cafe.taxPercent}%)</span><span>{money(totals.tax, cur)}</span></div>
                  <div className="cx-grand"><span>To pay</span><span>{money(totals.total, cur)}</span></div>
                </div>
                <button className="cx-btn big" disabled={placing} onClick={place}>
                  {placing ? 'Placing order…' : mode === 'offline' ? <>Save order · send when online</> : <>Place order · {money(totals.total, cur)}</>}
                </button>
                <p className="cx-fine">Your order goes straight to our kitchen. Pay {payment === 'upi' ? 'with UPI after ordering' : 'at the counter when you are done'}.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Tracker({ order, cur, cafe, onMore, onBill }) {
  const [splitOpen, setSplitOpen] = useState(false);
  if (!order) return <div className="cx-center small"><div className="cx-spinner" /></div>;
  const idx = order.status === 'cancelled' ? -1 : STEPS.findIndex((s) => s.key === order.status);
  const step = STEPS[idx];
  const note = `Order ${order.no} ${cafe.name}`;
  const msg = {
    pending: 'We have received your order. The kitchen will start soon.',
    preparing: 'Our chef is preparing your order right now.',
    ready: 'Your order is ready and on its way to your table!',
    served: 'Enjoy your food! Pay whenever you are ready.',
    paid: 'Payment received — thank you, visit again!',
  }[order.status] || 'This order was cancelled. Please contact the staff.';
  const Icon = step?.icon || X;
  const open = order.status !== 'paid' && order.status !== 'cancelled';
  const bill = billFromPublic(order, cafe);
  return (
    <section className="cx-track">
      <div className={`cx-track-hero s-${order.status}`}>
        <div className="cx-track-icon" key={order.status}><Icon size={38} /></div>
        <div className="cx-track-no">Order #{order.no}</div>
        <h2>{step?.label || 'Cancelled'}</h2>
        <p>{msg}</p>
      </div>

      {idx >= 0 && (
        <ol className="cx-steps">
          {STEPS.map((s, i) => (
            <li key={s.key} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
              <span className="dot"><s.icon size={14} /></span>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="cx-card">
        {order.items.map((i, k) => (
          <div key={k} className="cx-row">
            <span>{i.done && order.status !== 'paid' ? <CheckCircle2 size={14} className="ok" /> : <Clock3 size={14} />} {i.qty}× {i.name}{modsLabel(i.mods) && <small className="cx-mods-inline"> · {modsLabel(i.mods)}</small>}</span>
            <span>{money(i.qty * i.price, cur)}</span>
          </div>
        ))}
        {(order.discounts?.length ? order.discounts : order.discount > 0 ? [{ label: 'Discount', amount: order.discount }] : []).map((d) => (
          <div key={d.label} className="cx-row ok"><span>{d.label}</span><span>-{money(d.amount, cur)}</span></div>
        ))}
        <div className="cx-row muted"><span>GST</span><span>{money(order.tax, cur)}</span></div>
        <div className="cx-row cx-grand"><span>Total</span><span>{money(order.total, cur)}</span></div>
      </div>

      <div className="cx-actions">
        <button className="cx-btn ghost" onClick={() => downloadBillPdf(bill)}><Download size={16} /> {order.status === 'paid' ? 'Bill PDF' : 'Order PDF'}</button>
        <button className="cx-btn ghost wa" onClick={() => shareOnWhatsApp(bill)}><MessageCircle size={16} /> WhatsApp</button>
      </div>

      {open && (
        <>
          {order.billRequested ? (
            <div className="cx-bill-req"><HandPlatter size={18} /> Bill requested — a staff member is on the way.</div>
          ) : (
            <button className="cx-btn" onClick={onBill}><HandPlatter size={16} /> Request the bill</button>
          )}

          {cafe.upiId && (
            <div className="cx-card cx-upi">
              <div className="cx-sec-title"><Smartphone size={16} /> Pay {money(order.total, cur)} with UPI</div>
              <UpiQr upiId={cafe.upiId} name={cafe.upiName} amount={order.total} note={note} size={190} caption={<>Scan from another phone, or tap the button below<br /><b>{cafe.upiId}</b></>} />
              <a className="cx-btn big" href={upiLink({ upiId: cafe.upiId, name: cafe.upiName, amount: order.total, note })}><Smartphone size={18} /> Open UPI app</a>
              <p className="cx-fine">After paying, show the payment screen at the counter. The staff will mark your bill as paid.</p>
            </div>
          )}

          <button className="cx-btn ghost" onClick={() => setSplitOpen(!splitOpen)}><Receipt size={16} /> {splitOpen ? 'Hide' : 'Split the bill with friends'}</button>
          {splitOpen && (
            <div className="cx-card">
              <SplitCalculator
                items={order.items}
                subtotal={order.subtotal}
                total={order.total}
                cur={cur}
                renderPay={cafe.upiId ? (amt, who) => <a className="sc-pay" href={upiLink({ upiId: cafe.upiId, name: cafe.upiName, amount: amt, note: `${note} - ${who}` })}>Pay</a> : undefined}
              />
            </div>
          )}
          <button className="cx-btn ghost" onClick={onMore}><Plus size={16} /> Order more items</button>
        </>
      )}
      {order.status === 'paid' && <button className="cx-btn" onClick={onMore}><Flame size={16} /> Order something else</button>}
    </section>
  );
}
