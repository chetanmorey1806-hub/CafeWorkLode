/**
 * Soffity Cafe server — live sync + QR ordering API.
 *
 *   Staff devices  ── WebSocket /ws?role=staff&pin=…  → send actions, receive full state
 *   Customer phone ── GET  /api/public/menu?table=t1
 *                     POST /api/public/orders
 *                     WebSocket /ws?role=track&order=…&token=…  → live order status
 *
 * Data is stored in server/data/db.json (no database setup needed).
 * Run: node server/index.js   (PORT env var, default 4000)
 */
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { reducer, migrate, SYNC_ACTIONS } from '../src/context/reducer.js';
import { seedData } from '../src/context/seed.js';
import { isAvailable, suggestions } from '../src/utils/loyalty.js';
import { orderTotals, uid, ACTIVE_STATUSES } from '../src/utils/helpers.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const DATA_DIR = path.join(__dir, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DIST = path.join(__dir, '..', 'dist');

/* ------------------------------------------------------------------ storage */
let state;
let fresh = true; // true until any device writes data (lets the first device upload its local data)
let version = 0;

try {
  const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  state = migrate(saved.state);
  fresh = !!saved.fresh;
  version = saved.version || 0;
  console.log(`Loaded data (${state.orders.length} orders)`);
} catch {
  state = migrate(seedData());
  console.log('No saved data yet — starting with demo data');
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ state, fresh, version }));
    fs.renameSync(tmp, DB_FILE);
  }, 300);
}

/* ------------------------------------------------------------------ helpers */
const tableName = (id) => state.tables.find((t) => t.id === id)?.name;

const publicOrder = (o) => {
  const t = orderTotals(o);
  return {
    id: o.id, no: o.no, status: o.status, table: tableName(o.tableId) || null, createdAt: o.createdAt, paidAt: o.paidAt || null,
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, note: i.note || '', done: !!i.done })),
    subtotal: t.subtotal, discount: t.discount, tax: t.tax, total: t.total, paymentIntent: o.paymentIntent || null,
  };
};

const publicMenu = () => {
  const recs = {};
  state.menu.forEach((m) => { recs[m.id] = suggestions([m.id], state, 3).map((x) => x.id); });
  const s = state.settings;
  return {
    cafe: { name: s.cafeName, address: s.address, phone: s.phone, currency: s.currency, taxPercent: s.taxPercent, upiId: s.upiId, upiName: s.upiName || s.cafeName },
    categories: state.categories,
    menu: state.menu.map((m) => ({ id: m.id, name: m.name, category: m.category, price: m.price, veg: m.veg, available: isAvailable(m, state.inventory) })),
    recommendations: recs,
    stampEvery: s.loyalty?.stampEvery || 5,
  };
};

function lanUrls(port) {
  const out = [];
  Object.values(os.networkInterfaces()).flat().forEach((n) => {
    if (n && n.family === 'IPv4' && !n.internal) out.push(`http://${n.address}:${port}`);
  });
  return out;
}

/* ------------------------------------------------------------------ apply + broadcast */
const staff = new Set();
const trackers = new Set();

function apply(action) {
  state = reducer(state, action);
  version++;
  fresh = false;
  save();
}

function broadcast() {
  const base = { type: 'state', state, version };
  staff.forEach((ws) => ws.readyState === 1 && ws.send(JSON.stringify({ ...base, ack: ws.ack || 0 })));
  trackers.forEach((ws) => {
    const o = state.orders.find((x) => x.id === ws.orderId);
    if (!o) return;
    const msg = JSON.stringify({ type: 'order', order: publicOrder(o) });
    if (msg !== ws.last && ws.readyState === 1) { ws.last = msg; ws.send(msg); }
  });
}

