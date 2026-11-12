import { Armchair, Check, Pencil, Plus, Settings2, Trash2, Users, QrCode, Smartphone } from 'lucide-react';
import QrCodesModal from '../components/QrCodes';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { PageHead, Modal, Field, StatusBadge } from '../components/UI';
import { money, orderTotals, minutesAgo, ACTIVE_STATUSES } from '../utils/helpers';

export default function Tables() {
  const { state, add, update, remove, notify, cur } = useStore();
  const nav = useNavigate();
  const [edit, setEdit] = useState(null);
  const [manage, setManage] = useState(false);
  const [qr, setQr] = useState(false);

  const activeFor = (tid) => state.orders.find((o) => o.tableId === tid && ACTIVE_STATUSES.includes(o.status));

  const save = () => {
    if (!edit.name.trim()) return notify('Name required', 'danger');
    const data = { name: edit.name.trim(), seats: Number(edit.seats) || 2 };
    edit.id ? update('tables', edit.id, data) : add('tables', data);
    notify('Table saved');
    setEdit(null);
  };

  const del = (t) => {
    if (activeFor(t.id)) return notify('Table has a running order', 'danger');
    if (confirm(`Delete table ${t.name}?`)) remove('tables', t.id);
  };

  const free = state.tables.filter((t) => !activeFor(t.id)).length;

  return (
    <div>
      <PageHead icon={Armchair} title="Tables" subtitle={`${free} free · ${state.tables.length - free} occupied`}>
        <button className={`btn ${manage ? 'btn-primary' : ''}`} onClick={() => setManage(!manage)}>
          {manage ? <><Check size={16} /> Done</> : <><Settings2 size={16} /> Manage</>}
        </button>
        <button className="btn" onClick={() => setQr(true)}><QrCode size={16} /> QR Codes</button>
        <button className="btn btn-primary" onClick={() => setEdit({ name: '', seats: 4 })}><Plus size={16} /> Add Table</button>
      </PageHead>
      {qr && <QrCodesModal onClose={() => setQr(false)} />}

      <div className="table-grid stagger">
        {state.tables.map((t) => {
          const o = activeFor(t.id);
          return (
            <div key={t.id} className={`table-tile ${o ? 'busy' : 'free'}`}>
              <button className="tt-main" onClick={() => nav(o ? `/pos/${o.id}` : `/pos?table=${t.id}`)}>
                <div className="tt-name">{t.name}</div>{o && <span className="tt-pulse" />}
                <div className="tt-seats flex-c"><Users size={13} /> {t.seats} seats</div>
                {o ? (
                  <>
                    <div className="tt-amt">{money(orderTotals(o).total, cur)}</div>
                    <div className="tt-info flex-c">#{o.no} · {minutesAgo(o.createdAt)}m{o.source === 'qr' && <span className="badge badge-purple"><Smartphone size={11} /> QR</span>}</div>
                    <StatusBadge status={o.status} />
                  </>
                ) : (
                  <div className="tt-free flex-c"><Plus size={14} /> Available</div>
                )}
              </button>
              {manage && (
                <div className="tt-manage">
                  <button className="btn btn-sm" onClick={() => setEdit(t)}><Pencil size={13} /> Edit</button>
                  <button className="btn btn-sm btn-danger-ghost" onClick={() => del(t)}><Trash2 size={13} /> Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {edit && (
        <Modal
          title={edit.id ? 'Edit Table' : 'Add Table'}
          onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}
        >
          <Field label="Table name"><input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Seats"><input type="number" min="1" value={edit.seats} onChange={(e) => setEdit({ ...edit, seats: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
