import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Modal, Field, StatCard } from '../components/UI';
import DataTable from '../components/DataTable';
import { money, todayStr } from '../utils/helpers';

const ROLES = ['Manager', 'Cashier', 'Chef', 'Waiter', 'Helper', 'Delivery'];
const blank = { name: '', role: 'Waiter', phone: '', salary: '', active: true, attendance: {} };

export default function Staff() {
  const { state, add, update, remove, notify, cur } = useStore();
  const [edit, setEdit] = useState(null);
  const [date, setDate] = useState(todayStr());

  const save = () => {
    if (!edit.name.trim()) return notify('Name required', 'danger');
    const data = { ...edit, name: edit.name.trim(), salary: Number(edit.salary) || 0 };
    edit.id ? update('staff', edit.id, data) : add('staff', data);
    notify('Staff saved');
    setEdit(null);
  };

  const mark = (s, val) => update('staff', s.id, { attendance: { ...s.attendance, [date]: val } });

  const active = state.staff.filter((s) => s.active);
  const present = active.filter((s) => s.attendance?.[date] === 'present').length;
  const payroll = active.reduce((sum, s) => sum + s.salary, 0);

  // Days present this month
  const monthKey = date.slice(0, 7);
  const monthPresent = (s) =>
    Object.entries(s.attendance || {}).filter(([d, v]) => d.startsWith(monthKey) && v === 'present').length;

  return (
    <div>
      <PageHead title="Staff" subtitle="Employees, roles & attendance">
        <button className="btn btn-primary" onClick={() => setEdit(blank)}>+ Add Staff</button>
      </PageHead>

      <div className="stats">
        <StatCard icon="🧑‍💼" label="Active Staff" value={active.length} tone="blue" />
        <StatCard icon="✅" label={`Present (${date === todayStr() ? 'today' : date})`} value={`${present}/${active.length}`} tone="green" />
        <StatCard icon="💵" label="Monthly Payroll" value={money(payroll, cur)} tone="orange" />
      </div>

      <div className="toolbar">
        <Field label="Attendance date">
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <DataTable
        rows={state.staff}
        columns={[
          { key: 'name', label: 'Name', render: (s) => <><b>{s.name}</b>{!s.active && <span className="badge badge-muted ml">Inactive</span>}</> },
          { key: 'role', label: 'Role', render: (s) => <span className="badge badge-info">{s.role}</span> },
          { key: 'phone', label: 'Phone', render: (s) => <a href={`tel:${s.phone}`}>{s.phone}</a> },
          { key: 'salary', label: 'Salary', render: (s) => money(s.salary, cur) },
          { key: 'month', label: 'Days (month)', render: (s) => monthPresent(s) },
          {
            key: 'att', label: 'Attendance',
            render: (s) => (
              <div className="seg seg-mini">
                {[['present', 'P'], ['half', 'H'], ['absent', 'A']].map(([k, l]) => (
                  <button key={k} className={`seg-btn att-${k} ${s.attendance?.[date] === k ? 'active' : ''}`} onClick={() => mark(s, k)} disabled={!s.active}>{l}</button>
                ))}
              </div>
            ),
          },
        ]}
        actions={(s) => (
          <>
            <button className="btn btn-sm" onClick={() => setEdit(s)}>Edit</button>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => confirm(`Delete ${s.name}?`) && remove('staff', s.id)}>✕</button>
          </>
        )}
      />

      {edit && (
        <Modal
          title={edit.id ? 'Edit Staff' : 'Add Staff'}
          onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}
        >
          <Field label="Full name"><input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <div className="grid-2">
            <Field label="Role">
              <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Phone"><input inputMode="numeric" maxLength={10} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value.replace(/\D/g, '') })} /></Field>
          </div>
          <div className="grid-2">
            <Field label={`Monthly salary (${cur})`}><input type="number" value={edit.salary} onChange={(e) => setEdit({ ...edit, salary: e.target.value })} /></Field>
            <Field label="Status">
              <select value={edit.active ? 'y' : 'n'} onChange={(e) => setEdit({ ...edit, active: e.target.value === 'y' })}>
                <option value="y">Active</option>
                <option value="n">Inactive</option>
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
