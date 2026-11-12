import { useState } from 'react';
import {
  History, Pencil, Phone, Plus, Search, Star, Trash2, Users, Wallet, Ticket, Crown, Coffee, Banknote, Smartphone, CreditCard,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { PageHead, Modal, Field, SearchInput, StatCard } from '../components/UI';
import DataTable from '../components/DataTable';
import { money, orderTotals, fmtDateTime } from '../utils/helpers';
import { tierFor, nextTier, loyaltyOf, activePass, passUsedToday } from '../utils/loyalty';

const blank = { name: '', phone: '', email: '', visits: 0, totalSpent: 0, points: 0, stamps: 0, wallet: 0, subscription: null };
const PAY = [['cash', 'Cash', Banknote], ['upi', 'UPI', Smartphone], ['card', 'Card', CreditCard]];

export const TierBadge = ({ customer }) => {
  const { state } = useStore();
  const t = tierFor(customer, state.settings);
  if (!t) return <span className="badge badge-muted">Member</span>;
  return <span className={`badge tier tier-${t.name.toLowerCase()}`}><Crown size={11} /> {t.name}</span>;
};

export const StampCard = ({ stamps, every }) => (
  <span className="stamps" title={`${stamps}/${every} stamps`}>
    {Array.from({ length: every }, (_, i) => <span key={i} className={i < stamps ? 'on' : ''}><Coffee size={11} /></span>)}
    {stamps >= every && <b className="stamp-free">FREE</b>}
  </span>
);

export default function Customers() {
  const { state, add, update, remove, dispatch, notify, cur } = useStore();
  const L = loyaltyOf(state.settings);
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const [topup, setTopup] = useState(null); // { customer, amount, method }
  const [passFor, setPassFor] = useState(null); // { customer, planId, method }
  const [q, setQ] = useState('');

  const rows = state.customers
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const save = () => {
    if (!edit.name.trim() || !/^\d{10}$/.test(edit.phone)) return notify('Enter name & 10-digit phone', 'danger');
    if (state.customers.some((c) => c.phone === edit.phone && c.id !== edit.id)) return notify('Phone already exists', 'danger');
    edit.id ? update('customers', edit.id, edit) : add('customers', { ...edit, name: edit.name.trim() });
    notify('Customer saved');
    setEdit(null);
  };

  const doTopup = () => {
    const amt = Number(topup.amount);
    if (!(amt > 0)) return notify('Enter an amount', 'danger');
    dispatch({ type: 'WALLET_TOPUP', customerId: topup.customer.id, amount: amt, method: topup.method });
    notify(`${money(amt, cur)} added to ${topup.customer.name}'s wallet`);
    setTopup(null);
  };

  const doPass = () => {
    const plan = L.plans.find((p) => p.id === passFor.planId);
    if (!plan) return notify('Choose a plan', 'danger');
    dispatch({ type: 'SELL_PASS', customerId: passFor.customer.id, planId: plan.id, method: passFor.method });
    notify(`${plan.name} activated for ${passFor.customer.name}`);
    setPassFor(null);
  };

  const history = view ? state.orders.filter((o) => o.customerId === view.id && o.status === 'paid').reverse() : [];
  const ledger = view ? state.ledger.filter((l) => l.customerId === view.id).reverse() : [];
  const walletTotal = state.customers.reduce((s, c) => s + (c.wallet || 0), 0);
  const activePasses = state.customers.filter((c) => activePass(c)).length;
  const members = state.customers.filter((c) => tierFor(c, state.settings)).length;

  return (
    <div>
      <PageHead icon={Users} title="Customers" subtitle={`${state.customers.length} customers · loyalty, wallet & passes`}>
        <button className="btn btn-primary" onClick={() => setEdit(blank)}><Plus size={16} /> Add Customer</button>
      </PageHead>

      <div className="stats stagger">
        <StatCard icon={Users} label="Customers" value={state.customers.length} tone="blue" />
        <StatCard icon={Crown} label="Tier members" value={members} sub={L.tiers.map((t) => t.name).join(' · ')} tone="orange" />
        <StatCard icon={Wallet} label="Wallet balance held" value={walletTotal} format={(v) => money(Math.round(v), cur)} tone="green" />
        <StatCard icon={Ticket} label="Active passes" value={activePasses} tone="brown" />
      </div>

      <div className="toolbar">
        <SearchInput icon={Search} className="search" placeholder="Search name / phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <DataTable
        rows={rows}
        empty="No customers yet"
        columns={[
          { key: 'name', label: 'Name', render: (c) => <span className="flex-c"><b>{c.name}</b> <TierBadge customer={c} /></span> },
          { key: 'phone', label: 'Phone', render: (c) => <a className="flex-c" href={`tel:${c.phone}`}><Phone size={13} /> {c.phone}</a> },
          { key: 'totalSpent', label: 'Spent', render: (c) => <span>{money(c.totalSpent, cur)}<div className="muted small">{c.visits} visits</div></span> },
          { key: 'stamps', label: 'Stamp card', render: (c) => <StampCard stamps={c.stamps || 0} every={L.stampEvery} /> },
          { key: 'wallet', label: 'Wallet', render: (c) => <b className={(c.wallet || 0) > 0 ? 'text-ok' : 'muted'}>{money(c.wallet || 0, cur)}</b> },
          {
            key: 'pass', label: 'Pass',
            render: (c) => {
              const p = activePass(c);
              return p ? <span className="badge badge-info" title={`till ${p.end}`}><Ticket size={11} /> {passUsedToday(c) ? 'Used today' : 'Active'}</span> : <span className="muted small">—</span>;
            },
          },
          { key: 'points', label: 'Points', render: (c) => <span className="badge badge-purple flex-c"><Star size={11} fill="currentColor" /> {c.points}</span> },
        ]}
        actions={(c) => (
          <>
            <button className="btn btn-sm btn-success" onClick={() => setTopup({ customer: c, amount: '', method: 'cash' })}><Wallet size={13} /> Top up</button>
            <button className="btn btn-sm" onClick={() => setPassFor({ customer: c, planId: L.plans[0]?.id, method: 'cash' })}><Ticket size={13} /> Pass</button>
            <button className="btn btn-sm" onClick={() => setView(c)}><History size={13} /> History</button>
            <button className="btn btn-sm" onClick={() => setEdit(c)}><Pencil size={13} /></button>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => confirm(`Delete ${c.name}?`) && remove('customers', c.id)} title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      {edit && (
        <Modal
          title={edit.id ? 'Edit Customer' : 'Add Customer'}
          onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}
        >
          <Field label="Name"><input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Phone"><input inputMode="numeric" maxLength={10} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Email (optional)"><input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
        </Modal>
      )}

      {topup && (
        <Modal
          title={`Wallet top-up · ${topup.customer.name}`}
          icon={Wallet}
          onClose={() => setTopup(null)}
          footer={<><button className="btn" onClick={() => setTopup(null)}>Cancel</button><button className="btn btn-success" onClick={doTopup}>Add {topup.amount ? money(topup.amount, cur) : ''}</button></>}
        >
          <p className="muted">Current balance: <b>{money(topup.customer.wallet || 0, cur)}</b>. Customers can pay from their wallet at billing for a faster checkout.</p>
          <Field label={`Amount (${cur})`}><input type="number" autoFocus value={topup.amount} onChange={(e) => setTopup({ ...topup, amount: e.target.value })} /></Field>
          <div className="quick-cash">
            {[200, 500, 1000, 2000].map((v) => <button key={v} className={`chip ${Number(topup.amount) === v ? 'active' : ''}`} onClick={() => setTopup({ ...topup, amount: String(v) })}>{money(v, cur)}</button>)}
          </div>
          <div className="field mt"><span>Received via</span></div>
          <div className="seg">
            {PAY.map(([k, l, I]) => <button key={k} className={`seg-btn ${topup.method === k ? 'active' : ''}`} onClick={() => setTopup({ ...topup, method: k })}><I size={15} /> {l}</button>)}
          </div>
        </Modal>
      )}

      {passFor && (
        <Modal
          title={`Coffee subscription · ${passFor.customer.name}`}
          icon={Ticket}
          onClose={() => setPassFor(null)}
          footer={<><button className="btn" onClick={() => setPassFor(null)}>Cancel</button><button className="btn btn-primary" onClick={doPass} disabled={!L.plans.length}>Activate</button></>}
        >
          {activePass(passFor.customer) && <p className="qr-note">Already has an active pass till {activePass(passFor.customer).end}. Activating again starts a new period from today.</p>}
          {!L.plans.length && <p className="muted">No plans yet — add one in Settings → Loyalty & Rewards.</p>}
          <div className="plan-list">
            {L.plans.map((p) => (
              <button key={p.id} className={`plan ${passFor.planId === p.id ? 'on' : ''}`} onClick={() => setPassFor({ ...passFor, planId: p.id })}>
                <Ticket size={20} />
                <span className="grow"><b>{p.name}</b><div className="muted small">1 {p.category.toLowerCase()} per day (up to {money(p.maxPrice, cur)}) · {p.days} days</div></span>
                <b className="plan-price">{money(p.price, cur)}</b>
              </button>
            ))}
          </div>
          <div className="field mt"><span>Received via</span></div>
          <div className="seg">
            {PAY.map(([k, l, I]) => <button key={k} className={`seg-btn ${passFor.method === k ? 'active' : ''}`} onClick={() => setPassFor({ ...passFor, method: k })}><I size={15} /> {l}</button>)}
          </div>
        </Modal>
      )}

      {view && (
        <Modal title={`${view.name}`} icon={History} onClose={() => setView(null)}>
          <div className="cust-summary">
            <TierBadge customer={view} />
            {nextTier(view, state.settings) && <span className="muted small">{money(nextTier(view, state.settings).remaining, cur)} more to {nextTier(view, state.settings).name}</span>}
          </div>
          <div className="cust-grid">
            <div><span className="muted small">Stamp card</span><StampCard stamps={view.stamps || 0} every={L.stampEvery} /></div>
            <div><span className="muted small">Wallet</span><b>{money(view.wallet || 0, cur)}</b></div>
            <div><span className="muted small">Points</span><b>{view.points}</b></div>
            <div><span className="muted small">Pass</span><b>{activePass(view) ? `till ${activePass(view).end}` : '—'}</b></div>
          </div>
          {ledger.length > 0 && (
            <>
              <h4 className="mt">Wallet & passes</h4>
              <ul className="simple-list">
                {ledger.map((l) => (
                  <li key={l.id}>
                    <span className="li-icon">{l.type === 'wallet' ? <Wallet size={15} /> : <Ticket size={15} />}</span>
                    <span className="grow">{l.type === 'wallet' ? 'Wallet top-up' : l.plan}<div className="muted small">{fmtDateTime(l.date)} · {String(l.method).toUpperCase()}</div></span>
                    <b>{money(l.amount, cur)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4 className="mt">Orders</h4>
          {!history.length ? <p className="muted">No orders linked yet.</p> : (
            <ul className="simple-list">
              {history.map((o) => (
                <li key={o.id}>
                  <span className="grow"><b>#{o.no}</b> <span className="muted small">{fmtDateTime(o.paidAt)}</span>
                    <div className="small muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                  </span>
                  <b>{money(orderTotals(o).total, cur)}</b>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
