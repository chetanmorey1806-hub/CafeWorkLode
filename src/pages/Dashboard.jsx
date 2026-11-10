import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { StatCard, StatusBadge, PageHead, Empty } from '../components/UI';
import { money, orderTotals, inRange, ACTIVE_STATUSES, fmtTime, dateStr } from '../utils/helpers';

export default function Dashboard() {
  const { state, cur } = useStore();
  const paidToday = state.orders.filter((o) => o.status === 'paid' && inRange(o.paidAt, 'today'));
  const revenue = paidToday.reduce((s, o) => s + orderTotals(o).total, 0);
  const active = state.orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const occupied = new Set(active.filter((o) => o.tableId).map((o) => o.tableId)).size;
  const lowStock = state.inventory.filter((i) => i.qty <= i.minQty);
  const expToday = state.expenses.filter((e) => e.date === dateStr(new Date())).reduce((s, e) => s + Number(e.amount), 0);

  // Last 7 days revenue
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const key = dateStr(d);
    const total = state.orders
      .filter((o) => o.status === 'paid' && o.paidAt && dateStr(o.paidAt) === key)
      .reduce((s, o) => s + orderTotals(o).total, 0);
    return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }), total };
  });
  const max = Math.max(...days.map((d) => d.total), 1);

  // Top items (all time)
  const itemMap = {};
  state.orders.filter((o) => o.status === 'paid').forEach((o) =>
    o.items.forEach((i) => { itemMap[i.name] = (itemMap[i.name] || 0) + i.qty; }),
  );
  const top = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <PageHead title={`Welcome 👋`} subtitle="Here's what's happening at your cafe today">
        <Link to="/pos" className="btn btn-primary">+ New Order</Link>
      </PageHead>

      <div className="stats">
        <StatCard icon="💰" label="Today's Sales" value={money(revenue, cur)} sub={`${paidToday.length} bills`} tone="green" />
        <StatCard icon="🔥" label="Active Orders" value={active.length} sub="in progress" tone="orange" />
        <StatCard icon="🪑" label="Tables Occupied" value={`${occupied}/${state.tables.length}`} tone="blue" />
        <StatCard icon="💸" label="Today's Expense" value={money(expToday, cur)} tone="red" />
      </div>

      <div className="grid-dash">
        <div className="card">
          <div className="card-head"><h3>Sales — Last 7 days</h3></div>
          <div className="bar-chart">
            {days.map((d, i) => (
              <div className="bar-col" key={i}>
                <div className="bar-val">{d.total ? Math.round(d.total) : ''}</div>
                <div className="bar" style={{ height: `${(d.total / max) * 100}%` }} />
                <div className="bar-label">{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Top Selling</h3></div>
          {top.length ? (
            <ul className="rank-list">
              {top.map(([name, qty], i) => (
                <li key={name}><span className="rank">{i + 1}</span><span className="grow">{name}</span><b>{qty}</b></li>
              ))}
            </ul>
          ) : <Empty text="No sales yet" />}
        </div>

        <div className="card">
          <div className="card-head"><h3>Running Orders</h3><Link to="/orders" className="link">View all</Link></div>
          {active.length ? (
            <ul className="simple-list">
              {active.slice(-6).reverse().map((o) => (
                <li key={o.id}>
                  <Link to={`/pos/${o.id}`} className="grow">
                    <b>#{o.no}</b> · {o.tableId ? state.tables.find((t) => t.id === o.tableId)?.name : o.type}
                    <div className="muted small">{fmtTime(o.createdAt)} · {money(orderTotals(o).total, cur)}</div>
                  </Link>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          ) : <Empty icon="☕" text="No running orders" />}
        </div>

        <div className="card">
          <div className="card-head"><h3>Low Stock Alerts</h3><Link to="/inventory" className="link">Inventory</Link></div>
          {lowStock.length ? (
            <ul className="simple-list">
              {lowStock.map((i) => (
                <li key={i.id}><span className="grow">⚠️ {i.name}</span><span className="badge badge-danger">{i.qty} {i.unit}</span></li>
              ))}
            </ul>
          ) : <Empty icon="✅" text="All stock levels OK" />}
        </div>
      </div>
    </div>
  );
}
