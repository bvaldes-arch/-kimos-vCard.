#!/usr/bin/env node
/**
 * PDF interactivo de la tarjeta, para mostrar desde el teléfono y compartir.
 *
 *   node tools/make-pdf.mjs            (después de tools/build.mjs)
 *
 * Página 1 (formato teléfono): el QR es el protagonista. Al escanearlo se abre
 *   la tarjeta digital publicada. Debajo, botones con enlace real: WhatsApp
 *   (principal), guardar contacto, correo, LinkedIn, web, Instagram, llamar y
 *   ubicación.
 * Página 2 (apaisada): la tarjeta ejecutiva, con cada dato enlazado.
 *
 * Antes de imprimir, el QR se decodifica (jsQR) con el isotipo puesto y tiene
 * que dar EXACTAMENTE la URL pública; si no, el PDF no se genera.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const URL_PUBLICA = process.env.KVC_PUBLIC_URL || pkg.kvc.publicUrl;
const OUT = path.join(ROOT, 'docs', 'Bryan_Valdes_FIGIT_Tarjeta_Digital.pdf');
const core = fs.readFileSync(path.join(ROOT, 'app/kimos-vcard/assets/kvc-core.js'), 'utf8');
const jsqr = fs.readFileSync(path.join(ROOT, 'tools/vendor/jsQR.js'), 'utf8');
const img = (f) => 'data:image/' + (f.endsWith('.jpg') ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(path.join(ROOT, 'src/img', f)).toString('base64');
const IMGS = { photo: img('photo.jpg'), logo: img('logo-full.png'), logoMark: img('logo-mark.png'), logoWord: img('logo-word.png') };

const PAGE1_CSS = `
@page { margin: 0; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.p1 { width: 420px; height: 960px; box-sizing: border-box; position: relative; overflow: hidden; padding: 26px 26px 18px;
  font-family: "Plus Jakarta Sans", Inter, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0F172A;
  background: radial-gradient(600px 380px at 110% -10%, #CFE6FF, transparent 60%), radial-gradient(500px 400px at -20% 105%, #D7F6FF, transparent 60%), #F6FAFF; }
.p1 svg.bgc { position: absolute; width: 640px; height: 640px; right: -260px; top: -240px; color: #0052FF; opacity: .12; }
.p1 svg.bgd { position: absolute; width: 600px; height: 600px; left: -300px; bottom: -280px; color: #00D2FF; opacity: .18; }
.p1 > * { position: relative; }
.p1 .top { display: flex; align-items: center; justify-content: space-between; }
.p1 .lock { display: flex; align-items: center; gap: 7px; background: #fff; padding: 6px 10px 6px 8px; border-radius: 12px; border: 1px solid #E2E8F0; }
.p1 .lock img.m { height: 30px; } .p1 .lock img.w { height: 14px; }
.p1 .badge { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #0043D9; background: #EDF5FF; border: 1px solid #BFDBFE; padding: 5px 9px; border-radius: 999px; }
.p1 .who { display: flex; align-items: center; gap: 14px; margin-top: 20px; }
.p1 .av { width: 74px; height: 74px; border-radius: 50%; padding: 3px; background: linear-gradient(45deg, #0052FF, #00D2FF); flex: none; }
.p1 .av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; object-position: 50% 25%; border: 2px solid #fff; display: block; }
.p1 h1 { margin: 0; font-size: 27px; line-height: 1.1; font-weight: 800; letter-spacing: -.02em; color: #0D366B; }
.p1 .role { margin-top: 5px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #0052FF; }
.p1 .role span { color: #475569; font-weight: 600; text-transform: none; letter-spacing: 0; }
.p1 .qrcard { margin-top: 20px; padding: 18px 18px 14px; border-radius: 26px; background: #fff; border: 1px solid #DBEAFE; box-shadow: 0 24px 50px -24px rgba(0, 40, 140, .35); text-align: center; }
.p1 .k { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #0043D9; }
.p1 .k .kvc-i { width: 15px; height: 15px; }
.p1 .frame { display: inline-block; margin-top: 10px; padding: 12px; border-radius: 24px; background: linear-gradient(45deg, #0052FF, #00D2FF, #0043D9); }
.p1 .frame a { display: block; width: 236px; padding: 10px; border-radius: 16px; background: #fff; }
.p1 .frame svg { width: 100%; height: auto; display: block; }
.p1 .hint { margin: 10px 0 0; font-size: 12.5px; color: #475569; line-height: 1.45; }
.p1 .hint b { color: #0D366B; }
.p1 .wa { margin-top: 14px; display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 10px; border-radius: 18px; text-decoration: none; color: #fff;
  background: linear-gradient(135deg, #25D366, #0F9D6E); box-shadow: 0 14px 26px -14px #0F9D6E; }
.p1 .wa .ic { width: 42px; height: 42px; border-radius: 13px; background: rgba(255,255,255,.2); display: grid; place-items: center; }
.p1 .wa .ic .kvc-i { width: 25px; height: 25px; }
.p1 .wa b { display: block; font-size: 16px; } .p1 .wa small { font-size: 12px; opacity: .92; font-weight: 600; }
.p1 .wa .go { margin-left: auto; width: 18px; height: 18px; }
.p1 .grid { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.p1 .b { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 14px; text-decoration: none; color: #0F172A; background: #fff; border: 1px solid #E2E8F0; min-width: 0; }
.p1 .b .ic { width: 30px; height: 30px; flex: none; border-radius: 9px; display: grid; place-items: center; color: #fff; background: var(--c); }
.p1 .b .ic .kvc-i { width: 16px; height: 16px; }
.p1 .b span.t { display: flex; flex-direction: column; min-width: 0; font-size: 12px; font-weight: 700; line-height: 1.2; }
.p1 .b small { font-size: 10px; font-weight: 500; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.p1 .b.save { background: linear-gradient(90deg, #0052FF, #0043D9); color: #fff; border-color: transparent; }
.p1 .b.save small { color: #DBEAFE; } .p1 .b.save .ic { background: rgba(255,255,255,.2); }
.p1 .b.full { grid-column: 1 / -1; }
.p1 .ig .ic { background: radial-gradient(circle at 30% 107%, #FDF497 0%, #F58529 35%, #DD2A7B 60%, #8134AF 95%) !important; }
.p1 .foot { position: absolute; left: 26px; right: 26px; bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748B; }
.p1 .foot a { color: #0043D9; font-weight: 700; text-decoration: none; }
`;

const PAGE2_CSS = `
@page { margin: 0; }
html, body { margin: 0; padding: 0; background: #F1F6FD; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.kvc { background: #F1F6FD !important; min-height: 0 !important; }
.kvc .kvc-head, .kvc .kvc-foot, .kvc .kvc-flipbar, .kvc .kvc-card-actions, .kvc .kvc-back, .kvc .kvc-sheen, .kvc .kvc-bg { display: none !important; }
.kvc .kvc-body { padding: 52px 0 0 !important; align-items: flex-start !important; }
.kvc .kvc-view { animation: none !important; }
.kvc .kvc-scene { height: 350px !important; perspective: none !important; }
.kvc .kvc-c3d, .kvc .kvc-face { transform: none !important; transform-style: flat !important; }
.p2cap { text-align: center; font: 600 13px/1.4 "Plus Jakarta Sans", Inter, -apple-system, "Segoe UI", sans-serif; color: #475569; margin-top: 22px; }
.p2cap a { color: #0043D9; font-weight: 800; text-decoration: none; }
`;

function page1Html() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${PAGE1_CSS}</style></head><body><div id="r"></div>
<script>${core.replace(/<\/(script)/gi, '<\\/$1')}</script>
<script>
(function(){
  var P = KVC.normalize(Object.assign({}, KVC.DEFAULT_PROFILE, ${JSON.stringify(IMGS)}, { publicUrl: ${JSON.stringify(URL_PUBLICA)} }));
  var L = KVC.links(P), h = KVC.h, I = KVC.icon, U = ${JSON.stringify(URL_PUBLICA)};
  var qr = KVC.qrSvg(U, { dark: P.theme.ink, logo: P.logoMark });
  function contour(cls){ var s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('viewBox','0 0 600 600'); s.setAttribute('class',cls); s.setAttribute('fill','none'); s.setAttribute('stroke','currentColor');
    for (var i=0;i<6;i++){ var o=i*20,y=100+i*30,p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d','M'+(50+o)+' 300 C '+(150+o/2)+' '+y+', '+(350-o/2)+' '+y+', '+(550-o)+' 300 C '+(450-o)+' '+(600-y)+', '+(250+o/2)+' '+(600-y)+', '+(50+o)+' 300'); p.setAttribute('stroke-width','1.4'); s.appendChild(p);} return s; }
  function btn(href, cls, color, icon, t, sub){ return h('a',{href:href,class:'b '+cls,style:'--c:'+color}, h('span',{class:'ic'}, I(icon)), h('span',{class:'t'}, t, h('small',{text:sub}))); }
  document.getElementById('r').appendChild(h('div',{class:'p1'},
    contour('bgc'), contour('bgd'),
    h('div',{class:'top'}, h('a',{class:'lock',href:L.website}, h('img',{class:'m',src:P.logoMark,alt:''}), h('img',{class:'w',src:P.logoWord,alt:'FIGIT.ai'})), h('span',{class:'badge',text:'Tarjeta digital oficial'})),
    h('div',{class:'who'}, h('div',{class:'av'}, h('img',{src:P.photo,alt:P.name})),
      h('div',null, h('h1',{text:P.name}), h('div',{class:'role'}, P.title.toUpperCase()+'  ', h('span',{text:'· '+P.company})))),
    h('div',{class:'qrcard'},
      h('div',{class:'k'}, I('qr-code'), 'Escanea mi tarjeta'),
      h('div',null, h('div',{class:'frame'}, h('a',{href:U,id:'qr'}, qr))),
      h('p',{class:'hint'}, 'Apunta la cámara de tu teléfono: se abre mi ', h('b',{text:'tarjeta digital'}), ' con WhatsApp, correo, LinkedIn, web e Instagram.')),
    h('a',{class:'wa',href:L.whatsapp}, h('span',{class:'ic'}, I('whatsapp')), h('span',null, h('b',{text:'Escríbeme por WhatsApp'}), h('small',{text:P.phone+' · respuesta directa'})), I('chevron-right','go')),
    h('div',{class:'grid'},
      btn(U+'contacto.vcf','save','#0052FF','user-plus','Guardar contacto','Añadir a mi agenda'),
      btn(L.email,'','#0052FF','mail','Correo',P.email),
      btn(L.linkedin,'','#0A66C2','linkedin','LinkedIn','in/bryan-valdés-chacana'),
      btn(L.website,'','#4F46E5','globe','Sitio web','figit.ai'),
      btn(L.instagram,'ig','#DB2777','instagram','Instagram','@figit.ai'),
      btn(L.phone,'','#E53E3E','phone','Llamar',P.phone),
      btn(L.maps,'full','#E11D48','map-pin','Ubicación','Av. Larraín 5862, Piso 13, La Reina, Santiago')),
    h('div',{class:'foot'}, h('span',{text:'© '+new Date().getFullYear()+' FIGIT.ai'}), h('a',{href:U,text:'Abrir tarjeta digital ↗'}))));
})();
</script></body></html>`;
}

function page2Html() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${PAGE2_CSS}</style></head><body><div id="r"></div>
<script>${core.replace(/<\/(script)/gi, '<\\/$1')}</script>
<script>
KVC.injectCss();
var P = Object.assign({}, KVC.DEFAULT_PROFILE, ${JSON.stringify(IMGS)}, { publicUrl: ${JSON.stringify(URL_PUBLICA)} });
KVC.mount(document.getElementById('r'), P, { view: 'card', storage: false, qrUrl: ${JSON.stringify(URL_PUBLICA)} });
var cap = document.createElement('p'); cap.className = 'p2cap';
cap.append('Toca cualquier dato para contactarme · ');
var a = document.createElement('a'); a.href = ${JSON.stringify(URL_PUBLICA)}; a.textContent = 'Ver tarjeta digital'; cap.append(a);
document.querySelector('.kvc-cardview').appendChild(cap);
</script></body></html>`;
}

async function decode(page, selector) {
  return page.evaluate(async ([src, sel]) => {
    const jsQR = new Function(src + '; return jsQR;')();
    const svg = document.querySelector(sel);
    const xml = new XMLSerializer().serializeToString(svg);
    const im = new Image(); await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
    const c = document.createElement('canvas'); c.width = 680; c.height = 680;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 680, 680); g.drawImage(im, 40, 40, 600, 600);
    const d = g.getImageData(0, 0, 680, 680); const k = jsQR(d.data, 680, 680); return k ? k.data : null;
  }, [jsqr, selector]);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kvc-pdf-'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 960 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.setContent(page1Html(), { waitUntil: 'load' });
await page.waitForTimeout(300);
const got1 = await decode(page, '#qr svg');
if (got1 !== URL_PUBLICA) throw new Error('El QR de la página 1 decodifica «' + got1 + '», no «' + URL_PUBLICA + '»');
console.log('✔ QR página 1 (con isotipo) →', got1);
await page.screenshot({ path: path.join(tmp, 'p1.png') });
await page.pdf({ path: path.join(tmp, 'p1.pdf'), width: '420px', height: '960px', printBackground: true, pageRanges: '1' });

await page.setViewportSize({ width: 900, height: 520 });
await page.setContent(page2Html(), { waitUntil: 'load' });
await page.waitForTimeout(400);
const got2 = await decode(page, '.kvc-front-qrbox svg');
if (got2 !== URL_PUBLICA) throw new Error('El QR de la página 2 decodifica «' + got2 + '»');
console.log('✔ QR página 2 →', got2);
await page.screenshot({ path: path.join(tmp, 'p2.png') });
await page.pdf({ path: path.join(tmp, 'p2.pdf'), width: '900px', height: '520px', printBackground: true, pageRanges: '1' });
await browser.close();
if (errs.length) throw new Error('Errores en la página: ' + errs.join(' | '));

// Unir con pypdf (conserva los enlaces) y verificar que estén.
const py = `
import sys
from pypdf import PdfWriter, PdfReader
w = PdfWriter()
for f in sys.argv[2:]:
    w.append(PdfReader(f))
w.add_metadata({'/Title': 'Bryan Valdes Ch. · CEO & Fundador · FIGIT.ai — Tarjeta digital', '/Author': 'Bryan Valdes Ch.', '/Subject': 'Tarjeta de contacto virtual con QR', '/Keywords': 'FIGIT.ai, tarjeta digital, QR, WhatsApp, LinkedIn'})
w.write(sys.argv[1])
r = PdfReader(sys.argv[1])
for i, p in enumerate(r.pages):
    uris = [a.get_object()['/A'].get('/URI') for a in (p.get('/Annots') or []) if a.get_object().get('/A')]
    print('PAGE', i + 1, len(uris))
    for u in uris: print('  ', u)
`;
const res = execFileSync('python3', ['-c', py, OUT, path.join(tmp, 'p1.pdf'), path.join(tmp, 'p2.pdf')], { encoding: 'utf8' });
console.log(res.trim());
fs.copyFileSync(path.join(tmp, 'p1.png'), path.join(ROOT, 'docs', 'preview-pdf-1.png'));
fs.copyFileSync(path.join(tmp, 'p2.png'), path.join(ROOT, 'docs', 'preview-pdf-2.png'));
console.log('✔ PDF →', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
