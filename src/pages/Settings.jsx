import { useRef, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Field } from '../components/UI';
import { todayStr } from '../utils/helpers';
import { seedData } from '../context/seed';

export default function Settings() {
  const { state, set, dispatch, notify } = useStore();
  const [form, setForm] = useState(state.settings);
  const fileRef = useRef();

  const save = () => {
    set('settings', { ...form, taxPercent: Number(form.taxPercent) || 0 });
    notify('Settings saved');
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
        setForm(data.settings);
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
      <PageHead title="Settings" subtitle="Cafe details, billing & data" />
      <div className="grid-settings">
        <div className="card">
          <div className="card-head"><h3>🏪 Cafe Details</h3></div>
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
          {F('footer', 'Bill footer message')}
          <button className="btn btn-primary mt" onClick={save}>Save Settings</button>
        </div>

        <div className="card">
          <div className="card-head"><h3>💾 Data & Backup</h3></div>
          <p className="muted small">All data is stored in this browser. Take regular backups.</p>
          <div className="stack">
            <button className="btn" onClick={backup}>⬇️ Download Backup</button>
            <button className="btn" onClick={() => fileRef.current.click()}>⬆️ Restore Backup</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={restore} />
            <button className="btn btn-warn" onClick={() => confirm('Delete all orders, expenses & customers? Menu/staff stay.') && (dispatch({ type: 'CLEAR_ALL' }), notify('Transactions cleared'))}>
              🧹 Clear Transactions
            </button>
            <button className="btn btn-danger-ghost" onClick={() => confirm('Reset EVERYTHING to demo data?') && (dispatch({ type: 'RESET' }), setForm(seedData().settings), notify('Reset to demo data'))}>
              ♻️ Reset to Demo Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
