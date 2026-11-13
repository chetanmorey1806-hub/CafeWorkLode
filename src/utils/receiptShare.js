/**
 * Digital receipts: PDF download (jsPDF) and WhatsApp share (wa.me deep link). No backend needed.
 * Both work from a normalised "bill" object so staff & customer screens share the code.
 */
import { orderTotals } from './helpers';
import { modsLabel } from './menuOptions';
import { orderOffers } from './offers';

/** bill = { no, date, table, customer, items:[{name, mods, qty, price}], subtotal, discounts:[{label, amount}],
 *           tax, taxPercent, total, payments:[{method, amount}], status, cafe:{name,address,phone,gstin,footer} } */
export function billFromOrder(order, state) {
  const s = state.settings;
  const t = orderTotals(order);
  const d = [];
  if (order.status === 'paid') {
    if (order.tierDiscount > 0) d.push({ label: `${order.tierName} member discount`, amount: order.tierDiscount });
    if (order.offerHH > 0) d.push({ label: 'Happy hours', amount: order.offerHH });
    if (order.offerPromo > 0) d.push({ label: `Promo ${order.promoCode}`, amount: order.offerPromo });
    if (order.freeItem > 0) d.push({ label: 'Free coffee (stamp card)', amount: order.freeItem });
    if (order.passAmount > 0) d.push({ label: 'Coffee pass', amount: order.passAmount });
    if (order.pointsUsed > 0) d.push({ label: 'Points redeemed', amount: order.pointsUsed });
    const rest = +(t.discount - d.reduce((a, x) => a + x.amount, 0)).toFixed(2);
    if (rest > 0) d.push({ label: 'Discount', amount: rest });
  } else {
    d.push(...orderOffers(order, state).lines);
    const rest = +(t.discount - d.reduce((a, x) => a + x.amount, 0)).toFixed(2);
    if (rest > 0) d.push({ label: 'Discount', amount: rest });
  }
  return {
    no: order.no, date: order.paidAt || order.createdAt, status: order.status,
    table: order.type === 'dine-in' ? state.tables.find((x) => x.id === order.tableId)?.name || '' : order.type,
    customer: order.customerName || '', phone: order.customerPhone || state.customers.find((c) => c.id === order.customerId)?.phone || '',
    items: order.items.map((i) => ({ name: i.name, mods: i.mods || [], qty: i.qty, price: i.price })),
    subtotal: t.subtotal, discounts: d, tax: t.tax, taxPercent: order.taxPercent, total: t.total,
    payments: order.status === 'paid' ? (order.payments?.length ? order.payments : [{ method: order.paymentMethod, amount: t.total }]) : [],
    cafe: { name: s.cafeName, address: s.address, phone: s.phone, gstin: s.gstin, footer: s.footer },
  };
}

/** From the customer page's public order view */
export function billFromPublic(o, cafe) {
  return {
    no: o.no, date: o.paidAt || o.createdAt, status: o.status, table: o.table || '', customer: o.customerName || '', phone: '',
    items: o.items, subtotal: o.subtotal,
    discounts: o.discounts?.length ? o.discounts : o.discount > 0 ? [{ label: 'Discount', amount: o.discount }] : [],
    tax: o.tax, taxPercent: o.taxPercent, total: o.total, payments: o.payments || [], cafe,
  };
}

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

let fontCache;
async function loadFonts(doc) {
  try {
    fontCache ??= await Promise.all(['Poppins-Regular', 'Poppins-SemiBold'].map(async (f) => {
      const buf = await (await fetch(`fonts/${f}.ttf`)).arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return [f, btoa(bin)];
    }));
    fontCache.forEach(([f, b64]) => doc.addFileToVFS(`${f}.ttf`, b64));
    doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');
    doc.addFont('Poppins-SemiBold.ttf', 'Poppins', 'bold');
    return 'Poppins';
  } catch {
    return null; // fall back to Helvetica (no ₹ glyph → "Rs.")
  }
}

