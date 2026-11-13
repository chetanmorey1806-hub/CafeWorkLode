/**
 * Turns a customer's QR-menu cart into a state action. Pure — used by the Node server AND by the
 * customer page's no-server "local mode" (same browser, synced to the kitchen tab with BroadcastChannel).
 */
import { orderTotals, uid, ACTIVE_STATUSES } from './helpers.js';
import { isAvailable, servingsLeft, suggestions } from './loyalty.js';
import { buildMods, selectionFrom, modsPrice, lineKey, groupsFor } from './menuOptions.js';
import { checkPromo, happyHourSnapshot, orderOffers, offersOf, activeHappyHour } from './offers.js';

const token = () => Array.from({ length: 24 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

/** Returns { action, id, no, token, appended } or { error, status } */
export function buildQrOrder(state, body) {
  const { tableId, items, customerName = '', phone = '', payment = 'counter', promoCode = '' } = body || {};
  const table = state.tables.find((t) => t.id === tableId);
  if (!table) return { status: 400, error: 'Unknown table. Please scan the QR code again.' };
  if (!Array.isArray(items) || !items.length || items.length > 30) return { status: 400, error: 'Your cart is empty.' };

  const want = {};
  items.forEach((it) => { want[it.menuId] = (want[it.menuId] || 0) + (Math.floor(Number(it.qty)) || 0); });
  for (const [mid, q] of Object.entries(want)) {
    const m = state.menu.find((x) => x.id === mid);
    if (m && isAvailable(m, state.inventory) && servingsLeft(m, state.inventory) < q) {
      return { status: 409, error: `Sorry, only ${servingsLeft(m, state.inventory)} ${m.name} left.` };
    }
  }

  const lines = [];
  for (const it of items) {
    const m = state.menu.find((x) => x.id === it.menuId);
    const qty = Math.floor(Number(it.qty));
    if (!m || !(qty >= 1 && qty <= 20)) return { status: 400, error: 'Invalid item in cart.' };
    if (!isAvailable(m, state.inventory)) return { status: 409, error: `Sorry, ${m.name} is sold out.` };
    let mods;
    try { mods = buildMods(m, selectionFrom(it.mods), state.modifiers || []); } catch (e) { return { status: 400, error: e.message }; }
    // prices always come from the café's menu, never from the client
    lines.push({ key: lineKey(m.id, mods), menuId: m.id, name: m.name, price: m.price + modsPrice(mods), basePrice: m.price, mods, qty, note: String(it.note || '').slice(0, 100), done: false });
  }

  const cleanPhone = /^\d{10}$/.test(String(phone)) ? String(phone) : '';
  const name = String(customerName).trim().slice(0, 40);
  const customer = cleanPhone ? state.customers.find((c) => c.phone === cleanPhone) : null;
  const intent = ['counter', 'upi'].includes(payment) ? payment : 'counter';
  const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const promo = promoCode ? checkPromo(state.settings, promoCode, sub) : null;
  if (promo && !promo.ok) return { status: 400, error: promo.error };

  // One running bill per table: add to the open order if there is one.
  const open = state.orders.find((o) => o.tableId === table.id && ACTIVE_STATUSES.includes(o.status));
  if (open) {
    const round = (open.round || 1) + 1;
    const next = {
      ...open,
      items: [...open.items, ...lines.map((l) => ({ ...l, round }))],
      promoCode: open.promoCode || promo?.code || '',
    };
    const patch = {
      items: next.items, round, status: 'pending', source: open.source || 'qr', updatedAt: new Date().toISOString(),
      customerName: open.customerName || name, customerPhone: open.customerPhone || cleanPhone,
      customerId: open.customerId || customer?.id || null, paymentIntent: intent, promoCode: next.promoCode,
      discount: orderOffers(next, state).total,
    };
    return { action: { type: 'UPDATE', col: 'orders', id: open.id, patch }, id: open.id, no: open.no, token: open.trackToken || '', appended: true };
  }

  const order = {
    id: uid(), type: 'dine-in', tableId: table.id, items: lines, status: 'pending', discount: 0,
    taxPercent: state.settings.taxPercent, paymentMethod: null, paidAt: null, source: 'qr', round: 1,
    customerName: customer?.name || name, customerPhone: cleanPhone, customerId: customer?.id || null,
    paymentIntent: intent, trackToken: token(), happyHour: happyHourSnapshot(state.settings), promoCode: promo?.code || '',
  };
  order.discount = orderOffers(order, state).total;
  return { action: { type: 'CREATE_ORDER', order }, id: order.id, no: state.nextOrderNo, token: order.trackToken, appended: false };
}

/** What a customer may see about their order. */
export function publicOrder(state, o) {
  const t = orderTotals(o);
  const offers = o.status === 'paid' ? { lines: [] } : orderOffers(o, state);
  return {
    id: o.id, no: o.no, status: o.status, table: state.tables.find((x) => x.id === o.tableId)?.name || null,
    createdAt: o.createdAt, paidAt: o.paidAt || null, billRequested: !!o.billRequested,
    items: o.items.map((i) => ({ key: i.key || i.menuId, menuId: i.menuId, name: i.name, qty: i.qty, price: i.price, mods: i.mods || [], note: i.note || '', done: !!i.done })),
    subtotal: t.subtotal, discount: t.discount, discounts: offers.lines, tax: t.tax, taxPercent: o.taxPercent, total: t.total,
    paymentIntent: o.paymentIntent || null, payments: o.status === 'paid' ? (o.payments || []) : [], customerName: o.customerName || '',
  };
}

/** The menu as the customer page sees it (no costs, recipes or private settings). */
export function publicMenu(state, tableId) {
  const s = state.settings;
  const recs = {};
  state.menu.forEach((m) => { recs[m.id] = suggestions([m.id], state, 3).map((x) => x.id); });
  const table = state.tables.find((t) => t.id === tableId);
  return {
    cafe: { name: s.cafeName, address: s.address, phone: s.phone, gstin: s.gstin, footer: s.footer, currency: s.currency, taxPercent: s.taxPercent, upiId: s.upiId, upiName: s.upiName || s.cafeName },
    table: table ? { id: table.id, name: table.name } : null,
    categories: state.categories,
    menu: state.menu.map((m) => ({
      id: m.id, name: m.name, category: m.category, price: m.price, veg: m.veg, available: isAvailable(m, state.inventory),
      groups: groupsFor(m, state.modifiers || []).map((g) => g.id),
    })),
    modifiers: (state.modifiers || []).map(({ exclude, categories, ...g }) => g),
    happyHours: offersOf(s).happyHours.filter((h) => h.active),
    happyHourNow: activeHappyHour(s),
    recommendations: recs,
    stampEvery: s.loyalty?.stampEvery || 5,
  };
}
