#!/usr/bin/env node
/**
 * Pases de Apple Wallet y Google Wallet para la tarjeta de contacto.
 *
 * Guardan SOLO la tarjeta de contacto (nombre, cargo, empresa, contacto y el
 * QR que abre la tarjeta digital). No tienen relación con pagos: Apple usa el
 * estilo «generic» y Google el «Generic pass».
 *
 * Las firmas exigen credenciales del emisor y se hacen aquí, en tu equipo,
 * nunca en la app ni en el navegador:
 *
 *   Apple  → certificado «Pass Type ID» (Apple Developer Program) en PEM,
 *            su llave privada y el certificado intermedio WWDR de Apple.
 *   Google → cuenta de servicio de Google Cloud (JSON) con acceso a la
 *            Google Wallet API y el ID de emisor (Issuer ID).
 *
 * Uso:
 *   node tools/wallet.mjs --apple-cert pass.pem --apple-key pass.key \
 *        --wwdr wwdr.pem --pass-type pass.ai.figit.tarjeta --team ABCDE12345 \
 *        [--key-pass secreto]
 *   node tools/wallet.mjs --google-sa cuenta.json --issuer 3388000000012345678
 *
 *   Opcionales: --url <tarjeta> (por defecto la de package.json)
 *               --profile perfil.json (por defecto el perfil de fábrica)
 *               --out docs/wallet
 *
 * Resultado: docs/wallet/<nombre>.pkpass y docs/wallet/google-wallet-url.txt.
 * Pega ambos enlaces en la app (Publicar → Apple Wallet y Google Wallet).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true'; args[k] = v; }
}
const die = (m) => { console.error('✖ ' + m); process.exit(1); };

const corePath = path.join(ROOT, 'app/kimos-vcard/assets/kvc-core.js');
if (!fs.existsSync(corePath)) die('Falta el núcleo: ejecuta antes node tools/build.mjs');
const KVC = new Function(fs.readFileSync(corePath, 'utf8') + '\nreturn KVC;')();

const cardUrl = args.url || process.env.KVC_PUBLIC_URL || pkg.kvc.publicUrl;
const base = cardUrl.endsWith('/') ? cardUrl : cardUrl.replace(/[^/]*$/, '');
const profile = KVC.normalize(args.profile ? JSON.parse(fs.readFileSync(args.profile, 'utf8')) : KVC.DEFAULT_PROFILE);
const out = path.resolve(args.out || path.join(ROOT, 'docs/wallet'));
fs.mkdirSync(out, { recursive: true });
const name = KVC.slug(profile.name).toLowerCase();
let did = false;

/* ── ZIP sin compresión (lo que exige un .pkpass es un ZIP válido) ── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  const parts = [], central = [];
  let off = 0;
  for (const [fname, data] of files) {
    const nameB = Buffer.from(fname, 'utf8'), crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, nameB, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nameB);
    off += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

/* ── Apple Wallet ── */
if (args['apple-cert'] || args['apple-key'] || args.wwdr) {
  for (const k of ['apple-cert', 'apple-key', 'wwdr', 'pass-type', 'team']) if (!args[k] || args[k] === 'true') die('Apple Wallet: falta --' + k);
  const pass = KVC.walletApplePass(profile, { cardUrl, passTypeIdentifier: args['pass-type'], teamIdentifier: args.team, serialNumber: 'vcard-' + name });
  const imgDir = path.join(ROOT, 'src/img/wallet');
  const files = [['pass.json', Buffer.from(JSON.stringify(pass, null, 2))]];
  for (const f of fs.readdirSync(imgDir).filter((f) => f.endsWith('.png')).sort()) files.push([f, fs.readFileSync(path.join(imgDir, f))]);
  const manifest = {};
  for (const [f, d] of files) manifest[f] = crypto.createHash('sha1').update(d).digest('hex');
  const manifestB = Buffer.from(JSON.stringify(manifest, null, 2));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kvc-pass-'));
  fs.writeFileSync(path.join(tmp, 'manifest.json'), manifestB);
  const sslArgs = ['smime', '-binary', '-sign', '-certfile', args.wwdr, '-signer', args['apple-cert'], '-inkey', args['apple-key'],
    '-in', path.join(tmp, 'manifest.json'), '-out', path.join(tmp, 'signature'), '-outform', 'DER'];
  if (args['key-pass']) sslArgs.push('-passin', 'pass:' + args['key-pass']);
  try { execFileSync('openssl', sslArgs, { stdio: 'pipe' }); } catch (e) { die('openssl no pudo firmar: ' + String(e.stderr || e.message)); }
  files.push(['manifest.json', manifestB], ['signature', fs.readFileSync(path.join(tmp, 'signature'))]);
  const file = path.join(out, name + '.pkpass');
  fs.writeFileSync(file, zip(files));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✔ Apple Wallet →', path.relative(ROOT, file), '(' + files.length + ' archivos)');
  console.log('  Publica el archivo (p. ej. GitHub Pages: ' + base + 'wallet/' + name + '.pkpass) y pega ese enlace en la app.');
  did = true;
}

/* ── Google Wallet ── */
if (args['google-sa'] || args.issuer) {
  if (!args['google-sa'] || !args.issuer) die('Google Wallet: faltan --google-sa y/o --issuer');
  const sa = JSON.parse(fs.readFileSync(args['google-sa'], 'utf8'));
  if (!sa.client_email || !sa.private_key) die('La cuenta de servicio no trae client_email/private_key');
  const payload = KVC.walletGoogleObject(profile, {
    issuerId: args.issuer, cardUrl, suffix: name,
    logoUrl: base + 'logo-mark.png', heroUrl: base + 'og.png',
  });
  const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: sa.client_email, aud: 'google', typ: 'savetowallet', iat: Math.floor(Date.now() / 1000), origins: [new URL(cardUrl).origin], payload };
  const unsigned = b64u(header) + '.' + b64u(claims);
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const url = 'https://pay.google.com/gp/v/save/' + unsigned + '.' + sig;
  fs.writeFileSync(path.join(out, 'google-wallet-url.txt'), url + '\n');
  console.log('✔ Google Wallet →', path.relative(ROOT, path.join(out, 'google-wallet-url.txt')), '(' + url.length + ' caracteres)');
  console.log('  Pega ese enlace en la app (Publicar → «Guardar en Google Wallet»).');
  did = true;
}

if (!did) {
  console.log('Nada que firmar. Pases de Wallet SOLO para guardar la tarjeta de contacto (sin pagos).');
  console.log('  Apple : --apple-cert --apple-key --wwdr --pass-type --team');
  console.log('  Google: --google-sa --issuer');
}
