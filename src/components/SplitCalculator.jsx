import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, Minus, Plus, Divide, ListChecks } from 'lucide-react';
import { money } from '../utils/helpers';
import { modsLabel } from '../utils/menuOptions';

const COLORS = ['#c08552', '#2f7bd8', '#22a061', '#7c4dc4', '#e38b17', '#dc4a42', '#0f9aa8', '#b5527d'];

/**
 * Bill split tool for friends at a table.
 *  - Equal: total ÷ people
 *  - By item: tap who had each item; shared items are split between everyone.
 * Discounts & GST are shared in proportion to what each person ordered.
 */
export default function SplitCalculator({ items, subtotal, total, cur = '₹', onUse, renderPay }) {
  const [mode, setMode] = useState('equal');
  const [names, setNames] = useState(['Me', 'Friend 2']);
  // one entry per unit: person index, or -1 = shared by everyone
  const units = useMemo(() => items.flatMap((i, k) => Array.from({ length: i.qty }, (_, u) => ({ id: `${k}-${u}`, name: i.name, mods: i.mods, price: i.price }))), [items]);
  const [owner, setOwner] = useState({});
  const n = names.length;

  const setPeople = (count) => {
    const c = Math.max(2, Math.min(8, count));
    setNames((p) => Array.from({ length: c }, (_, k) => p[k] || `Friend ${k + 1}`));
    setOwner((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v < c)));
  };

  const shares = useMemo(() => {
    if (mode === 'equal') {
      const each = Math.floor(total / n);
      return names.map((_, k) => (k === n - 1 ? total - each * (n - 1) : each));
    }
    const sub = Array(n).fill(0);
    units.forEach((u) => {
      const o = owner[u.id] ?? -1;
      if (o < 0) for (let k = 0; k < n; k++) sub[k] += u.price / n; else sub[o] += u.price;
    });
    const base = subtotal || sub.reduce((a, b) => a + b, 0) || 1;
    const raw = sub.map((v) => Math.round((v / base) * total));
    raw[n - 1] += total - raw.reduce((a, b) => a + b, 0); // rounding goes to the last person
    return raw;
  }, [mode, n, names, units, owner, subtotal, total]);

  return (
    <div className="split-calc">
      <div className="sc-head">
        <div className="sc-modes">
          <button className={mode === 'equal' ? 'on' : ''} onClick={() => setMode('equal')}><Divide size={14} /> Equal</button>
          <button className={mode === 'item' ? 'on' : ''} onClick={() => setMode('item')}><ListChecks size={14} /> By item</button>
        </div>
        <div className="sc-people">
          <Users size={15} />
          <button onClick={() => setPeople(n - 1)} aria-label="Fewer people"><Minus size={14} /></button>
          <b>{n}</b>
          <button onClick={() => setPeople(n + 1)} aria-label="More people"><Plus size={14} /></button>
        </div>
      </div>

      {mode === 'item' && (
        <div className="sc-units">
          {units.map((u) => {
            const o = owner[u.id] ?? -1;
            return (
              <div key={u.id} className="sc-unit">
                <span className="grow">{u.name}{modsLabel(u.mods) && <small> · {modsLabel(u.mods)}</small>}<em>{money(u.price, cur)}</em></span>
                <div className="sc-who">
                  <button className={o < 0 ? 'on' : ''} onClick={() => setOwner({ ...owner, [u.id]: -1 })}>All</button>
                  {names.map((nm, k) => (
                    <button key={k} className={o === k ? 'on' : ''} style={o === k ? { background: COLORS[k], borderColor: COLORS[k] } : { borderColor: COLORS[k], color: COLORS[k] }}
                      onClick={() => setOwner({ ...owner, [u.id]: k })} title={nm}>{nm.slice(0, 1).toUpperCase()}{k + 1}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sc-result">
        <AnimatePresence initial={false}>
          {names.map((nm, k) => (
            <motion.div key={k} className="sc-person" layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <span className="sc-dot" style={{ background: COLORS[k] }}>{k + 1}</span>
              <input value={nm} onChange={(e) => setNames(names.map((x, j) => (j === k ? e.target.value : x)))} aria-label={`Name of person ${k + 1}`} />
              <motion.b key={shares[k]} initial={{ scale: 1.25 }} animate={{ scale: 1 }}>{money(shares[k], cur)}</motion.b>
              {renderPay && renderPay(shares[k], nm)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {onUse && <button className="btn btn-primary btn-block" onClick={() => onUse(shares)}>Use this split</button>}
    </div>
  );
}
