/**
 * In-app table QR scanner — <site>/#/scan
 * Uses the camera (needs HTTPS or localhost); otherwise customers can pick a photo of the QR.
 */
import { useEffect, useRef, useState } from 'react';
import { ScanLine, ImageUp, Camera, AlertTriangle, ArrowLeft } from 'lucide-react';
import './customer.css';

const isOrderUrl = (t) => /#\/order\/[\w-]+/.test(t);

function go(text) {
  const m = text.match(/#\/order\/([\w-]+)/);
  if (!m) return false;
  // Same café site → stay in the app; otherwise open the scanned address.
  try {
    const u = new URL(text, location.href);
    if (u.origin === location.origin) { location.hash = `#/order/${m[1]}`; location.reload(); return true; }
  } catch { /* relative */ }
  location.href = text;
  return true;
}

export default function Scanner() {
  const [err, setErr] = useState('');
  const [camera, setCamera] = useState('starting'); // starting | on | off
  const scanner = useRef(null);

  useEffect(() => {
    let stopped = false;
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return;
      const h = new Html5Qrcode('qr-reader', { verbose: false });
      scanner.current = h;
      if (!window.isSecureContext || !navigator.mediaDevices) {
        setCamera('off');
        setErr('Your browser only allows the camera on secure (https) sites. Use “Scan from photo” instead, or your phone’s camera app.');
        return;
      }
      h.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => {
        if (isOrderUrl(text)) { h.stop().catch(() => {}); go(text); } else setErr('That QR code is not a table QR from this café.');
      }).then(() => setCamera('on')).catch(() => {
        setCamera('off');
        setErr('Camera not available or permission denied. Use “Scan from photo” instead.');
      });
    });
    return () => {
      stopped = true;
      const h = scanner.current;
      if (h?.isScanning) h.stop().catch(() => {});
    };
  }, []);

  const fromFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const h = scanner.current || new Html5Qrcode('qr-reader');
      if (h.isScanning) await h.stop();
      const text = await h.scanFile(f, false);
      if (!go(text)) setErr('That QR code is not a table QR from this café.');
    } catch {
      setErr('Could not find a QR code in that photo. Try again closer and in good light.');
    }
    e.target.value = '';
  };

  return (
    <div className="cx scan">
      <header className="cx-head">
        <img src="logo.svg" alt="" className="cx-logo" />
        <div className="cx-brand"><div className="cx-name">Scan your table</div><div className="cx-sub">Point the camera at the QR code on your table</div></div>
      </header>
      <div className="scan-wrap">
        <div id="qr-reader" className={`scan-box ${camera}`} />
        {camera !== 'on' && (
          <div className="scan-overlay">
            {camera === 'starting' ? <><Camera size={40} /><p>Starting camera…</p></> : <><ScanLine size={44} /><p>Camera is off</p></>}
          </div>
        )}
        {camera === 'on' && <div className="scan-laser" />}
      </div>
      {err && <div className="scan-err"><AlertTriangle size={16} /> {err}</div>}
      <label className="cx-btn big scan-file">
        <ImageUp size={18} /> Scan from photo
        <input type="file" accept="image/*" capture="environment" hidden onChange={fromFile} />
      </label>
      <a className="cx-btn ghost" href="#/" onClick={() => setTimeout(() => location.reload(), 50)}><ArrowLeft size={16} /> Back</a>
    </div>
  );
}
