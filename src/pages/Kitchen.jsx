import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Empty } from '../components/UI';
import { minutesAgo } from '../utils/helpers';

const COLS = [
  { key: 'pending', title: '🕐 New', next: 'preparing', action: 'Start Cooking' },
  { key: 'preparing', title: '🔥 Preparing', next: 'ready', action: 'Mark Ready' },
  { key: 'ready', title: '✅ Ready to Serve', next: 'served', action: 'Served' },
];

export default function Kitchen() {
  const { state, update, notify } = useStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const tableName = (id) => state.tables.find((t) => t.id === id)?.name;

  return (
    <div>
      <PageHead title="Kitchen Display" subtitle="KOT tickets — move orders across as they progress" />
      <div className="kds">
        {COLS.map((c) => {
          const orders = state.orders
            .filter((o) => o.status === c.key)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return (
            <div className={`kds-col kds-${c.key}`} key={c.key}>
              <div className="kds-title">{c.title} <span className="count">{orders.length}</span></div>
              {!orders.length && <Empty icon="—" text="Nothing here" />}
              {orders.map((o) => {
                const mins = minutesAgo(o.createdAt);
                return (
                  <div className={`kot ${mins >= 15 && c.key !== 'ready' ? 'late' : ''}`} key={o.id}>
                    <div className="kot-head">
                      <b>#{o.no}</b>
                      <span>{o.type === 'dine-in' ? `Table ${tableName(o.tableId)}` : o.type.toUpperCase()}</span>
                      <span className="kot-time">{mins}m</span>
                    </div>
                    <ul>
                      {o.items.map((i, idx) => (
                        <li key={idx}>
                          <b>{i.qty}×</b> {i.name}
                          {i.note && <div className="kot-note">📝 {i.note}</div>}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="btn btn-primary btn-block"
                      onClick={() => {
                        update('orders', o.id, { status: c.next });
                        notify(`#${o.no} → ${c.action}`);
                      }}
                    >
                      {c.action} ›
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
