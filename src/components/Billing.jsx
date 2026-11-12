import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer, Banknote, Smartphone, CreditCard, Check, ReceiptText, Wallet, UserPlus, X, Star, PartyPopper,
  Crown, Coffee, Ticket, Users, Plus, Minus, Divide,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Modal, Field } from './UI';
import { money, orderTotals, fmtDateTime, uid, chime, confetti } from '../utils/helpers';
import { tierFor, loyaltyOf, stampItems, activePass, passUsedToday } from '../utils/loyalty';

const METHOD = { cash: ['Cash', Banknote], upi: ['UPI', Smartphone], card: ['Card', CreditCard], wallet: ['Wallet', Wallet] };

/** Printable receipt */
export function Receipt({ order }) {
  const { state, cur } = useStore();
  const s = state.settings;
  const t = orderTotals(order);
  const table = state.tables.find((x) => x.id === order.tableId);
  const special = (order.pointsUsed || 0) + (order.tierDiscount || 0) + (order.freeItem || 0) + (order.passAmount || 0);
  const manual = +(t.discount - special).toFixed(2);
  return (
    <div className="receipt">
      <div className="r-center">
        <div className="r-title">{s.cafeName}</div>
        <div>{s.address}</div>
        <div>Ph: {s.phone}</div>
        {s.gstin && <div>GSTIN: {s.gstin}</div>}
      </div>
      <div className="r-line" />
      <div className="r-row"><span>Bill #{order.no}</span><span>{fmtDateTime(order.paidAt || order.createdAt)}</span></div>
      <div className="r-row">
        <span>{order.type === 'dine-in' ? `Table ${table?.name || '-'}` : order.type}</span>
        <span>{order.customerName}</span>
      </div>
      <div className="r-line" />
      <div className="r-row r-bold"><span>Item</span><span>Qty × Rate = Amt</span></div>
      {order.items.map((i, idx) => (
        <div className="r-row" key={idx}>
          <span>{i.name}</span>
          <span>{i.qty} × {i.price} = {i.qty * i.price}</span>
        </div>
      ))}
      <div className="r-line" />
      <div className="r-row"><span>Subtotal</span><span>{money(t.subtotal, cur)}</span></div>
      {order.tierDiscount > 0 && <div className="r-row"><span>{order.tierName} member discount</span><span>-{money(order.tierDiscount, cur)}</span></div>}
      {order.freeItem > 0 && <div className="r-row"><span>Free coffee (stamp card)</span><span>-{money(order.freeItem, cur)}</span></div>}
      {order.passAmount > 0 && <div className="r-row"><span>Coffee pass</span><span>-{money(order.passAmount, cur)}</span></div>}
      {manual > 0 && <div className="r-row"><span>Discount</span><span>-{money(manual, cur)}</span></div>}
      {order.pointsUsed > 0 && <div className="r-row"><span>Points redeemed</span><span>-{money(order.pointsUsed, cur)}</span></div>}
      {t.tax > 0 && <div className="r-row"><span>GST ({order.taxPercent}%)</span><span>{money(t.tax, cur)}</span></div>}
      <div className="r-row r-total"><span>TOTAL</span><span>{money(t.total, cur)}</span></div>
      {order.status === 'paid' && (order.payments?.length > 1 ? order.payments : order.paymentMethod ? [{ method: order.paymentMethod, amount: t.total }] : []).map((p, k) => (
        <div className="r-row" key={k}><span>Paid via {String(p.method).toUpperCase()}</span><span>{money(p.amount, cur)}</span></div>
      ))}
      <div className="r-line" />
      <div className="r-center">{s.footer}</div>
    </div>
  );
}

export function printReceipt(order) {
  window.dispatchEvent(new CustomEvent('print-order', { detail: order }));
}

/** Mounted once; listens for print requests and prints the receipt only */
export function PrintHost() {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    const handler = (e) => {
      setOrder(e.detail);
      setTimeout(() => window.print(), 150);
    };
    window.addEventListener('print-order', handler);
    return () => window.removeEventListener('print-order', handler);
  }, []);
  if (!order) return null;
  return createPortal(<div className="print-area"><Receipt order={order} /></div>, document.body);
}

export function ReceiptModal({ order, onClose }) {
  return (
    <Modal
      title={`Bill #${order.no}`}
      icon={ReceiptText}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => printReceipt(order)}><Printer size={16} /> Print</button>
        </>
      }
    >
      <Receipt order={order} />
    </Modal>
  );
}

/** A loyalty perk toggle row (tier discount, free coffee, pass, points) */
const Perk = ({ icon: Icon, tone, title, sub, checked, onChange }) => (
  <label className={`redeem perk-${tone} slide-in`}>
    <span className="redeem-icon"><Icon size={16} /></span>
    <span className="grow"><b>{title}</b><div className="muted small">{sub}</div></span>
    <span className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span /></span>
  </label>
);

