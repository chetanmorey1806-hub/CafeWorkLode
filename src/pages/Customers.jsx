import { History, Pencil, Phone, Plus, Search, Star, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Modal, Field, SearchInput } from '../components/UI';
import DataTable from '../components/DataTable';
import { money, orderTotals, fmtDateTime } from '../utils/helpers';

const blank = { name: '', phone: '', email: '', visits: 0, totalSpent: 0, points: 0 };

export default function Customers() {
  const { state, add, update, remove, notify, cur } = useStore();
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const [q, setQ] = useState('');

  const rows = state.customers
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const save = () => {
    if (!edit.name.trim() || !/^\d{10}$/.test(edit.phone)) return notify('Enter name & 10-digit phone', 'danger');
    if (state.customers.some((c) => c.phone === edit.phone && c.id !== edit.id)) return notify('Phone already exists', 'danger');
    edit.id ? update('customers', edit.id, edit) : add('customers', { ...edit, name: edit.name.trim() });
    notify('Customer saved');
    setEdit(null);
  };

  const history = view ? state.orders.filter((o) => o.customerId === view.id && o.status === 'paid').reverse() : [];

  return (
    <div>
      <PageHead icon={Users} title="Customers" subtitle={`${state.customers.length} customers · 1 point per ${cur}100 spent`}>
        <button className="btn btn-primary" onClick={() => setEdit(blank)}><Plus size={16} /> Add Customer</button>
      </PageHead>
      <div className="toolbar">
        <SearchInput icon={Search} className="search" placeholder="Search name / phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <DataTable
        rows={rows}
        empty="No customers yet"
        columns={[
          { key: 'name', label: 'Name', render: (c) => <b>{c.name}</b> },
          { key: 'phone', label: 'Phone', render: (c) => <a className="flex-c" href={`tel:${c.phone}`}><Phone size={13} /> {c.phone}</a> },
          { key: 'visits', label: 'Visits' },
          { key: 'totalSpent', label: 'Total Spent', render: (c) => money(c.totalSpent, cur) },
          { key: 'points', label: 'Points', render: (c) => <span className="badge badge-purple flex-c"><Star size={11} fill="currentColor" /> {c.points}</span> },
        ]}
        actions={(c) => (
          <>
            <button className="btn btn-sm" onClick={() => setView(c)}><History size={13} /> History</button>
            <button className="btn btn-sm" onClick={() => setEdit(c)}><Pencil size={13} /> Edit</button>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => confirm(`Delete ${c.name}?`) && remove('customers', c.id)} title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      {edit && (
        <Modal
          title={edit.id ? 'Edit Customer' : 'Add Customer'}
          onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}
        >
          <Field label="Name"><input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Phone"><input inputMode="numeric" maxLength={10} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Email (optional)"><input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
        </Modal>
      )}

      {view && (
        <Modal title={`${view.name} — Order History`} onClose={() => setView(null)}>
          {!history.length ? <p className="muted">No orders linked yet.</p> : (
            <ul className="simple-list">
              {history.map((o) => (
                <li key={o.id}>
                  <span className="grow"><b>#{o.no}</b> <span className="muted small">{fmtDateTime(o.paidAt)}</span>
                    <div className="small muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                  </span>
                  <b>{money(orderTotals(o).total, cur)}</b>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
