/*
 * KIMOS vCard — núcleo de la tarjeta (compartido).
 *
 * Este mismo código pinta la tarjeta en TRES lugares, para que lo que ve quien
 * escanea sea exactamente lo que se edita:
 *   1. La vista previa dentro de la app de KIMOS (dist/index.js).
 *   2. La página pública que abre el QR (assets/card.html), servida por KIMOS.
 *   3. La página autónoma exportable (docs/index.html), para alojar donde sea.
 *
 * Sin dependencias de red: íconos SVG y motor QR (qrcode-generator, MIT,
 * Kazuhiko Arase) van embebidos. Todo texto del perfil se pinta como texto
 * (textContent), nunca como HTML.
 */
var KVC = (function () {
  'use strict';

  /* ── Motor QR (qrcode-generator 1.4.4, MIT) ─────────────────────────── */
  var qrcode = (function () {
    /*@@QRCODE@@*/
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    return qrcode;
  })();

  /* ── Íconos: Simple Icons (CC0) para marcas, Lucide (ISC) el resto ──── */
  var ICONS = /*@@ICONS@@*/ {};

  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ── Perfil por defecto: Bryan Valdes Ch. · FIGIT.ai ────────────────── */
  var DEFAULT_PROFILE = {
    name: 'Bryan Valdes Ch.',
    firstName: 'Bryan',
    lastName: 'Valdes Chacana',
    title: 'CEO & Fundador',
    company: 'FIGIT.ai',
    tagline: 'Transformando el futuro con Inteligencia Artificial y ecosistemas digitales.',
    phone: '+56 9 8716 1097',
    whatsapp: '56987161097',
    whatsappMsg: 'Hola Bryan, un gusto saludarte. Te contacto desde tu tarjeta digital FIGIT.ai',
    email: 'bvaldes@figit.ai',
    website: 'https://figit.ai',
    linkedin: 'https://www.linkedin.com/in/bryan-vald%C3%A9s-chacana/',
    instagram: 'https://www.instagram.com/figit.ai/',
    address: 'Av. Larraín 5862, Piso 13, La Reina, Santiago, Región Metropolitana',
    city: 'Santiago',
    region: 'Región Metropolitana',
    country: 'Chile',
    photo: 'asset:photo.jpg',
    logo: 'asset:logo-full.png',
    logoMark: 'asset:logo-mark.png',
    logoWord: 'asset:logo-word.png',
    publicUrl: '',
    cardId: 'FIGIT-EXEC-001',
    motto: 'Inteligencia Artificial Estratégica, Modelos Predictivos y Automatización de Alto Impacto.',
    location: 'Santiago, Chile',
    hashtag: '#AIChile',
    font: '',
    brandId: '',
    brandName: '',
    theme: { primary: '#0052FF', ink: '#0D366B', soft: '#DDF0FF', accent: '#00D2FF' }
  };

  var FIELDS = ['name', 'firstName', 'lastName', 'title', 'company', 'tagline', 'phone', 'whatsapp',
    'whatsappMsg', 'email', 'website', 'linkedin', 'instagram', 'address', 'city', 'region', 'country',
    'photo', 'logo', 'logoMark', 'logoWord', 'publicUrl', 'cardId', 'motto', 'location', 'hashtag', 'font', 'brandId', 'brandName'];

  function str(v, max) {
    if (v === null || v === undefined) return '';
    var s = String(v).replace(/[\u0000-\u001f]/g, ' ').trim();
    return s.length > (max || 400) ? s.slice(0, max || 400) : s;
  }
  function isHex(c) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')); }

  function normalize(p) {
    p = p || {};
    var out = {};
    FIELDS.forEach(function (k) {
      var max = /photo|logo/.test(k) ? 800000 : 400;
      out[k] = p[k] === undefined ? DEFAULT_PROFILE[k] : str(p[k], max);
    });
    out.whatsapp = out.whatsapp.replace(/\D/g, '');
    out.font = out.font.replace(/[^\w \-]/g, '').slice(0, 60);
    var t = p.theme || {};
    out.theme = {};
    Object.keys(DEFAULT_PROFILE.theme).forEach(function (k) {
      out.theme[k] = isHex(t[k]) ? t[k] : DEFAULT_PROFILE.theme[k];
    });
    return out;
  }

  /* ── Enlaces de cada canal ──────────────────────────────────────────── */
  function withProto(u) {
    u = str(u);
    if (!u) return '';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    return 'https://' + u.replace(/^\/+/, '');
  }
  function prettyUrl(u) {
    return str(u).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }
  function igHandle(u) {
    var s = str(u);
    var m = s.match(/instagram\.com\/([^/?#]+)/i);
    if (m) return '@' + m[1];
    return s ? (s.charAt(0) === '@' ? s : '@' + s) : '';
  }
  function igUrl(u) {
    var s = str(u);
    if (!s) return '';
    if (/instagram\.com/i.test(s)) return withProto(s);
    return 'https://www.instagram.com/' + s.replace(/^@/, '') + '/';
  }
  function liLabel(u) {
    var s = str(u);
    var m = s.match(/linkedin\.com\/(in\/[^?#]+)/i);
    var label = m ? m[1].replace(/\/$/, '') : prettyUrl(s);
    try { label = decodeURIComponent(label); } catch (e) { /* tal cual */ }
    return label;
  }

  function links(p) {
    var L = {};
    if (p.whatsapp) {
      L.whatsapp = 'https://wa.me/' + p.whatsapp + (p.whatsappMsg ? '?text=' + encodeURIComponent(p.whatsappMsg) : '');
    }
    var tel = (p.phone || '').replace(/[^\d+]/g, '');
    if (tel) L.phone = 'tel:' + tel;
    if (p.email) L.email = 'mailto:' + p.email + '?subject=' + encodeURIComponent('Contacto desde tu tarjeta digital ' + (p.company || ''));
    if (p.website) L.website = withProto(p.website);
    if (p.linkedin) L.linkedin = withProto(p.linkedin);
    if (p.instagram) L.instagram = igUrl(p.instagram);
    if (p.address) L.maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address);
    return L;
  }

  /* Lista ordenada de canales (WhatsApp primero: es el canal principal). */
  function channels(p) {
    var L = links(p);
    var out = [];
    if (L.whatsapp) out.push({ key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', sub: p.phone || ('+' + p.whatsapp), href: L.whatsapp });
    if (L.email) out.push({ key: 'email', icon: 'mail', label: 'Correo electrónico', sub: p.email, href: L.email });
    if (L.linkedin) out.push({ key: 'linkedin', icon: 'linkedin', label: 'LinkedIn', sub: liLabel(p.linkedin), href: L.linkedin });
    if (L.website) out.push({ key: 'website', icon: 'globe', label: 'Sitio web', sub: prettyUrl(p.website), href: L.website });
    if (L.instagram) out.push({ key: 'instagram', icon: 'instagram', label: 'Instagram', sub: igHandle(p.instagram), href: L.instagram });
    if (L.phone) out.push({ key: 'phone', icon: 'phone', label: 'Llamar', sub: p.phone, href: L.phone });
    if (L.maps) out.push({ key: 'maps', icon: 'map-pin', label: 'Ubicación', sub: p.address, href: L.maps });
    return out;
  }

  /* ── vCard 3.0 (RFC 2426) ───────────────────────────────────────────── */
  function esc(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  function fold(line) {
    // Plegado a 75 octetos aprox. (seguro para base64 de la foto).
    if (line.length <= 75) return line;
    var out = line.slice(0, 75);
    for (var i = 75; i < line.length; i += 74) out += '\r\n ' + line.slice(i, i + 74);
    return out;
  }
  function vcard(p, photoB64) {
    var L = links(p);
    var first = p.firstName || p.name.split(' ')[0] || '';
    var last = p.lastName || p.name.split(' ').slice(1).join(' ');
    var lines = [
      'BEGIN:VCARD', 'VERSION:3.0',
      'N:' + esc(last) + ';' + esc(first) + ';;;',
      'FN:' + esc(p.name)
    ];
    if (p.company) lines.push('ORG:' + esc(p.company));
    if (p.title) lines.push('TITLE:' + esc(p.title));
    if (p.phone) lines.push('TEL;TYPE=CELL,VOICE,PREF:' + p.phone.replace(/[^\d+]/g, ''));
    if (p.email) lines.push('EMAIL;TYPE=INTERNET,WORK,PREF:' + p.email);
    if (L.website) lines.push('URL;TYPE=WORK:' + L.website);
    if (L.linkedin) lines.push('X-SOCIALPROFILE;TYPE=linkedin:' + L.linkedin);
    if (L.instagram) lines.push('X-SOCIALPROFILE;TYPE=instagram:' + L.instagram);
    if (L.whatsapp) lines.push('X-SOCIALPROFILE;TYPE=whatsapp:https://wa.me/' + p.whatsapp);
    if (p.address) lines.push('ADR;TYPE=WORK:;;' + esc(p.address) + ';' + esc(p.city) + ';' + esc(p.region) + ';;' + esc(p.country));
    if (p.tagline) lines.push('NOTE:' + esc(p.tagline));
    if (photoB64) lines.push('PHOTO;ENCODING=b;TYPE=JPEG:' + photoB64);
    lines.push('END:VCARD');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  /* ── QR ─────────────────────────────────────────────────────────────── */
  function qrMatrix(text, ec) {
    var q = qrcode(0, ec || 'Q');
    q.addData(text, 'Byte');
    q.make();
    var n = q.getModuleCount();
    var m = [];
    for (var r = 0; r < n; r++) { var row = []; for (var c = 0; c < n; c++) row.push(q.isDark(r, c)); m.push(row); }
    return m;
  }

  /* Un QR solo vale si abre algo REAL en otro teléfono: https público.
     Se rechazan blob:, file:, data:, localhost y redes locales, que en la
     pantalla de quien lo genera funcionan y en la cámara de otro no. */
  function checkQrUrl(u) {
    var s = str(u, 2000);
    if (!s) return { ok: false, reason: 'Falta el enlace de destino.' };
    var url;
    try { url = new URL(s); } catch (e) { return { ok: false, reason: 'No es un enlace válido (debe empezar por https://).' }; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'Un enlace ' + url.protocol + ' solo existe en este equipo: usa una dirección https:// pública.' };
    var host = url.hostname;
    if (!host || /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /\.local$/.test(host)) {
      return { ok: false, reason: 'Ese enlace es local (' + host + '): otro teléfono no puede abrirlo.' };
    }
    if (host.indexOf('.') < 0) return { ok: false, reason: 'Al dominio le falta la extensión (.com, .ai…).' };
    if (url.protocol === 'http:') return { ok: true, url: url.href, warn: 'Funciona, pero conviene https:// (los teléfonos avisan «sitio no seguro»).' };
    return { ok: true, url: url.href };
  }

  /* SVG del QR: módulos en un solo <path>, ojos redondeados y hueco central
     para el isotipo (nivel Q = 25 % de corrección: el logo tapa < 8 %). */
  function qrSvg(text, opt) {
    opt = opt || {};
    var m = qrMatrix(text, opt.ec || 'Q');
    var n = m.length, quiet = 2, size = n + quiet * 2;
    var hole = opt.logo ? Math.floor(n * 0.24) | 1 : 0;
    var h0 = Math.floor((n - hole) / 2), h1 = h0 + hole;
    function inEye(r, c) {
      return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    }
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!m[r][c] || inEye(r, c)) continue;
        if (hole && r >= h0 && r < h1 && c >= h0 && c < h1) continue;
        d += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Código QR: ' + text);
    var bg = document.createElementNS(SVGNS, 'rect');
    bg.setAttribute('width', size); bg.setAttribute('height', size); bg.setAttribute('fill', opt.light || '#FFFFFF');
    svg.appendChild(bg);
    var path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', d); path.setAttribute('fill', opt.dark || '#0C364F');
    svg.appendChild(path);
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(function (pos) {
      var y = pos[0] + quiet, x = pos[1] + quiet;
      var o = document.createElementNS(SVGNS, 'rect');
      o.setAttribute('x', x + 0.5); o.setAttribute('y', y + 0.5); o.setAttribute('width', 6); o.setAttribute('height', 6);
      o.setAttribute('rx', 1.6); o.setAttribute('fill', 'none'); o.setAttribute('stroke', opt.eye || opt.dark || '#0C364F');
      o.setAttribute('stroke-width', 1);
      svg.appendChild(o);
      var i = document.createElementNS(SVGNS, 'rect');
      i.setAttribute('x', x + 2); i.setAttribute('y', y + 2); i.setAttribute('width', 3); i.setAttribute('height', 3);
      i.setAttribute('rx', 0.8); i.setAttribute('fill', opt.eye || opt.dark || '#0C364F');
      svg.appendChild(i);
    });
    if (hole && opt.logo) {
      var pad = document.createElementNS(SVGNS, 'rect');
      pad.setAttribute('x', h0 + quiet + 0.3); pad.setAttribute('y', h0 + quiet + 0.3);
      pad.setAttribute('width', hole - 0.6); pad.setAttribute('height', hole - 0.6);
      pad.setAttribute('rx', hole * 0.22); pad.setAttribute('fill', opt.light || '#FFFFFF');
      svg.appendChild(pad);
      var img = document.createElementNS(SVGNS, 'image');
      var inset = hole * 0.16;
      img.setAttribute('x', h0 + quiet + inset); img.setAttribute('y', h0 + quiet + inset);
      img.setAttribute('width', hole - inset * 2); img.setAttribute('height', hole - inset * 2);
      img.setAttribute('href', opt.logo);
      img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.appendChild(img);
    }
    return svg;
  }

  /* ── DOM helpers ────────────────────────────────────────────────────── */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var ch = arguments[i];
      if (ch === null || ch === undefined || ch === false) continue;
      if (Array.isArray(ch)) ch.forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      else el.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
    }
    return el;
  }
  function icon(name, cls) {
    var spec = ICONS[name];
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'kvc-i' + (cls ? ' ' + cls : ''));
    if (!spec) return svg;
    if (spec.fill) svg.setAttribute('fill', 'currentColor');
    else {
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    }
    spec.els.forEach(function (e) {
      var node = document.createElementNS(SVGNS, e[0]);
      Object.keys(e[1]).forEach(function (k) { node.setAttribute(k, e[1][k]); });
      svg.appendChild(node);
    });
    return svg;
  }

  function resolveImg(src, resolver) {
    if (!src) return '';
    if (src.indexOf('asset:') === 0) return resolver ? resolver(src.slice(6)) : src.slice(6);
    return src;
  }

  function download(name, blob) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function imgToB64(url) {
    if (!url) return Promise.resolve('');
    if (url.indexOf('data:') === 0) {
      return Promise.resolve(/^data:image\/jpe?g/.test(url) ? url.split(',')[1] : '').then(function (b) {
        return b || rasterB64(url);
      });
    }
    return rasterB64(url);
  }
  // Re-codifica a JPEG 320 px (lo que aceptan iOS y Android en PHOTO).
  function rasterB64(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var s = 320, c = document.createElement('canvas'); c.width = s; c.height = s;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
          var r = Math.max(s / img.naturalWidth, s / img.naturalHeight);
          var w = img.naturalWidth * r, hh = img.naturalHeight * r;
          g.drawImage(img, (s - w) / 2, (s - hh) / 2, w, hh);
          resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
        } catch (e) { resolve(''); }
      };
      img.onerror = function () { resolve(''); };
      img.src = url;
    });
  }

  function slug(s) {
    return String(s || 'contacto').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  function saveVcf(p, resolver) {
    return imgToB64(resolveImg(p.photo, resolver)).then(function (b64) {
      var text = vcard(p, b64);
      download(slug(p.name) + '.vcf', new Blob([text], { type: 'text/vcard;charset=utf-8' }));
      return text;
    });
  }

  /* QR a PNG (para imprimir o fondo de pantalla). */
  function qrPng(text, opt) {
    opt = opt || {};
    var svg = qrSvg(text, opt);
    var px = opt.px || 1200;
    var xml = new XMLSerializer().serializeToString(svg);
    return new Promise(function (resolve, reject) {
      // El isotipo va como data: para que el canvas no quede «tainted».
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = px; c.height = px;
        var g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, px, px);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('PNG')); }, 'image/png');
      };
      img.onerror = function () { reject(new Error('No se pudo rasterizar el QR')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
  }

  /* ── La tarjeta: Hub · Tarjeta 3D · Código QR ─────────────────────────── */
  /*
   * mount(root, profile, opts) pinta la interfaz completa dentro de `root`.
   * opts.qrUrl     destino del QR (si falta: profile.publicUrl o location.href)
   * opts.resolve   (nombre) → URL, para las imágenes 'asset:…'
   * opts.preview   true dentro de la app de KIMOS (sin imprimir ni compartir nativo)
   * opts.view      vista inicial: 'hub' (por defecto) | 'card' | 'qr'
   * opts.storage   false para no recordar el tema en localStorage
   */
  var HUB_TITLES = {
    whatsapp: 'Chatear por WhatsApp', email: 'Enviar Correo Directo', linkedin: 'Perfil en LinkedIn',
    website: 'Sitio Web Oficial', instagram: 'Instagram Oficial', phone: 'Llamar por Teléfono', maps: 'Ubicación en Google Maps'
  };

  function mount(root, profile, opts) {
    opts = opts || {};
    var p = normalize(profile);
    var R = function (s) { return resolveImg(s, opts.resolve); };
    var here = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
    var baseQr = [opts.qrUrl, p.publicUrl, here, links(p).website].filter(function (u) { return u && checkQrUrl(u).ok; })[0] || 'https://figit.ai';
    var qrUrl = baseQr;
    var ch = channels(p);
    var L = links(p);
    var dark = false;
    try { dark = opts.storage !== false && localStorage.getItem('kvc-theme') === 'dark'; } catch (e) { /* sin storage */ }
    var view = opts.view === 'card' || opts.view === 'qr' ? opts.view : 'hub';
    var cleanups = [];

    /* Avisos */
    var toastEl = h('div', { class: 'kvc-toast', role: 'status', 'aria-live': 'polite' });
    var toastT = null;
    function toast(t) {
      toastEl.textContent = t; toastEl.classList.add('kvc-on');
      clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('kvc-on'); }, 2600);
    }
    function a(href, cls, attrs, children) {
      var o = { href: href, class: cls, target: /^https?:/.test(href) ? '_blank' : null, rel: 'noopener noreferrer' };
      Object.keys(attrs || {}).forEach(function (k) { o[k] = attrs[k]; });
      return h('a', o, children);
    }
    function copy(text, ok) {
      var done = function () { toast(ok || 'Copiado'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast(text); });
      else toast(text);
    }

    /* Acciones */
    function onSave() {
      saveVcf(p, opts.resolve).then(function () { toast('Contacto descargado: ábrelo para guardarlo en tu agenda.'); });
    }
    function logoData() {
      var src = R(p.logoMark);
      if (!src || src.indexOf('data:') === 0) return Promise.resolve(src);
      return fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
      }).catch(function () { return ''; });
    }
    function onQrPng() {
      logoData().then(function (logo) { return qrPng(qrUrl, { dark: p.theme.ink, logo: logo, px: 1400 }); })
        .then(function (b) { download('QR_' + slug(p.name) + '.png', b); toast('QR descargado en alta resolución'); })
        .catch(function () { toast('No se pudo generar el PNG'); });
    }
    function onShare() {
      var data = { title: p.name + ' · ' + p.company, text: 'Te comparto mi tarjeta de contacto digital.', url: qrUrl };
      if (navigator.share && !opts.preview) { navigator.share(data).catch(function () { }); return; }
      openModal(shareModal());
    }

    /* Modales */
    var modalHost = h('div', { class: 'kvc-modal-host' });
    function openModal(content) {
      var close = function () { modalHost.replaceChildren(); };
      var box = h('div', { class: 'kvc-modal', role: 'dialog', 'aria-modal': 'true' },
        h('button', { type: 'button', class: 'kvc-modal-x', 'aria-label': 'Cerrar', on: { click: close } }, '×'),
        content);
      var back = h('div', { class: 'kvc-backdrop', on: { click: function (e) { if (e.target === back) close(); } } }, box);
      modalHost.replaceChildren(back);
    }
    function shareModal() {
      var msg = 'Hola, te comparto la tarjeta digital de ' + p.name + ' (' + p.title + ', ' + p.company + '): ' + qrUrl;
      var opt = function (href, icn, cls, label) {
        return a(href, 'kvc-share-opt ' + cls, null, [h('span', { class: 'kvc-share-ic' }, icon(icn)), h('span', { text: label })]);
      };
      return h('div', null,
        h('h3', { class: 'kvc-modal-t', text: 'Compartir tarjeta' }),
        h('p', { class: 'kvc-modal-s', text: 'Envía tu tarjeta digital por el canal que prefieras.' }),
        h('div', { class: 'kvc-share-grid' },
          opt('https://wa.me/?text=' + encodeURIComponent(msg), 'whatsapp', 'kvc-c-whatsapp', 'WhatsApp'),
          opt('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(qrUrl), 'linkedin', 'kvc-c-linkedin', 'LinkedIn'),
          opt('mailto:?subject=' + encodeURIComponent('Tarjeta digital · ' + p.name) + '&body=' + encodeURIComponent(msg), 'mail', 'kvc-c-email', 'Correo'),
          h('button', { type: 'button', class: 'kvc-share-opt kvc-c-qr', on: { click: function () { modalHost.replaceChildren(); setView('qr'); } } },
            h('span', { class: 'kvc-share-ic' }, icon('qr-code')), h('span', { text: 'Código QR' }))),
        h('div', { class: 'kvc-copy' },
          h('input', { class: 'kvc-input', value: qrUrl, readonly: true, 'aria-label': 'Enlace de la tarjeta' }),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(qrUrl, 'Enlace copiado'); } } }, icon('copy'), h('span', { text: 'Copiar' }))));
    }
    function vcardModal() {
      var text = vcard(p, '');
      return h('div', null,
        h('h3', { class: 'kvc-modal-t', text: 'Datos de contacto (vCard 3.0)' }),
        h('pre', { class: 'kvc-pre', text: text }),
        h('div', { class: 'kvc-modal-actions' },
          h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onSave } }, icon('download'), h('span', { text: 'Descargar .vcf' })),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(text, 'vCard copiada'); } } }, icon('copy'), h('span', { text: 'Copiar' }))));
    }

    /* QR (se repinta si cambia el destino en el estudio) */
    var qrSlots = [];
    function qrSlot(cls, withLogo) {
      var el = h('div', { class: 'kvc-qr-slot ' + (cls || '') });
      qrSlots.push({ el: el, logo: withLogo });
      return el;
    }
    function paintQr() {
      qrSlots.forEach(function (s) {
        try { s.el.replaceChildren(qrSvg(qrUrl, { dark: p.theme.ink, logo: s.logo ? R(p.logoMark) : '' })); }
        catch (e) { s.el.textContent = 'Enlace demasiado largo para un QR'; }
      });
    }

    /* ── Cabecera ── */
    var tabs = {};
    function tab(id, icn, label) {
      tabs[id] = h('button', { type: 'button', class: 'kvc-tab', 'data-v': id, on: { click: function () { setView(id); } } },
        icon(icn), h('span', { class: 'kvc-tab-t', text: label }));
      return tabs[id];
    }
    var themeBtn = h('button', { type: 'button', class: 'kvc-ibtn', title: 'Cambiar tema', 'aria-label': 'Cambiar tema' }, icon(dark ? 'sun' : 'moon'));
    var header = h('header', { class: 'kvc-head' },
      h('div', { class: 'kvc-head-in' },
        h('button', { type: 'button', class: 'kvc-head-brand', on: { click: function () { setView('hub'); } } },
          h('span', { class: 'kvc-head-logo' },
            p.logoMark ? h('img', { src: R(p.logoMark), alt: '', class: 'kvc-head-mark' }) : null,
            p.logoWord ? h('img', { src: R(p.logoWord), alt: p.company, class: 'kvc-head-word' })
              : (p.logoMark && p.logoMark === p.logo ? null : h('strong', { class: 'kvc-head-co', text: p.company }))),
          h('span', { class: 'kvc-head-meta' },
            h('span', { class: 'kvc-badge', text: 'Oficial' }),
            h('span', { class: 'kvc-head-sub', text: 'Tarjeta de Contacto Ejecutiva' }))),
        h('div', { class: 'kvc-head-actions' },
          h('nav', { class: 'kvc-tabs', 'aria-label': 'Vistas' },
            tab('hub', 'contact', 'Hub'), tab('card', 'id-card', 'Tarjeta 3D'), tab('qr', 'qr-code', 'Código QR')),
          h('button', { type: 'button', class: 'kvc-ibtn', title: 'Compartir tarjeta', 'aria-label': 'Compartir', on: { click: onShare } }, icon('share-2')),
          themeBtn)));

    /* ── Vista 1: Hub ── */
    var hubList = ch.map(function (c) {
      return a(c.href, 'kvc-hl kvc-c-' + c.key + (c.key === 'whatsapp' ? ' kvc-hl-main' : ''), null, [
        h('span', { class: 'kvc-hl-ic' }, icon(c.icon)),
        h('span', { class: 'kvc-hl-txt' },
          h('strong', null, HUB_TITLES[c.key] || c.label, c.key === 'whatsapp' ? h('em', { class: 'kvc-chip-main', text: 'Principal' }) : null),
          h('small', { text: c.sub })),
        h('span', { class: 'kvc-hl-go' }, icon('chevron-right'))]);
    });
    var pills = [];
    if (L.phone) pills.push(a(L.phone, 'kvc-pill kvc-c-phone', null, [icon('phone'), h('span', { text: 'Llamar' })]));
    if (L.whatsapp) pills.push(a(L.whatsapp, 'kvc-pill kvc-pill-wa kvc-c-whatsapp', null, [icon('whatsapp'), h('span', { text: 'WhatsApp' })]));
    if (L.email) pills.push(a(L.email, 'kvc-pill kvc-c-email', null, [icon('mail'), h('span', { text: 'Email' })]));

    var hub = h('section', { class: 'kvc-view kvc-hub', 'data-view': 'hub' },
      h('div', { class: 'kvc-panel' },
        h('div', { class: 'kvc-panel-bar' }),
        h('div', { class: 'kvc-profile' },
          h('div', { class: 'kvc-avatar' },
            h('div', { class: 'kvc-avatar-ring' },
              p.photo ? h('img', { src: R(p.photo), alt: p.name, class: 'kvc-avatar-img' })
                : h('div', { class: 'kvc-avatar-ph', text: (p.name || '?').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('') })),
            h('span', { class: 'kvc-verified', title: 'Perfil verificado' }, icon('check'))),
          h('h1', { class: 'kvc-name', text: p.name }),
          h('div', { class: 'kvc-role' },
            h('span', { class: 'kvc-dot' }),
            h('span', { class: 'kvc-title', text: p.title }),
            p.company ? h('span', { class: 'kvc-sep', text: '|' }) : null,
            p.company ? h('span', { class: 'kvc-company', text: p.company }) : null),
          p.tagline ? h('p', { class: 'kvc-tagline', text: p.tagline }) : null,
          h('button', { type: 'button', class: 'kvc-save', on: { click: onSave } },
            icon('user-plus', 'kvc-bounce'), h('span', { text: 'Guardar Contacto en el Teléfono' }), h('span', { class: 'kvc-save-chip', text: 'vCard .VCF' })),
          pills.length ? h('div', { class: 'kvc-pills' }, pills) : null),
        h('div', { class: 'kvc-divider' }, h('span', { text: 'Canales Oficiales' })),
        h('div', { class: 'kvc-hlist' }, hubList),
        h('div', { class: 'kvc-mini' },
          h('button', { type: 'button', class: 'kvc-mini-qr', 'aria-label': 'Ver código QR', on: { click: function () { setView('qr'); } } }, qrSlot('', false)),
          h('div', { class: 'kvc-mini-txt' },
            h('strong', { text: 'Código QR Dinámico' }),
            h('small', { text: 'Escanea para compartir o abrir en otro celular' })),
          h('button', { type: 'button', class: 'kvc-mini-btn', on: { click: function () { setView('qr'); } } }, 'Ver QR')),
        h('div', { class: 'kvc-powered' },
          h('div', null, h('span', { text: 'Impulsado por ' }), h('strong', { text: p.company || 'KIMOS' })),
          h('small', { text: 'Ecosistema de Tarjetas Digitales Inteligentes' }))));

    /* ── Vista 2: Tarjeta 3D ── */
    var rowsDef = [
      L.phone && ['phone', 'phone', p.phone, L.phone],
      L.email && ['email', 'mail', p.email, L.email],
      L.website && ['website', 'globe', prettyUrl(p.website), L.website],
      L.maps && ['maps', 'map-pin', p.address, L.maps],
      L.linkedin && ['linkedin', 'linkedin', liLabel(p.linkedin), L.linkedin],
      L.instagram && ['instagram', 'instagram', igHandle(p.instagram), L.instagram]
    ].filter(Boolean);
    var card3d = h('div', { class: 'kvc-c3d' },
      h('div', { class: 'kvc-face kvc-front' },
        h('div', { class: 'kvc-front-side' },
          h('div', { class: 'kvc-front-avatar' }, p.photo ? h('img', { src: R(p.photo), alt: p.name }) : null),
          p.logo ? h('div', { class: 'kvc-front-logo' }, h('img', { src: R(p.logo), alt: p.company })) : null,
          h('div', { class: 'kvc-front-qr' }, qrSlot('kvc-front-qrbox', false), h('span', { text: 'Escanear contacto' }))),
        h('div', { class: 'kvc-front-main' },
          h('div', null,
            h('h2', { class: 'kvc-front-name', text: p.name }),
            h('p', { class: 'kvc-front-title', text: p.title.replace(/\s*&\s*/g, ' - ') }),
            h('p', { class: 'kvc-front-co', text: p.company }),
            h('div', { class: 'kvc-front-rule' })),
          h('div', { class: 'kvc-front-rows' }, rowsDef.map(function (r) {
            return a(r[3], 'kvc-fr kvc-c-' + r[0], { on: null }, [h('span', { class: 'kvc-fr-ic' }, icon(r[1])), h('span', { class: 'kvc-fr-t', text: r[2] })]);
          })),
          h('div', { class: 'kvc-front-foot' }, h('span', { text: 'ID: ' + (p.cardId || slug(p.name).toUpperCase()) }), h('strong', { text: (p.company || 'KIMOS') + ' Ecosystem' }))),
        h('div', { class: 'kvc-sheen' })),
      h('div', { class: 'kvc-face kvc-back' },
        h('div', { class: 'kvc-back-top' },
          h('div', { class: 'kvc-chipset' }, h('span', { class: 'kvc-chip' }), icon('nfc', 'kvc-nfc')),
          h('div', { class: 'kvc-back-pass' }, h('span', { text: 'Verified Executive Pass' }), h('i', { class: 'kvc-live' }))),
        h('div', { class: 'kvc-back-mid' },
          p.logo ? h('div', { class: 'kvc-back-logo' }, h('img', { src: R(p.logo), alt: p.company })) : null,
          p.motto ? h('p', { text: p.motto }) : null),
        h('div', { class: 'kvc-back-foot' },
          h('span', { text: p.location || p.city }),
          h('span', null, h('strong', { text: prettyUrl(p.website) }), p.hashtag ? h('em', { text: p.hashtag }) : null)),
        h('div', { class: 'kvc-sheen' })));
    var flipped = false;
    function flip() { flipped = !flipped; card3d.classList.toggle('kvc-flipped', flipped); }
    var scene = h('div', { class: 'kvc-scene', on: { click: function (e) { if (!e.target.closest('a')) flip(); } } }, card3d);
    var cardView = h('section', { class: 'kvc-view kvc-cardview', 'data-view': 'card' },
      h('div', { class: 'kvc-flipbar' },
        h('span', null, icon('rotate-cw'), h('span', { text: 'Haz clic para voltear la tarjeta' })),
        h('button', { type: 'button', class: 'kvc-btn-xs', on: { click: flip } }, icon('repeat'), h('span', { text: 'Voltear' }))),
      scene,
      h('div', { class: 'kvc-card-actions' },
        h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onSave } }, icon('download'), h('span', { text: 'Descargar Contacto (vCard)' })),
        opts.preview ? null : h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { window.print(); } } }, icon('printer'), h('span', { text: 'Imprimir Tarjeta' })),
        h('button', { type: 'button', class: 'kvc-btn-s', on: { click: onShare } }, icon('share-2'), h('span', { text: 'Compartir' }))));

    /* ── Vista 3: Código QR ── */
    var urlInput = h('input', { class: 'kvc-input kvc-mono', value: qrUrl, 'aria-label': 'Enlace de destino del QR', spellcheck: 'false' });
    var urlMsg = h('small', { class: 'kvc-field-err' });
    urlInput.addEventListener('input', function () {
      var v = urlInput.value.trim();
      var c = checkQrUrl(v || baseQr);
      urlMsg.textContent = c.ok ? (c.warn || '') : c.reason + ' El QR sigue apuntando a ' + qrUrl;
      if (c.ok) { qrUrl = v || baseQr; paintQr(); }
    });
    var qrView = h('section', { class: 'kvc-view kvc-qrview', 'data-view': 'qr' },
      h('div', { class: 'kvc-panel kvc-panel-qr' },
        h('span', { class: 'kvc-kicker' }, icon('qr-code'), h('span', { text: 'Generador Dinámico ' + (p.company.replace(/\.ai$/i, '').toUpperCase() || 'KIMOS') })),
        h('h2', { class: 'kvc-qr-title', text: 'Código QR Oficial' }),
        h('p', { class: 'kvc-qr-sub', text: 'Apunta la cámara de cualquier teléfono para abrir instantáneamente la tarjeta virtual y canales de contacto.' }),
        h('div', { class: 'kvc-qr-frame' }, h('div', { class: 'kvc-qr-white' }, qrSlot('kvc-qr-big', true))),
        h('div', { class: 'kvc-field' },
          h('label', null, h('span', { text: 'Enlace de Destino del QR:' }), h('em', { text: '100% Dinámico' })),
          h('div', { class: 'kvc-field-row' }, urlInput,
            h('button', { type: 'button', class: 'kvc-reset', title: 'Restablecer enlace original', on: { click: function () { urlInput.value = baseQr; qrUrl = baseQr; paintQr(); } } }, 'Actual')),
          urlMsg,
          h('small', { text: 'Puedes personalizar el enlace a tu propio dominio si lo requieres. Solo se aceptan direcciones https:// públicas.' })),
        h('div', { class: 'kvc-qr-actions' },
          h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onQrPng } }, icon('download'), h('span', { text: 'Descargar PNG HD' })),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(qrUrl, 'Enlace copiado'); } } }, icon('copy'), h('span', { text: 'Copiar Enlace' })))));

    /* ── Pie ── */
    var footer = h('footer', { class: 'kvc-foot' },
      h('div', { class: 'kvc-foot-in' },
        h('p', { text: '© ' + new Date().getFullYear() + ' ' + (p.company || '') + ' • ' + p.name + '. Todos los derechos reservados.' }),
        h('div', { class: 'kvc-foot-links' },
          L.website ? a(L.website, '', null, [prettyUrl(p.website)]) : null,
          L.linkedin ? h('span', { text: '•' }) : null,
          L.linkedin ? a(L.linkedin, '', null, ['LinkedIn']) : null,
          h('span', { text: '•' }),
          h('button', { type: 'button', on: { click: function () { openModal(vcardModal()); } } }, 'Ver Datos vCard'))));

    var bg = h('div', { class: 'kvc-bg', 'aria-hidden': 'true' }, contour('kvc-bg-a', 5), contour('kvc-bg-b', 3));
    var wrap = h('div', {
      class: 'kvc' + (dark ? ' kvc-dark' : '') + (opts.preview ? ' kvc-preview' : ''),
      style: '--kvc-primary:' + p.theme.primary + ';--kvc-ink:' + p.theme.ink + ';--kvc-soft:' + p.theme.soft + ';--kvc-accent:' + p.theme.accent +
        (p.font ? ';font-family:"' + p.font + '","Plus Jakarta Sans",Inter,-apple-system,"Segoe UI",Roboto,sans-serif' : '')
    }, bg, header, h('main', { class: 'kvc-body' }, hub, cardView, qrView), footer, modalHost, toastEl);

    function setView(v) {
      view = v;
      [hub, cardView, qrView].forEach(function (s) { s.hidden = s.getAttribute('data-view') !== v; });
      Object.keys(tabs).forEach(function (k) { tabs[k].classList.toggle('kvc-tab-on', k === v); tabs[k].setAttribute('aria-pressed', k === v ? 'true' : 'false'); });
    }
    themeBtn.addEventListener('click', function () {
      dark = !dark;
      wrap.classList.toggle('kvc-dark', dark);
      themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
      try { if (opts.storage !== false) localStorage.setItem('kvc-theme', dark ? 'dark' : 'light'); } catch (e) { /* sin storage */ }
    });
    function onKey(e) { if (e.key === 'Escape') modalHost.replaceChildren(); }
    document.addEventListener('keydown', onKey);
    cleanups.push(function () { document.removeEventListener('keydown', onKey); });

    setView(view);
    paintQr();
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(wrap);
    return {
      qrUrl: function () { return qrUrl; },
      profile: p,
      setView: setView,
      destroy: function () { cleanups.forEach(function (f) { f(); }); clearTimeout(toastT); }
    };
  }

  /* Contornos de fondo (la «huella» de la marca). */
  function contour(cls, n) {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 600 600');
    svg.setAttribute('class', cls);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    for (var i = 0; i < n; i++) {
      var o = i * 20, y = 100 + i * 30;
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', 'M' + (50 + o) + ' 300 C ' + (150 + o / 2) + ' ' + y + ', ' + (350 - o / 2) + ' ' + y + ', ' + (550 - o) + ' 300 C ' + (450 - o) + ' ' + (600 - y) + ', ' + (250 + o / 2) + ' ' + (600 - y) + ', ' + (50 + o) + ' 300');
      path.setAttribute('stroke-width', String(1.5 - i * 0.2));
      svg.appendChild(path);
    }
    return svg;
  }

  /* ── Estilos de la tarjeta (todo bajo .kvc) ─────────────────────────── */
  var CSS = /*@@CSS@@*/ '';
  function injectCss(doc) {
    doc = doc || document;
    if (doc.getElementById('kvc-card-css')) return;
    var s = doc.createElement('style'); s.id = 'kvc-card-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ── Página autónoma (para alojar en cualquier hosting) ─────────────── */
  function htmlEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function standaloneHtml(profile, coreSrc, extra) {
    extra = extra || {};
    var p = normalize(profile);
    var json = JSON.stringify(p).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    var title = p.name + ' · ' + p.title + (p.company ? ' · ' + p.company : '');
    var desc = 'Tarjeta digital de ' + p.name + '. WhatsApp, correo, LinkedIn, web e Instagram en un toque.';
    return '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<title>' + htmlEsc(title) + '</title>\n' +
      '<meta name="description" content="' + htmlEsc(desc) + '">\n' +
      '<meta name="theme-color" content="' + p.theme.primary + '">\n' +
      '<meta property="og:type" content="profile">\n' +
      '<meta property="og:title" content="' + htmlEsc(title) + '">\n' +
      '<meta property="og:description" content="' + htmlEsc(desc) + '">\n' +
      (extra.ogImage ? '<meta property="og:image" content="' + htmlEsc(extra.ogImage) + '">\n' : '') +
      (extra.canonical ? '<link rel="canonical" href="' + htmlEsc(extra.canonical) + '">\n' : '') +
      (extra.icon ? '<link rel="icon" href="' + htmlEsc(extra.icon) + '">\n<link rel="apple-touch-icon" href="' + htmlEsc(extra.icon) + '">\n' : '') +
      '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
      '<meta name="apple-mobile-web-app-title" content="' + htmlEsc(p.name.split(' ')[0] + ' · ' + (p.company || 'Tarjeta')) + '">\n' +
      '<style>html,body{margin:0;padding:0;background:#F8FAFC}#kvc-root{min-height:100vh;display:flex;flex-direction:column}#kvc-root>.kvc{flex:1}</style>\n' +
      '</head>\n<body>\n<div id="kvc-root"></div>\n<script>\n' + String(coreSrc).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--') + '\n' +
      'KVC.injectCss();KVC.mount(document.getElementById("kvc-root"),' + json + ',{qrUrl:' + JSON.stringify(extra.qrUrl || '') + '||undefined});\n' +
      '</script>\n</body>\n</html>\n';
  }

  return {
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    normalize: normalize,
    links: links,
    channels: channels,
    vcard: vcard,
    qrMatrix: qrMatrix,
    h: h,
    icon: icon,
    checkQrUrl: checkQrUrl,
    qrSvg: qrSvg,
    qrPng: qrPng,
    saveVcf: saveVcf,
    mount: mount,
    injectCss: injectCss,
    standaloneHtml: standaloneHtml,
    resolveImg: resolveImg,
    slug: slug,
    download: download
  };
})();
