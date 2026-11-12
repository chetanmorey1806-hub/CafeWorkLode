/**
 * Single source of truth for every state change.
 * Runs in the browser AND on the Node server (server/index.js), so it must stay pure
 * and every action must be idempotent (safe to apply twice after a reconnect).
 */
import { seedData } from './seed.js';
import { orderTotals, uid, dateStr } from '../utils/helpers.js';
import { loyaltyOf, stampQty, consumeStock } from '../utils/loyalty.js';

/** Fill in fields added in newer versions so old saved data keeps working. */
export function migrate(data) {
  const seed = seedData();
  const s = { ...seed, ...data };
  s.settings = { ...seed.settings, ...(data.settings || {}) };
  s.settings.loyalty = { ...seed.settings.loyalty, ...(data.settings?.loyalty || {}) };
  if (s.settings.cafeName === 'Brew & Bite Cafe') s.settings.cafeName = 'Soffity Cafe';
  s.ledger = data.ledger || [];
  s.menu = (s.menu || []).map((m) => {
    const sm = seed.menu.find((x) => x.id === m.id && x.name === m.name);
    return { ...m, recipe: m.recipe ?? sm?.recipe ?? [], pairs: m.pairs ?? sm?.pairs ?? [] };
  });
  s.customers = (s.customers || []).map((c) => ({ stamps: 0, wallet: 0, subscription: null, ...c }));
  return s;
}

const exists = (list, id) => id && list.some((x) => x.id === id);

export function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      if (exists(state[action.col], action.item.id)) return state;
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
      if (exists(state.orders, action.order.id)) return state;
      const order = { id: uid(), ...action.order, no: state.nextOrderNo, createdAt: new Date().toISOString() };
      return { ...state, orders: [...state.orders, order], nextOrderNo: state.nextOrderNo + 1 };
    }

    case 'PAY_ORDER': {
      const order = state.orders.find((o) => o.id === action.id);
      if (!order || order.status === 'paid') return state;
      const paid = { ...order, ...action.patch, status: 'paid', paidAt: new Date().toISOString() };
      const { total } = orderTotals(paid);
      const payments = paid.payments?.length ? paid.payments : [{ method: paid.paymentMethod, amount: total }];
      const walletUsed = payments.filter((p) => p.method === 'wallet').reduce((s, p) => s + Number(p.amount), 0);
      const L = loyaltyOf(state.settings);
      const today = dateStr(paid.paidAt);
      // free coffee (stamp reward) and pass coffee don't earn a new stamp
      const earnedStamps = Math.max(0, stampQty(paid.items, state.menu, state.settings) - (paid.stampsUsed ? 1 : 0) - (paid.passUsed ? 1 : 0));

      const customers = paid.customerId
        ? state.customers.map((c) => {
            if (c.id !== paid.customerId) return c;
            return {
              ...c,
              visits: (c.visits || 0) + 1,
              totalSpent: (c.totalSpent || 0) + total,
              points: Math.max(0, (c.points || 0) - (Number(paid.pointsUsed) || 0)) + Math.floor(total / L.pointsPer),
              stamps: Math.max(0, (c.stamps || 0) - (Number(paid.stampsUsed) || 0)) + earnedStamps,
              wallet: +((c.wallet || 0) - walletUsed).toFixed(2),
              subscription: paid.passUsed && c.subscription ? { ...c.subscription, lastUsed: today } : c.subscription,
            };
          })
        : state.customers;
      return {
        ...state,
        customers,
        inventory: consumeStock(state.inventory, paid.items, state.menu),
        orders: state.orders.map((o) => (o.id === action.id ? { ...paid, payments } : o)),
      };
    }

    case 'WALLET_TOPUP': {
      if (exists(state.ledger, action.id)) return state;
      const amount = Number(action.amount) || 0;
      return {
        ...state,
        customers: state.customers.map((c) => (c.id === action.customerId ? { ...c, wallet: +((c.wallet || 0) + amount).toFixed(2) } : c)),
        ledger: [...state.ledger, { id: action.id, type: 'wallet', customerId: action.customerId, amount, method: action.method, date: new Date().toISOString() }],
      };
    }

    case 'SELL_PASS': {
      if (exists(state.ledger, action.id)) return state;
      const plan = loyaltyOf(state.settings).plans.find((p) => p.id === action.planId);
      if (!plan) return state;
      const start = dateStr(new Date());
      const end = dateStr(Date.now() + (plan.days - 1) * 86400000);
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.customerId ? { ...c, subscription: { planId: plan.id, name: plan.name, maxPrice: plan.maxPrice, category: plan.category, start, end, lastUsed: null } } : c,
        ),
        ledger: [...state.ledger, { id: action.id, type: 'pass', customerId: action.customerId, amount: plan.price, method: action.method, plan: plan.name, date: new Date().toISOString() }],
      };
    }

    case 'REPLACE':
      return action.state;
    case 'RESET':
      return seedData();
    case 'CLEAR_ALL':
      return { ...state, orders: [], expenses: [], customers: [], ledger: [], nextOrderNo: 1001 };
    case 'IMPORT':
      return migrate(action.data);
    default:
      return state;
  }
}

/** Actions the server accepts from staff devices. */
export const SYNC_ACTIONS = ['ADD', 'UPDATE', 'DELETE', 'SET', 'CREATE_ORDER', 'PAY_ORDER', 'WALLET_TOPUP', 'SELL_PASS', 'RESET', 'CLEAR_ALL', 'IMPORT'];
