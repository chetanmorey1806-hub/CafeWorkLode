import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** upi://pay deep link — opens GPay / PhonePe / Paytm with the amount filled in. */
export const upiLink = ({ upiId, name, amount, note }) =>
  `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name || '')}&am=${Number(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note || '')}`;

/** Dynamic UPI QR for an exact bill amount — scan with any UPI app. */
export default function UpiQr({ upiId, name, amount, note, size = 220, caption }) {
  const [src, setSrc] = useState('');
  const link = upiLink({ upiId, name, amount, note });
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(link, { width: size * 2, margin: 1, color: { dark: '#1d140e', light: '#ffffff' } }).then((u) => alive && setSrc(u));
    return () => { alive = false; };
  }, [link, size]);
  if (!upiId) return null;
  return (
    <div className="upi-qr">
      {src ? <img src={src} width={size} height={size} alt={`UPI QR for ₹${amount}`} /> : <div className="upi-qr-ph" style={{ width: size, height: size }} />}
      <div className="upi-qr-cap">{caption || <>Scan with GPay · PhonePe · Paytm<br /><b>{upiId}</b></>}</div>
    </div>
  );
}
