import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Modal, Field, StatCard } from '../components/UI';
import DataTable from '../components/DataTable';
import { money, todayStr, inRange } from '../utils/helpers';

const CATS = ['Rent', 'Salary', 'Supplies', 'Utilities', 'Maintenance', 'Marketing', 'Other'];

export default function Expenses() {
  const { state, add, update, remove, notify, cur } = useStore();
  const [edit, setEdit] = useState(null);
  const [range, setRange] = useState('month');
  const [cat, setCat] = useState('All');

  const rows = state.expenses
    .filter((e) => inRange(e.date + 'T12:00:00', range) && (cat === 'All' || e.category === cat))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);

  const byCat = CATS.map((c) => [c, rows.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0)]).filter(([, v]) => v);

  const save = () => {
    if (!(Number(edit.amount) > 0)) return notify('Enter amount', 'danger');
    const data = { ...edit, amount: Number(edit.amount) };
    edit.id ? update('expenses', edit.id, data) : add('expenses', data);
    notify('Expense saved');
    setEdit(null);
  };

  return (
    <div>
      <PageHead title="Expenses" subtitle="Track rent, salaries, supplies and more">
        <button className="btn btn-primary" onClick={() => setEdit({ date: todayStr(), category: 'Supplies', amount: '', note: '' })}>+ Add Expense</button>
      </PageHead>

      <div className="stats">
        <StatCard icon="💸" label="Total" value={money(total, cur)} sub={`${rows.length} entries`} tone="red" />
        {byCat.slice(0, 3).map(([c, v]) => <StatCard key={c} icon="🏷️" label={c} value={money(v, cur)} tone="orange" />)}
      </div>

      <div className="toolbar">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option>All</option>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <DataTable
        rows={rows}
        empty="No expenses in this period"
        columns={[
          { key: 'date', label: 'Date', render: (e) => new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
          { key: 'category', label: 'Category', render: (e) => <span className="badge badge-warn">{e.category}</span> },
          { key: 'note', label: 'Note' },
          { key: 'amount', label: 'Amount', render: (e) => <b>{money(e.amount, cur)}</b> },
        ]}
        actions={(e) => (
          <>
            <button className="btn btn-sm" onClick={() => setEdit(e)}>Edit</button>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => confirm('Delete this expense?') && remove('expenses', e.id)}>✕</button>
          </>
        )}
      />

      {edit && (
        <Modal
          title={edit.id ? 'Edit Expense' : 'Add Expense'}
          onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}
        >
          <div className="grid-2">
            <Field label="Date"><input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
            <Field label="Category">
              <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label={`Amount (${cur})`}><input type="number" autoFocus value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
          <Field label="Note"><input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
