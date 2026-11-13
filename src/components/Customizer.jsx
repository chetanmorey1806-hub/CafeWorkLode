import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Minus, Plus, Check, StickyNote } from 'lucide-react';
import { money } from '../utils/helpers';
import { buildMods, defaultSelection, modsPrice } from '../utils/menuOptions';

/**
 * Drink / food customiser (milk, sugar, add-ons…) with live price.
 * Used by the staff POS and the customer QR menu.
 *   <CustomizerSheet item={menuItem|null} groups={[...]} cur="₹" onAdd={({mods, qty, note}) => …} onClose={…} />
 */
export function CustomizerSheet({ item, ...rest }) {
  return (
    <AnimatePresence>
      {item && <Customizer key={item.id} item={item} {...rest} />}
    </AnimatePresence>
  );
}

function Customizer({ item, groups, cur = '₹', onAdd, onClose }) {
  const [sel, setSel] = useState(() => defaultSelection(groups));
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mods = useMemo(() => buildMods(item, sel, groups.map((g) => ({ ...g, categories: [item.category], exclude: [] }))), [item, sel, groups]);
  const unit = item.price + modsPrice(mods);

  const pick = (g, oid) => setSel((s) => {
    if (g.type === 'single') return { ...s, [g.id]: [oid] };
    const cur = s[g.id] || [];
    return { ...s, [g.id]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
  });

  return (
    <motion.div className="cz-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="cz" role="dialog" aria-modal="true" aria-label={`Customise ${item.name}`}
        initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 60, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
        <div className="cz-head">
          <div>
            <div className="cz-title"><span className={`veg-dot ${item.veg ? 'veg' : 'nonveg'}`} /> {item.name}</div>
            <div className="cz-sub">{money(item.price, cur)} · customise your order</div>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="cz-body">
          {groups.map((g, gi) => (
            <motion.section key={g.id} className="cz-group" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + gi * 0.05 }}>
              <div className="cz-gname">{g.name}<span>{g.type === 'single' ? 'Choose 1' : 'Optional · choose any'}</span></div>
              <div className={`cz-opts ${g.type}`}>
                {g.options.map((o) => {
                  const on = (sel[g.id] || []).includes(o.id);
                  return (
                    <button key={o.id} className={`cz-opt ${on ? 'on' : ''}`} onClick={() => pick(g, o.id)} aria-pressed={on}>
                      {on && g.type === 'single' && <motion.span layoutId={`cz-pill-${g.id}`} className="cz-pill" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                      <span className="cz-check">{on && <Check size={12} strokeWidth={3} />}</span>
                      <span className="cz-oname">{o.name}</span>
                      {o.price > 0 && <span className="cz-oprice">+{money(o.price, cur)}</span>}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          ))}
          <div className="cz-note"><StickyNote size={14} /><input placeholder="Any special request? (optional)" maxLength={100} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>

        <div className="cz-foot">
          <div className="cz-qty">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less"><Minus size={16} /></button>
            <motion.span key={qty} initial={{ scale: 1.4 }} animate={{ scale: 1 }}>{qty}</motion.span>
            <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="More"><Plus size={16} /></button>
          </div>
          <button className="cz-add" onClick={() => onAdd({ mods, qty, note: note.trim() })}>
            Add to order · <motion.b key={unit * qty} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{money(unit * qty, cur)}</motion.b>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