/** Builds & downloads an A5 PDF bill. */
export async function downloadBillPdf(bill) {
  const { jsPDF } = await import('jspdf'); // loaded only when needed
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const font = await loadFonts(doc);
  const F = font || 'helvetica';
  const money = font ? inr : (n) => inr(n).replace('₹', 'Rs. ');
  const W = 148; const L = 12; const R = W - 12;
  let y = 16;

  // header band
  doc.setFillColor(75, 52, 37);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(F, 'bold'); doc.setFontSize(17);
  doc.text(bill.cafe.name, W / 2, 13, { align: 'center' });
  doc.setFont(F, 'normal'); doc.setFontSize(8.5);
  doc.text([bill.cafe.address, `Ph: ${bill.cafe.phone}${bill.cafe.gstin ? `  ·  GSTIN: ${bill.cafe.gstin}` : ''}`].filter(Boolean), W / 2, 19, { align: 'center' });
  doc.setTextColor(40, 30, 24);
  y = 40;

  doc.setFont(F, 'bold'); doc.setFontSize(12);
  doc.text(bill.status === 'paid' ? 'TAX INVOICE' : 'ORDER SUMMARY', L, y);
  doc.setFont(F, 'normal'); doc.setFontSize(9);
  doc.text(`Bill #${bill.no}`, R, y, { align: 'right' });
  y += 6;
  doc.text(`Date: ${fmtDate(bill.date)}`, L, y);
  doc.text(bill.table ? (/^\w+$/.test(bill.table) && !['takeaway', 'delivery'].includes(bill.table) ? `Table ${bill.table}` : bill.table) : '', R, y, { align: 'right' });
  if (bill.customer) { y += 5; doc.text(`Customer: ${bill.customer}`, L, y); }
  y += 5;
  doc.setDrawColor(200, 180, 160); doc.setLineWidth(0.3); doc.line(L, y, R, y);
  y += 6;

  // items table
  doc.setFont(F, 'bold'); doc.setFontSize(9);
  doc.text('Item', L, y); doc.text('Qty', 92, y, { align: 'right' }); doc.text('Rate', 112, y, { align: 'right' }); doc.text('Amount', R, y, { align: 'right' });
  y += 2.5; doc.line(L, y, R, y); y += 5;
  doc.setFont(F, 'normal');
  bill.items.forEach((i) => {
    if (y > 185) { doc.addPage(); y = 16; }
    const name = doc.splitTextToSize(i.name, 72);
    doc.text(name, L, y);
    doc.text(String(i.qty), 92, y, { align: 'right' });
    doc.text(money(i.price), 112, y, { align: 'right' });
    doc.text(money(i.price * i.qty), R, y, { align: 'right' });
    y += 4.6 * name.length;
    const ml = modsLabel(i.mods);
    if (ml) { doc.setFontSize(7.5); doc.setTextColor(130, 110, 95); doc.text(doc.splitTextToSize(ml, 80), L + 2, y - 0.8); y += 3.8; doc.setFontSize(9); doc.setTextColor(40, 30, 24); }
    y += 1.2;
  });
  doc.line(L, y, R, y); y += 6;

  const row = (label, val, bold = false, color) => {
    doc.setFont(F, bold ? 'bold' : 'normal');
    if (color) doc.setTextColor(...color);
    doc.text(label, 80, y); doc.text(val, R, y, { align: 'right' });
    doc.setTextColor(40, 30, 24);
    y += 5.2;
  };
  row('Subtotal', money(bill.subtotal));
  bill.discounts.forEach((d) => row(d.label, `-${money(d.amount)}`, false, [34, 140, 80]));
  if (bill.tax > 0) row(`GST (${bill.taxPercent}%)`, money(bill.tax));
  y += 1;
  doc.setFillColor(246, 237, 229);
  doc.roundedRect(76, y - 5, R - 76 + 2, 9, 2, 2, 'F');
  doc.setFontSize(11.5); row('TOTAL', money(bill.total), true);
  doc.setFontSize(9);
  bill.payments.forEach((p) => row(`Paid via ${String(p.method).toUpperCase()}`, money(p.amount)));

  y += 6;
  doc.setFont(F, 'normal'); doc.setFontSize(9.5); doc.setTextColor(122, 82, 54);
  doc.text(bill.cafe.footer || 'Thank you! Visit again', W / 2, y, { align: 'center' });
  doc.setFontSize(7); doc.setTextColor(160, 150, 140);
  doc.text('This is a computer generated bill.', W / 2, y + 5, { align: 'center' });

  doc.save(`${bill.cafe.name.replace(/\W+/g, '_')}_Bill_${bill.no}.pdf`);
}

/** Plain-text bill summary for WhatsApp (WhatsApp *bold* formatting). */
export function billText(bill) {
  const lines = [
    `*${bill.cafe.name}* — ${bill.status === 'paid' ? 'Bill' : 'Order'} #${bill.no}`,
    `${fmtDate(bill.date)}${bill.table ? ` · ${/^\w+$/.test(bill.table) && !['takeaway', 'delivery'].includes(bill.table) ? `Table ${bill.table}` : bill.table}` : ''}`,
    '------------------------------',
    ...bill.items.map((i, k) => `${k + 1}. ${i.name} × ${i.qty} — ${inr(i.price * i.qty)}${modsLabel(i.mods) ? `\n    _${modsLabel(i.mods)}_` : ''}`),
    '------------------------------',
    `Subtotal: ${inr(bill.subtotal)}`,
    ...bill.discounts.map((d) => `${d.label}: -${inr(d.amount)}`),
    ...(bill.tax > 0 ? [`GST (${bill.taxPercent}%): ${inr(bill.tax)}`] : []),
    `*Total: ${inr(bill.total)}*`,
    ...bill.payments.map((p) => `Paid via ${String(p.method).toUpperCase()}: ${inr(p.amount)}`),
    '',
    bill.cafe.footer || 'Thank you! Visit again ☕',
  ];
  return lines.join('\n');
}

/** Opens WhatsApp with the bill pre-filled. phone: 10-digit Indian number (optional → user picks a chat). */
export function shareOnWhatsApp(bill, phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  const to = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${to}?text=${encodeURIComponent(billText(bill))}`, '_blank', 'noopener');
}