/* ------------------------------------------------------------------ HTTP API */
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/health', (req, res) => res.json({ ok: true, version }));
app.get('/api/info', (req, res) => res.json({ lanIps: lanUrls(0).map((u) => u.replace(/^http:\/\//, '').replace(/:0$/, '')), port: PORT }));

app.get('/api/public/menu', (req, res) => {
  const table = state.tables.find((t) => t.id === req.query.table);
  res.json({ ...publicMenu(), table: table ? { id: table.id, name: table.name } : null });
});

// simple per-IP rate limit for public order placement
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 15;
}

app.post('/api/public/orders', (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many orders from this device. Please ask the staff.' });
  const { tableId, items, customerName = '', phone = '', payment = 'counter' } = req.body || {};
  const table = state.tables.find((t) => t.id === tableId);
  if (!table) return res.status(400).json({ error: 'Unknown table. Please scan the QR code again.' });
  if (!Array.isArray(items) || !items.length || items.length > 30) return res.status(400).json({ error: 'Your cart is empty.' });

  const lines = [];
  for (const it of items) {
    const m = state.menu.find((x) => x.id === it.menuId);
    const qty = Math.floor(Number(it.qty));
    if (!m || !(qty >= 1 && qty <= 20)) return res.status(400).json({ error: 'Invalid item in cart.' });
    if (!isAvailable(m, state.inventory)) return res.status(409).json({ error: `Sorry, ${m.name} is sold out.` });
    // prices always come from the server menu, never from the client
    lines.push({ menuId: m.id, name: m.name, price: m.price, qty, note: String(it.note || '').slice(0, 100), done: false });
  }
  const cleanPhone = /^\d{10}$/.test(String(phone)) ? String(phone) : '';
  const name = String(customerName).trim().slice(0, 40);
  const customer = cleanPhone ? state.customers.find((c) => c.phone === cleanPhone) : null;
  const intent = ['counter', 'upi'].includes(payment) ? payment : 'counter';

  // One running bill per table: add to the table's open order if there is one.
  const open = state.orders.find((o) => o.tableId === table.id && ACTIVE_STATUSES.includes(o.status));
  if (open) {
    const round = (open.round || 1) + 1;
    apply({
      type: 'UPDATE', col: 'orders', id: open.id,
      patch: {
        items: [...open.items, ...lines.map((l) => ({ ...l, round }))],
        round, status: 'pending', source: open.source || 'qr', updatedAt: new Date().toISOString(),
        customerName: open.customerName || name, customerPhone: open.customerPhone || cleanPhone,
        customerId: open.customerId || customer?.id || null, paymentIntent: intent,
      },
    });
    broadcast();
    return res.json({ id: open.id, no: open.no, token: open.trackToken || '', appended: true });
  }

  const order = {
    id: uid(), type: 'dine-in', tableId: table.id, items: lines, status: 'pending', discount: 0,
    taxPercent: state.settings.taxPercent, paymentMethod: null, paidAt: null, source: 'qr', round: 1,
    customerName: customer?.name || name, customerPhone: cleanPhone, customerId: customer?.id || null,
    paymentIntent: intent, trackToken: crypto.randomBytes(12).toString('hex'),
  };
  apply({ type: 'CREATE_ORDER', order });
  broadcast();
  const created = state.orders.find((o) => o.id === order.id);
  res.json({ id: created.id, no: created.no, token: created.trackToken });
});

app.get('/api/public/orders/:id', (req, res) => {
  const o = state.orders.find((x) => x.id === req.params.id);
  if (!o || !o.trackToken || o.trackToken !== req.query.token) return res.status(404).json({ error: 'Order not found' });
  res.json(publicOrder(o));
});

// production: serve the built React app
if (fs.existsSync(DIST)) app.use(express.static(DIST));

/* ------------------------------------------------------------------ WebSocket */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  if (q.get('role') === 'track') {
    const o = state.orders.find((x) => x.id === q.get('order'));
    if (!o || !o.trackToken || o.trackToken !== q.get('token')) return ws.close(4004, 'not found');
    ws.orderId = o.id;
    ws.last = JSON.stringify({ type: 'order', order: publicOrder(o) });
    ws.send(ws.last);
    trackers.add(ws);
    ws.on('close', () => trackers.delete(ws));
    return;
  }

  // staff device
  if (String(q.get('pin') || '') !== String(state.settings.pin || '')) {
    ws.send(JSON.stringify({ type: 'auth-failed' }));
    return ws.close(4001, 'bad pin');
  }
  ws.ack = 0;
  staff.add(ws);
  ws.send(JSON.stringify({ type: 'hello', state, version, fresh, ack: 0 }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'action' && msg.action && SYNC_ACTIONS.includes(msg.action.type)) {
      try { apply(msg.action); } catch (e) { console.error('action failed', msg.action.type, e.message); }
      ws.ack = msg.seq || ws.ack;
      broadcast();
    } else if (msg.type === 'import' && fresh && msg.state?.menu) {
      state = migrate(msg.state);
      fresh = false;
      version++;
      save();
      console.log('Imported data from the first connected device');
      broadcast();
    }
  });
  ws.on('close', () => staff.delete(ws));
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n☕ Soffity Cafe server running on port ${PORT}`);
  console.log(`   Local:   http://localhost:${PORT}`);
  lanUrls(PORT).forEach((u) => console.log(`   Network: ${u}`));
  if (!fs.existsSync(DIST)) console.log('   (dev mode: open the Vite URL — it proxies /api and /ws here)');
});
