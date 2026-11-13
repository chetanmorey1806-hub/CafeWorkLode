import { useState } from 'react';
import { PartyPopper, Tag, Save, Plus, Trash2, Settings2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Field } from '../components/UI';
import { offersOf, activeHappyHour } from '../utils/offers';
import { uid } from '../utils/helpers';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Happy hours (time-based auto discount) and promo codes */
export function OffersSettings() {
  const { state, set, notify, cur } = useStore();
  const [O, setO] = useState(() => JSON.parse(JSON.stringify(offersOf(state.settings))));
  const hh = (k, patch) => setO({ ...O, happyHours: O.happyHours.map((h, j) => (j === k ? { ...h, ...patch } : h)) });
  const pr = (k, patch) => setO({ ...O, promos: O.promos.map((p, j) => (j === k ? { ...p, ...patch } : p)) });
  const now = activeHappyHour(state.settings);

  const save = () => {
    const codes = O.promos.map((p) => p.code.trim().toUpperCase()).filter(Boolean);
    if (new Set(codes).size !== codes.length) return notify('Two promo codes have the same name', 'danger');
    const clean = {
      happyHours: O.happyHours.map((h) => ({ ...h, name: h.name.trim() || 'Happy Hours', percent: Math.min(90, Math.max(0, Number(h.percent) || 0)) })),
      promos: O.promos.filter((p) => p.code.trim()).map((p) => ({
        ...p, code: p.code.trim().toUpperCase(), value: Number(p.value) || 0, minOrder: Number(p.minOrder) || 0, max: Number(p.max) || 0,
      })),
    };
    set('settings', { ...state.settings, offers: clean });
    setO(clean);
    notify('Offers saved');
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="flex-c"><PartyPopper size={17} /> Happy Hours & Promo Codes</h3>
        {now && <span className="badge badge-ok badge-dot">{now.name} live now</span>}
      </div>

      <div className="field"><span>Happy hours — discount applied automatically during these times</span></div>
      {O.happyHours.map((h, k) => (
        <div className="plan-edit" key={h.id}>
          <div className="row-input">
            <input value={h.name} onChange={(e) => hh(k, { name: e.target.value })} placeholder="Name" />
            <label className="switch" title="Active"><input type="checkbox" checked={h.active} onChange={(e) => hh(k, { active: e.target.checked })} /><span /></label>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => setO({ ...O, happyHours: O.happyHours.filter((_, j) => j !== k) })}><Trash2 size={13} /></button>
          </div>
          <div className="grid-3">
            <Field label="From"><input type="time" value={h.start} onChange={(e) => hh(k, { start: e.target.value })} /></Field>
            <Field label="To"><input type="time" value={h.end} onChange={(e) => hh(k, { end: e.target.value })} /></Field>
            <Field label="% off"><input type="number" min="0" max="90" value={h.percent} onChange={(e) => hh(k, { percent: e.target.value })} /></Field>
          </div>
          <div className="pair-chips">
            {DAYS.map((d, i) => {
              const on = h.days.includes(i);
              return <button key={d} className={`chip ${on ? 'active' : ''}`} onClick={() => hh(k, { days: on ? h.days.filter((x) => x !== i) : [...h.days, i].sort() })}>{d}</button>;
            })}
          </div>
          <div className="pair-chips">
            <span className="muted small">Applies to:</span>
            {state.categories.map((c) => {
              const on = (h.categories || []).includes(c);
              return <button key={c} className={`chip ${on ? 'active' : ''}`} onClick={() => hh(k, { categories: on ? h.categories.filter((x) => x !== c) : [...(h.categories || []), c] })}>{c}</button>;
            })}
            {!(h.categories || []).length && <span className="muted small">everything</span>}
          </div>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => setO({ ...O, happyHours: [...O.happyHours, { id: uid(), name: 'Happy Hours', days: [1, 2, 3, 4, 5], start: '16:00', end: '18:00', percent: 10, categories: [], active: true }] })}>
        <Plus size={13} /> Add happy hour
      </button>

      <div className="field mt"><span className="flex-c"><Tag size={14} /> Promo codes</span></div>
      <div className="promo-edit">
        <div className="promo-row-edit muted small"><span>Code</span><span>Type</span><span>Value</span><span>Min order</span><span>Max off</span><span /></div>
        {O.promos.map((p, k) => (
          <div className="promo-row-edit" key={k}>
            <input value={p.code} onChange={(e) => pr(k, { code: e.target.value.toUpperCase() })} />
            <select value={p.type} onChange={(e) => pr(k, { type: e.target.value })}>
              <option value="flat">{cur} off</option>
              <option value="percent">% off</option>
            </select>
            <input type="number" value={p.value} onChange={(e) => pr(k, { value: e.target.value })} />
            <input type="number" value={p.minOrder} onChange={(e) => pr(k, { minOrder: e.target.value })} />
            <input type="number" value={p.max} placeholder="—" onChange={(e) => pr(k, { max: e.target.value })} title="0 = no limit" />
            <span className="flex-c">
              <label className="switch" title="Active"><input type="checkbox" checked={p.active} onChange={(e) => pr(k, { active: e.target.checked })} /><span /></label>
              <button className="btn btn-sm btn-danger-ghost" onClick={() => setO({ ...O, promos: O.promos.filter((_, j) => j !== k) })}><Trash2 size={13} /></button>
            </span>
            <input className="promo-desc" placeholder="Description shown to customers" value={p.desc || ''} onChange={(e) => pr(k, { desc: e.target.value })} />
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => setO({ ...O, promos: [...O.promos, { code: '', type: 'flat', value: 50, minOrder: 0, max: 0, active: true, desc: '' }] })}><Plus size={13} /> Add promo code</button>
      </div>

      <button className="btn btn-primary btn-block mt" onClick={save}><Save size={16} /> Save offers</button>
    </div>
  );
}

/** Customisation options (milk, sugar, add-ons…) */
export function ModifiersSettings() {
  const { state, set, notify, cur } = useStore();
  const [G, setG] = useState(() => JSON.parse(JSON.stringify(state.modifiers || [])));
  const g = (k, patch) => setG(G.map((x, j) => (j === k ? { ...x, ...patch } : x)));
  const opt = (k, i, patch) => g(k, { options: G[k].options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  const save = () => {
    const clean = G.filter((x) => x.name.trim() && x.options.length).map((x) => ({
      ...x, name: x.name.trim(),
      options: x.options.filter((o) => o.name.trim()).map((o) => ({ ...o, name: o.name.trim(), price: Number(o.price) || 0 })),
      defaultId: x.type === 'single' ? (x.options.find((o) => o.id === x.defaultId) ? x.defaultId : x.options[0]?.id) : undefined,
    }));
    set('modifiers', clean);
    setG(clean);
    notify('Customisation options saved');
  };

  return (
    <div className="card">
      <div className="card-head"><h3 className="flex-c"><Settings2 size={17} /> Item Customisation</h3></div>
      <p className="muted small">Options customers choose when ordering (e.g. milk type, sugar level, add-ons). Extra prices are added automatically.</p>
      {G.map((x, k) => (
        <div className="plan-edit" key={x.id}>
          <div className="row-input">
            <input value={x.name} placeholder="Group name (e.g. Milk)" onChange={(e) => g(k, { name: e.target.value })} />
            <select value={x.type} onChange={(e) => g(k, { type: e.target.value })}>
              <option value="single">Choose one</option>
              <option value="multi">Choose any</option>
            </select>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => setG(G.filter((_, j) => j !== k))}><Trash2 size={13} /></button>
          </div>
          <div className="pair-chips">
            <span className="muted small">For:</span>
            {state.categories.map((c) => {
              const on = x.categories.includes(c);
              return <button key={c} className={`chip ${on ? 'active' : ''}`} onClick={() => g(k, { categories: on ? x.categories.filter((y) => y !== c) : [...x.categories, c] })}>{c}</button>;
            })}
          </div>
          {x.options.map((o, i) => (
            <div className="row-input mod-opt" key={o.id}>
              {x.type === 'single' && (
                <input type="radio" name={`def-${x.id}`} title="Default choice" checked={(x.defaultId || x.options[0]?.id) === o.id} onChange={() => g(k, { defaultId: o.id })} />
              )}
              <input value={o.name} placeholder="Option" onChange={(e) => opt(k, i, { name: e.target.value })} />
              <input type="number" value={o.price} title={`Extra price (${cur})`} onChange={(e) => opt(k, i, { price: e.target.value })} />
              <button className="btn btn-sm btn-danger-ghost" onClick={() => g(k, { options: x.options.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => g(k, { options: [...x.options, { id: uid(), name: '', price: 0 }] })}><Plus size={13} /> Add option</button>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => setG([...G, { id: uid(), name: '', type: 'single', categories: [], exclude: [], options: [{ id: uid(), name: '', price: 0 }] }])}><Plus size={13} /> Add group</button>
      <button className="btn btn-primary btn-block mt" onClick={save}><Save size={16} /> Save customisation</button>
    </div>
  );
}
