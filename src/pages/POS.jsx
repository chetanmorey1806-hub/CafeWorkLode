import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UtensilsCrossed, ShoppingBag, Bike, ChefHat, Wallet, ShoppingCart, Minus, Plus, Trash2, X, ChevronRight, StickyNote, SearchX } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { VegDot, Empty, SearchInput } from '../components/UI';
import { PaymentModal, ReceiptModal } from '../components/Billing';
import { money, orderTotals, uid, ACTIVE_STATUSES } from '../utils/helpers';

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
      setItems(existing.items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const busyTables = useMemo(
    () => new Set(state.orders.filter((o) => ACTIVE_STATUSES.includes(o.status) && o.id !== orderId).map((o) => o.tableId)),
    [state.orders, orderId],
  );

  const filtered = state.menu.filter(
    (m) => (cat === 'All' || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase()),
  );

  const addItem = (m) => {
    if (!m.available) return;
    setBump((b) => b + 1);
    setItems((prev) => {
      const ex = prev.find((i) => i.menuId === m.id);
      if (ex) return prev.map((i) => (i.menuId === m.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { menuId: m.id, name: m.name, price: m.price, qty: 1, note: '' }];
    });
  };
  const changeQty = (mid, d) =>
    setItems((prev) => prev.map((i) => (i.menuId === mid ? { ...i, qty: i.qty + d } : i)).filter((i) => i.qty > 0));
  const setNote = (mid, note) => setItems((prev) => prev.map((i) => (i.menuId === mid ? { ...i, note } : i)));
  const qtyOf = (mid) => items.find((i) => i.menuId === mid)?.qty || 0;

  const draft = { items, discount: 0, taxPercent: state.settings.taxPercent };
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
    const base = { type, tableId: type === 'dine-in' ? tableId : null, customerName, items, taxPercent: state.settings.taxPercent };
    if (existing) {
      const changed = JSON.stringify(existing.items) !== JSON.stringify(items);
      const patch = { ...base, status: changed ? 'pending' : existing.status };
      update('orders', existing.id, patch);
      return { ...existing, ...patch };
    }
    const order = { ...base, id: uid(), customerId: null, status: 'pending', discount: 0, paymentMethod: null, paidAt: null };
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
          {['All', ...state.categories].map((c) => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="item-grid stagger" key={cat}>
          {filtered.map((m) => (
            <button key={m.id} className={`item-card ${!m.available ? 'disabled' : ''} ${qtyOf(m.id) ? 'in-cart' : ''}`} onClick={() => addItem(m)}>
              {qtyOf(m.id) > 0 && <span key={qtyOf(m.id)} className="item-qty pop">{qtyOf(m.id)}</span>}
              <div className="item-top"><VegDot veg={m.veg} /><span className="item-cat">{m.category}</span></div>
              <div className="item-name">{m.name}</div>
              <div className="item-price">{m.available ? money(m.price, cur) : 'Out of stock'}</div>
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
          {items.map((i) => (
            <div className="cart-item slide-in" key={i.menuId}>
              <div className="ci-main">
                <div className="ci-name">{i.name}</div>
                <div className="ci-price">{money(i.price, cur)} × {i.qty} = <b>{money(i.price * i.qty, cur)}</b></div>
                <SearchInput icon={StickyNote} className="ci-note" placeholder="Note (less sugar, extra hot…)" value={i.note} onChange={(e) => setNote(i.menuId, e.target.value)} />
              </div>
              <div className="qty">
                <button onClick={() => changeQty(i.menuId, -1)} aria-label="Decrease">{i.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button>
                <span key={i.qty} className="pop">{i.qty}</span>
                <button onClick={() => changeQty(i.menuId, 1)} aria-label="Increase"><Plus size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-foot">
          <div className="r-row"><span>Subtotal</span><span>{money(t.subtotal, cur)}</span></div>
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
