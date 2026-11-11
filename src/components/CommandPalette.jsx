import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, Plus, Moon, Lock, Receipt, CornerRightDown } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { NAV } from './nav';
import { ACTIVE_STATUSES, money, orderTotals } from '../utils/helpers';

export default function CommandPalette({ onClose, onLock }) {
  const { state, toggleTheme, cur } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef();
  const listRef = useRef();

  useEffect(() => inputRef.current?.focus(), []);

  const items = useMemo(() => {
    const go = (to) => () => nav(to);
    const all = [
      { section: 'Actions', icon: Plus, label: 'New order', hint: 'POS', run: go('/pos') },
      { section: 'Actions', icon: Moon, label: 'Toggle dark mode', run: toggleTheme },
      { section: 'Actions', icon: Lock, label: 'Lock screen', run: onLock },
      ...NAV.map((n) => ({ section: 'Pages', icon: n.icon, label: n.label, run: go(n.to) })),
      ...state.orders
        .filter((o) => ACTIVE_STATUSES.includes(o.status))
        .map((o) => ({
          section: 'Running orders', icon: Receipt,
          label: `Order #${o.no}${o.customerName ? ' · ' + o.customerName : ''}`,
          hint: money(orderTotals(o).total, cur), run: go(`/pos/${o.id}`),
        })),
      ...state.tables.map((t) => ({ section: 'Tables', icon: CornerRightDown, label: `Table ${t.name}`, hint: `${t.seats} seats`, run: go(`/pos?table=${t.id}`) })),
    ];
    const s = q.trim().toLowerCase();
    return s ? all.filter((i) => i.label.toLowerCase().includes(s) || i.section.toLowerCase().includes(s)) : all;
  }, [q, state.orders, state.tables, nav, toggleTheme, onLock, cur]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.cp-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (i) => { onClose(); i?.run(); };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') run(items[sel]);
    else if (e.key === 'Escape') onClose();
  };

  let lastSection = null;
  return (
    <div className="cp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cp">
        <div className="cp-input">
          <Search size={18} />
          <input ref={inputRef} placeholder="Type a command or search…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          <kbd>Esc</kbd>
        </div>
        <div className="cp-list" ref={listRef}>
          {!items.length && <div className="cp-empty">No results for “{q}”</div>}
          {items.map((i, idx) => {
            const head = i.section !== lastSection ? (lastSection = i.section) : null;
            return (
              <div key={idx}>
                {head && <div className="cp-section">{head}</div>}
                <button className={`cp-item ${idx === sel ? 'active' : ''}`} onMouseEnter={() => setSel(idx)} onClick={() => run(i)}>
                  <i.icon size={16} />
                  <span className="grow">{i.label}</span>
                  {i.hint && <span className="cp-hint">{i.hint}</span>}
                  {idx === sel && <CornerDownLeft size={14} className="cp-enter" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
