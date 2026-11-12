/**
 * Pure business rules shared by the browser app and the Node server.
 * (No DOM access here — keep it importable from Node.)
 */
import { dateStr } from './helpers.js';

export const DEFAULT_LOYALTY = {
  pointsPer: 100, // 1 point per ₹100 spent
  stampEvery: 5, // buy 5 coffees → next one free
  stampCategories: ['Coffee'],
  tierDiscountAuto: true,
  tiers: [
    { name: 'Silver', min: 2000, discount: 5 },
    { name: 'Gold', min: 5000, discount: 10 },
    { name: 'Platinum', min: 10000, discount: 15 },
  ],
  plans: [
    { id: 'p1', name: 'Daily Coffee Pass', price: 999, days: 30, maxPrice: 160, category: 'Coffee' },
  ],
};

export const loyaltyOf = (settings) => ({ ...DEFAULT_LOYALTY, ...(settings?.loyalty || {}) });

/* ---------------- tiers ---------------- */
export const tierFor = (customer, settings) => {
  if (!customer) return null;
  const tiers = [...loyaltyOf(settings).tiers].sort((a, b) => b.min - a.min);
  return tiers.find((t) => (customer.totalSpent || 0) >= t.min) || null;
};

export const nextTier = (customer, settings) => {
  const tiers = [...loyaltyOf(settings).tiers].sort((a, b) => a.min - b.min);
  const t = tiers.find((x) => (customer?.totalSpent || 0) < x.min);
  return t ? { ...t, remaining: t.min - (customer?.totalSpent || 0) } : null;
};

/* ---------------- stamps & passes ---------------- */
export const stampItems = (items, menu, settings) => {
  const cats = loyaltyOf(settings).stampCategories;
  return items.filter((i) => cats.includes(menu.find((m) => m.id === i.menuId)?.category));
};

export const stampQty = (items, menu, settings) => stampItems(items, menu, settings).reduce((s, i) => s + i.qty, 0);

export const activePass = (customer, today = dateStr(new Date())) => {
  const p = customer?.subscription;
  return p && p.start <= today && p.end >= today ? p : null;
};

export const passUsedToday = (customer, today = dateStr(new Date())) => activePass(customer, today)?.lastUsed === today;

/* ---------------- stock / recipes ---------------- */
/** How many servings of a menu item the current inventory allows (Infinity if no recipe). */
export const servingsLeft = (item, inventory) => {
  const rec = item?.recipe || [];
  if (!rec.length) return Infinity;
  return Math.min(
    ...rec.map((r) => {
      const inv = inventory.find((x) => x.id === r.inventoryId);
      if (!inv || !(r.qty > 0)) return Infinity;
      return Math.floor((inv.qty + 1e-9) / r.qty);
    }),
  );
};

export const isAvailable = (item, inventory) => !!item?.available && servingsLeft(item, inventory) >= 1;

/** Returns a new inventory array with recipe quantities deducted for the given order items. */
export const consumeStock = (inventory, items, menu) => {
  const use = {};
  items.forEach((it) => {
    const m = menu.find((x) => x.id === it.menuId);
    (m?.recipe || []).forEach((r) => { use[r.inventoryId] = (use[r.inventoryId] || 0) + r.qty * it.qty; });
  });
  if (!Object.keys(use).length) return inventory;
  return inventory.map((inv) => (use[inv.id] ? { ...inv, qty: Math.max(0, +(inv.qty - use[inv.id]).toFixed(3)) } : inv));
};

/* ---------------- smart upselling ---------------- */
const CATEGORY_PAIRS = {
  Coffee: ['Desserts', 'Snacks'],
  Tea: ['Snacks', 'Desserts'],
  Snacks: ['Beverages', 'Coffee'],
  Desserts: ['Coffee', 'Tea'],
  Beverages: ['Snacks'],
};

/**
 * Suggest items to add next. Scores: manual pairing (menu.pairs) > bought-together history
 * > category affinity > overall popularity. Excludes items already in the cart / unavailable.
 */
export const suggestions = (cartIds, state, n = 3) => {
  const ids = [...new Set(cartIds)];
  if (!ids.length) return [];
  const { menu, orders, inventory } = state;
  const inCart = new Set(ids);
  const score = {};
  const bump = (id, v) => { if (!inCart.has(id)) score[id] = (score[id] || 0) + v; };
  const cartItems = ids.map((id) => menu.find((m) => m.id === id)).filter(Boolean);

  cartItems.forEach((m) => (m.pairs || []).forEach((p) => bump(p, 12)));

  const pop = {};
  orders.forEach((o) => {
    if (o.status === 'cancelled') return;
    const set = new Set(o.items.map((i) => i.menuId));
    set.forEach((id) => { pop[id] = (pop[id] || 0) + 1; });
    if (ids.some((id) => set.has(id))) set.forEach((id) => bump(id, 2));
  });

  const cats = new Set(cartItems.map((m) => m.category));
  cartItems.forEach((m) => (CATEGORY_PAIRS[m.category] || []).forEach((c) => {
    if (cats.has(c)) return; // already has something from that category
    menu.filter((x) => x.category === c).forEach((x) => bump(x.id, 3));
  }));
  Object.keys(score).forEach((id) => { score[id] += Math.min(2, (pop[id] || 0) * 0.2); });

  return Object.entries(score)
    .map(([id, s]) => [menu.find((m) => m.id === id), s])
    .filter(([m]) => m && isAvailable(m, inventory) && !cats.has(m.category))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([m]) => m);
};
