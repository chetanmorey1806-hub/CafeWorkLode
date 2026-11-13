import { Smartphone, Ban, Bike, ClipboardList, ConciergeBell, Pencil, ReceiptText, Search, ShoppingBag, UtensilsCrossed, Wallet } from 'lucide-react';
import { useState } from 'react';
import { modsLabel } from '../utils/menuOptions';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { PageHead, StatusBadge, Empty, SearchInput } from '../components/UI';
import { PaymentModal, ReceiptModal } from '../components/Billing';
import { money, orderTotals, fmtDateTime, inRange, ACTIVE_STATUSES } from '../utils/helpers';

const TABS = [
  ['active', 'Running'],
  ['paid', 'Paid'],
  ['cancelled', 'Cancelled'],
  ['all', 'All'],
];

export default function Orders() {
  const { state, update, notify, cur } = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState('active');
  const [range, setRange] = useState('today');
  const [q, setQ] = useState('');
  const [payOrder, setPayOrder] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const list = state.orders
    .filter((o) => {
      if (tab === 'active') return ACTIVE_STATUSES.includes(o.status);
      if (tab === 'all') return true;
      return o.status === tab;
    })
    .filter((o) => tab === 'active' || inRange(o.createdAt, range))
    .filter((o) => !q || String(o.no).includes(q) || (o.customerName || '').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const tableName = (id) => state.tables.find((t) => t.id === id)?.name;

  const cancel = (o) => {
    if (!confirm(`Cancel order #${o.no}?`)) return;
    update('orders', o.id, { status: 'cancelled' });
    notify(`Order #${o.no} cancelled`, 'danger');
  };

  return (
    <div>
      <PageHead icon={ClipboardList} title="Orders" subtitle="Manage running orders and billing history" />

      <div className="toolbar">
        <div className="seg seg-inline">
          {TABS.map(([k, l]) => (
            <button key={k} className={`seg-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab !== 'active' && (
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </select>
        )}
        <SearchInput icon={Search} className="search" placeholder="Search bill # / customer" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!list.length ? (
        <Empty icon={ClipboardList} text="No orders here" />
      ) : (
        <div className="order-grid stagger">
          {list.map((o) => {
            const t = orderTotals(o);
            return (
              <div className="card order-card" key={o.id}>
                <div className="oc-head">
                  <div>
                    <b>#{o.no}</b>{' '}
                    <span className="muted small flex-c">
                      {o.type === 'dine-in' ? <><UtensilsCrossed size={13} /> Table {tableName(o.tableId) || ''}</> : o.type === 'takeaway' ? <><ShoppingBag size={13} /> Takeaway</> : <><Bike size={13} /> Delivery</>}{o.source === 'qr' && <span className="badge badge-purple"><Smartphone size={11} /> QR</span>}{o.paymentIntent === 'upi' && o.status !== 'paid' && <span className="badge badge-info">Wants UPI</span>}{o.paymentMethod === 'split' && <span className="badge badge-warn">Split</span>}
                    </span>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="muted small">{fmtDateTime(o.createdAt)}{o.customerName && ` · ${o.customerName}`}</div>
                <ul className="oc-items">
                  {o.items.map((i, idx) => (
                    <li key={idx}><span>{i.qty} × {i.name}{modsLabel(i.mods) && <small className="muted"> · {modsLabel(i.mods)}</small>}</span><span>{money(i.qty * i.price, cur)}</span></li>
                  ))}
                </ul>
                <div className="oc-total"><span>Total</span><b>{money(t.total, cur)}</b></div>
                <div className="oc-actions">
                  {ACTIVE_STATUSES.includes(o.status) && (
                    <>
                      <button className="btn btn-sm" onClick={() => nav(`/pos/${o.id}`)}><Pencil size={13} /> Edit</button>
                      {o.status === 'ready' && (
                        <button className="btn btn-sm" onClick={() => update('orders', o.id, { status: 'served' })}><ConciergeBell size={13} /> Served</button>
                      )}
                      <button className="btn btn-sm btn-danger-ghost" onClick={() => cancel(o)}><Ban size={13} /> Cancel</button>
                      <button className="btn btn-sm btn-success" onClick={() => setPayOrder(o)}><Wallet size={13} /> Pay</button>
                    </>
                  )}
                  {o.status === 'paid' && (
                    <button className="btn btn-sm" onClick={() => setReceipt(o)}><ReceiptText size={13} /> View Bill · {o.paymentMethod?.toUpperCase()}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {payOrder && (
        <PaymentModal
          order={payOrder}
          onClose={() => setPayOrder(null)}
          onPaid={(o) => { setPayOrder(null); setReceipt(o); }}
        />
      )}
      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
