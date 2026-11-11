import { createContext, useContext, useEffect, useReducer, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { seedData } from './seed';
import { uid, orderTotals } from '../utils/helpers';

const KEY = 'cafe-software-v1';
const THEME_KEY = 'cafe-theme';
const StoreContext = createContext(null);

const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = { ...seedData(), ...JSON.parse(raw) };
      data.settings = { ...seedData().settings, ...data.settings };
      if (data.settings.cafeName === 'Brew & Bite Cafe') data.settings.cafeName = 'Soffity Cafe';
      return data;
    }
  } catch { /* ignore */ }
  return seedData();
};

const loadTheme = () => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t) return t;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
              ? { ...c, visits: c.visits + 1, totalSpent: c.totalSpent + total, points: c.points + Math.floor(total / 100) }
              : c,
          )
        : state.customers;
      return { ...state, customers, orders: state.orders.map((o) => (o.id === action.id ? paid : o)) };
    }
    case 'RESET':
      return seedData();
    case 'CLEAR_ALL':
      return { ...state, orders: [], expenses: [], customers: [], nextOrderNo: 1001 };
    case 'IMPORT':
      return { ...seedData(), ...action.data };
    default:
      return state;
  }
}

const TOAST_ICON = { ok: CheckCircle2, danger: AlertCircle, info: Info };

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(loadTheme);
  const [locked, setLocked] = useState(() => !!load().settings.lockEnabled);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const notify = useCallback((msg, kind = 'ok') => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const api = {
    state,
    dispatch,
    notify,
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    locked,
    setLocked,
    add: (col, item) => dispatch({ type: 'ADD', col, item }),
    update: (col, id, patch) => dispatch({ type: 'UPDATE', col, id, patch }),
    remove: (col, id) => dispatch({ type: 'DELETE', col, id }),
    set: (key, value) => dispatch({ type: 'SET', key, value }),
    cur: state.settings.currency,
  };

  return (
    <StoreContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.kind] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <Icon size={18} />
              <span>{t.msg}</span>
            </div>
          );
        })}
      </div>
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
