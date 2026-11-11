#!/usr/bin/env node
/**
 * Prueba de punta a punta de la tarjeta en Chromium (Playwright):
 *  - la tarjeta autónoma (docs/) se pinta en móvil y escritorio, en sus 3 vistas;
 *  - CADA QR visible se decodifica (jsQR) y debe dar exactamente la URL esperada;
 *  - todos los enlaces de canal son reales (wa.me, mailto, linkedin, https…);
 *  - el vCard generado tiene los campos y la foto.
 * Uso: node tools/test.mjs [--shots dir]
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const EXPECTED = process.env.KVC_PUBLIC_URL || pkg.kvc.publicUrl;
const shotsIdx = process.argv.indexOf('--shots');
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : '';
const jsqrSrc = fs.readFileSync(path.join(ROOT, 'tools/vendor/jsQR.js'), 'utf8');

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.vcf': 'text/vcard' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, 'docs', decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(path.join(ROOT, 'docs')) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) fails++; };

async function decodeQrs(page, label, expected = EXPECTED) {
  const results = await page.evaluate(async (src) => {
    // eslint-disable-next-line no-new-func
    const jsQR = new Function(src + '; return jsQR;')();
    const out = [];
    for (const svg of document.querySelectorAll('.kvc-qr-slot svg')) {
      const r = svg.getBoundingClientRect();
      if (!r.width || svg.closest('[hidden]')) continue;
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
      const px = 600, c = document.createElement('canvas'); c.width = px + 80; c.height = px + 80;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
      g.drawImage(img, 40, 40, px, px);
      const d = g.getImageData(0, 0, c.width, c.height);
      const code = jsQR(d.data, d.width, d.height);
      out.push(code ? code.data : null);
    }
    return out;
  }, jsqrSrc);
  ok(results.length > 0, `${label}: ${results.length} QR visibles`);
  results.forEach((r, i) => ok(r === expected, `${label}: QR #${i + 1} decodifica → ${r}`));
}

const browser = await chromium.launch();
for (const [name, ctxOpts] of [
  ['móvil', { viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1, isMobile: true, hasTouch: true }],
  ['escritorio', { viewport: { width: 1280, height: 860 }, deviceScaleFactor: SHOTS ? 2 : 1 }],
]) {
  console.log(`\n▶ ${name}`);
  const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, ctxOpts));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.kvc-hub');
  await page.waitForTimeout(600);
  ok(await page.locator('.kvc-hub').isVisible(), 'arranca en la vista Hub (lo primero que ve quien escanea)');
  ok((await page.locator('.kvc-name').textContent()) === 'Bryan Valdes Ch.', 'nombre correcto');
  const imgs = await page.$$eval('.kvc img', (els) => els.filter((e) => e.offsetParent).map((e) => [e.getAttribute('src'), e.naturalWidth]));
  ok(imgs.every(([, w]) => w > 0), `imágenes cargadas (${imgs.length}): foto y logo oficial`);
  const hrefs = await page.$$eval('.kvc-hl', (els) => els.map((e) => e.href));
  const want = [/^https:\/\/wa\.me\/56987161097\?text=/, /^mailto:bvaldes@figit\.ai/, /^https:\/\/www\.linkedin\.com\/in\//, /^https:\/\/figit\.ai/, /^https:\/\/www\.instagram\.com\/figit\.chile\/$/, /^tel:\+56987161097$/, /^https:\/\/www\.google\.com\/maps\//];
  want.forEach((re, i) => ok(re.test(hrefs[i] || ''), `canal ${i + 1}: ${hrefs[i]}`));
  ok((await page.locator('.kvc-hl').first().textContent()).includes('WhatsApp'), 'WhatsApp es el primer canal');
  ok(await page.locator('.kvc-pill-wa').isVisible(), 'acceso rápido de WhatsApp en el Hub');
  ok((await page.locator('.kvc-hub a[href^="mailto:"]').count()) === 1, 'el correo aparece una sola vez en el Hub');
  ok(await page.locator('.kvc-hub .kvc-corner-logo img').isVisible(), 'logo de la marca arriba a la izquierda del Hub');
  ok(/CEO · Fundador/i.test(await page.locator('.kvc-hub .kvc-title').textContent()) && (await page.locator('.kvc-hub .kvc-company').textContent()) === 'FIGIT.ai', 'cargo bajo el nombre y empresa debajo');
  await decodeQrs(page, 'Hub');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-1-hub.png`), fullPage: true });

  // vCard
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.kvc-save')]);
  const vcf = fs.readFileSync(await dl.path(), 'utf8');
  ok(/FN:Bryan Valdes Ch\./.test(vcf) && /TEL;TYPE=CELL,VOICE,PREF:\+56987161097/.test(vcf) && /EMAIL;[^:]*:bvaldes@figit\.ai/.test(vcf), 'vCard con nombre, teléfono y correo');
  ok(/PHOTO;ENCODING=b;TYPE=JPEG:/.test(vcf), 'vCard incluye la foto');

  await page.click('.kvc-tab[data-v="card"]');
  await page.waitForTimeout(500);
  await decodeQrs(page, 'Tarjeta 3D');
  ok(/^https:\/\/wa\.me\/56987161097/.test(await page.locator('.kvc-front .kvc-fr.kvc-c-whatsapp').getAttribute('href')), 'la Tarjeta 3D tiene enlace a WhatsApp');
  ok(await page.locator('.kvc-front-main .kvc-front-logo img').isVisible(), 'logo arriba a la derecha de la Tarjeta 3D');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-2-tarjeta.png`) });
  await page.click('.kvc-scene', { position: { x: 30, y: 30 } });
  await page.waitForTimeout(900);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-3-reverso.png`) });

  await page.click('.kvc-tab[data-v="qr"]');
  await page.waitForTimeout(400);
  await decodeQrs(page, 'Código QR');
  ok(await page.locator('.kvc-panel-qr .kvc-corner-logo img').isVisible(), 'logo arriba a la derecha en Código QR');
  for (const [k, re] of [['whatsapp', /^https:\/\/wa\.me\/56987161097/], ['website', /^https:\/\/figit\.ai/], ['instagram', /^https:\/\/www\.instagram\.com\/figit\.chile\/$/], ['linkedin', /^https:\/\/www\.linkedin\.com\/in\//]]) {
    await page.click(`.kvc-dest[data-k="${k}"]`);
    const url = await page.inputValue('.kvc-qrview .kvc-input');
    ok(re.test(url), `destino ${k} → ${url.slice(0, 60)}`);
    await decodeQrs(page, `QR → ${k}`, url);
  }
  if (SHOTS) await page.click('.kvc-dest[data-k="whatsapp"]');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-5-qr-whatsapp.png`), fullPage: true });
  await page.click('.kvc-dest[data-k="card"]');
  // El PNG HD (con el isotipo al centro) también debe leerse.
  const [pngDl] = await Promise.all([page.waitForEvent('download'), page.click('.kvc-qr-actions .kvc-btn-s-primary')]);
  const pngData = 'data:image/png;base64,' + fs.readFileSync(await pngDl.path()).toString('base64');
  const pngText = await page.evaluate(async ([src, url]) => {
    const jsQR = new Function(src + '; return jsQR;')();
    const img = new Image(); await new Promise((r) => { img.onload = r; img.src = url; });
    const c = document.createElement('canvas'); c.width = 700; c.height = 700;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 700, 700); g.drawImage(img, 50, 50, 600, 600);
    const d = g.getImageData(0, 0, 700, 700); const code = jsQR(d.data, 700, 700); return code ? code.data : null;
  }, [jsqrSrc, pngData]);
  ok(pngText === EXPECTED, 'PNG HD con logo decodifica → ' + pngText);
  // Un destino no ejecutable se rechaza y el QR se queda con el real.
  await page.fill('.kvc-qrview .kvc-input', 'blob:https://x/123');
  await page.dispatchEvent('.kvc-qrview .kvc-input', 'input');
  ok((await page.locator('.kvc-field-err').textContent()).length > 0, 'rechaza un destino blob: (no ejecutable)');
  await decodeQrs(page, 'Código QR tras blob:');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-4-qr.png`), fullPage: true });
  ok(errors.length === 0, 'sin errores de consola' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
await browser.close();
server.close();
console.log(fails ? `\n✖ ${fails} fallos` : '\n✔ todo correcto');
process.exit(fails ? 1 : 0);
