import { Pencil, Plus, Search, Tags, Trash2, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Modal, Field, VegDot, SearchInput } from '../components/UI';
import DataTable from '../components/DataTable';
import { money } from '../utils/helpers';

const blank = { name: '', category: '', price: '', veg: true, available: true };

export default function Menu() {
  const { state, add, update, remove, set, notify, cur } = useStore();
  const [edit, setEdit] = useState(null);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat] = useState('');

  const rows = state.menu.filter(
    (m) => (cat === 'All' || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase()),
  );

  const save = () => {
    if (!edit.name.trim() || !edit.category || !(Number(edit.price) > 0)) return notify('Fill name, category & price', 'danger');
    const data = { ...edit, name: edit.name.trim(), price: Number(edit.price) };
    edit.id ? update('menu', edit.id, data) : add('menu', data);
    notify('Menu item saved');
    setEdit(null);
  };

  const addCat = () => {
    const c = newCat.trim();
    if (!c || state.categories.includes(c)) return;
    set('categories', [...state.categories, c]);
    setNewCat('');
  };
  const delCat = (c) => {
    if (state.menu.some((m) => m.category === c)) return notify('Category has items — move them first', 'danger');
    set('categories', state.categories.filter((x) => x !== c));
  };

  return (
    <div>
      <PageHead icon={UtensilsCrossed} title="Menu" subtitle={`${state.menu.length} items · ${state.categories.length} categories`}>
        <button className="btn" onClick={() => setCatModal(true)}><Tags size={16} /> Categories</button>
        <button className="btn btn-primary" onClick={() => setEdit({ ...blank, category: state.categories[0] || '' })}><Plus size={16} /> Add Item</button>
      </PageHead>

      <div className="toolbar">
        <SearchInput icon={Search} className="search" placeholder="Search menu" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option>All</option>
          {state.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: 'name', label: 'Item', render: (m) => <span className="flex-c"><VegDot veg={m.veg} /> <b>{m.name}</b></span> },
          { key: 'category', label: 'Category' },
          { key: 'price', label: 'Price', render: (m) => money(m.price, cur) },
          {
            key: 'available', label: 'Available',
            render: (m) => (
              <label className="switch">
                <input type="checkbox" checked={m.available} onChange={(e) => update('menu', m.id, { available: e.target.checked })} />
                <span />
              </label>
            ),
          },
        ]}
        actions={(m) => (
          <>
            <button className="btn btn-sm" onClick={() => setEdit(m)}><Pencil size={13} /> Edit</button>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => confirm(`Delete ${m.name}?`) && remove('menu', m.id)}><Trash2 size={13} /> Delete</button>
          </>
        )}
      />

      {edit && (
        <Modal
          title={edit.id ? 'Edit Item' : 'Add Menu Item'}
          onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}
        >
          <Field label="Item name"><input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <div className="grid-2">
            <Field label="Category">
              <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {state.categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={`Price (${cur})`}><input type="number" min="0" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
          </div>
          <div className="grid-2">
            <Field label="Type">
              <select value={edit.veg ? 'veg' : 'nonveg'} onChange={(e) => setEdit({ ...edit, veg: e.target.value === 'veg' })}>
                <option value="veg">Veg</option>
                <option value="nonveg">Non-veg</option>
              </select>
            </Field>
            <Field label="Available">
              <select value={edit.available ? 'y' : 'n'} onChange={(e) => setEdit({ ...edit, available: e.target.value === 'y' })}>
                <option value="y">Yes</option>
                <option value="n">No (out of stock)</option>
              </select>
            </Field>
          </div>
        </Modal>
      )}

      {catModal && (
        <Modal title="Categories" icon={Tags} onClose={() => setCatModal(false)}>
          <div className="row-input">
            <input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} />
            <button className="btn btn-primary" onClick={addCat}><Plus size={16} /> Add</button>
          </div>
          <ul className="simple-list mt">
            {state.categories.map((c) => (
              <li key={c}>
                <span className="grow">{c} <span className="muted small">({state.menu.filter((m) => m.category === c).length} items)</span></span>
                <button className="btn btn-sm btn-danger-ghost" onClick={() => delCat(c)}><Trash2 size={13} /> Delete</button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
