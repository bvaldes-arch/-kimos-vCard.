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
  .replace("/*@@CSS@@*/ ''", () => JSON.stringify(css));
if (/@@\w+@@/.test(core)) throw new Error('Quedó un marcador sin reemplazar en el núcleo');

/* ── App KIMOS ── */
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(path.join(APP, 'dist'), { recursive: true });
fs.mkdirSync(path.join(APP, 'assets'), { recursive: true });

let app = read('app.js').replace('/*@@CORE@@*/', () => core);
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
  ogImage: PAGES_URL + 'photo.jpg',
  icon: 'logo-mark.png',
});
fs.writeFileSync(path.join(DOCS, 'index.html'), html);
fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');
fs.writeFileSync(path.join(DOCS, 'contacto.vcf'), KVC.vcard(profile, fs.readFileSync(path.join(SRC, 'img', 'photo.jpg')).toString('base64')));

console.log(`✔ kimos-vcard ${VERSION}`);
console.log(`  app/kimos-vcard  (dist ${(app.length / 1024).toFixed(0)} KB, core ${(core.length / 1024).toFixed(0)} KB)`);
console.log(`  docs/index.html  → ${PAGES_URL}`);
