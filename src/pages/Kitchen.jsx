import { ArrowRight, Check, CheckCheck, CheckCircle2, ChefHat, Clock3, Flame, StickyNote, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Empty } from '../components/UI';
import { minutesAgo } from '../utils/helpers';
import { modsLabel } from '../utils/menuOptions';

const COLS = [
  { key: 'pending', title: 'New', icon: Clock3, next: 'preparing', action: 'Start Cooking' },
  { key: 'preparing', title: 'Preparing', icon: Flame, next: 'ready', action: 'Mark Ready' },
  { key: 'ready', title: 'Ready to Serve', icon: CheckCircle2, next: 'served', action: 'Served' },
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
      <PageHead icon={ChefHat} title="Kitchen Display" subtitle="KOT tickets — move orders across as they progress" />
      <div className="kds">
        {COLS.map((c) => {
          const orders = state.orders
            .filter((o) => o.status === c.key)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return (
            <div className={`kds-col kds-${c.key}`} key={c.key}>
              <div className="kds-title"><span className="flex-c"><c.icon size={18} /> {c.title}</span> <span className="count">{orders.length}</span></div>
              {!orders.length && <Empty icon={CheckCheck} text="Nothing here" />}
              {orders.map((o) => {
                const mins = minutesAgo(o.createdAt);
                const doneCount = o.items.filter((i) => i.done).length;
                const allDone = doneCount === o.items.length;
                const toggleItem = (idx) =>
                  update('orders', o.id, {
                    items: o.items.map((it, k) => (k === idx ? { ...it, done: !it.done } : it)),
                    ...(o.status === 'pending' ? { status: 'preparing' } : {}),
                  });
                return (
                  <div className={`kot pop-in ${mins >= 15 && c.key !== 'ready' ? 'late' : ''}`} key={o.id}>
                    <div className="kot-head">
                      <b>#{o.no}</b>
                      <span className="flex-c">{o.type === 'dine-in' ? `Table ${tableName(o.tableId)}` : o.type.toUpperCase()}{o.source === 'qr' && <span className="badge badge-purple">QR</span>}{(o.round || 1) > 1 && <span className="badge badge-warn">+ Round {o.round}</span>}</span>
                      <span className="kot-time flex-c"><Timer size={13} /> {mins}m</span>
                    </div>
                    <div className="kot-progress"><div style={{ width: `${Math.min(100, (mins / 15) * 100)}%` }} /></div>
                    <ul>
                      {o.items.map((i, idx) => (
                        <li key={idx} className={`${i.done ? 'done' : ''} ${(o.round || 1) > 1 && i.round === o.round ? 'kot-new' : ''}`}>
                          {c.key === 'ready' ? (
                            <span className="kot-item"><b>{i.qty}×</b> {i.name}</span>
                          ) : (
                            <button className="kot-item kot-check" onClick={() => toggleItem(idx)} title="Tap to mark this item done">
                              <span className="kc-box">{i.done && <Check size={13} strokeWidth={3} />}</span>
                              <span className="kc-text"><b>{i.qty}×</b> {i.name}</span>
                            </button>
                          )}
                          {modsLabel(i.mods) && <div className="kot-mods">{modsLabel(i.mods)}</div>}
                          {i.note && <div className="kot-note"><StickyNote size={12} /> {i.note}</div>}
                        </li>
                      ))}
                    </ul>
                    {c.key !== 'ready' && doneCount > 0 && (
                      <div className="kot-count muted small">{doneCount}/{o.items.length} items done</div>
                    )}
                    <button
                      className={`btn btn-primary btn-block ${allDone && c.key === 'preparing' ? 'btn-glow' : ''}`}
                      onClick={() => {
                        update('orders', o.id, { status: c.next });
                        notify(`#${o.no} → ${c.action}`);
                      }}
                    >
                      {c.action} <ArrowRight size={15} />
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
