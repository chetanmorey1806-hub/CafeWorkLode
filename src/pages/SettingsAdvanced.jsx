import { useState } from 'react';
import { QrCode, Gift, Save, Plus, Trash2, Crown, Coffee, Ticket, BellRing, Wifi, WifiOff, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Field } from '../components/UI';
import { loyaltyOf } from '../utils/loyalty';
import { uid } from '../utils/helpers';

/** QR ordering, UPI and notifications */
export function QrSettings() {
  const { state, set, notify, conn } = useStore();
  const s = state.settings;
  const [f, setF] = useState({ upiId: s.upiId || '', upiName: s.upiName || '', publicUrl: s.publicUrl || '' });

  const save = () => {
    if (f.upiId && !/^[\w.-]+@[\w.-]+$/.test(f.upiId)) return notify('UPI ID looks wrong (example: cafe@okaxis)', 'danger');
    set('settings', { ...state.settings, ...f, publicUrl: f.publicUrl.trim().replace(/\/+$/, '') });
    notify('QR ordering settings saved');
  };

  const toggleDesktop = async (on) => {
    if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return notify('Browser blocked notifications', 'danger');
    }
    set('settings', { ...state.settings, desktopAlerts: on });
  };

  return (
    <div className="card">
      <div className="card-head"><h3 className="flex-c"><QrCode size={17} /> QR Ordering & Payments</h3></div>
      <div className={`server-status conn-${conn}`}>
        {conn === 'online' ? <Wifi size={16} /> : <WifiOff size={16} />}
        <div>
          <b>{conn === 'online' ? 'Server connected — live sync on' : 'Server not connected'}</b>
          <div className="small">
            {conn === 'online'
              ? 'QR orders, kitchen screen & billing update instantly on every device.'
              : <>Run <code>npm start</code> on the café computer to enable QR ordering and multi-device sync.</>}
          </div>
        </div>
      </div>
      <div className="grid-2 mt">
        <Field label="UPI ID (for customer payments)"><input placeholder="cafe@okaxis" value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value.trim() })} /></Field>
        <Field label="UPI payee name"><input value={f.upiName} onChange={(e) => setF({ ...f, upiName: e.target.value })} /></Field>
      </div>
      <Field label="Public website address (optional, once hosted online)">
        <input placeholder="https://order.mycafe.com" value={f.publicUrl} onChange={(e) => setF({ ...f, publicUrl: e.target.value })} />
      </Field>
      <div className="pref-row">
        <span className="li-icon"><BellRing size={16} /></span>
        <div className="grow"><div className="pref-title">Desktop notifications</div><div className="muted small">New QR orders & low-stock alerts, even when the tab is in the background</div></div>
        <label className="switch"><input type="checkbox" checked={!!s.desktopAlerts} onChange={(e) => toggleDesktop(e.target.checked)} /><span /></label>
      </div>
      <button className="btn btn-primary mt" onClick={save}><Save size={16} /> Save</button>
    </div>
  );
}

