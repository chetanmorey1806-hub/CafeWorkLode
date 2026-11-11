import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, IndianRupee, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Modal, Field, StatCard, SearchInput } from '../components/UI';
import DataTable from '../components/DataTable';
import { money, todayStr } from '../utils/helpers';

const blank = { name: '', unit: 'kg', qty: '', minQty: '', cost: '' };

export default function Inventory() {
  const { state, add, update, remove, notify, cur } = useStore();
  const [edit, setEdit] = useState(null);
  const [stock, setStock] = useState(null); // { item, mode: 'in'|'out', qty, addExpense }
  const [q, setQ] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const rows = state.inventory.filter(
    (i) => i.name.toLowerCase().includes(q.toLowerCase()) && (!onlyLow || i.qty <= i.minQty),
  );
  const low = state.inventory.filter((i) => i.qty <= i.minQty).length;
  const value = state.inventory.reduce((s, i) => s + i.qty * i.cost, 0);

  const save = () => {
    if (!edit.name.trim()) return notify('Name required', 'danger');
    const data = { ...edit, name: edit.name.trim(), qty: Number(edit.qty) || 0, minQty: Number(edit.minQty) || 0, cost: Number(edit.cost) || 0 };
    edit.id ? update('inventory', edit.id, data) : add('inventory', data);
    notify('Item saved');
    setEdit(null);
  };

  const applyStock = () => {
    const n = Number(stock.qty);
    if (!(n > 0)) return notify('Enter quantity', 'danger');
    const { item, mode } = stock;
    const newQty = mode === 'in' ? item.qty + n : Math.max(0, item.qty - n);
    update('inventory', item.id, { qty: +newQty.toFixed(3) });
    if (mode === 'in' && stock.addExpense && item.cost) {
      add('expenses', { date: todayStr(), category: 'Supplies', amount: +(n * item.cost).toFixed(2), note: `Stock: ${n} ${item.unit} ${item.name}` });
    }
    notify(`${item.name}: ${mode === 'in' ? '+' : '−'}${n} ${item.unit}`);
    setStock(null);
  };

  return (
    <div>
      <PageHead icon={Package} title="Inventory" subtitle="Track raw material & supplies">
        <button className="btn btn-primary" onClick={() => setEdit(blank)}><Plus size={16} /> Add Item</button>
      </PageHead>

      <div className="stats stagger">
        <StatCard icon={Package} label="Total Items" value={state.inventory.length} tone="blue" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={low} tone="red" />
        <StatCard icon={IndianRupee} label="Stock Value" value={value} format={(v) => money(Math.round(v), cur)} tone="green" />
      </div>

      <div className="toolbar">
        <SearchInput icon={Search} className="search" placeholder="Search stock" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Low stock only</label>
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: 'name', label: 'Item', render: (i) => <b>{i.name}</b> },
          {
            key: 'qty', label: 'Stock',
            render: (i) => <span className={`badge ${i.qty <= i.minQty ? 'badge-danger' : 'badge-ok'}`}>{i.qty} {i.unit}</span>,
          },
          { key: 'minQty', label: 'Min level', render: (i) => `${i.minQty} ${i.unit}` },
          { key: 'cost', label: 'Cost / unit', render: (i) => money(i.cost, cur) },
        ]}
        actions={(i) => (
          <>
            <button className="btn btn-sm btn-success" onClick={() => setStock({ item: i, mode: 'in', qty: '', addExpense: true })} title="Stock in"><ArrowDownToLine size={13} /> In</button>
            <button className="btn btn-sm btn-warn" onClick={() => setStock({ item: i, mode: 'out', qty: '' })} title="Stock used"><ArrowUpFromLine size={13} /> Use</button>
            <button className="btn btn-sm" onClick={() => setEdit(i)}><Pencil size={13} /> Edit</button>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => confirm(`Delete ${i.name}?`) && remove('inventory', i.id)} title="Delete"><Trash2 size={14} /></button>
          </>
        )}
      />

      {edit && (
        <Modal
          title={edit.id ? 'Edit Inventory Item' : 'Add Inventory Item'}
          onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}
        >
          <Field label="Name"><input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <div className="grid-2">
            <Field label="Unit">
              <select value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })}>
                {['kg', 'g', 'L', 'ml', 'pcs', 'pkt', 'box', 'dozen'].map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label={`Cost per unit (${cur})`}><input type="number" value={edit.cost} onChange={(e) => setEdit({ ...edit, cost: e.target.value })} /></Field>
          </div>
          <div className="grid-2">
            <Field label="Current qty"><input type="number" value={edit.qty} onChange={(e) => setEdit({ ...edit, qty: e.target.value })} /></Field>
            <Field label="Min qty (alert)"><input type="number" value={edit.minQty} onChange={(e) => setEdit({ ...edit, minQty: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      {stock && (
        <Modal
          title={`${stock.mode === 'in' ? 'Stock In' : 'Stock Used'} · ${stock.item.name}`}
          onClose={() => setStock(null)}
          footer={<><button className="btn" onClick={() => setStock(null)}>Cancel</button><button className="btn btn-primary" onClick={applyStock}>Update</button></>}
        >
          <p className="muted">Current: {stock.item.qty} {stock.item.unit}</p>
          <Field label={`Quantity (${stock.item.unit})`}>
            <input type="number" autoFocus value={stock.qty} onChange={(e) => setStock({ ...stock, qty: e.target.value })} />
          </Field>
          {stock.mode === 'in' && (
            <label className="check">
              <input type="checkbox" checked={stock.addExpense} onChange={(e) => setStock({ ...stock, addExpense: e.target.checked })} />
              Add as expense ({money((Number(stock.qty) || 0) * stock.item.cost, cur)})
            </label>
          )}
        </Modal>
      )}
    </div>
  );
}
