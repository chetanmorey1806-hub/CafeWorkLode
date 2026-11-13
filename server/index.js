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
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { reducer, migrate, SYNC_ACTIONS } from '../src/context/reducer.js';
import { seedData } from '../src/context/seed.js';
import { buildQrOrder, publicOrder as toPublic, publicMenu } from '../src/utils/qrOrder.js';
import { checkPromo } from '../src/utils/offers.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const DATA_DIR = path.join(__dir, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DIST = path.join(__dir, '..', 'dist');
const CERTS = path.join(__dir, 'certs');
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 4443;
const hasCerts = fs.existsSync(path.join(CERTS, 'server.key')) && fs.existsSync(path.join(CERTS, 'server.crt'));

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

const publicOrder = (o) => toPublic(state, o);


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
app.get('/api/info', (req, res) => res.json({
  lanIps: lanUrls(0).map((u) => u.replace(/^http:\/\//, '').replace(/:0$/, '')), port: PORT, httpsPort: hasCerts ? HTTPS_PORT : null, built: fs.existsSync(DIST),
}));

// phones download & install this once so they trust the café's https address (needed to install the app)
app.get('/ca.crt', (req, res) => {
  const ca = path.join(CERTS, 'ca.crt');
  if (!fs.existsSync(ca)) return res.status(404).send('Run "npm run make-cert" on the café computer first.');
  res.set('Content-Type', 'application/x-x509-ca-cert');
  res.set('Content-Disposition', 'attachment; filename="SoffityCafe-CA.crt"');
  res.sendFile(ca);
});

app.get('/api/public/menu', (req, res) => {
  res.json(publicMenu(state, req.query.table));
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
  const r = buildQrOrder(state, req.body);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  apply(r.action);
  broadcast();
  const o = state.orders.find((x) => x.id === r.id);
  res.json({ id: o.id, no: o.no, token: o.trackToken || r.token, appended: r.appended });
});

app.post('/api/public/promo', (req, res) => {
  const r = checkPromo(state.settings, req.body?.code, Number(req.body?.amount) || 0);
  res.status(r.ok ? 200 : 400).json(r);
});

// customer asks for the bill from their phone → table turns red on the floor plan
app.post('/api/public/orders/:id/bill', (req, res) => {
  const o = state.orders.find((x) => x.id === req.params.id);
  if (!o || !o.trackToken || o.trackToken !== req.query.token) return res.status(404).json({ error: 'Order not found' });
  if (!o.billRequested && o.status !== 'paid') {
    apply({ type: 'UPDATE', col: 'orders', id: o.id, patch: { billRequested: true, billRequestedAt: new Date().toISOString() } });
    broadcast();
  }
  res.json(publicOrder(state.orders.find((x) => x.id === o.id)));
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
const httpsServer = hasCerts
  ? https.createServer({ key: fs.readFileSync(path.join(CERTS, 'server.key')), cert: fs.readFileSync(path.join(CERTS, 'server.crt')) }, app)
  : null;
const wss = new WebSocketServer({ noServer: true });
[server, httpsServer].filter(Boolean).forEach((srv) => srv.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/ws')) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
}));

// slow down PIN guessing: 8 wrong PINs from one address → blocked for 10 minutes
const pinFails = new Map();
const isLocal = (ip) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
const pinBlocked = (ip) => { if (isLocal(ip)) return false; const f = pinFails.get(ip); return f && f.count >= 8 && Date.now() - f.first < 10 * 60 * 1000; };
const pinFail = (ip) => {
  const f = pinFails.get(ip);
  if (!f || Date.now() - f.first > 10 * 60 * 1000) pinFails.set(ip, { count: 1, first: Date.now() });
  else f.count++;
};

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
  const ip = req.socket.remoteAddress;
  if (pinBlocked(ip) || String(q.get('pin') || '') !== String(state.settings.pin || '')) {
    if (!pinBlocked(ip)) pinFail(ip);
    ws.send(JSON.stringify({ type: 'auth-failed' }));
    return ws.close(4001, 'bad pin');
  }
  pinFails.delete(ip);
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

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`\n🔒 HTTPS (install the app on phones) on port ${HTTPS_PORT}`);
    lanUrls(HTTPS_PORT).forEach((u) => console.log(`   ${u.replace('http:', 'https:')}`));
    console.log(`   Phones: first install the certificate from http://<this-pc>:${PORT}/ca.crt`);
  });
} else {
  console.log('\n   Tip: run "npm run make-cert" to enable https so phones can install the app.');
}