export function PaymentModal({ order, onClose, onPaid }) {
  const { state, dispatch, notify, cur } = useStore();
  const L = loyaltyOf(state.settings);
  const [discount, setDiscount] = useState(0);
  const [discType, setDiscType] = useState('amt');
  const [method, setMethod] = useState(order.paymentIntent === 'upi' ? 'upi' : 'cash');
  const [received, setReceived] = useState('');
  const phoneMatch = order.customerPhone && state.customers.find((c) => c.phone === order.customerPhone);
  const [customerId, setCustomerId] = useState(order.customerId || phoneMatch?.id || '');
  const [newCust, setNewCust] = useState(() => (!order.customerId && !phoneMatch && order.customerPhone ? { name: order.customerName || '', phone: order.customerPhone } : null));
  const [redeem, setRedeem] = useState(false);
  const [useTier, setUseTier] = useState(L.tierDiscountAuto);
  const [useStamp, setUseStamp] = useState(false);
  const [usePass, setUsePass] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [parts, setParts] = useState([{ method: 'cash', amount: '' }, { method: 'upi', amount: '' }]);
  const [done, setDone] = useState(null);
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  const customer = state.customers.find((c) => c.id === customerId);
  const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);

  // ---- loyalty perks (applied in this order, never more than the subtotal) ----
  const tier = tierFor(customer, state.settings);
  const tierDisc = useTier && tier ? Math.round((subtotal * tier.discount) / 100) : 0;
  const coffees = stampItems(order.items, state.menu, state.settings);
  const cheapestCoffee = coffees.length ? Math.min(...coffees.map((i) => i.price)) : 0;
  const canStamp = customer && (customer.stamps || 0) >= L.stampEvery && coffees.length > 0;
  const freeAmt = useStamp && canStamp ? cheapestCoffee : 0;
  const pass = activePass(customer);
  const passCoffees = pass ? order.items.filter((i) => state.menu.find((m) => m.id === i.menuId)?.category === (pass.category || 'Coffee')) : [];
  const canPass = pass && !passUsedToday(customer) && passCoffees.length > 0;
  const passAmt = usePass && canPass ? Math.min(Math.max(...passCoffees.map((i) => i.price)), pass.maxPrice || Infinity) : 0;
  const manual = Math.min(subtotal, discType === 'pct' ? (subtotal * (Number(discount) || 0)) / 100 : Number(discount) || 0);
  const before = Math.min(subtotal, tierDisc + freeAmt + passAmt + manual);
  const pointsUsed = redeem && customer ? Math.min(customer.points || 0, Math.floor(subtotal - before)) : 0;
  const t = orderTotals({ ...order, discount: before + pointsUsed });
  const change = method === 'cash' && received ? Number(received) - t.total : 0;
  const quickCash = [...new Set([t.total, Math.ceil(t.total / 50) * 50, Math.ceil(t.total / 100) * 100, Math.ceil(t.total / 500) * 500])];
  const walletBal = customer?.wallet || 0;

  // ---- split payments ----
  const splitEqual = (n) => {
    const each = Math.floor(t.total / n);
    setParts(Array.from({ length: n }, (_, k) => ({ method: parts[k]?.method || (k % 2 ? 'upi' : 'cash'), amount: String(k === n - 1 ? t.total - each * (n - 1) : each) })));
  };
  useEffect(() => { if (splitOn) splitEqual(parts.length); /* re-balance when the total changes */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.total, splitOn]);
  const splitSum = parts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const splitWallet = parts.filter((p) => p.method === 'wallet').reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const finish = (paid) => { clearTimeout(timer.current); onPaid?.(paid); };

  const pay = () => {
    if (done) return;
    let payments;
    if (splitOn) {
      if (Math.abs(splitSum - t.total) > 0.01) return notify(`Split parts add up to ${money(splitSum, cur)}, bill is ${money(t.total, cur)}`, 'danger');
      if (splitWallet > walletBal) return notify(`Wallet balance is only ${money(walletBal, cur)}`, 'danger');
      payments = parts.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount) }));
    } else {
      if (method === 'cash' && received && change < 0) return notify('Cash received is less than the bill', 'danger');
      if (method === 'wallet' && walletBal < t.total) return notify(`Wallet has ${money(walletBal, cur)} — use Split to pay the rest`, 'danger');
      payments = [{ method, amount: t.total }];
    }
    let cid = customerId || null;
    let cname = customer?.name || order.customerName || '';
    if (newCust) {
      const name = newCust.name.trim();
      if (!name || !/^\d{10}$/.test(newCust.phone)) return notify('Enter customer name & 10-digit phone', 'danger');
      const dup = state.customers.find((c) => c.phone === newCust.phone);
      if (dup) { cid = dup.id; cname = dup.name; } else {
        cid = uid(); cname = name;
        dispatch({ type: 'ADD', col: 'customers', item: { id: cid, name, phone: newCust.phone, email: '', visits: 0, totalSpent: 0, points: 0, stamps: 0, wallet: 0, subscription: null } });
      }
    }
    const patch = {
      discount: +(before + pointsUsed).toFixed(2),
      pointsUsed,
      tierDiscount: tierDisc, tierName: tierDisc ? tier.name : null,
      freeItem: freeAmt, stampsUsed: freeAmt ? L.stampEvery : 0,
      passAmount: passAmt, passUsed: passAmt > 0,
      paymentMethod: payments.length > 1 ? 'split' : payments[0].method,
      payments,
      customerId: cid,
      customerName: cname,
    };
    dispatch({ type: 'PAY_ORDER', id: order.id, patch });
    const paid = { ...order, ...patch, status: 'paid', paidAt: new Date().toISOString() };
    if (state.settings.sound !== false) chime();
    confetti();
    setDone(paid);
    timer.current = setTimeout(() => finish(paid), 2400);
  };

  if (done) {
    const earned = done.customerId ? Math.floor(t.total / L.pointsPer) : 0;
    return (
      <Modal title="Payment successful" icon={PartyPopper} onClose={() => finish(done)}>
        <div className="pay-success">
          <svg className="check-anim" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27 l7 7 l15 -16" />
          </svg>
          <div className="ps-amount">{money(t.total, cur)}</div>
          <div className="muted">Bill #{done.no} paid via {done.paymentMethod.toUpperCase()}</div>
          {!splitOn && change > 0 && <div className="ps-chip">Return change: <b>{money(change, cur)}</b></div>}
          {earned > 0 && <div className="ps-chip ps-points"><Star size={13} fill="currentColor" /> {done.customerName} earned {earned} points</div>}
          {done.freeItem > 0 && <div className="ps-chip ps-points"><Coffee size={13} /> Free coffee redeemed</div>}
          <button className="btn btn-primary mt" onClick={() => finish(done)}><ReceiptText size={16} /> View bill</button>
          <div className="ps-timer"><div /></div>
        </div>
      </Modal>
    );
  }

  const methods = ['cash', 'upi', 'card', ...(customer && walletBal > 0 ? ['wallet'] : [])];

  return (
    <Modal
      title={`Payment · Bill #${order.no}`}
      icon={Wallet}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={pay}><Check size={16} /> Confirm {money(t.total, cur)}</button>
        </>
      }
    >
      {order.source === 'qr' && order.paymentIntent === 'upi' && (
        <div className="qr-note slide-in"><Smartphone size={15} /> Customer chose to pay by UPI from their phone — check the payment before confirming.</div>
      )}
      <div className="pay-summary">
        <div className="r-row"><span>Items ({order.items.reduce((s, i) => s + i.qty, 0)})</span><span>{money(t.subtotal, cur)}</span></div>
        {tierDisc > 0 && <div className="r-row text-ok slide-in"><span>{tier.name} member ({tier.discount}%)</span><span>-{money(tierDisc, cur)}</span></div>}
        {freeAmt > 0 && <div className="r-row text-ok slide-in"><span>Free coffee (stamp card)</span><span>-{money(freeAmt, cur)}</span></div>}
        {passAmt > 0 && <div className="r-row text-ok slide-in"><span>{pass.name}</span><span>-{money(passAmt, cur)}</span></div>}
        {manual > 0 && <div className="r-row text-ok slide-in"><span>Discount</span><span>-{money(manual, cur)}</span></div>}
        {pointsUsed > 0 && <div className="r-row text-ok slide-in"><span>Points redeemed ({pointsUsed})</span><span>-{money(pointsUsed, cur)}</span></div>}
        <div className="r-row"><span>GST {order.taxPercent}%</span><span>{money(t.tax, cur)}</span></div>
        <div className="r-row pay-total"><span>Payable</span><span key={t.total} className="pop">{money(t.total, cur)}</span></div>
      </div>

      {newCust ? (
        <div className="new-cust slide-in">
          <div className="field"><span className="flex-c"><UserPlus size={14} /> New customer</span></div>
          <div className="row-input">
            <input autoFocus placeholder="Name" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
            <input inputMode="numeric" maxLength={10} placeholder="10-digit phone" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value.replace(/\D/g, '') })} />
            <button className="btn" onClick={() => setNewCust(null)} title="Cancel"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <Field label="Customer (optional)">
          <div className="row-input">
            <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setRedeem(false); setUseStamp(false); setUsePass(false); }}>
              <option value="">Walk-in customer</option>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.phone}{tierFor(c, state.settings) ? ` · ${tierFor(c, state.settings).name}` : ''}</option>
              ))}
            </select>
            <button className="btn" onClick={() => { setCustomerId(''); setRedeem(false); setNewCust({ name: order.customerName || '', phone: order.customerPhone || '' }); }}><UserPlus size={16} /> New</button>
          </div>
        </Field>
      )}

      {customer && (
        <div className="perks">
          {tier && <Perk icon={Crown} tone="gold" title={`${tier.name} member · ${tier.discount}% off`} sub={`Lifetime spend ${money(customer.totalSpent, cur)}`} checked={useTier} onChange={setUseTier} />}
          {canStamp && <Perk icon={Coffee} tone="brown" title="Free coffee — stamp card full!" sub={`${customer.stamps} stamps · uses ${L.stampEvery}`} checked={useStamp} onChange={setUseStamp} />}
          {canPass && <Perk icon={Ticket} tone="blue" title={`Use ${pass.name}`} sub={`Valid till ${pass.end} · 1 coffee today`} checked={usePass} onChange={setUsePass} />}
          {customer.points > 0 && (
            <Perk icon={Star} tone="purple" title={`Redeem ${Math.min(customer.points, Math.floor(subtotal - before))} points`} sub={`${customer.points} available · 1 point = ${cur}1`} checked={redeem} onChange={setRedeem} />
          )}
          {!tier && !canStamp && !canPass && !(customer.points > 0) && (
            <div className="muted small">Stamps: {customer.stamps || 0}/{L.stampEvery} · Wallet: {money(walletBal, cur)}</div>
          )}
        </div>
      )}

      <div className="grid-2">
        <Field label="Extra discount">
          <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Type">
          <select value={discType} onChange={(e) => setDiscType(e.target.value)}>
            <option value="amt">{cur} Amount</option>
            <option value="pct">% Percent</option>
          </select>
        </Field>
      </div>

      <div className="field flex-row-between">
        <span>Payment method</span>
        <button className={`chip ${splitOn ? 'active' : ''}`} onClick={() => setSplitOn(!splitOn)}><Divide size={14} /> Split bill</button>
      </div>

      {!splitOn ? (
        <>
          <div className="seg">
            {methods.map((k) => {
              const [l, I] = METHOD[k];
              return <button key={k} className={`seg-btn ${method === k ? 'active' : ''}`} onClick={() => setMethod(k)}><I size={16} /> {l}</button>;
            })}
          </div>
          {method === 'wallet' && (
            <div className={`muted small mt ${walletBal < t.total ? 'text-danger' : ''}`}>Wallet balance: {money(walletBal, cur)}{walletBal >= t.total ? ` → ${money(walletBal - t.total, cur)} after this bill` : ' — not enough, use Split bill'}</div>
          )}
          {method === 'cash' && (
            <div className="slide-in">
              <div className="grid-2 mt">
                <Field label="Cash received">
                  <input type="number" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={t.total} />
                </Field>
                <Field label="Return change">
                  <input readOnly className={change < 0 ? 'text-danger' : ''} value={change > 0 ? money(change, cur) : change < 0 ? `Short ${money(-change, cur)}` : '—'} />
                </Field>
              </div>
              <div className="quick-cash">
                {quickCash.map((v) => (
                  <button key={v} className={`chip ${Number(received) === v ? 'active' : ''}`} onClick={() => setReceived(String(v))}>{money(v, cur)}</button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="split-box slide-in">
          <div className="split-head">
            <span className="flex-c"><Users size={15} /> Split between</span>
            <div className="qty">
              <button onClick={() => parts.length > 2 && splitEqual(parts.length - 1)}><Minus size={14} /></button>
              <span>{parts.length}</span>
              <button onClick={() => parts.length < 10 && splitEqual(parts.length + 1)}><Plus size={14} /></button>
            </div>
            <button className="chip" onClick={() => splitEqual(parts.length)}>Equal</button>
          </div>
          {parts.map((p, k) => (
            <div className="split-row" key={k}>
              <span className="split-n">{k + 1}</span>
              <select value={p.method} onChange={(e) => setParts(parts.map((x, j) => (j === k ? { ...x, method: e.target.value } : x)))}>
                {methods.map((m) => <option key={m} value={m}>{METHOD[m][0]}</option>)}
              </select>
              <input type="number" value={p.amount} onChange={(e) => setParts(parts.map((x, j) => (j === k ? { ...x, amount: e.target.value } : x)))} />
            </div>
          ))}
          <div className={`split-sum ${Math.abs(splitSum - t.total) > 0.01 ? 'text-danger' : 'text-ok'}`}>
            {money(splitSum, cur)} of {money(t.total, cur)}{Math.abs(splitSum - t.total) > 0.01 ? ` · ${splitSum < t.total ? 'short' : 'over'} by ${money(Math.abs(t.total - splitSum), cur)}` : ' ✓'}
          </div>
        </div>
      )}
    </Modal>
  );
}