/** Points, stamp card, tiers and subscription plans */
export function LoyaltySettings() {
  const { state, set, notify, cur } = useStore();
  const [L, setL] = useState(() => JSON.parse(JSON.stringify(loyaltyOf(state.settings))));
  const upd = (patch) => setL({ ...L, ...patch });
  const tier = (k, patch) => upd({ tiers: L.tiers.map((t, j) => (j === k ? { ...t, ...patch } : t)) });
  const plan = (k, patch) => upd({ plans: L.plans.map((p, j) => (j === k ? { ...p, ...patch } : p)) });

  const save = () => {
    const clean = {
      ...L,
      pointsPer: Math.max(1, Number(L.pointsPer) || 100),
      stampEvery: Math.max(2, Number(L.stampEvery) || 5),
      tiers: L.tiers.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim(), min: Number(t.min) || 0, discount: Math.min(50, Number(t.discount) || 0) })).sort((a, b) => a.min - b.min),
      plans: L.plans.filter((p) => p.name.trim()).map((p) => ({ ...p, name: p.name.trim(), price: Number(p.price) || 0, days: Math.max(1, Number(p.days) || 30), maxPrice: Number(p.maxPrice) || 0 })),
    };
    set('settings', { ...state.settings, loyalty: clean });
    setL(clean);
    notify('Loyalty settings saved');
  };

  return (
    <div className="card">
      <div className="card-head"><h3 className="flex-c"><Gift size={17} /> Loyalty & Rewards</h3></div>

      <div className="grid-2">
        <Field label={<span className="flex-c"><Star size={13} /> 1 point for every ({cur})</span>}>
          <input type="number" min="1" value={L.pointsPer} onChange={(e) => upd({ pointsPer: e.target.value })} />
        </Field>
        <Field label={<span className="flex-c"><Coffee size={13} /> Stamp card: buy N, get 1 free</span>}>
          <input type="number" min="2" value={L.stampEvery} onChange={(e) => upd({ stampEvery: e.target.value })} />
        </Field>
      </div>
      <Field label="Stamps are earned on">
        <div className="pair-chips">
          {state.categories.map((c) => {
            const on = L.stampCategories.includes(c);
            return <button key={c} className={`chip ${on ? 'active' : ''}`} onClick={() => upd({ stampCategories: on ? L.stampCategories.filter((x) => x !== c) : [...L.stampCategories, c] })}>{c}</button>;
          })}
        </div>
      </Field>

      <div className="field"><span className="flex-c"><Crown size={14} /> Membership tiers (by lifetime spend)</span></div>
      <div className="tier-edit">
        <div className="tier-row muted small"><span>Name</span><span>From ({cur})</span><span>Discount %</span><span /></div>
        {L.tiers.map((t, k) => (
          <div className="tier-row" key={k}>
            <input value={t.name} onChange={(e) => tier(k, { name: e.target.value })} />
            <input type="number" value={t.min} onChange={(e) => tier(k, { min: e.target.value })} />
            <input type="number" value={t.discount} onChange={(e) => tier(k, { discount: e.target.value })} />
            <button className="btn btn-sm btn-danger-ghost" onClick={() => upd({ tiers: L.tiers.filter((_, j) => j !== k) })}><Trash2 size={13} /></button>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => upd({ tiers: [...L.tiers, { name: '', min: 0, discount: 0 }] })}><Plus size={13} /> Add tier</button>
      </div>
      <div className="pref-row">
        <div className="grow"><div className="pref-title">Apply tier discount automatically</div><div className="muted small">Cashier can still switch it off per bill</div></div>
        <label className="switch"><input type="checkbox" checked={!!L.tierDiscountAuto} onChange={(e) => upd({ tierDiscountAuto: e.target.checked })} /><span /></label>
      </div>

      <div className="field mt"><span className="flex-c"><Ticket size={14} /> Subscription plans</span></div>
      {L.plans.map((p, k) => (
        <div className="plan-edit" key={p.id}>
          <input placeholder="Plan name" value={p.name} onChange={(e) => plan(k, { name: e.target.value })} />
          <div className="grid-3">
            <Field label={`Price (${cur})`}><input type="number" value={p.price} onChange={(e) => plan(k, { price: e.target.value })} /></Field>
            <Field label="Days"><input type="number" value={p.days} onChange={(e) => plan(k, { days: e.target.value })} /></Field>
            <Field label={`Max item price (${cur})`}><input type="number" value={p.maxPrice} onChange={(e) => plan(k, { maxPrice: e.target.value })} /></Field>
          </div>
          <div className="row-input">
            <select value={p.category} onChange={(e) => plan(k, { category: e.target.value })}>
              {state.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => upd({ plans: L.plans.filter((_, j) => j !== k) })}><Trash2 size={13} /> Remove</button>
          </div>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => upd({ plans: [...L.plans, { id: uid(), name: '', price: 999, days: 30, maxPrice: 160, category: state.categories[0] || 'Coffee' }] })}><Plus size={13} /> Add plan</button>

      <button className="btn btn-primary btn-block mt" onClick={save}><Save size={16} /> Save loyalty settings</button>
    </div>
  );
}
