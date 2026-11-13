/**
 * Happy-hour & promo-code engine. Pure — shared by browser & server.
 */

export const DEFAULT_OFFERS = {
  happyHours: [
    { id: 'hh1', name: 'Happy Hours', days: [1, 2, 3, 4, 5], start: '16:00', end: '18:00', percent: 10, categories: [], active: true },
  ],
  promos: [
    { code: 'WELCOME50', type: 'flat', value: 50, minOrder: 200, max: 0, active: true, desc: '₹50 off your first order' },
    { code: 'COFFEE100', type: 'flat', value: 100, minOrder: 500, max: 0, active: true, desc: '₹100 off orders above ₹500' },
    { code: 'SAVE10', type: 'percent', value: 10, minOrder: 300, max: 150, active: true, desc: '10% off (up to ₹150)' },
  ],
};

export const offersOf = (settings) => ({ ...DEFAULT_OFFERS, ...(settings?.offers || {}) });

const minutes = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

/** The happy hour running at `date`, or null. */
export const activeHappyHour = (settings, date = new Date()) => {
  const d = new Date(date);
  const now = d.getHours() * 60 + d.getMinutes();
  return offersOf(settings).happyHours.find((h) => {
    if (!h.active || !h.days?.includes(d.getDay())) return false;
    const a = minutes(h.start); const b = minutes(h.end);
    return a <= b ? now >= a && now < b : now >= a || now < b; // supports windows past midnight
  }) || null;
};

const subtotal = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);

/** Discount from a happy-hour snapshot on the eligible items. */
export const happyHourAmount = (hh, items, menu) => {
  if (!hh) return 0;
  const eligible = items.filter((i) => !hh.categories?.length || hh.categories.includes(menu.find((m) => m.id === i.menuId)?.category));
  return Math.round((subtotal(eligible) * hh.percent) / 100);
};

/** Validate a promo code against an order amount. */
export const checkPromo = (settings, code, amount) => {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { ok: false, error: 'Enter a code' };
  const p = offersOf(settings).promos.find((x) => x.code.toUpperCase() === c && x.active);
  if (!p) return { ok: false, error: 'This code is not valid' };
  if (amount < (p.minOrder || 0)) return { ok: false, error: `Add items worth ₹${p.minOrder - amount} more to use ${p.code}` };
  let off = p.type === 'percent' ? Math.round((amount * p.value) / 100) : Number(p.value);
  if (p.max > 0) off = Math.min(off, p.max);
  return { ok: true, code: p.code, amount: Math.min(off, amount), desc: p.desc };
};

/**
 * Offer discounts stored on an order (happy-hour snapshot + promo code), recomputed on the
 * order's current items so extra rounds are discounted too.
 */
export const orderOffers = (order, state) => {
  const lines = [];
  const hh = happyHourAmount(order.happyHour, order.items, state.menu);
  if (hh > 0) lines.push({ key: 'hh', label: `${order.happyHour.name} (${order.happyHour.percent}%)`, amount: hh });
  if (order.promoCode) {
    const r = checkPromo(state.settings, order.promoCode, subtotal(order.items) - hh);
    if (r.ok) lines.push({ key: 'promo', label: `Promo ${r.code}`, amount: r.amount });
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
};

/** Snapshot to store on a new order (so the price the customer saw is honoured at billing). */
export const happyHourSnapshot = (settings, date = new Date()) => {
  const h = activeHappyHour(settings, date);
  return h ? { id: h.id, name: h.name, percent: h.percent, categories: h.categories || [], end: h.end } : null;
};
