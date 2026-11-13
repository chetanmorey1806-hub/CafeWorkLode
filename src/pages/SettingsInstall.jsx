import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, ShieldCheck, Download, AlertTriangle, CheckCircle2, Apple } from 'lucide-react';
import { useOrderBaseUrl } from '../components/QrCodes';
import { useInstallPrompt } from '../utils/pwa';

const Qr = ({ text }) => {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(text, { width: 360, margin: 1 }).then(setSrc); }, [text]);
  return src ? <img src={src} alt="" className="inst-qr" /> : <div className="inst-qr qr-ph" />;
};

/** Settings card: how to install the app on phones/tablets (needs https → local certificate). */
export function InstallSettings() {
  const { info } = useOrderBaseUrl();
  const { canInstall, install } = useInstallPrompt();
  const [os, setOs] = useState(/iphone|ipad/i.test(navigator.userAgent) ? 'ios' : 'android');
  const ip = info.lanIps?.[0];
  const httpsUrl = ip && info.httpsPort ? `https://${ip}:${info.httpsPort}/` : null;
  const caUrl = ip && info.port ? `http://${ip}:${info.port}/ca.crt` : null;
  const installedHere = window.matchMedia?.('(display-mode: standalone)').matches;

  return (
    <div className="card">
      <div className="card-head"><h3 className="flex-c"><Smartphone size={17} /> Install the app on phones & tablets</h3></div>

      {installedHere && <div className="inst-ok"><CheckCircle2 size={16} /> This device is running the installed app.</div>}
      {canInstall && <button className="btn btn-primary btn-block" onClick={install}><Download size={16} /> Install on this device</button>}

      {!info.httpsPort ? (
        <div className="qr-warn mt">
          <AlertTriangle size={18} />
          <div>Phones only allow installing over a secure (https) link. On the café computer run <code>npm run make-cert</code>, then <code>npm start</code>.</div>
        </div>
      ) : !info.built ? (
        <div className="qr-warn mt">
          <AlertTriangle size={18} />
          <div>HTTPS is set up. Start the app with <code>npm start</code> (not the dev server) so phones can open <b>{httpsUrl}</b>.</div>
        </div>
      ) : null}

      {httpsUrl && (
        <>
          <div className="seg mt">
            <button className={`seg-btn ${os === 'android' ? 'active' : ''}`} onClick={() => setOs('android')}><Smartphone size={15} /> Android</button>
            <button className={`seg-btn ${os === 'ios' ? 'active' : ''}`} onClick={() => setOs('ios')}><Apple size={15} /> iPhone / iPad</button>
          </div>
          <p className="muted small mt">The phone must be on the café Wi-Fi. Step 1 is needed only once per phone.</p>
          <div className="inst-steps">
            <div className="inst-step">
              <span className="inst-n">1</span>
              <Qr text={caUrl} />
              <div>
                <b className="flex-c"><ShieldCheck size={15} /> Trust the café certificate</b>
                {os === 'android' ? (
                  <ol>
                    <li>Scan this, download <i>SoffityCafe-CA.crt</i></li>
                    <li>Settings → Security → <i>Encryption & credentials</i> → <i>Install a certificate</i> → <i>CA certificate</i></li>
                    <li>Choose the downloaded file → Install anyway</li>
                  </ol>
                ) : (
                  <ol>
                    <li>Scan this in Safari → <i>Allow</i> the profile download</li>
                    <li>Settings → <i>Profile Downloaded</i> → Install</li>
                    <li>Settings → General → About → <i>Certificate Trust Settings</i> → turn on “Soffity Cafe Local CA”</li>
                  </ol>
                )}
                <a className="link small" href={caUrl}>{caUrl}</a>
              </div>
            </div>
            <div className="inst-step">
              <span className="inst-n">2</span>
              <Qr text={httpsUrl} />
              <div>
                <b className="flex-c"><Download size={15} /> Open & install the app</b>
                {os === 'android' ? (
                  <ol>
                    <li>Scan this in <b>Chrome</b></li>
                    <li>Tap <i>Install app</i> (or ⋮ menu → <i>Add to Home screen</i> → Install)</li>
                    <li>Open “Soffity” from the home screen and enter the café PIN</li>
                  </ol>
                ) : (
                  <ol>
                    <li>Scan this in <b>Safari</b></li>
                    <li>Tap the Share button → <i>Add to Home Screen</i></li>
                    <li>Open “Soffity” from the home screen and enter the café PIN</li>
                  </ol>
                )}
                <a className="link small" href={httpsUrl}>{httpsUrl}</a>
              </div>
            </div>
          </div>
          <p className="muted small">Customers don't need any of this — they just scan the table QR code. If this computer's IP address changes, run <code>npm run make-cert</code> again (and reserve its IP in the Wi-Fi router to avoid that).</p>
        </>
      )}
    </div>
  );
}
