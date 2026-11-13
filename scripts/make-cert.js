/**
 * Creates HTTPS certificates so phones on the café Wi-Fi can install the app (PWA).
 *
 *   npm run make-cert
 *
 * Makes a private "Soffity Cafe Local CA" (once) and a server certificate for localhost and this
 * computer's network IPs. Each phone installs ca.crt once (download it from https://<pc-ip>:4443/ca.crt
 * or http://<pc-ip>:4000/ca.crt). Re-run this if the computer's IP address changes.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'certs');
fs.mkdirSync(dir, { recursive: true });
const f = (n) => path.join(dir, n);
const ssl = (...args) => execFileSync('openssl', args, { stdio: 'pipe' });

const ips = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
const extra = process.argv.slice(2); // optional extra IPs / hostnames

// 1. local certificate authority (kept, so phones don't need to re-install it)
if (!fs.existsSync(f('ca.key')) || !fs.existsSync(f('ca.crt'))) {
  ssl('genrsa', '-out', f('ca.key'), '2048');
  ssl('req', '-x509', '-new', '-nodes', '-key', f('ca.key'), '-sha256', '-days', '3650',
    '-subj', '/CN=Soffity Cafe Local CA/O=Soffity Cafe',
    '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
    '-out', f('ca.crt'));
  console.log('Created local CA: server/certs/ca.crt');
}

// 2. server certificate (≤ 825 days so iPhones accept it)
const sans = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((i) => `IP:${i}`), ...extra.map((x) => (/^[\d.]+$/.test(x) ? `IP:${x}` : `DNS:${x}`))];
fs.writeFileSync(f('server.ext'), [
  'authorityKeyIdentifier=keyid,issuer',
  'basicConstraints=CA:FALSE',
  'keyUsage=digitalSignature,keyEncipherment',
  'extendedKeyUsage=serverAuth',
  `subjectAltName=${sans.join(',')}`,
].join('\n'));
ssl('genrsa', '-out', f('server.key'), '2048');
ssl('req', '-new', '-key', f('server.key'), '-subj', '/CN=Soffity Cafe', '-out', f('server.csr'));
ssl('x509', '-req', '-in', f('server.csr'), '-CA', f('ca.crt'), '-CAkey', f('ca.key'), '-CAcreateserial',
  '-out', f('server.crt'), '-days', '825', '-sha256', '-extfile', f('server.ext'));
fs.rmSync(f('server.csr'));

console.log(`HTTPS certificate ready for: ${sans.join(', ')}`);
console.log('Restart the server (npm start) — it will also listen on https port 4443.');
