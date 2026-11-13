import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UtensilsCrossed, ShoppingBag, Bike, ChefHat, Wallet, ShoppingCart, Minus, Plus, Trash2, X, ChevronRight, StickyNote, SearchX, Flame, Sparkles, Settings2, PartyPopper } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { VegDot, Empty, SearchInput } from '../components/UI';
import { PaymentModal, ReceiptModal } from '../components/Billing';
import { money, orderTotals, uid, flyTo, ACTIVE_STATUSES } from '../utils/helpers';
import { isAvailable, suggestions } from '../utils/loyalty';
import { groupsFor, lineKey, modsLabel } from '../utils/menuOptions';
import { happyHourSnapshot, orderOffers } from '../utils/offers';
import { CustomizerSheet } from '../components/Customizer';

const POPULAR = '__popular';

export default function POS() {
  const { state, dispatch, update, notify, cur } = useStore();
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const existing = state.orders.find((o) => o.id === orderId);

  const [type, setType] = useState('dine-in');
  const [tableId, setTableId] = useState(params.get('table') || '');
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState([]);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [payOrder, setPayOrder] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [bump, setBump] = useState(0);
  const [custom, setCustom] = useState(null);
  const searchRef = useRef();

  // Press "/" to jump to search
  useEffect(() => {
    const h = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (existing) {
      setType(existing.type);
      setTableId(existing.tableId || '');
      setCustomerName(existing.customerName || '');
      setItems(existing.items.map((i) => ({ ...i, key: i.key || lineKey(i.menuId, i.mods || []) })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const busyTables = useMemo(
    () => new Set(state.orders.filter((o) => ACTIVE_STATUSES.includes(o.status) && o.id !== orderId).map((o) => o.tableId)),
    [state.orders, orderId],
  );

  // Best sellers (by quantity sold) for the "Popular" chip
  const popular = useMemo(() => {
    const sold = {};
    state.orders.filter((o) => o.status === 'paid').forEach((o) => o.items.forEach((i) => { sold[i.menuId] = (sold[i.menuId] || 0) + i.qty; }));
    return state.menu.filter((m) => sold[m.id]).sort((a, b) => sold[b.id] - sold[a.id]).slice(0, 8);
  }, [state.orders, state.menu]);

  const filtered = (cat === POPULAR ? popular : state.menu).filter(
    (m) => (cat === 'All' || cat === POPULAR || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase()),
  );

  const avail = (m) => isAvailable(m, state.inventory);
  const recs = useMemo(() => suggestions(items.map((i) => i.menuId), state, 3), [items, state]);

  const groupsOf = (m) => groupsFor(m, state.modifiers);
  const addLine = (m, mods = [], qty = 1, note = '') => {
    const key = lineKey(m.id, mods);
    setItems((prev) => {
      const ex = prev.find((i) => i.key === key && (i.note || '') === note && !i.done);
      if (ex) return prev.map((i) => (i === ex ? { ...i, qty: i.qty + qty } : i));
      const extra = mods.reduce((s, x) => s + x.price, 0);
      return [...prev, { key, menuId: m.id, name: m.name, price: m.price + extra, basePrice: m.price, mods, qty, note }];
    });
  };

  const addItem = (m, e) => {
    if (!avail(m)) return notify(`${m.name} is sold out`, 'danger');
    if (groupsOf(m).length) { setCustom(m); return; }
    const fab = document.querySelector('.cart-fab');
    const target = fab?.getClientRects().length ? fab : document.querySelector('.pos-cart .cart-head');
    flyTo(e?.currentTarget, target, '+1');
    setBump((b) => b + 1);
    addLine(m);
  };
  const changeQty = (idx, d) =>
    setItems((prev) => prev.map((i, k) => (k === idx ? { ...i, qty: i.qty + d } : i)).filter((i) => i.qty > 0));
  const setNote = (idx, note) => setItems((prev) => prev.map((i, k) => (k === idx ? { ...i, note } : i)));
  const qtyOf = (mid) => items.filter((i) => i.menuId === mid).reduce((s, i) => s + i.qty, 0);

  // happy hours: new orders get a snapshot of the offer running now; edited orders keep theirs
  const happyHour = existing ? existing.happyHour || null : happyHourSnapshot(state.settings);
  const offers = orderOffers({ items, happyHour, promoCode: existing?.promoCode || '' }, state);
  const draft = { items, discount: offers.total, taxPercent: state.settings.taxPercent };
  const t = orderTotals(draft);
  const count = items.reduce((s, i) => s + i.qty, 0);

  const validate = () => {
    if (!items.length) return notify('Add at least one item', 'danger'), false;
    if (type === 'dine-in' && !tableId) return notify('Select a table', 'danger'), false;
    return true;
  };

  const reset = () => {
    setItems([]); setCustomerName(''); setTableId(''); setCartOpen(false);
    if (orderId) nav('/pos');
  };

  /** Save order and return it */
  const save = () => {
    const base = { type, tableId: type === 'dine-in' ? tableId : null, customerName, items, taxPercent: state.settings.taxPercent, happyHour, discount: offers.total };
    if (existing) {
      const changed = JSON.stringify(existing.items) !== JSON.stringify(items);
      const patch = { ...base, status: changed ? 'pending' : existing.status };
      update('orders', existing.id, patch);
      return { ...existing, ...patch };
    }
    const order = { ...base, id: uid(), customerId: null, status: 'pending', paymentMethod: null, paidAt: null };
    dispatch({ type: 'CREATE_ORDER', order });
    return { ...order, no: state.nextOrderNo };
  };

  const sendKOT = () => {
    if (!validate()) return;
    const o = save();
    notify(`KOT sent to kitchen — order #${o.no}`);
    reset();
  };

  const payNow = () => {
    if (!validate()) return;
    setPayOrder(save());
  };

  return (
    <div className="pos">
      <section className="pos-menu">
        <div className="pos-toolbar">
          <SearchInput icon={Search} inputRef={searchRef} placeholder="Search items…  (press /)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          {['All', ...(popular.length ? [POPULAR] : []), ...state.categories].map((c) => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c === POPULAR ? <span className="flex-c"><Flame size={14} /> Popular</span> : c}
            </button>
          ))}
        </div>
        <div className="item-grid stagger" key={cat}>
          {filtered.map((m) => (
            <button key={m.id} className={`item-card ${!avail(m) ? 'disabled' : ''} ${qtyOf(m.id) ? 'in-cart' : ''}`} onClick={(e) => addItem(m, e)}>
              {qtyOf(m.id) > 0 && <span key={qtyOf(m.id)} className="item-qty pop">{qtyOf(m.id)}</span>}
              <div className="item-top"><VegDot veg={m.veg} /><span className="item-cat">{m.category}</span>{cat === POPULAR && <span className="item-rank">#{popular.indexOf(m) + 1}</span>}</div>
              <div className="item-name">{m.name}{groupsOf(m).length > 0 && <Settings2 size={12} className="item-custom" />}</div>
              <div className="item-price">{avail(m) ? money(m.price, cur) : 'Sold out'}</div>
            </button>
          ))}
          {!filtered.length && <Empty icon={SearchX} text="No items found" />}
        </div>
      </section>

      <section className={`pos-cart ${cartOpen ? 'open' : ''}`}>
        <div className="cart-head">
          <h3>{existing ? `Edit Order #${existing.no}` : 'Current Order'}</h3>
          <span className="cart-count">{count} items</span>
          <button className="icon-btn cart-close" onClick={() => setCartOpen(false)}><X size={18} /></button>
        </div>

        <div className="seg">
          {[['dine-in', 'Dine-in', UtensilsCrossed], ['takeaway', 'Takeaway', ShoppingBag], ['delivery', 'Delivery', Bike]].map(([k, l, I]) => (
            <button key={k} className={`seg-btn ${type === k ? 'active' : ''}`} onClick={() => setType(k)}><I size={15} /> {l}</button>
          ))}
        </div>

        <div className="cart-meta">
          {type === 'dine-in' && (
            <select value={tableId} onChange={(e) => setTableId(e.target.value)}>
              <option value="">Select table</option>
              {state.tables.map((tb) => (
                <option key={tb.id} value={tb.id} disabled={busyTables.has(tb.id)}>
                  {tb.name} ({tb.seats} seats){busyTables.has(tb.id) ? ' — occupied' : ''}
                </option>
              ))}
            </select>
          )}
          <input placeholder="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>

        <div className="cart-items">
          {!items.length && <Empty icon={ShoppingCart} text="Tap items to add them" />}
          {items.map((i, idx) => (
            <div className="cart-item slide-in" key={(i.key || i.menuId) + idx}>
              <div className="ci-main">
                <div className="ci-name">{i.name}</div>
                {modsLabel(i.mods) && <div className="ci-mods">{modsLabel(i.mods)}</div>}
                <div className="ci-price">{money(i.price, cur)} × {i.qty} = <b>{money(i.price * i.qty, cur)}</b></div>
                <SearchInput icon={StickyNote} className="ci-note" placeholder="Note (less sugar, extra hot…)" value={i.note} onChange={(e) => setNote(idx, e.target.value)} />
              </div>
              <div className="qty">
                <button onClick={() => changeQty(idx, -1)} aria-label="Decrease">{i.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button>
                <span key={i.qty} className="pop">{i.qty}</span>
                <button onClick={() => changeQty(idx, 1)} aria-label="Increase"><Plus size={14} /></button>
              </div>
            </div>
          ))}
          {recs.length > 0 && (
            <div className="upsell slide-in">
              <div className="upsell-head"><Sparkles size={14} /> Suggest to the customer</div>
              <div className="upsell-list">
                {recs.map((m) => (
                  <button key={m.id} className="upsell-chip" onClick={(e) => addItem(m, e)}>
                    <Plus size={13} /> {m.name} <span>{money(m.price, cur)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="cart-foot">
          {happyHour && !existing && <div className="hh-pill"><PartyPopper size={14} /> {happyHour.name} · {happyHour.percent}% off till {happyHour.end}</div>}
          <div className="r-row"><span>Subtotal</span><span>{money(t.subtotal, cur)}</span></div>
          {offers.lines.map((l) => <div key={l.key} className="r-row text-ok"><span>{l.label}</span><span>-{money(l.amount, cur)}</span></div>)}
          <div className="r-row"><span>GST {state.settings.taxPercent}%</span><span>{money(t.tax, cur)}</span></div>
          <div className="r-row cart-total"><span>Total</span><span key={t.total} className="pop">{money(t.total, cur)}</span></div>
          <div className="cart-actions">
            <button className="btn" onClick={reset} disabled={!items.length && !existing}>Clear</button>
            <button className="btn btn-warn" onClick={sendKOT}><ChefHat size={16} /> KOT</button>
            <button className="btn btn-success" onClick={payNow}><Wallet size={16} /> Pay</button>
          </div>
        </div>
      </section>

      {!cartOpen && (
        <button key={bump} className={`cart-fab ${bump ? 'bump' : ''}`} onClick={() => setCartOpen(true)}>
          <span className="flex-c"><ShoppingCart size={18} /> {count} items · {money(t.total, cur)}</span>
          <span className="flex-c">View <ChevronRight size={16} /></span>
        </button>
      )}

      <CustomizerSheet
        item={custom}
        groups={custom ? groupsOf(custom) : []}
        cur={cur}
        onClose={() => setCustom(null)}
        onAdd={({ mods, qty, note }) => { addLine(custom, mods, qty, note); setBump((b) => b + 1); setCustom(null); }}
      />

      {payOrder && (
        <PaymentModal
          order={payOrder}
          onClose={() => { setPayOrder(null); reset(); }}
          onPaid={(o) => { setPayOrder(null); setReceipt(o); reset(); }}
        />
      )}
      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
