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

/** Short two-tone chime using Web Audio (no audio files needed) */
let audioCtx;
export const chime = () => {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = audioCtx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch { /* audio not available */ }
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const inRange = (d, range) => {
  const t = new Date(d);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') return t >= startOfDay;
  if (range === 'week') return t >= new Date(startOfDay.getTime() - 6 * 86400000);
  if (range === 'month') return t >= new Date(now.getFullYear(), now.getMonth(), 1);
  return true;
};

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Lightweight canvas confetti burst (no library) */
export const confetti = (count = 140) => {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti-canvas';
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#c08552', '#7a5236', '#f3a33b', '#2fbf74', '#5b9cf0', '#f06a60', '#e8c9a6'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 15 - 5,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  const frame = (t) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - elapsed / 2200);
    parts.forEach((p) => {
      p.vy += 0.42; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.r * 2));
      ctx.restore();
    });
    if (elapsed < 2200) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
};

/** Animate a small dot flying from one element to another (add-to-cart effect) */
export const flyTo = (fromEl, toEl, label = '') => {
  if (!fromEl || !toEl || reducedMotion()) return;
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  if (!b.width) return;
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  dot.textContent = label;
  dot.style.left = `${a.left + a.width / 2 - 16}px`;
  dot.style.top = `${a.top + a.height / 2 - 16}px`;
  document.body.appendChild(dot);
  const dx = b.left + Math.min(b.width / 2, 60) - (a.left + a.width / 2);
  const dy = b.top + 24 - (a.top + a.height / 2);
  const anim = dot.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(1.15)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.2 },
    ],
    { duration: 650, easing: 'cubic-bezier(.5,0,.6,1)' },
  );
  anim.onfinish = () => dot.remove();
};

/** Material-style ripple on buttons — call once at startup */
export const installRipple = () => {
  document.addEventListener('pointerdown', (e) => {
    if (reducedMotion()) return;
    const el = e.target.closest?.('.btn, .chip, .item-card, .seg-btn, .quick-btn, .pin-pad button');
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = `${size}px`;
    s.style.left = `${e.clientX - r.left - size / 2}px`;
    s.style.top = `${e.clientY - r.top - size / 2}px`;
    const wrap = document.createElement('span');
    wrap.className = 'ripple-wrap';
    wrap.appendChild(s);
    el.appendChild(wrap);
    s.addEventListener('animationend', () => wrap.remove());
  });
};
