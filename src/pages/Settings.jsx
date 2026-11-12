import { useRef, useState } from 'react';
import {
  Settings as SettingsIcon, Store, ShieldCheck, Database, Download, Upload, Eraser, RotateCcw,
  Save, Lock, Volume2, Moon, KeyRound,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { PageHead, Field } from '../components/UI';
import { todayStr, chime } from '../utils/helpers';
import { seedData } from '../context/seed';
import { QrSettings, LoyaltySettings } from './SettingsAdvanced';

const Toggle = ({ icon: Icon, title, desc, checked, onChange }) => (
  <div className="pref-row">
    <span className="li-icon"><Icon size={16} /></span>
    <div className="grow">
      <div className="pref-title">{title}</div>
      <div className="muted small">{desc}</div>
    </div>
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  </div>
);

export default function Settings() {
  const { state, set, dispatch, notify, theme, toggleTheme, setLocked } = useStore();
  const [form, setForm] = useState(state.settings);
  const [pin, setPin] = useState({ current: '', next: '' });
  const fileRef = useRef();
  const s = state.settings;

  const save = () => {
    const keys = ['cafeName', 'address', 'phone', 'gstin', 'taxPercent', 'currency', 'dailyTarget', 'footer'];
    const picked = Object.fromEntries(keys.filter((k) => k in form).map((k) => [k, form[k]]));
    set('settings', { ...state.settings, ...picked, taxPercent: Number(form.taxPercent) || 0, dailyTarget: Number(form.dailyTarget) || 0 });
    notify('Settings saved');
  };
  const pref = (patch) => set('settings', { ...s, ...patch });

  const changePin = () => {
    if (pin.current !== String(s.pin)) return notify('Current PIN is wrong', 'danger');
    if (!/^\d{4,6}$/.test(pin.next)) return notify('New PIN must be 4–6 digits', 'danger');
    pref({ pin: pin.next });
    setPin({ current: '', next: '' });
    notify('PIN updated');
  };

  const backup = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = `cafe-backup-${todayStr()}.json`;
    a.click();
  };

  const restore = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.menu || !data.orders) throw new Error();
        dispatch({ type: 'IMPORT', data });
        setForm({ ...seedData().settings, ...data.settings });
        notify('Backup restored');
      } catch {
        notify('Invalid backup file', 'danger');
      }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  const F = (k, label, props = {}) => (
    <Field label={label}><input value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...props} /></Field>
  );

  return (
    <div>
      <PageHead icon={SettingsIcon} title="Settings" subtitle="Cafe details, security, preferences & data" />
      <div className="grid-settings stagger">
        <div className="card">
          <div className="card-head"><h3 className="flex-c"><Store size={17} /> Cafe Details</h3></div>
          {F('cafeName', 'Cafe name')}
          {F('address', 'Address')}
          <div className="grid-2">
            {F('phone', 'Phone')}
            {F('gstin', 'GSTIN (optional)')}
          </div>
          <div className="grid-2">
            {F('taxPercent', 'GST %', { type: 'number', min: 0 })}
            {F('currency', 'Currency symbol', { maxLength: 3 })}
          </div>
          {F('dailyTarget', 'Daily sales target (shown on Dashboard)', { type: 'number', min: 0 })}
          {F('footer', 'Bill footer message')}
          <button className="btn btn-primary mt" onClick={save}><Save size={16} /> Save Settings</button>
        </div>

        <div className="stack-lg">
          <div className="card">
            <div className="card-head"><h3 className="flex-c"><ShieldCheck size={17} /> Security & Preferences</h3></div>
            <Toggle icon={Lock} title="Lock on startup" desc="Ask for PIN when the app opens" checked={!!s.lockEnabled} onChange={(v) => pref({ lockEnabled: v })} />
            <Toggle icon={Volume2} title="Kitchen sounds" desc="Chime on new KOT & ready orders" checked={s.sound !== false} onChange={(v) => { pref({ sound: v }); if (v) chime(); }} />
            <Toggle icon={Moon} title="Dark mode" desc="Easier on the eyes at night" checked={theme === 'dark'} onChange={toggleTheme} />
            <div className="field mt"><span className="flex-c"><KeyRound size={14} /> Change PIN</span></div>
            <div className="row-input">
              <input type="password" inputMode="numeric" placeholder="Current" maxLength={6} value={pin.current} onChange={(e) => setPin({ ...pin, current: e.target.value.replace(/\D/g, '') })} />
              <input type="password" inputMode="numeric" placeholder="New" maxLength={6} value={pin.next} onChange={(e) => setPin({ ...pin, next: e.target.value.replace(/\D/g, '') })} />
              <button className="btn" onClick={changePin}>Update</button>
            </div>
            <button className="btn btn-block mt" onClick={() => setLocked(true)}><Lock size={16} /> Lock now</button>
          </div>

          <div className="card">
            <div className="card-head"><h3 className="flex-c"><Database size={17} /> Data & Backup</h3></div>
            <p className="muted small">All data is stored in this browser. Take regular backups.</p>
            <div className="stack">
              <button className="btn" onClick={backup}><Download size={16} /> Download Backup</button>
              <button className="btn" onClick={() => fileRef.current.click()}><Upload size={16} /> Restore Backup</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={restore} />
              <button className="btn btn-warn" onClick={() => confirm('Delete all orders, expenses & customers? Menu/staff stay.') && (dispatch({ type: 'CLEAR_ALL' }), notify('Transactions cleared'))}>
                <Eraser size={16} /> Clear Transactions
              </button>
              <button className="btn btn-danger-ghost" onClick={() => confirm('Reset EVERYTHING to demo data?') && (dispatch({ type: 'RESET' }), setForm(seedData().settings), notify('Reset to demo data'))}>
                <RotateCcw size={16} /> Reset to Demo Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-settings stagger mt-lg">
        <LoyaltySettings />
        <QrSettings />
      </div>
    </div>
  );
}
