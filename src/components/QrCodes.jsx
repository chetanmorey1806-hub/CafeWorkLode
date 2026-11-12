import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Printer, ExternalLink, AlertTriangle, Wifi } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Modal, Field } from './UI';

/** Works out the address customers' phones should open (never "localhost"). */
export function useOrderBaseUrl() {
  const { state } = useStore();
  const [lanIps, setLanIps] = useState([]);
  useEffect(() => {
    fetch('/api/info').then((r) => r.json()).then((d) => setLanIps(d.lanIps || [])).catch(() => {});
  }, []);
  const port = location.port ? `:${location.port}` : '';
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const options = [
    ...(state.settings.publicUrl ? [state.settings.publicUrl.replace(/\/+$/, '')] : []),
    ...(!local ? [location.origin] : []),
    ...lanIps.map((ip) => `${location.protocol}//${ip}${port}`),
  ];
  return { options: [...new Set(options)], fallback: location.origin };
}

export const orderUrl = (base, tableId) => `${base}/#/order/${tableId}`;

export default function QrCodesModal({ onClose }) {
  const { state, conn } = useStore();
  const { options, fallback } = useOrderBaseUrl();
  const [base, setBase] = useState('');
  const [codes, setCodes] = useState({});
  const chosen = base || options[0] || fallback;

  useEffect(() => {
    let alive = true;
    Promise.all(
      state.tables.map((t) =>
        QRCode.toDataURL(orderUrl(chosen, t.id), { width: 520, margin: 1, color: { dark: '#2a1a10', light: '#ffffff' } }).then((u) => [t.id, u]),
      ),
    ).then((list) => alive && setCodes(Object.fromEntries(list)));
    return () => { alive = false; };
  }, [chosen, state.tables]);

  const cafe = state.settings.cafeName;
  const printAll = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const cards = state.tables.map((t) => `
      <div class="card">
        <div class="cafe">${cafe}</div>
        <div class="table">Table ${t.name}</div>
        <img src="${codes[t.id]}" />
        <div class="scan">Scan to see the menu &amp; order</div>
        <div class="steps">1. Open camera &nbsp;·&nbsp; 2. Scan &nbsp;·&nbsp; 3. Order from your table</div>
      </div>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Table QR codes</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box} body{margin:0;font-family:Poppins,sans-serif;background:#fff}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10mm;padding:10mm}
        .card{border:2px solid #7a5236;border-radius:16px;padding:8mm;text-align:center;page-break-inside:avoid;background:linear-gradient(#fbf6f1,#fff)}
        .cafe{font-size:14pt;font-weight:600;color:#7a5236;letter-spacing:.04em}
        .table{font-size:26pt;font-weight:700;color:#2a1a10;margin:2mm 0}
        img{width:58mm;height:58mm}
        .scan{font-weight:600;font-size:12pt;margin-top:2mm}
        .steps{font-size:8.5pt;color:#7d6a5d;margin-top:1mm}
        @page{size:A4;margin:0}
      </style></head><body><div class="grid">${cards}</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`);
    w.document.close();
  };

  return (
    <Modal
      title="Table QR codes"
      icon={QrCode}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={printAll} disabled={Object.keys(codes).length < state.tables.length}><Printer size={16} /> Print all</button>
        </>
      }
    >
      {conn !== 'online' && (
        <div className="qr-warn">
          <AlertTriangle size={18} />
          <div>
            <b>The café server is not connected.</b> Customers' orders can only reach this app when the server is running.
            Start it with <code>npm start</code> (or <code>npm run dev:all</code> while developing).
          </div>
        </div>
      )}
      <Field label="Address customers' phones will open">
        <select value={chosen} onChange={(e) => setBase(e.target.value)}>
          {[...new Set([...options, fallback])].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>
      <p className="muted small flex-c"><Wifi size={14} /> Phones must be on the same Wi-Fi as this computer, or set a public URL in Settings once the app is hosted online.</p>
      <div className="qr-grid stagger">
        {state.tables.map((t) => (
          <div className="qr-card" key={t.id}>
            <div className="qr-table">Table {t.name}</div>
            {codes[t.id] ? <img src={codes[t.id]} alt={`QR for table ${t.name}`} /> : <div className="qr-ph" />}
            <a className="link small" href={orderUrl(chosen, t.id)} target="_blank" rel="noreferrer">Open <ExternalLink size={12} /></a>
          </div>
        ))}
      </div>
    </Modal>
  );
}

