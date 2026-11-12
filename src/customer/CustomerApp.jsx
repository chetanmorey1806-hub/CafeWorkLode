/**
 * Customer QR ordering page — opened by scanning a table QR code: <site>/#/order/<tableId>
 * Mobile-first, no login. Talks to the server's public API only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, Minus, ShoppingBag, X, ChefHat, Clock3, CheckCircle2, ConciergeBell, Receipt, Sparkles,
  RotateCcw, Smartphone, Store, Users, StickyNote, WifiOff, ChevronRight, Flame, BadgeCheck,
} from 'lucide-react';
import { money, orderTotals } from '../utils/helpers';
import './customer.css';

const tableIdFromHash = () => decodeURIComponent((location.hash.split('/order/')[1] || '').split(/[?/]/)[0]);
const HIST_KEY = 'cx-history';
const ACTIVE_KEY = (t) => `cx-active-${t}`;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const STEPS = [
  { key: 'pending', label: 'Order placed', icon: Receipt },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: ConciergeBell },
  { key: 'served', label: 'Served', icon: CheckCircle2 },
  { key: 'paid', label: 'Paid', icon: BadgeCheck },
];

export default function CustomerApp() {
  const tableId = tableIdFromHash();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cart, setCart] = useState([]); // {menuId, qty, note}
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  const [upsell, setUpsell] = useState(null); // { trigger, items }
  const [seenUpsell, setSeenUpsell] = useState(() => new Set());
  const [name, setName] = useState(() => read('cx-name', ''));
  const [phone, setPhone] = useState(() => read('cx-phone', ''));
  const [payment, setPayment] = useState('counter');
  const [split, setSplit] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [active, setActive] = useState(() => read(ACTIVE_KEY(tableId), null)); // {id, token}
  const [order, setOrder] = useState(null);
  const [view, setView] = useState(active ? 'track' : 'menu');
  const [history, setHistory] = useState(() => read(HIST_KEY, []));

  const loadMenu = useCallback(() => {
    fetch(`/api/public/menu?table=${encodeURIComponent(tableId)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setData(d); setError(''); })
      .catch(() => setError('offline'));
  }, [tableId]);

  useEffect(() => {
    loadMenu();
    const t = setInterval(loadMenu, 60000);
    return () => clearInterval(t);
  }, [loadMenu]);

  // live order tracking over WebSocket (falls back to polling)
  useEffect(() => {
    if (!active) return undefined;
    let ws; let poll; let closed = false;
    const fetchOnce = () =>
      fetch(`/api/public/orders/${active.id}?token=${active.token}`)
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
    poll = setInterval(fetchOnce, 20000);
    return () => { closed = true; ws?.close(); clearInterval(poll); };
  }, [active, tableId]);

  // once paid, forget the active order after a while
  useEffect(() => {
    if (order?.status === 'paid' || order?.status === 'cancelled') {
      const t = setTimeout(() => { write(ACTIVE_KEY(tableId), null); }, 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [order?.status, tableId]);

  const menu = data?.menu || [];
  const cur = data?.cafe.currency || '₹';
  const byId = useMemo(() => Object.fromEntries(menu.map((m) => [m.id, m])), [menu]);
  const lines = cart.map((c) => ({ ...c, ...byId[c.menuId] })).filter((l) => l.name);
  const totals = orderTotals({ items: lines.map((l) => ({ price: l.price, qty: l.qty })), discount: 0, taxPercent: data?.cafe.taxPercent || 0 });
  const count = cart.reduce((s, c) => s + c.qty, 0);
  const qtyOf = (id) => cart.find((c) => c.menuId === id)?.qty || 0;

  // "Order again" — favourites from this phone's past orders
  const favourites = useMemo(() => {
    const cnt = {};
    history.forEach((h) => h.items.forEach((i) => { cnt[i.menuId] = (cnt[i.menuId] || 0) + i.qty; }));
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([id]) => byId[id]).filter(Boolean).slice(0, 8);
  }, [history, byId]);
  const lastOrder = history[0];

  const add = (m, qty = 1, silent = false) => {
    if (!m?.available) return;
    setCart((c) => {
      const ex = c.find((x) => x.menuId === m.id);
      return ex ? c.map((x) => (x.menuId === m.id ? { ...x, qty: Math.min(20, x.qty + qty) } : x)) : [...c, { menuId: m.id, qty, note: '' }];
    });
    navigator.vibrate?.(15);
    if (silent || seenUpsell.has(m.id)) return;
    const recs = (data.recommendations[m.id] || []).map((id) => byId[id]).filter((x) => x?.available && !qtyOf(x.id));
    if (recs.length) {
      setSeenUpsell((s) => new Set(s).add(m.id));
      setUpsell({ trigger: m, items: recs.slice(0, 3) });
    }
  };
  const change = (id, d) => setCart((c) => c.map((x) => (x.menuId === id ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));
  const reorder = (h) => { h.items.forEach((i) => byId[i.menuId]?.available && add(byId[i.menuId], i.qty, true)); setSheet(true); };

  const place = async () => {
    if (!cart.length || placing) return;
    if (phone && !/^\d{10}$/.test(phone)) { alert('Please enter a valid 10-digit mobile number, or leave it empty.'); return; }
    setPlacing(true);
    try {
      const r = await fetch('/api/public/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, items: cart, customerName: name, phone, payment }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || 'Could not place the order');
      write('cx-name', name); write('cx-phone', phone);
      const hist = [{ date: new Date().toISOString(), items: cart.map(({ menuId, qty }) => ({ menuId, qty })) }, ...read(HIST_KEY, [])].slice(0, 12);
      write(HIST_KEY, hist);
      setHistory(hist);
      const a = { id: res.id, token: res.token };
      write(ACTIVE_KEY(tableId), a);
      setActive(a);
      setCart([]); setSheet(false); setView('track');
      window.scrollTo({ top: 0 });
    } catch (e) {
      alert(e.message);
      loadMenu();
    } finally {
      setPlacing(false);
    }
  };

  /* ------------------------------------------------ render */
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
        <span className="cx-table">Table {data.table.name}</span>
      </header>

      {active && view === 'menu' && order && order.status !== 'paid' && (
        <button className="cx-active-banner" onClick={() => setView('track')}>
          <span className="cx-pulse" />
          <span className="grow">Order #{order.no} · <b>{STEPS.find((s) => s.key === order.status)?.label || order.status}</b></span>
          Track <ChevronRight size={16} />
        </button>
      )}

      {view === 'track' && active ? (
        <Tracker order={order} cur={cur} cafe={data.cafe} split={split} setSplit={setSplit} onMore={() => setView('menu')} />
      ) : (
        <>
          <section className="cx-hero">
            <h1>What would you like today? <Sparkles size={20} /></h1>
            <p>Order from your table — we'll bring it to you.</p>
          </section>

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
                {list.map((m) => (
                  <div key={m.id} className={`cx-item ${!m.available ? 'off' : ''}`}>
                    <div className="grow">
                      <div className="cx-item-name"><span className={`veg-dot ${m.veg ? 'veg' : 'nonveg'}`} /> {m.name}</div>
                      <div className="cx-item-price">{money(m.price, cur)}</div>
                      {(data.recommendations[m.id] || []).length > 0 && m.available && (
                        <div className="cx-item-pair">Goes well with {byId[data.recommendations[m.id][0]]?.name}</div>
                      )}
                    </div>
                    {!m.available ? <span className="cx-soldout">Sold out</span> : qtyOf(m.id) ? (
                      <div className="cx-stepper">
                        <button onClick={() => change(m.id, -1)} aria-label="Remove one"><Minus size={16} /></button>
                        <span key={qtyOf(m.id)} className="pop">{qtyOf(m.id)}</span>
                        <button onClick={() => add(m)} aria-label="Add one"><Plus size={16} /></button>
                      </div>
                    ) : (
                      <button className="cx-add" onClick={() => add(m)}>ADD <Plus size={14} /></button>
                    )}
                  </div>
                ))}
              </section>
            ))}
            {!groups.length && <p className="cx-empty">No items match “{q}”.</p>}
          </main>

          {count > 0 && (
            <button key={count} className="cx-cartbar" onClick={() => setSheet(true)}>
              <span className="cx-cartbar-count"><ShoppingBag size={18} /> {count}</span>
              <span className="grow">View cart</span>
              <b>{money(totals.total, cur)}</b>
              <ChevronRight size={18} />
            </button>
          )}
        </>
      )}

      {/* Smart upsell */}
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
                  <button className="cx-add" onClick={() => add(m, 1, true)}>ADD <Plus size={14} /></button>
                )}
              </div>
            ))}
            <button className="cx-btn ghost" onClick={() => setUpsell(null)}>No thanks, continue</button>
          </div>
        </div>
      )}

      {/* Cart & checkout */}
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
              <div key={l.menuId} className="cx-line">
                <div className="grow">
                  <div className="cx-item-name"><span className={`veg-dot ${l.veg ? 'veg' : 'nonveg'}`} /> {l.name}</div>
                  <div className="cx-item-price">{money(l.price * l.qty, cur)}</div>
                  <div className="cx-note"><StickyNote size={13} /><input placeholder="Add a note (less sugar…)" maxLength={100} value={l.note}
                    onChange={(e) => setCart((c) => c.map((x) => (x.menuId === l.menuId ? { ...x, note: e.target.value } : x)))} /></div>
                </div>
                <div className="cx-stepper">
                  <button onClick={() => change(l.menuId, -1)}><Minus size={16} /></button>
                  <span>{l.qty}</span>
                  <button onClick={() => add(byId[l.menuId], 1, true)}><Plus size={16} /></button>
                </div>
              </div>
            ))}

            {lines.length > 0 && (
              <>
                <div className="cx-fields">
                  <input placeholder="Your name (optional)" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                  <input placeholder="Mobile no. — earn reward points" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
                </div>

                <div className="cx-label">How would you like to pay?</div>
                <div className="cx-pay">
                  <button className={payment === 'counter' ? 'on' : ''} onClick={() => setPayment('counter')}><Store size={18} /> At counter / cash</button>
                  {data.cafe.upiId && <button className={payment === 'upi' ? 'on' : ''} onClick={() => setPayment('upi')}><Smartphone size={18} /> UPI (GPay / PhonePe)</button>}
                </div>

                <SplitCalc total={totals.total} cur={cur} split={split} setSplit={setSplit} />

                <div className="cx-totals">
                  <div><span>Item total</span><span>{money(totals.subtotal, cur)}</span></div>
                  <div><span>GST ({data.cafe.taxPercent}%)</span><span>{money(totals.tax, cur)}</span></div>
                  <div className="cx-grand"><span>To pay</span><span>{money(totals.total, cur)}</span></div>
                </div>
                <button className="cx-btn big" disabled={placing} onClick={place}>
                  {placing ? 'Placing order…' : <>Place order · {money(totals.total, cur)}</>}
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

function SplitCalc({ total, cur, split, setSplit }) {
  return (
    <div className="cx-split">
      <Users size={18} />
      <div className="grow">
        <b>Split the bill</b>
        <div className="cx-muted">{split > 1 ? `${money(Math.ceil(total / split), cur)} each` : 'Paying for a group?'}</div>
      </div>
      <div className="cx-stepper small">
        <button onClick={() => setSplit(Math.max(1, split - 1))}><Minus size={14} /></button>
        <span>{split}</span>
        <button onClick={() => setSplit(Math.min(20, split + 1))}><Plus size={14} /></button>
      </div>
    </div>
  );
}

function Tracker({ order, cur, cafe, split, setSplit, onMore }) {
  if (!order) return <div className="cx-center small"><div className="cx-spinner" /></div>;
  const idx = order.status === 'cancelled' ? -1 : STEPS.findIndex((s) => s.key === order.status);
  const step = STEPS[idx];
  const upi = (amount) =>
    `upi://pay?pa=${encodeURIComponent(cafe.upiId)}&pn=${encodeURIComponent(cafe.upiName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Order ${order.no} ${cafe.name}`)}`;
  const share = Math.ceil(order.total / split);
  const msg = {
    pending: 'We have received your order. The kitchen will start soon.',
    preparing: 'Our chef is preparing your order right now.',
    ready: 'Your order is ready and on its way to your table!',
    served: 'Enjoy your food! Pay whenever you are ready.',
    paid: 'Payment received — thank you, visit again!',
  }[order.status] || 'This order was cancelled. Please contact the staff.';
  const Icon = step?.icon || X;
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
            <span>{i.done && order.status !== 'paid' ? <CheckCircle2 size={14} className="ok" /> : <Clock3 size={14} />} {i.qty}× {i.name}</span>
            <span>{money(i.qty * i.price, cur)}</span>
          </div>
        ))}
        <div className="cx-row muted"><span>GST</span><span>{money(order.tax, cur)}</span></div>
        {order.discount > 0 && <div className="cx-row muted"><span>Discount</span><span>-{money(order.discount, cur)}</span></div>}
        <div className="cx-row cx-grand"><span>Total</span><span>{money(order.total, cur)}</span></div>
      </div>

      {order.status !== 'paid' && order.status !== 'cancelled' && (
        <>
          <SplitCalc total={order.total} cur={cur} split={split} setSplit={setSplit} />
          {cafe.upiId && (
            <div className="cx-upi">
              <a className="cx-btn big" href={upi(share)}><Smartphone size={18} /> Pay {money(share, cur)} with UPI</a>
              {split > 1 && <p className="cx-fine">Each person can open this page and pay their share of {money(share, cur)}.</p>}
              <p className="cx-fine">After paying, show the payment screen at the counter. The staff will mark your bill as paid.</p>
            </div>
          )}
          <button className="cx-btn ghost" onClick={onMore}><Plus size={16} /> Order more items</button>
        </>
      )}
      {order.status === 'paid' && <button className="cx-btn" onClick={onMore}><Flame size={16} /> Order something else</button>}
    </section>
  );
}
