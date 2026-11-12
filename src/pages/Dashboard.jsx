import { Link } from 'react-router-dom';
import {
  IndianRupee, Flame, Armchair, Wallet, Plus, ChefHat, ClipboardList, UtensilsCrossed, BarChart3,
  Trophy, Coffee, PackageCheck, AlertTriangle, ArrowRight, Receipt, Target, Banknote, Smartphone, CreditCard,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { StatCard, StatusBadge, PageHead, Empty, CountUp } from '../components/UI';
import { money, orderTotals, inRange, ACTIVE_STATUSES, fmtTime, dateStr, greeting } from '../utils/helpers';

const QUICK = [
  { to: '/pos', icon: Plus, label: 'New Order', tone: 'brown' },
  { to: '/kitchen', icon: ChefHat, label: 'Kitchen', tone: 'orange' },
  { to: '/orders', icon: ClipboardList, label: 'Orders', tone: 'blue' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu', tone: 'green' },
  { to: '/reports', icon: BarChart3, label: 'Reports', tone: 'purple' },
];

export default function Dashboard() {
  const { state, cur } = useStore();
  const fmt = (v) => money(Math.round(v), cur);
  const sumDay = (key) =>
    state.orders
      .filter((o) => o.status === 'paid' && o.paidAt && dateStr(o.paidAt) === key)
      .reduce((s, o) => s + orderTotals(o).total, 0);

  const paidToday = state.orders.filter((o) => o.status === 'paid' && inRange(o.paidAt, 'today'));
  const revenue = paidToday.reduce((s, o) => s + orderTotals(o).total, 0);
  const yesterday = sumDay(dateStr(Date.now() - 86400000));
  const trend = yesterday ? ((revenue - yesterday) / yesterday) * 100 : undefined;
  const active = state.orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const occupied = new Set(active.filter((o) => o.tableId).map((o) => o.tableId)).size;
  const lowStock = state.inventory.filter((i) => i.qty <= i.minQty);
  const expToday = state.expenses.filter((e) => e.date === dateStr(new Date())).reduce((s, e) => s + Number(e.amount), 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }), total: sumDay(dateStr(d)), today: i === 6 };
  });
  const max = Math.max(...days.map((d) => d.total), 1);
  const weekTotal = days.reduce((s, d) => s + d.total, 0);

  const itemMap = {};
  state.orders.filter((o) => o.status === 'paid').forEach((o) =>
    o.items.forEach((i) => { itemMap[i.name] = (itemMap[i.name] || 0) + i.qty; }),
  );
  const top = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = top[0]?.[1] || 1;

  const target = Number(state.settings.dailyTarget) || 0;
  const pct = target ? Math.min(100, (revenue / target) * 100) : 0;
  const R = 54;
  const C = 2 * Math.PI * R;

  const split = ['cash', 'upi', 'card'].map((k) => {
    const list = paidToday.filter((o) => o.paymentMethod === k);
    return { k, count: list.length, total: list.reduce((s, o) => s + orderTotals(o).total, 0) };
  });
  const SPLIT_META = { cash: ['Cash', Banknote, 'green'], upi: ['UPI', Smartphone, 'purple'], card: ['Card', CreditCard, 'blue'] };

  return (
    <div>
      <PageHead title={`${greeting()}!`} subtitle={`Here's what's happening at ${state.settings.cafeName} today`}>
        <Link to="/pos" className="btn btn-primary btn-glow"><Plus size={16} /> New Order</Link>
      </PageHead>

      <div className="stats stagger">
        <StatCard icon={IndianRupee} label="Today's Sales" value={revenue} format={fmt} sub={`${paidToday.length} bills · vs yesterday`} trend={trend} tone="green" />
        <StatCard icon={Flame} label="Active Orders" value={active.length} sub="in progress" tone="orange" />
        <StatCard icon={Armchair} label="Tables Occupied" value={`${occupied}/${state.tables.length}`} sub={`${state.tables.length - occupied} free`} tone="blue" />
        <StatCard icon={Wallet} label="Today's Expense" value={expToday} format={fmt} tone="red" />
      </div>

      <div className="quick stagger">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className={`quick-btn tone-${q.tone}`}>
            <span className="quick-icon"><q.icon size={20} /></span>
            <span>{q.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid-dash stagger">
        <div className="card target-card">
          <div className="card-head">
            <h3 className="flex-c"><Target size={16} className="text-ok" /> Today's Target</h3>
            <Link to="/settings" className="link">Edit <ArrowRight size={14} /></Link>
          </div>
          {target ? (
            <div className="target-body">
              <div className={`ring-wrap ${pct >= 100 ? 'hit' : ''}`}>
                <svg viewBox="0 0 128 128" className="ring">
                  <circle className="ring-bg" cx="64" cy="64" r={R} />
                  <circle className="ring-fg" cx="64" cy="64" r={R} strokeDasharray={C} style={{ '--off': C - (pct / 100) * C, '--full': C }} />
                </svg>
                <div className="ring-label"><b><CountUp value={pct} />%</b><span>achieved</span></div>
              </div>
              <div className="target-info">
                <div><span className="muted small">Sales</span><b>{money(revenue, cur)}</b></div>
                <div><span className="muted small">Target</span><b>{money(target, cur)}</b></div>
                <div>
                  <span className="muted small">{pct >= 100 ? 'Status' : 'Remaining'}</span>
                  <b className={pct >= 100 ? 'text-ok' : ''}>{pct >= 100 ? 'Target hit!' : money(target - revenue, cur)}</b>
                </div>
              </div>
            </div>
          ) : <Empty icon={Target} text="Set a daily sales target in Settings" />}
        </div>

        <div className="card">
          <div className="card-head"><h3>Payments Today</h3><span className="muted small">{paidToday.length} bills</span></div>
          <ul className="split-list">
            {split.map(({ k, count, total }, i) => {
              const [label, Icon, tone] = SPLIT_META[k];
              return (
                <li key={k}>
                  <span className={`split-icon tone-${tone}`}><Icon size={17} /></span>
                  <div className="grow">
                    <div className="flex-between"><span>{label} <span className="muted small">· {count}</span></span><b>{money(total, cur)}</b></div>
                    <div className="mini-track"><div className={`mini-fill fill-${tone}`} style={{ width: `${revenue ? (total / revenue) * 100 : 0}%`, animationDelay: `${i * 120}ms` }} /></div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Sales — Last 7 days</h3>
            <span className="muted small">{money(weekTotal, cur)} total</span>
          </div>
          <div className="bar-chart">
            {days.map((d, i) => (
              <div className="bar-col" key={i} title={money(d.total, cur)}>
                <div className="bar-val">{d.total ? Math.round(d.total) : ''}</div>
                <div className={`bar grow-up ${d.today ? 'today' : ''}`} style={{ height: `${(d.total / max) * 100}%`, animationDelay: `${i * 60}ms` }} />
                <div className="bar-label">{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="flex-c"><Trophy size={16} className="text-warn" /> Top Selling</h3></div>
          {top.length ? (
            <ul className="rank-list">
              {top.map(([name, qty], i) => (
                <li key={name}>
                  <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                  <div className="grow">
                    <div className="rank-name">{name}</div>
                    <div className="mini-track"><div className="mini-fill" style={{ width: `${(qty / topMax) * 100}%` }} /></div>
                  </div>
                  <b>{qty}</b>
                </li>
              ))}
            </ul>
          ) : <Empty text="No sales yet" />}
        </div>

        <div className="card">
          <div className="card-head"><h3>Running Orders</h3><Link to="/orders" className="link">View all <ArrowRight size={14} /></Link></div>
          {active.length ? (
            <ul className="simple-list">
              {active.slice(-6).reverse().map((o) => (
                <li key={o.id}>
                  <span className="li-icon"><Receipt size={16} /></span>
                  <Link to={`/pos/${o.id}`} className="grow">
                    <b>#{o.no}</b> · {o.tableId ? `Table ${state.tables.find((t) => t.id === o.tableId)?.name}` : <span className="text-cap">{o.type}</span>}
                    <div className="muted small">{fmtTime(o.createdAt)} · {money(orderTotals(o).total, cur)}</div>
                  </Link>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          ) : <Empty icon={Coffee} text="No running orders" />}
        </div>

        <div className="card">
          <div className="card-head"><h3>Low Stock Alerts</h3><Link to="/inventory" className="link">Inventory <ArrowRight size={14} /></Link></div>
          {lowStock.length ? (
            <ul className="simple-list">
              {lowStock.map((i) => (
                <li key={i.id}>
                  <span className="li-icon danger"><AlertTriangle size={16} /></span>
                  <span className="grow">{i.name}<div className="muted small">Min level {i.minQty} {i.unit}</div></span>
                  <span className="badge badge-danger">{i.qty} {i.unit}</span>
                </li>
              ))}
            </ul>
          ) : <Empty icon={PackageCheck} text="All stock levels OK" />}
        </div>
      </div>
    </div>
  );
}
