import { createContext, useContext, useEffect, useReducer, useState, useCallback } from 'react';
import { seedData } from './seed';
import { uid, orderTotals } from '../utils/helpers';

const KEY = 'cafe-software-v1';
const StoreContext = createContext(null);

const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = { ...seedData(), ...JSON.parse(raw) };
      if (data.settings?.cafeName === 'Brew & Bite Cafe') data.settings = { ...data.settings, cafeName: 'Soffity Cafe' };
      return data;
    }
  } catch { /* ignore */ }
  return seedData();
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return { ...state, [action.col]: [...state[action.col], { id: uid(), ...action.item }] };
    case 'UPDATE':
      return {
        ...state,
        [action.col]: state[action.col].map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
      };
    case 'DELETE':
      return { ...state, [action.col]: state[action.col].filter((x) => x.id !== action.id) };
    case 'SET':
      return { ...state, [action.key]: action.value };
    case 'CREATE_ORDER': {
      const order = { id: uid(), ...action.order, no: state.nextOrderNo, createdAt: new Date().toISOString() };
      return { ...state, orders: [...state.orders, order], nextOrderNo: state.nextOrderNo + 1 };
    }
    case 'PAY_ORDER': {
      const order = state.orders.find((o) => o.id === action.id);
      if (!order) return state;
      const paid = { ...order, ...action.patch, status: 'paid', paidAt: new Date().toISOString() };
      const { total } = orderTotals(paid);
      const customers = paid.customerId
        ? state.customers.map((c) =>
            c.id === paid.customerId
              ? {
                  ...c,
                  visits: c.visits + 1,
                  totalSpent: c.totalSpent + total,
                  points: c.points + Math.floor(total / 100) - (Number(action.patch.redeemPoints) || 0),
                }
              : c,
          )
        : state.customers;
      return { ...state, customers, orders: state.orders.map((o) => (o.id === action.id ? paid : o)) };
    }
    case 'RESET':
      return seedData();
    case 'CLEAR_ALL':
      return {
        ...seedData(),
        orders: [], expenses: [], customers: [], nextOrderNo: 1001,
        settings: state.settings, menu: state.menu, tables: state.tables,
        categories: state.categories, staff: state.staff, inventory: state.inventory,
      };
    case 'IMPORT':
      return { ...seedData(), ...action.data };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const api = {
    state,
    dispatch,
    notify,
    add: (col, item) => dispatch({ type: 'ADD', col, item }),
    update: (col, id, patch) => dispatch({ type: 'UPDATE', col, id, patch }),
    remove: (col, id) => dispatch({ type: 'DELETE', col, id }),
    set: (key, value) => dispatch({ type: 'SET', key, value }),
    cur: state.settings.currency,
  };

  return (
    <StoreContext.Provider value={api}>
      {children}
      {toast && <div key={toast.id} className={`toast toast-${toast.kind}`}>{toast.msg}</div>}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
