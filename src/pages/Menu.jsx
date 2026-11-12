import { Pencil, Plus, Search, Tags, Trash2, UtensilsCrossed, FlaskConical, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PageHead, Modal, Field, VegDot, SearchInput } from '../components/UI';
import DataTable from '../components/DataTable';
import { money } from '../utils/helpers';
import { servingsLeft } from '../utils/loyalty';

const blank = { name: '', category: '', price: '', veg: true, available: true, recipe: [], pairs: [] };

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
    const recipe = (edit.recipe || []).filter((r) => r.inventoryId && Number(r.qty) > 0).map((r) => ({ inventoryId: r.inventoryId, qty: Number(r.qty) }));
    const data = { ...edit, name: edit.name.trim(), price: Number(edit.price), recipe, pairs: edit.pairs || [] };
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
            key: 'stock', label: 'Stock',
            render: (m) => {
              const n = servingsLeft(m, state.inventory);
              if (n === Infinity) return <span className="muted small">No recipe</span>;
              return <span className={`badge ${n < 1 ? 'badge-danger' : n < 10 ? 'badge-warn' : 'badge-ok'}`}>{n < 1 ? 'Sold out' : `${n} servings`}</span>;
            },
          },
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

          <div className="field"><span className="flex-c"><FlaskConical size={14} /> Recipe — stock used per serving</span></div>
          <p className="muted small" style={{ marginTop: -6 }}>Stock is deducted automatically when a bill is paid. The item shows as sold out when stock runs short.</p>
          {(edit.recipe || []).map((r, k) => {
            const inv = state.inventory.find((i) => i.id === r.inventoryId);
            return (
              <div className="row-input recipe-row" key={k}>
                <select value={r.inventoryId} onChange={(e) => setEdit({ ...edit, recipe: edit.recipe.map((x, j) => (j === k ? { ...x, inventoryId: e.target.value } : x)) })}>
                  {state.inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input type="number" step="any" min="0" value={r.qty} onChange={(e) => setEdit({ ...edit, recipe: edit.recipe.map((x, j) => (j === k ? { ...x, qty: e.target.value } : x)) })} />
                <span className="recipe-unit">{inv?.unit}</span>
                <button className="btn btn-sm btn-danger-ghost" onClick={() => setEdit({ ...edit, recipe: edit.recipe.filter((_, j) => j !== k) })}><X size={14} /></button>
              </div>
            );
          })}
          {state.inventory.length > 0 && (
            <button className="btn btn-sm" onClick={() => setEdit({ ...edit, recipe: [...(edit.recipe || []), { inventoryId: state.inventory[0].id, qty: '' }] })}><Plus size={13} /> Add ingredient</button>
          )}

          <div className="field mt"><span className="flex-c"><Sparkles size={14} /> Suggest with this item (smart upselling)</span></div>
          <div className="pair-chips">
            {state.menu.filter((m) => m.id !== edit.id).map((m) => {
              const on = (edit.pairs || []).includes(m.id);
              return (
                <button key={m.id} className={`chip ${on ? 'active' : ''}`}
                  onClick={() => setEdit({ ...edit, pairs: on ? edit.pairs.filter((x) => x !== m.id) : [...(edit.pairs || []), m.id] })}>
                  {m.name}
                </button>
              );
            })}
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
