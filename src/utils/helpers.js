export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const money = (n, cur = '₹') =>
  `${cur}${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Local YYYY-MM-DD (not UTC) */
export const dateStr = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const todayStr = () => dateStr(new Date());

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const minutesAgo = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));

/** Calculate bill totals for an order */
export const orderTotals = (order) => {
  const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.min(Number(order.discount) || 0, subtotal);
  const taxable = subtotal - discount;
  const tax = +(taxable * (Number(order.taxPercent) || 0) / 100).toFixed(2);
  const total = Math.round(taxable + tax);
  return { subtotal, discount, tax, total };
};

export const ORDER_STATUS = {
  pending: { label: 'Pending', color: 'warn' },
  preparing: { label: 'Preparing', color: 'info' },
  ready: { label: 'Ready', color: 'ok' },
  served: { label: 'Served', color: 'purple' },
  paid: { label: 'Paid', color: 'muted' },
  cancelled: { label: 'Cancelled', color: 'danger' },
};

export const ACTIVE_STATUSES = ['pending', 'preparing', 'ready', 'served'];

export const inRange = (d, range) => {
  const t = new Date(d);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') return t >= startOfDay;
  if (range === 'week') return t >= new Date(startOfDay.getTime() - 6 * 86400000);
  if (range === 'month') return t >= new Date(now.getFullYear(), now.getMonth(), 1);
  return true;
};
