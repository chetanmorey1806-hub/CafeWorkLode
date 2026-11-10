import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, StatCard, Empty } from '../components/UI';
import { money, orderTotals, inRange, dateStr } from '../utils/helpers';

export default function Reports() {
  const { state, cur } = useStore();
  const [range, setRange] = useState('week');

  const paid = state.orders.filter((o) => o.status === 'paid' && o.paidAt && inRange(o.paidAt, range));
  const cancelled = state.orders.filter((o) => o.status === 'cancelled' && inRange(o.createdAt, range)).length;
  const totals = paid.map((o) => ({ o, ...orderTotals(o) }));
  const revenue = totals.reduce((s, t) => s + t.total, 0);
  const tax = totals.reduce((s, t) => s + t.tax, 0);
  const discount = totals.reduce((s, t) => s + t.discount, 0);
  const expenses = state.expenses.filter((e) => inRange(e.date + 'T12:00:00', range)).reduce((s, e) => s + Number(e.amount), 0);
  const profit = revenue - tax - expenses;
  const avg = paid.length ? revenue / paid.length : 0;

  const group = (fn) => {
    const m = {};
    totals.forEach((t) => { const k = fn(t.o); m[k] = (m[k] || 0) + t.total; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const byPayment = group((o) => (o.paymentMethod || 'other').toUpperCase());
  const byType = group((o) => o.type);

  const itemStats = {};
  paid.forEach((o) => o.items.forEach((i) => {
    itemStats[i.name] ??= { qty: 0, amt: 0 };
    itemStats[i.name].qty += i.qty;
    itemStats[i.name].amt += i.qty * i.price;
  }));
  const items = Object.entries(itemStats).sort((a, b) => b[1].amt - a[1].amt);

  const catStats = {};
  paid.forEach((o) => o.items.forEach((i) => {
    const c = state.menu.find((m) => m.id === i.menuId)?.category || 'Other';
    catStats[c] = (catStats[c] || 0) + i.qty * i.price;
  }));
  const cats = Object.entries(catStats).sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(...cats.map((c) => c[1]), 1);

  // hourly
  const hours = Array.from({ length: 24 }, () => 0);
  paid.forEach((o) => { hours[new Date(o.createdAt).getHours()] += 1; });
  const busy = hours.map((v, h) => ({ h, v })).filter((x) => x.h >= 7 && x.h <= 23);
  const hMax = Math.max(...busy.map((x) => x.v), 1);

  const exportCSV = () => {
    const rows = [['Bill No', 'Date', 'Type', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment']];
    totals.forEach(({ o, subtotal, discount: d, tax: tx, total }) =>
      rows.push([o.no, dateStr(o.paidAt), o.type, o.customerName || '', o.items.map((i) => `${i.qty}x ${i.name}`).join('; '), subtotal, d, tx, total, o.paymentMethod]),
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `sales-${range}-${dateStr(new Date())}.csv`;
    a.click();
  };

  return (
    <div>
      <PageHead title="Reports" subtitle="Sales, profit and performance">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </select>
        <button className="btn" onClick={exportCSV}>⬇️ Export CSV</button>
      </PageHead>

      <div className="stats">
        <StatCard icon="💰" label="Revenue" value={money(revenue, cur)} sub={`${paid.length} bills`} tone="green" />
        <StatCard icon="💸" label="Expenses" value={money(expenses, cur)} tone="red" />
        <StatCard icon="📈" label="Net Profit" value={money(profit, cur)} sub="after GST & expenses" tone={profit >= 0 ? 'green' : 'red'} />
        <StatCard icon="🧾" label="Avg Bill" value={money(Math.round(avg), cur)} tone="blue" />
        <StatCard icon="🏛️" label="GST Collected" value={money(tax, cur)} tone="orange" />
        <StatCard icon="🏷️" label="Discounts" value={money(discount, cur)} sub={`${cancelled} cancelled orders`} tone="brown" />
      </div>

      {!paid.length ? <Empty icon="📉" text="No sales in this period" /> : (
        <div className="grid-dash">
          <div className="card">
            <div className="card-head"><h3>Sales by Category</h3></div>
            {cats.map(([c, v]) => (
              <div className="hbar" key={c}>
                <span className="hbar-label">{c}</span>
                <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(v / catMax) * 100}%` }} /></div>
                <span className="hbar-val">{money(v, cur)}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-head"><h3>Payment & Order Type</h3></div>
            <ul className="simple-list">
              {byPayment.map(([k, v]) => <li key={k}><span className="grow">{k === 'CASH' ? '💵' : k === 'UPI' ? '📱' : '💳'} {k}</span><b>{money(v, cur)}</b></li>)}
            </ul>
            <ul className="simple-list mt">
              {byType.map(([k, v]) => <li key={k}><span className="grow text-cap">{k}</span><b>{money(v, cur)}</b></li>)}
            </ul>
          </div>

          <div className="card">
            <div className="card-head"><h3>Busy Hours (orders)</h3></div>
            <div className="bar-chart small-bars">
              {busy.map((x) => (
                <div className="bar-col" key={x.h}>
                  <div className="bar" style={{ height: `${(x.v / hMax) * 100}%` }} title={`${x.v} orders`} />
                  <div className="bar-label">{x.h % 12 || 12}{x.h < 12 ? 'a' : 'p'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Item-wise Sales</h3></div>
            <div className="table-wrap">
              <table className="dt dt-plain">
                <thead><tr><th>Item</th><th className="right">Qty</th><th className="right">Amount</th></tr></thead>
                <tbody>
                  {items.map(([n, s]) => <tr key={n}><td>{n}</td><td className="right">{s.qty}</td><td className="right">{money(s.amt, cur)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
