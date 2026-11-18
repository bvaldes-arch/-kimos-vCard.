#!/usr/bin/env node
/**
 * Build de KIMOS vCard.
 *
 *   node tools/build.mjs
 *
 * Genera, a partir de src/:
 *   app/kimos-vcard/            la app KIMOS (misma forma que kimos-packages/apps/{id})
 *     manifest.json
 *     dist/index.js, dist/index.css
 *     assets/card.html          página pública que abre el QR (servida por KIMOS)
 *     assets/kvc-core.js        núcleo de la tarjeta (lo usa card.html y «Exportar HTML»)
 *     assets/*.jpg|png          foto y logos por defecto
 *   docs/                       tarjeta autónoma para GitHub Pages / cualquier hosting
 *
 * Sin dependencias: solo Node ≥ 18.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const APP = path.join(ROOT, 'app', 'kimos-vcard');
const DOCS = path.join(ROOT, 'docs');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
// URL pública de la tarjeta autónoma (GitHub Pages del repo). Sobrescribible.
const PAGES_URL = process.env.KVC_PUBLIC_URL || pkg.kvc.publicUrl;
// Gateway de la tarjeta publicada en KIMOS (…/api/public/app/{instancia}/submit/).
// Con él, el formulario y la medición de docs/ llegan a la app. Lo muestra la
// app en Publicar → «Enlace para formularios externos».
const GATEWAY = (process.env.KVC_GATEWAY || (pkg.kvc && pkg.kvc.gateway) || '').replace(/\/?$/, '/');

/* ── Núcleo ── */
function icons() {
  const raw = JSON.parse(read('vendor/icons.json'));
  const out = {};
  for (const [name, { fill, body }] of Object.entries(raw)) {
    const els = [];
    for (const m of body.matchAll(/<(\w+)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
      if (m[1] === 'svg') continue;
      const attrs = {};
      for (const a of m[2].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
      els.push([m[1], attrs]);
    }
    out[name] = { fill, els };
  }
  return out;
}
let qr = read('vendor/qrcode.js');
qr = qr.slice(0, qr.indexOf('(function (factory) {')).trim(); // sin envoltorio UMD
const css = read('card.css');
const core = read('card-core.js')
  .replace('/*@@QRCODE@@*/', () => qr)
  .replace('/*@@ICONS@@*/ {}', () => JSON.stringify(icons()))
  .replace("/*@@CSS@@*/ ''", () => JSON.stringify(css))
  .replace("'@@VERSION@@'", () => JSON.stringify(VERSION));
if (/@@\w+@@/.test(core)) throw new Error('Quedó un marcador sin reemplazar en el núcleo');

/* ── App KIMOS ── */
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(path.join(APP, 'dist'), { recursive: true });
fs.mkdirSync(path.join(APP, 'assets'), { recursive: true });

// v1.3: el bundle ya NO lleva el núcleo dentro; lo carga de assets/kvc-core.js.
let app = read('app.js').replace("/*@@APPCSS@@*/ ''", () => JSON.stringify(read('app.css')));
if (/@@\w+@@/.test(app)) throw new Error('Quedó un marcador sin reemplazar en la app');
app = app.replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${VERSION}';`);
fs.writeFileSync(path.join(APP, 'dist', 'index.js'), app);
fs.writeFileSync(path.join(APP, 'dist', 'index.css'), read('app.css'));
fs.writeFileSync(path.join(APP, 'assets', 'kvc-core.js'), core);

const IMAGES = ['photo.jpg', 'logo-full.png', 'logo-mark.png', 'logo-word.png'];
for (const f of IMAGES) fs.copyFileSync(path.join(SRC, 'img', f), path.join(APP, 'assets', f));

const cardHtml = read('card.html').replace('/*@@VERSION@@*/', VERSION);
fs.writeFileSync(path.join(APP, 'assets', 'card.html'), cardHtml);

const manifest = JSON.parse(read('manifest.json'));
manifest.version = VERSION;
manifest.assets = ['card.html', 'kvc-core.js', ...IMAGES];
fs.writeFileSync(path.join(APP, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(APP, 'README.md'), read('APP-README.md').replace(/\{\{VERSION\}\}/g, VERSION));

/* ── Página autónoma (docs/) ── */
fs.mkdirSync(DOCS, { recursive: true });
for (const f of IMAGES) fs.copyFileSync(path.join(SRC, 'img', f), path.join(DOCS, f));
// Evaluamos el núcleo en un sandbox mínimo para reutilizar standaloneHtml().
const KVC = new Function(core + '\nreturn KVC;')();
const profile = KVC.normalize(Object.assign({}, KVC.DEFAULT_PROFILE, { publicUrl: PAGES_URL }));
const html = KVC.standaloneHtml(profile, core, {
  qrUrl: PAGES_URL,
  canonical: PAGES_URL,
  ogImage: PAGES_URL + 'og.png',          // la genera tools/make-pdf.mjs
  icon: 'logo-mark.png',
  touchIcon: 'photo.jpg',
  manifest: 'manifest.webmanifest',
  configUrl: 'kvc-config.json',
  leadEndpoint: GATEWAY.length > 1 ? GATEWAY + 'lead' : '',
  statsEndpoint: GATEWAY.length > 1 ? GATEWAY + 'visita' : '',
});
// Conexión con KIMOS editable sin regenerar: pega aquí el «Enlace para
// formularios externos» de la app (pestaña Publicar).
const cfgPath = path.join(DOCS, 'kvc-config.json');
const prevCfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
fs.writeFileSync(cfgPath, JSON.stringify({
  gateway: GATEWAY.length > 1 ? GATEWAY : (prevCfg.gateway || ''),
  _ayuda: 'Pega en "gateway" el «Enlace para formularios externos» de KIMOS vCard (pestaña Publicar). Termina en /submit/. Con él, cada prospecto de esta página queda registrado en la app.',
}, null, 2) + '\n');
fs.writeFileSync(path.join(DOCS, 'manifest.webmanifest'), JSON.stringify({
  name: profile.name + ' · ' + profile.company,
  short_name: profile.name.split(' ')[0] + ' · ' + profile.company,
  start_url: './', scope: './', display: 'standalone',
  background_color: '#F8FAFC', theme_color: profile.theme.primary,
  icons: [{ src: 'photo.jpg', sizes: '360x360', type: 'image/jpeg' }, { src: 'logo-mark.png', sizes: '256x256', type: 'image/png' }],
}, null, 2));
fs.writeFileSync(path.join(DOCS, 'index.html'), html);
fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');
fs.writeFileSync(path.join(DOCS, 'contacto.vcf'), KVC.vcard(profile, fs.readFileSync(path.join(SRC, 'img', 'photo.jpg')).toString('base64')));

console.log(`✔ kimos-vcard ${VERSION}`);
console.log(`  app/kimos-vcard  (dist ${(app.length / 1024).toFixed(0)} KB, core ${(core.length / 1024).toFixed(0)} KB)`);
console.log(`  docs/index.html  → ${PAGES_URL}` + (GATEWAY.length > 1 ? `  (formulario y medición → ${GATEWAY})` : '  (formulario → WhatsApp: falta kvc.gateway)'));
