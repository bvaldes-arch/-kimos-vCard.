/*
 * KIMOS vCard (kimos-vcard) — tarjeta de contacto virtual con QR.
 *
 * Edita la tarjeta, la ve en vivo tal como la verá quien escanea, y la
 * publica: el QR apunta a una página pública que sirve el propio KIMOS
 * (asset `card.html` + gateway `public.read`), sin backend a medida.
 *
 *   QR ──► {api}/api/apps/kimos-vcard/asset/card.html?i={instanceId}
 *            └─ lee /api/public/app/{instanceId}/definition  (solo `data`)
 *
 * También exporta la tarjeta como un único HTML autónomo para alojarla en
 * cualquier dominio (figit.ai/bryan, GitHub Pages, Netlify…).
 */

// Mantener en sincronía con manifest.json (y con el catálogo raíz).
const APP_VERSION = '1.0.0';
const APP_ID = 'kimos-vcard';

// Estilos de la app, también inyectados desde JS con su versión: KIMOS no
// recarga la página al actualizar una app y dejaba la hoja anterior.
const APP_CSS = /*@@APPCSS@@*/ '';

/* ── Un solo núcleo (v1.3) ──
   El núcleo de la tarjeta (interfaz, QR, vCard) vive en assets/kvc-core.js y
   lo comparten la app, la página pública y el HTML exportado. Se carga una vez
   y se exige que su versión sea la de la app. */
function loadCore(shell) {
  const want = APP_VERSION;
  const g = globalThis;
  if (g.KVC && g.KVC.VERSION === want) return Promise.resolve(g.KVC);
  if (g.__kvcCoreLoading && g.__kvcCoreLoading.v === want) return g.__kvcCoreLoading.p;
  const p = new Promise((resolve, reject) => {
    let url;
    try { url = shell.assetUrl('kvc-core.js'); } catch (e) { reject(new Error('Este KIMOS no sirve los archivos de la app.')); return; }
    const sc = document.createElement('script');
    sc.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'v=' + encodeURIComponent(want);
    sc.async = true;
    sc.onload = () => (g.KVC && g.KVC.VERSION === want
      ? resolve(g.KVC)
      : reject(new Error('El núcleo cargado (v' + ((g.KVC && g.KVC.VERSION) || '?') + ') no coincide con la app v' + want + '. Recarga la página.')));
    sc.onerror = () => { g.__kvcCoreLoading = null; reject(new Error('No se pudo cargar kvc-core.js. Reinstala la app desde la Tienda.')); };
    document.head.appendChild(sc);
  });
  g.__kvcCoreLoading = { v: want, p };
  return p;
}

const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'canales', label: 'Canales' },
  { id: 'marca', label: 'Marca' },
  { id: 'publicar', label: 'Publicar' },
  { id: 'prospectos', label: 'Prospectos' },
  { id: 'medicion', label: 'Medición' },
];

/* ── Marca de la empresa (shell.brands) → tarjeta ──────────────────────
   La tarjeta asume la identidad de la marca elegida: color base y acento,
   color de texto, superficie suave, logotipos (sobre fondo claro) y la
   tipografía de títulos. Lo personal (nombre, WhatsApp, correo…) no se toca. */
function hexOk(x) { return /^#[0-9a-f]{6}$/i.test(String(x || '')); }
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const WHITE = '#FFFFFF';
const BLACK = '#000000';

function brandToPatch(brand) {
  if (!brand) return null;
  const pal = Array.isArray(brand.palette) ? brand.palette : [];
  const byRole = (r) => { const c = pal.find((x) => x && x.role === r && hexOk(x.hex)); return c ? c.hex.toUpperCase() : ''; };
  const primary = hexOk((brand.baseColor || {}).hex) ? brand.baseColor.hex.toUpperCase() : byRole('base');
  if (!primary) return null;
  let accent = hexOk((brand.accentColor || {}).hex) ? brand.accentColor.hex.toUpperCase() : (byRole('accent') || byRole('baseAlt'));
  if (!accent || accent === primary) accent = mix(primary, WHITE, 0.35);
  let ink = byRole('text');
  if (!ink || lum(ink) > 0.12) ink = mix(primary, BLACK, 0.55);
  let soft = byRole('surface') || byRole('background');
  if (!soft || lum(soft) < 0.75) soft = mix(primary, WHITE, 0.87);

  const logos = Array.isArray(brand.logos) ? brand.logos.filter((l) => l && l.url) : [];
  const isMark = (l) => /iso|icon|ícono|mark|s[ií]mbolo|favicon|monogram/i.test((l.key || '') + ' ' + (l.name || ''));
  const onLight = (l) => l.background === 'light' || l.background === 'transparent' || l.background === 'color';
  const full = brand.logoLight || (logos.find((l) => onLight(l) && !isMark(l)) || {}).url || brand.logoDark || (logos[0] || {}).url || '';
  const mark = (logos.find((l) => isMark(l) && onLight(l)) || logos.find(isMark) || {}).url || full;
  const heading = (Array.isArray(brand.typography) ? brand.typography : []).find((f) => f && (f.usage === 'headings' || f.usage === 'body'));

  const patch = {
    brandId: brand.id || '',
    brandName: brand.name || '',
    theme: { primary, accent, ink, soft },
    font: heading ? String(heading.family || '') : '',
  };
  if (brand.name) patch.company = brand.name;
  if (brand.website) patch.website = brand.website;
  if (brand.tagline || brand.description) patch.motto = brand.tagline || brand.description;
  if (full) { patch.logo = full; patch.logoMark = mark; patch.logoWord = ''; }
  return patch;
}

function baseApi(shell) {
  try {
    const u = shell.assetUrl('x');
    const i = u.indexOf('/api/apps/');
    if (i > 0) return u.slice(0, i);
    if (i === 0) return typeof location !== 'undefined' ? location.origin : '';
  } catch (e) { /* host sin assetUrl */ }
  return typeof location !== 'undefined' ? location.origin : '';
}

function fileToDataUrl(file, kind) {
  // Foto: recorte cuadrado 480 px JPEG. Logos: hasta 640 px, PNG (transparencia).
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen no es válida'));
      img.onload = () => {
        const c = document.createElement('canvas');
        const g = c.getContext('2d');
        if (kind === 'photo') {
          const s = 480; c.width = s; c.height = s;
          const r = Math.max(s / img.naturalWidth, s / img.naturalHeight);
          const w = img.naturalWidth * r, hh = img.naturalHeight * r;
          g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
          g.drawImage(img, (s - w) / 2, (s - hh) / 2, w, hh);
          resolve(c.toDataURL('image/jpeg', 0.86));
        } else {
          const max = 640;
          const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
          g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/png'));
        }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl, name) {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => resolve(''); fr.readAsDataURL(blob); });
}

/* ── Medición (v1.3) ──
   Resume las visitas que manda la tarjeta pública (canal 'visita') y los
   prospectos de un periodo. `days` = 0 → todo el historial. */
const CHANNELS = [
  ['whatsapp', 'WhatsApp'], ['email', 'Correo'], ['linkedin', 'LinkedIn'], ['website', 'Sitio web'],
  ['instagram', 'Instagram'], ['phone', 'Llamar'], ['maps', 'Ubicación'],
];
function summarize(visits, leads, days, now) {
  const end = now ? new Date(now) : new Date();
  const from = days ? new Date(end.getTime() - days * 86400000) : null;
  const inRange = (iso) => { const t = Date.parse(iso || ''); return !isNaN(t) && (!from || t >= from.getTime()); };
  const vs = (visits || []).filter((v) => inRange(v.at));
  // Los envíos de prueba desde la vista previa no cuentan como prospectos reales.
  const ls = (leads || []).filter((l) => inRange(l.createdAt) && ((l.data || {}).source || '') !== 'vista previa');
  const clicks = {};
  CHANNELS.forEach(([k]) => { clicks[k] = 0; });
  let opens = 0, saved = 0, shared = 0, qr = 0, mobile = 0, en = 0, touched = 0;
  const refs = {};
  vs.forEach((v) => {
    const d = v.d || {};
    if (d.visit === '1') {
      opens++;
      if (d.mobile === '1') mobile++;
      if (d.lang === 'en') en++;
      const r = d.ref ? String(d.ref).replace(/^www\./, '') : 'Directo o QR';
      refs[r] = (refs[r] || 0) + 1;
    }
    const cs = String(d.clicks || '').split(',').filter(Boolean);
    if (cs.length) touched++;
    cs.forEach((c) => { if (c in clicks) clicks[c]++; });
    if (d.saved === '1') saved++;
    if (d.shared === '1') shared++;
    if (d.qr === '1') qr++;
  });
  const n = days || 30;
  const daily = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
    daily.push({ day, opens: vs.filter((v) => (v.d || {}).visit === '1' && String(v.at).slice(0, 10) === day).length });
  }
  const totalClicks = Object.keys(clicks).reduce((a, k) => a + clicks[k], 0);
  return {
    opens, totalClicks, clicks, saved, shared, qr, leads: ls.length,
    conversion: opens ? Math.min(100, Math.round((ls.length / opens) * 1000) / 10) : 0,
    mobile, en, refs, daily, touched,
  };
}

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;
  const { useState, useEffect, useRef, useMemo } = React;

  const instanceId = (shell.app && shell.app.instanceId) || '';
  const resolveAsset = (name) => { try { return shell.assetUrl(name); } catch (e) { return name; } };

  let KVC = null;
  let coreErr = '';

  /* ── Estado (un modelo en el closure; UI y agente mutan lo mismo) ── */
  let model = { profile: null, published: false, publishedAt: '', loaded: false };
  let ui = { tab: 'perfil', device: 'mobile', busy: '', error: '' };
  const listeners = new Set();
  let leads = { list: [], visits: [], loaded: false, error: '' };
  const emit = () => listeners.forEach((l) => l({ model, ui, leads }));
  let saveT = null;
  let pubT = null;
  let disposed = false;

  function setUi(patch) { ui = Object.assign({}, ui, patch); emit(); }
  function commit(next, opts) {
    model = Object.assign({}, model, next);
    emit();
    clearTimeout(saveT);
    saveT = setTimeout(save, 600);
    if (model.published && !(opts && opts.noPublish)) {
      clearTimeout(pubT);
      pubT = setTimeout(() => { void publish(true); }, 1500);
    }
  }
  function updateProfile(patch) {
    const p = Object.assign({}, model.profile, patch);
    if (patch.theme) p.theme = Object.assign({}, model.profile.theme, patch.theme);
    commit({ profile: KVC.normalize(p) });
  }

  async function save() {
    if (!instanceId || disposed) return;
    try {
      await shell.saveData({ v: 1, profile: model.profile, published: model.published, publishedAt: model.publishedAt });
    } catch (e) {
      setUi({ error: 'No se pudo guardar: ' + String((e && e.message) || e) });
    }
  }

  /* Marcas del tenant: TODAS, para elegir (una empresa puede tener submarcas). */
  let brands = { list: [], currentId: '', loaded: false, error: '' };
  async function loadBrands() {
    if (!shell.brands || !shell.brands.list) { brands = Object.assign({}, brands, { loaded: true }); emit(); return; }
    try {
      const r = await shell.brands.list();
      brands = { list: (r && r.brands) || [], currentId: (r && r.currentId) || '', loaded: true, error: '' };
    } catch (e) {
      brands = Object.assign({}, brands, { loaded: true, error: 'No se pudieron leer las marcas.' });
    }
    emit();
  }
  function applyBrand(brand, quiet) {
    const patch = brandToPatch(brand);
    if (!patch) { if (!quiet) shell.notify({ level: 'warn', text: 'Esa marca no define un color base: complétala en la app Marcas.' }); return false; }
    updateProfile(patch);
    if (!quiet) shell.notify({ level: 'success', text: 'Tarjeta con la identidad de ' + (brand.name || 'la marca') });
    return true;
  }

  /* Instancia nueva en OTRA empresa: la tarjeta nace con la persona conectada
     (/api/identity/me) y con la marca por defecto del tenant, no con FIGIT. */
  /* Persona conectada (/api/identity/me), una sola lectura. */
  let mePromise = null;
  function fetchMe() {
    if (!mePromise) {
      mePromise = (async () => {
        try {
          if (typeof shell.authFetch !== 'function') return null;
          const res = await shell.authFetch('/api/identity/me', { cache: 'no-store' });
          return res.ok ? await res.json() : null;
        } catch (e) { return null; }
      })();
    }
    return mePromise;
  }
  const fold = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  /* ¿La persona conectada es la del perfil de fábrica (Bryan · FIGIT.ai)? */
  function isOwner(me) {
    if (!me) return false;
    const def = KVC.DEFAULT_PROFILE;
    const email = String(me.email || '').toLowerCase();
    const meName = fold(me.displayName || me.name);
    return email === def.email || (!!meName && fold(def.name).indexOf(meName.split(' ').slice(0, 2).join(' ')) === 0);
  }
  /* Datos personales desde la identidad de KIMOS (o vacíos). */
  function personFromMe(me) {
    if (!me) return {};
    const name = String(me.displayName || me.name || '').trim();
    const phone = String(me.phone || '');
    const first = name.split(' ')[0] || '';
    return {
      name, firstName: first, lastName: name.split(' ').slice(1).join(' '),
      title: String(me.description || ''), email: String(me.email || '').toLowerCase(), phone, whatsapp: phone.replace(/\D/g, ''),
      whatsappMsg: first ? 'Hola ' + first + ', te contacto desde tu tarjeta digital.' : '',
      whatsappMsgEn: first ? 'Hi ' + first + ", I'm reaching out from your digital card." : '',
      photo: String(me.photoUrl || ''), location: String(me.location || ''),
    };
  }
  /* La identidad visual de FIGIT de fábrica, sin los datos personales de Bryan. */
  function figitBranding() {
    const d = KVC.DEFAULT_PROFILE;
    return { company: d.company, website: d.website, instagram: d.instagram, logo: d.logo, logoMark: d.logoMark, logoWord: d.logoWord,
      motto: d.motto, mottoEn: d.mottoEn, theme: d.theme, hashtag: d.hashtag, brandId: '', brandName: 'FIGIT.ai' };
  }

  /* ── Plantillas (v1.2) ──
     · «FIGIT · Bryan (fábrica)»: la tarjeta original completa.
     · «En blanco»: solo la persona conectada.
     · Una por cada marca del registro de KIMOS: persona conectada + esa marca.
     Se conserva siempre el dominio propio (publicUrl). */
  async function buildTemplate(kind, brand) {
    const keep = { publicUrl: model.profile.publicUrl, leadForm: model.profile.leadForm };
    if (kind === 'figit') return KVC.normalize(Object.assign({}, KVC.DEFAULT_PROFILE, keep));
    const me = await fetchMe();
    let p = Object.assign({}, KVC.EMPTY_PROFILE, personFromMe(me), keep);
    if (kind === 'brand' && brand) {
      if (/figit/i.test(brand.name || '') && !brandToPatch(brand)) p = Object.assign(p, figitBranding());
      else p = Object.assign(p, brandToPatch(brand) || {});
    }
    return KVC.normalize(p);
  }

  /* Instancia nueva: el dueño recibe su tarjeta FIGIT; cualquier otra persona
     recibe una tarjeta en blanco con SUS datos y la marca de su empresa. Los
     datos de Bryan nunca aparecen en la tarjeta de otra persona. */
  async function seedNewInstance() {
    const me = await fetchMe();
    if (isOwner(me)) return;
    let p = Object.assign({}, KVC.EMPTY_PROFILE, personFromMe(me));
    let cur = null;
    if (shell.brands && shell.brands.current) {
      try { cur = await shell.brands.current(); } catch (e) { cur = null; }
    }
    if (cur && /figit/i.test(cur.name || '')) p = Object.assign(p, figitBranding(), brandToPatch(cur) ? { theme: brandToPatch(cur).theme } : {});
    else if (cur && brandToPatch(cur)) p = Object.assign(p, brandToPatch(cur));
    commit({ profile: KVC.normalize(p) });
  }

  async function load() {
    if (!instanceId) { model = Object.assign({}, model, { loaded: true }); emit(); return; }
    let fresh = true;
    try {
      const d = await shell.loadData();
      if (d && d.profile) {
        fresh = false;
        model = Object.assign({}, model, {
          profile: KVC.normalize(d.profile), published: d.published === true, publishedAt: d.publishedAt || '',
        });
      }
    } catch (e) { /* instancia nueva */ }
    if (fresh) await seedNewInstance();
    model = Object.assign({}, model, { loaded: true });
    emit();
  }

  /* ── Enlace público ── */
  function gatewayUrl(channel) {
    if (!instanceId) return '';
    return baseApi(shell) + '/api/public/app/' + encodeURIComponent(instanceId) + '/submit/' + channel;
  }
  function kimosUrl() {
    if (!instanceId) return '';
    return baseApi(shell) + '/api/apps/' + APP_ID + '/asset/card.html?i=' + encodeURIComponent(instanceId);
  }
  /* Destino del QR: siempre una URL https pública y abrible desde otro
     teléfono. Un dominio propio inválido NO se usa (se avisa en Publicar). */
  function qrTarget() {
    const cands = [model.profile.publicUrl, kimosUrl(), model.profile.website];
    return cands.find((u) => u && KVC.checkQrUrl(u).ok) || kimosUrl() || 'https://figit.ai';
  }

  /* Prueba real del enlace: el QR de KIMOS se comprueba pidiendo lo mismo
     que pedirá el teléfono que escanee (la definición pública) y mirando que
     traiga ESTA tarjeta. Un dominio propio solo puede comprobarse que responde. */
  async function testLink() {
    const url = qrTarget();
    const chk = KVC.checkQrUrl(url);
    if (!chk.ok) return { ok: false, text: chk.reason };
    if (url === kimosUrl()) {
      if (!model.published) return { ok: false, text: 'El QR apunta a tu página de KIMOS, pero la tarjeta aún no está publicada: quien escanee verá «no publicada».' };
      try {
        const r = await fetch(baseApi(shell) + '/api/public/app/' + encodeURIComponent(instanceId) + '/definition', { cache: 'no-store' });
        if (!r.ok) return { ok: false, text: 'La página pública respondió ' + r.status + '. Vuelve a publicar.' };
        const j = await r.json();
        const pub = j && j.data && j.data.profile;
        if (!pub || pub.name !== model.profile.name) return { ok: false, text: 'La página pública aún muestra datos anteriores. Espera unos segundos y prueba otra vez.' };
        return { ok: true, text: 'Verificado: el QR abre la tarjeta de ' + pub.name + ' con ' + KVC.channels(KVC.normalize(pub)).length + ' canales de contacto.' };
      } catch (e) {
        return { ok: false, text: 'No se pudo comprobar: ' + String((e && e.message) || e) };
      }
    }
    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-store' });
      return { ok: true, text: 'El dominio responde. Ábrelo una vez en tu teléfono para confirmar que muestra tu tarjeta.' + (chk.warn ? ' ' + chk.warn : '') };
    } catch (e) {
      return { ok: false, text: 'El dominio no responde: el QR no abriría nada. Revisa la dirección o súbele el HTML exportado.' };
    }
  }

  /* Imágenes subidas: con `shell.files` pasan a URL pública (no ocupan el
     documento); sin él quedan embebidas como data: comprimido. */
  async function storeImage(dataUrl, name) {
    if (shell.files && shell.files.upload) {
      try {
        return await shell.files.upload(dataUrlToFile(dataUrl, name), { folder: 'tarjeta', maxMB: 4 });
      } catch (e) { /* sin cuota o permiso: se embebe */ }
    }
    return dataUrl;
  }

  async function publish(enabled) {
    if (!instanceId || !shell.items) {
      setUi({ error: 'Abre la app como documento (🗂️ Nuevo) para poder publicarla.' });
      return false;
    }
    const definicion = {
      kind: 'definition',
      public: {
        enabled: !!enabled,
        // «Déjame tus datos»: el gateway acepta envíos solo en el canal 'lead'.
        channels: [].concat(model.profile.leadForm === 'on' ? ['lead'] : [], model.profile.stats === 'on' ? ['visita'] : []),
        // Lo que ve el mundo: SOLO la tarjeta. Es información de contacto
        // pensada para compartirse; nada más de la instancia sale de aquí.
        data: enabled ? { profile: model.profile, leads: model.profile.leadForm === 'on', stats: model.profile.stats === 'on', app: APP_ID, version: APP_VERSION } : {},
      },
    };
    try {
      const existentes = await shell.items.list();
      const previo = (existentes || []).find((it) => it && it.id === 'definition');
      if (previo) await shell.items.update('definition', definicion);
      else await shell.items.create(Object.assign({ id: 'definition' }, definicion));
      commit({ published: !!enabled, publishedAt: enabled ? new Date().toISOString() : '' }, { noPublish: true });
      setUi({ error: '' });
      return true;
    } catch (e) {
      setUi({ error: 'No se pudo publicar: ' + String((e && e.message) || e) });
      return false;
    }
  }

  /* ── Prospectos (v1.2) ──
     Lo que envían desde «Déjame tus datos» llega por el gateway como item
     (kind 'submission', channel 'lead'). Aquí se listan, se contactan y se
     pasan a Clientes con shell.records (identidad compartida, sin duplicar). */
  async function loadLeads() {
    if (!instanceId || !shell.items || disposed) return;
    try {
      const all = await shell.items.list();
      const subs = (all || []).filter((it) => it && it.id !== 'definition' && (it.kind || '') === 'submission');
      const list = subs
        .filter((it) => it.channel === 'lead')
        .map((it) => Object.assign({}, it, { data: it.data || {} }))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      const visits = subs.filter((it) => it.channel === 'visita').map((it) => ({ at: it.createdAt || '', d: it.data || {} }));
      const sig = JSON.stringify(list.map((l) => [l.id, l.status, l.recordRef || ''])) + '|' + visits.length;
      if (sig !== leads.sig || !leads.loaded) { leads = { list, visits, loaded: true, error: '', sig }; emit(); }
    } catch (e) {
      leads = Object.assign({}, leads, { loaded: true, error: 'No se pudieron leer los prospectos: ' + String((e && e.message) || e) });
      emit();
    }
  }
  async function setLeadStatus(lead, patch) {
    try {
      await shell.items.update(lead.id, Object.assign({ updatedAt: new Date().toISOString() }, patch));
      await loadLeads();
    } catch (e) { shell.notify({ level: 'error', text: 'No se pudo actualizar: ' + String((e && e.message) || e) }); }
  }
  async function convertLead(lead) {
    const d = lead.data || {};
    if (!shell.records || !shell.records.findOrCreate) {
      shell.notify({ level: 'warn', text: 'Este KIMOS no tiene el registro de clientes compartido: copia los datos a mano.' });
      return;
    }
    const keys = {};
    if (d.email) keys.email = d.email;
    if (d.phone) keys.phone = d.phone;
    try {
      const r = await shell.records.findOrCreate('contact', { keys, label: d.name || d.email || d.phone });
      if (r.warning) shell.notify({ level: 'warn', text: r.warning });
      try {
        await shell.records.link(r.ref, { instanceId, itemId: lead.id, kind: 'prospecto', label: (d.name || '') + (d.company ? ' · ' + d.company : '') });
      } catch (e) { /* el enlace es índice inverso: el contacto ya existe */ }
      await setLeadStatus(lead, { status: 'converted', recordRef: r.ref, convertedAt: new Date().toISOString() });
      shell.notify({ level: 'success', text: (r.created ? 'Contacto creado: ' : 'Ya existía; quedó enlazado: ') + (d.name || '') });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo pasar a Clientes: ' + String((e && e.message) || e) });
    }
  }
  const leadsTimer = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void loadLeads();
  }, 15000);

  async function exportHtml() {
    setUi({ busy: 'export' });
    try {
      const coreSrc = await fetch(resolveAsset('kvc-core.js')).then((r) => {
        if (!r.ok) throw new Error('asset kvc-core.js (' + r.status + ')');
        return r.text();
      });
      const p = Object.assign({}, model.profile);
      for (const k of ['photo', 'logo', 'logoMark', 'logoWord']) {
        const src = KVC.resolveImg(p[k], resolveAsset);
        if (src && src.indexOf('data:') !== 0) {
          try { p[k] = await blobToDataUrl(await fetch(src).then((r) => r.blob())); } catch (e) { /* se deja la URL */ }
        }
      }
      // El QR del HTML exportado apunta al enlace público real (dominio propio
      // o la página de KIMOS), nunca a «donde se abra el archivo».
      // Imagen para compartir: con shell.files queda en una URL pública y el
      // HTML la declara como og:image (vista previa en WhatsApp y LinkedIn).
      let ogImage = '';
      if (shell.files && shell.files.upload) {
        try {
          const blob = await KVC.shareImage(p, { qrUrl: qrTarget() });
          ogImage = await shell.files.upload(new File([blob], 'compartir.png', { type: 'image/png' }), { folder: 'tarjeta', maxMB: 3 });
        } catch (e) { ogImage = ''; }
      }
      // Publicada: el HTML alojado fuera de KIMOS manda prospectos y visitas a
      // esta app por el gateway público (CORS abierto en /api/public/*).
      const live = model.published;
      const html = KVC.standaloneHtml(p, coreSrc, {
        qrUrl: qrTarget(), ogImage,
        leadEndpoint: live && p.leadForm === 'on' ? gatewayUrl('lead') : '',
        statsEndpoint: live && p.stats === 'on' ? gatewayUrl('visita') : '',
      });
      KVC.download(KVC.slug(p.name) + '_tarjeta.html', new Blob([html], { type: 'text/html;charset=utf-8' }));
      shell.notify({ level: 'success', text: 'HTML exportado: súbelo como index.html a tu dominio.' });
    } catch (e) {
      shell.notify({ level: 'error', text: 'No se pudo exportar: ' + String((e && e.message) || e) });
    }
    setUi({ busy: '' });
  }

  /* ── Agente ── */
  const EDITABLE = ['name', 'firstName', 'lastName', 'title', 'company', 'tagline', 'phone', 'whatsapp', 'whatsappMsg',
    'email', 'website', 'linkedin', 'instagram', 'address', 'city', 'region', 'country', 'publicUrl', 'cardId', 'motto', 'location', 'hashtag'];
  let agentOff = null;
  if (shell.agent && typeof shell.agent.register === 'function') {
    const props = {};
    EDITABLE.forEach((k) => { props[k] = { type: 'string' }; });
    agentOff = shell.agent.register({
      label: 'KIMOS vCard',
      description: 'Tarjeta de contacto virtual con QR: consulta y edita los datos (nombre, cargo, WhatsApp, correo, LinkedIn, web, Instagram, dirección), publica o despublica la página que abre el QR y entrega su enlace.',
      tools: [
        { name: 'GET_CARD', description: 'Devuelve los datos de la tarjeta, si está publicada y el enlace del QR.', inputSchema: { type: 'object', properties: {} } },
        { name: 'UPDATE_CARD', description: 'Actualiza campos de la tarjeta. Solo se cambian los campos enviados. whatsapp va en dígitos con código de país (56987161097).', inputSchema: { type: 'object', properties: props } },
        { name: 'GET_STATS', description: 'Medición de la tarjeta: aperturas, toques por canal (WhatsApp, correo, LinkedIn, web, Instagram, llamar, ubicación), contactos guardados y prospectos. days: 7, 30, 90 o 0 (todo).', inputSchema: { type: 'object', properties: { days: { type: 'number' } } } },
        { name: 'LIST_LEADS', description: 'Lista los prospectos que dejaron sus datos en la tarjeta (nombre, empresa, correo, teléfono, mensaje, estado).', inputSchema: { type: 'object', properties: {} } },
        { name: 'SET_PUBLISHED', description: 'Publica (true) o despublica (false) la página pública que abre el QR.', inputSchema: { type: 'object', properties: { published: { type: 'boolean' } }, required: ['published'] } },
      ],
      getSnapshot: () => (!model.profile ? { app: APP_ID, version: APP_VERSION, loading: true } : {
        app: APP_ID, version: APP_VERSION, profile: Object.assign({}, model.profile, {
          photo: model.profile.photo ? '(imagen)' : '', logo: '(imagen)', logoMark: '(imagen)', logoWord: '(imagen)',
        }), published: model.published, qrUrl: qrTarget(), kimosPublicUrl: kimosUrl(),
        stats: KVC ? summarize(leads.visits, leads.list, 30) : null,
      }),
      dispatchAction: async (action) => {
        const t = action && action.type;
        const pl = (action && action.payload) || {};
        if (t === 'GET_CARD') return { success: true, message: JSON.stringify({ profile: model.profile.name, published: model.published, qrUrl: qrTarget() }) };
        if (t === 'UPDATE_CARD') {
          const patch = {};
          EDITABLE.forEach((k) => { if (typeof pl[k] === 'string') patch[k] = pl[k].slice(0, 400); });
          if (!Object.keys(patch).length) return { success: false, error: 'No llegó ningún campo editable.' };
          updateProfile(patch);
          return { success: true, message: 'Tarjeta actualizada: ' + Object.keys(patch).join(', ') };
        }
        if (t === 'GET_STATS') {
          await loadLeads();
          const days = [7, 30, 90, 0].indexOf(Number(pl.days)) >= 0 ? Number(pl.days) : 30;
          const st = summarize(leads.visits, leads.list, days);
          delete st.daily;
          return { success: true, message: JSON.stringify(Object.assign({ periodo: days ? days + ' días' : 'todo' }, st)) };
        }
        if (t === 'LIST_LEADS') {
          await loadLeads();
          return { success: true, message: JSON.stringify(leads.list.slice(0, 50).map((l) => Object.assign({ id: l.id, status: l.status || 'new', at: l.createdAt }, l.data))) };
        }
        if (t === 'SET_PUBLISHED') {
          const ok = await publish(pl.published === true);
          return ok ? { success: true, message: pl.published ? 'Publicada en ' + qrTarget() : 'Despublicada' } : { success: false, error: ui.error };
        }
        return { success: false, error: 'Acción desconocida: ' + t };
      },
    });
  }

  if (shell.documents) {
    try {
      shell.documents.onSerialize(() => ({ profile: model.profile }));
      shell.documents.onLoad((cfg) => { if (cfg && cfg.profile && KVC) commit({ profile: KVC.normalize(cfg.profile) }); });
    } catch (e) { /* host sin documentos */ }
  }

  loadCore(shell).then((core) => {
    if (disposed) return;
    KVC = core;
    KVC.injectCss(document, 'kvcx-app-css', APP_CSS);
    model = Object.assign({}, model, { profile: KVC.normalize(KVC.DEFAULT_PROFILE) });
    emit();
    void load();
    void loadBrands();
    void loadLeads();
  }).catch((e) => {
    coreErr = String((e && e.message) || e);
    emit();
  });

  /* ── Componentes ── */
  function Field(props) {
    const { label, k, profile, type, placeholder, help, area } = props;
    const val = profile[k] || '';
    const onChange = (e) => updateProfile({ [k]: e.target.value });
    return h('label', { className: 'kvcx-field' + (props.wide ? ' kvcx-wide' : '') },
      h('span', { className: 'kvcx-label' }, label),
      area
        ? h('textarea', { className: 'kvcx-input', rows: 3, value: val, placeholder, onChange })
        : h('input', { className: 'kvcx-input', type: type || 'text', value: val, placeholder, onChange }),
      help ? h('span', { className: 'kvcx-help' }, help) : null);
  }

  function ImageField(props) {
    const { label, k, kind, profile } = props;
    const inputRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const src = KVC.resolveImg(profile[k], resolveAsset);
    const onFile = async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { shell.notify({ level: 'warn', text: 'Elige una imagen (JPG, PNG o WebP).' }); return; }
      setBusy(true);
      try {
        const data = await fileToDataUrl(f, kind);
        const url = await storeImage(data, k + (kind === 'photo' ? '.jpg' : '.png'));
        updateProfile({ [k]: url });
      } catch (err) {
        shell.notify({ level: 'error', text: String((err && err.message) || err) });
      }
      setBusy(false);
    };
    return h('div', { className: 'kvcx-img' },
      h('div', { className: 'kvcx-img-prev' + (kind === 'photo' ? ' kvcx-round' : '') }, src ? h('img', { src, alt: '' }) : h('span', null, 'Sin imagen')),
      h('div', { className: 'kvcx-img-meta' },
        h('span', { className: 'kvcx-label' }, label),
        h('div', { className: 'kvcx-row' },
          h('button', { type: 'button', className: 'kvcx-btn', disabled: busy, onClick: () => inputRef.current && inputRef.current.click() }, busy ? 'Subiendo…' : 'Cambiar'),
          h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: () => updateProfile({ [k]: KVC.DEFAULT_PROFILE[k] }) }, 'Original')),
        h('input', { ref: inputRef, type: 'file', accept: 'image/*', hidden: true, onChange: onFile })));
  }

  function ColorField({ label, k, profile }) {
    return h('label', { className: 'kvcx-color' },
      h('input', { type: 'color', value: profile.theme[k], onChange: (e) => updateProfile({ theme: { [k]: e.target.value } }) }),
      h('span', null, label));
  }

  function Preview({ profile, qrUrl, device, leads: leadsOn }) {
    const ref = useRef(null);
    const key = useMemo(() => JSON.stringify(profile) + '|' + qrUrl + '|' + leadsOn, [profile, qrUrl, leadsOn]);
    useEffect(() => {
      if (!ref.current) return undefined;
      let inst = null;
      const t = setTimeout(() => {
        inst = KVC.mount(ref.current, profile, {
          preview: true, storage: false, resolve: resolveAsset, qrUrl,
          // Publicada: el formulario de la vista previa envía de verdad (queda
          // marcado «vista previa») y el prospecto aparece al instante.
          leadEndpoint: leadsOn && profile.leadForm === 'on' ? gatewayUrl('lead') : '',
          onLead: () => { void loadLeads(); shell.notify({ level: 'success', text: 'Prospecto registrado en la pestaña Prospectos.' }); },
        });
      }, 180);
      return () => { clearTimeout(t); if (inst) inst.destroy(); };
    }, [key]);
    return h('div', { className: 'kvcx-device kvcx-device-' + device },
      h('div', { className: 'kvcx-device-screen', ref }));
  }

  function PublishPane({ m }) {
    const url = qrTarget();
    const kurl = kimosUrl();
    const qrRef = useRef(null);
    const [test, setTest] = useState(null);
    const own = m.profile.publicUrl ? KVC.checkQrUrl(m.profile.publicUrl) : null;
    const runTest = async () => { setTest({ busy: true, text: 'Comprobando…' }); setTest(await testLink()); };
    useEffect(() => { setTest(null); }, [url, m.published]);
    useEffect(() => {
      if (!qrRef.current) return;
      try { qrRef.current.replaceChildren(KVC.qrSvg(url, { dark: m.profile.theme.ink, logo: KVC.resolveImg(m.profile.logoMark, resolveAsset) })); }
      catch (e) { qrRef.current.textContent = 'Enlace demasiado largo para un QR.'; }
    }, [url, m.profile.theme.ink, m.profile.logoMark]);
    const copy = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => shell.notify({ level: 'success', text: 'Enlace copiado' }));
    };
    const png = () => {
      fetch(KVC.resolveImg(m.profile.logoMark, resolveAsset)).then((r) => r.blob()).then(blobToDataUrl).catch(() => '')
        .then((logo) => KVC.qrPng(url, { dark: m.profile.theme.ink, logo, px: 1400 }))
        .then((b) => KVC.download('QR_' + KVC.slug(m.profile.name) + '.png', b))
        .catch(() => shell.notify({ level: 'error', text: 'No se pudo generar el PNG' }));
    };
    return h('div', { className: 'kvcx-pane' },
      h('div', { className: 'kvcx-status ' + (m.published ? 'kvcx-ok' : 'kvcx-off') },
        h('span', { className: 'kvcx-status-dot' }),
        h('div', null,
          h('strong', null, m.published ? 'Tarjeta publicada' : 'Tarjeta sin publicar'),
          h('small', null, m.published
            ? 'Quien escanee el QR verá tu tarjeta. Los cambios se publican solos.'
            : 'Publícala para que el QR abra tu tarjeta en cualquier teléfono.')),
        h('button', { type: 'button', className: 'kvcx-btn ' + (m.published ? 'kvcx-btn-ghost' : 'kvcx-btn-primary'), disabled: !instanceId, onClick: () => publish(!m.published) },
          m.published ? 'Despublicar' : 'Publicar ahora')),
      !m.profile.whatsapp ? h('p', { className: 'kvcx-warn' }, 'Tu tarjeta no tiene WhatsApp: agrégalo en Canales para que sea el contacto principal.') : null,
      !instanceId ? h('p', { className: 'kvcx-warn' }, 'Esta ventana no tiene documento: abre la app desde 🗂️ Documentos → Nuevo para guardar y publicar.') : null,
      h('div', { className: 'kvcx-qr' },
        h('div', { className: 'kvcx-qr-img', ref: qrRef }),
        h('div', { className: 'kvcx-qr-meta' },
          h('span', { className: 'kvcx-label' }, 'El QR abre'),
          h('code', { className: 'kvcx-url' }, url),
          h('div', { className: 'kvcx-row kvcx-wrap' },
            h('button', { type: 'button', className: 'kvcx-btn', onClick: copy }, 'Copiar enlace'),
            h('a', { className: 'kvcx-btn', href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir'),
            h('button', { type: 'button', className: 'kvcx-btn', onClick: png }, 'QR en PNG'),
            h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-primary', disabled: test && test.busy, onClick: runTest }, 'Probar el QR')),
          test ? h('p', { className: 'kvcx-test ' + (test.busy ? '' : test.ok ? 'kvcx-test-ok' : 'kvcx-test-bad') }, (test.busy ? '' : test.ok ? '✔ ' : '✖ ') + test.text) : null)),
      own && !own.ok ? h('p', { className: 'kvcx-warn' }, 'Dominio propio no usado: ' + own.reason) : null,
      own && own.ok && own.warn ? h('p', { className: 'kvcx-help' }, own.warn) : null,
      h(Field, { label: 'Dominio propio (opcional)', k: 'publicUrl', profile: m.profile, placeholder: 'https://figit.ai/bryan', wide: true,
        help: 'Si alojas la tarjeta en tu dominio (con «Exportar HTML»), el QR apunta ahí. Vacío = enlace público de KIMOS' + (kurl ? '.' : ' (requiere documento).') }),
      h('div', { className: 'kvcx-row kvcx-wrap' },
        h('button', { type: 'button', className: 'kvcx-btn', disabled: ui.busy === 'export', onClick: exportHtml }, ui.busy === 'export' ? 'Exportando…' : 'Exportar HTML autónomo'),
        h('button', { type: 'button', className: 'kvcx-btn', onClick: () => KVC.saveVcf(m.profile, resolveAsset) }, 'Descargar contacto .vcf'),
        h('button', { type: 'button', className: 'kvcx-btn', title: 'Un QR que guarda tu contacto aunque no haya señal', onClick: () => {
          KVC.qrPng(KVC.vcardLite(m.profile), { dark: m.profile.theme.ink, px: 1400, ec: 'M' })
            .then((b) => KVC.download('QR_sin_internet_' + KVC.slug(m.profile.name) + '.png', b))
            .catch(() => shell.notify({ level: 'error', text: 'No se pudo generar el QR sin internet' }));
        } }, 'QR sin internet (PNG)')),
      m.published && instanceId ? h('div', { className: 'kvcx-qr-meta' },
        h('span', { className: 'kvcx-label' }, 'Enlace para formularios externos'),
        h('code', { className: 'kvcx-url' }, gatewayUrl('')),
        h('small', { className: 'kvcx-help' }, 'Si tu tarjeta vive en otro sitio (GitHub Pages, figit.ai), este enlace conecta su formulario y su medición con esta app.')) : null,
      m.published ? h('p', { className: 'kvcx-help' }, 'El HTML exportado lleva el formulario y la medición conectados a esta app: aunque lo subas a tu dominio o a GitHub Pages, cada prospecto y cada visita llegan aquí.') : null,
      h(ShareImage, { m }));
  }

  function BrandPicker({ p }) {
    const [sel, setSel] = useState(p.brandId || brands.currentId || '');
    if (!shell.brands) {
      return h('div', { className: 'kvcx-brand kvcx-brand-off' },
        h('strong', null, 'Marca de la empresa'),
        h('small', null, 'Este KIMOS aún no expone el registro de marcas: ajusta logos y colores a mano aquí abajo.'));
    }
    const list = brands.list;
    const chosen = list.find((b) => b.id === sel);
    const sw = (c) => h('span', { className: 'kvcx-sw', style: { background: c }, title: c });
    return h('div', { className: 'kvcx-brand' },
      h('div', { className: 'kvcx-brand-head' },
        h('div', null,
          h('strong', null, 'Marca de la empresa'),
          h('small', null, 'La tarjeta asume el manual de marca: colores, logos y tipografía.')),
        h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: loadBrands }, 'Recargar')),
      !brands.loaded ? h('small', null, 'Cargando marcas…') :
      list.length === 0 ? h('small', null, 'No hay marcas registradas. Créalas en la app «Marcas» de KIMOS y vuelve aquí.') :
      h('div', { className: 'kvcx-brand-list' }, list.map((b) => {
        const pt = brandToPatch(b);
        return h('button', { key: b.id, type: 'button', className: 'kvcx-brand-opt' + (sel === b.id ? ' kvcx-on' : ''), onClick: () => setSel(b.id) },
          (b.logoLight || b.logoDark) ? h('img', { src: b.logoLight || b.logoDark, alt: '' }) : h('span', { className: 'kvcx-brand-ph' }, (b.name || '?').slice(0, 1)),
          h('span', { className: 'kvcx-brand-name' }, b.name || 'Marca', b.isDefault ? h('em', null, 'por defecto') : null),
          pt ? h('span', { className: 'kvcx-sws' }, sw(pt.theme.primary), sw(pt.theme.accent), sw(pt.theme.ink), sw(pt.theme.soft)) : h('small', null, 'sin color base'));
      })),
      chosen && Array.isArray(chosen.warnings) && chosen.warnings.length ? h('ul', { className: 'kvcx-warns' }, chosen.warnings.map((w, i) => h('li', { key: i }, w))) : null,
      h('div', { className: 'kvcx-row kvcx-wrap' },
        h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-primary', disabled: !chosen, onClick: () => applyBrand(chosen) },
          p.brandId && p.brandId === sel ? 'Volver a aplicar la marca' : 'Aplicar esta marca'),
        p.brandName ? h('small', { className: 'kvcx-help' }, 'Aplicada: ' + p.brandName) : null));
  }

  const newLeads = (l) => (l && l.list ? l.list.filter((x) => (x.status || 'new') === 'new').length : 0);

  function TemplatePicker() {
    const [busy, setBusy] = useState('');
    const apply = async (kind, brand, label) => {
      if (typeof confirm === 'function' && !confirm('¿Reemplazar la tarjeta actual por la plantilla «' + label + '»? El enlace público se mantiene.')) return;
      setBusy(label);
      try { commit({ profile: await buildTemplate(kind, brand) }); shell.notify({ level: 'success', text: 'Plantilla aplicada: ' + label }); }
      finally { setBusy(''); }
    };
    const opts = [
      { kind: 'figit', label: 'FIGIT · Bryan Valdes (fábrica)', sub: 'La tarjeta original completa.' },
      { kind: 'blank', label: 'En blanco', sub: 'Solo tus datos de KIMOS, sin marca.' },
    ].concat((brands.list || []).map((b) => ({ kind: 'brand', brand: b, label: 'Marca: ' + (b.name || 'sin nombre'), sub: 'Tus datos con los colores y logos de esta marca.' })));
    return h('div', { className: 'kvcx-preset' },
      h('div', null,
        h('strong', null, 'Plantillas'),
        h('small', null, 'Empieza desde una tarjeta lista. Cada empresa tiene la suya, tomada del registro de marcas de KIMOS.')),
      h('div', { className: 'kvcx-tpls' }, opts.map((o) =>
        h('button', { key: o.label, type: 'button', className: 'kvcx-tpl', disabled: !!busy, onClick: () => apply(o.kind, o.brand, o.label) },
          h('strong', null, busy === o.label ? 'Aplicando…' : o.label), h('small', null, o.sub)))));
  }

  function LeadsPane({ l, m }) {
    useEffect(() => { void loadLeads(); }, []);
    const [filter, setFilter] = useState('open');
    if (!instanceId) return h('p', { className: 'kvcx-warn' }, 'Abre la app como documento para recibir prospectos.');
    const list = (l.list || []).filter((x) => (filter === 'open' ? (x.status || 'new') !== 'archived' : (x.status || 'new') === 'archived'));
    const fmt = (iso) => { try { return new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso || ''; } };
    return h('div', { className: 'kvcx-pane' },
      m.profile.leadForm !== 'on' ? h('p', { className: 'kvcx-warn' }, 'El formulario está apagado (pestaña Canales): nadie puede dejarte sus datos.') : null,
      m.profile.leadForm === 'on' && !m.published ? h('p', { className: 'kvcx-warn' }, 'Publica la tarjeta para que el formulario reciba prospectos.') : null,
      h('div', { className: 'kvcx-row kvcx-wrap' },
        h('div', { className: 'kvcx-seg' },
          h('button', { type: 'button', className: filter === 'open' ? 'kvcx-on' : '', onClick: () => setFilter('open') }, 'Activos'),
          h('button', { type: 'button', className: filter === 'archived' ? 'kvcx-on' : '', onClick: () => setFilter('archived') }, 'Archivados')),
        h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: loadLeads }, 'Actualizar')),
      l.error ? h('p', { className: 'kvcx-warn' }, l.error) : null,
      !l.loaded ? h('p', { className: 'kvcx-help' }, 'Cargando prospectos…') :
      list.length === 0 ? h('div', { className: 'kvcx-empty' },
        h('strong', null, filter === 'open' ? 'Aún no hay prospectos' : 'No hay archivados'),
        h('small', null, 'Cuando alguien escanee tu QR y complete «Déjame tus datos», aparecerá aquí con su nombre, empresa y forma de contacto.')) :
      h('div', { className: 'kvcx-leads' }, list.map((x) => {
        const d = x.data || {};
        const st = x.status || 'new';
        const wa = String(d.phone || '').replace(/\D/g, '');
        return h('article', { key: x.id, className: 'kvcx-lead kvcx-lead-' + st },
          h('div', { className: 'kvcx-lead-h' },
            h('strong', null, d.name || '(sin nombre)'),
            h('span', { className: 'kvcx-lead-st' }, st === 'new' ? 'Nuevo' : st === 'converted' ? 'En Clientes' : st === 'contacted' ? 'Contactado' : 'Archivado')),
          d.company ? h('div', { className: 'kvcx-lead-co' }, d.company) : null,
          h('div', { className: 'kvcx-lead-meta' },
            d.email ? h('span', null, d.email) : null,
            d.phone ? h('span', null, d.phone) : null,
            h('span', null, fmt(x.createdAt)), d.lang === 'en' ? h('span', null, 'EN') : null),
          d.message ? h('p', { className: 'kvcx-lead-msg' }, d.message) : null,
          h('div', { className: 'kvcx-row kvcx-wrap' },
            wa ? h('a', { className: 'kvcx-btn kvcx-btn-primary', href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent('Hola ' + String(d.name || '').split(' ')[0] + ', soy ' + m.profile.name + ' de ' + m.profile.company + '. Gracias por dejarme tus datos.'), target: '_blank', rel: 'noopener noreferrer', onClick: () => st === 'new' && setLeadStatus(x, { status: 'contacted' }) }, 'WhatsApp') : null,
            d.email ? h('a', { className: 'kvcx-btn', href: 'mailto:' + d.email + '?subject=' + encodeURIComponent(m.profile.company + ' · ' + m.profile.name), onClick: () => st === 'new' && setLeadStatus(x, { status: 'contacted' }) }, 'Correo') : null,
            st !== 'converted' ? h('button', { type: 'button', className: 'kvcx-btn', onClick: () => convertLead(x) }, 'Pasar a Clientes') : null,
            st !== 'archived'
              ? h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: () => setLeadStatus(x, { status: 'archived' }) }, 'Archivar')
              : h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: () => setLeadStatus(x, { status: 'new' }) }, 'Restaurar')));
      })));
  }

  function ShareImage({ m }) {
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const blobRef = useRef(null);
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
    const make = async () => {
      setBusy(true);
      try {
        const b = await KVC.shareImage(m.profile, { qrUrl: qrTarget(), resolve: resolveAsset });
        blobRef.current = b;
        setUrl(URL.createObjectURL(b));
      } catch (e) { shell.notify({ level: 'error', text: 'No se pudo crear la imagen: ' + String((e && e.message) || e) }); }
      setBusy(false);
    };
    return h('div', { className: 'kvcx-share' },
      h('div', null,
        h('strong', null, 'Imagen para compartir'),
        h('small', null, 'La vista previa que aparece al enviar tu enlace por WhatsApp, LinkedIn o correo (1200 × 630). Va incluida en el HTML exportado.')),
      url ? h('img', { src: url, alt: 'Vista previa al compartir', className: 'kvcx-share-img' }) : null,
      h('div', { className: 'kvcx-row kvcx-wrap' },
        h('button', { type: 'button', className: 'kvcx-btn', disabled: busy, onClick: make }, busy ? 'Creando…' : url ? 'Actualizar imagen' : 'Crear imagen'),
        url ? h('button', { type: 'button', className: 'kvcx-btn', onClick: () => KVC.download('compartir_' + KVC.slug(m.profile.name) + '.png', blobRef.current) }, 'Descargar PNG') : null));
  }

  function StatsPane({ l, m }) {
    const [days, setDays] = useState(30);
    useEffect(() => { void loadLeads(); }, []);
    const st = summarize(l.visits, l.list, days);
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    const maxC = Math.max(1, ...CHANNELS.map(([k]) => st.clicks[k]));
    const maxD = Math.max(1, ...st.daily.map((d) => d.opens));
    const kpi = (label, value, sub) => h('div', { className: 'kvcx-kpi' }, h('span', null, label), h('strong', null, String(value)), sub ? h('small', null, sub) : null);
    const refs = Object.keys(st.refs).sort((a, b) => st.refs[b] - st.refs[a]).slice(0, 5);
    const W = 560, H = 120, bw = W / st.daily.length;
    return h('div', { className: 'kvcx-pane' },
      m.profile.stats !== 'on' ? h('p', { className: 'kvcx-warn' }, 'La medición está apagada (pestaña Canales).') : null,
      !m.published ? h('p', { className: 'kvcx-warn' }, 'Publica la tarjeta para empezar a medir.') : null,
      h('div', { className: 'kvcx-row kvcx-wrap' },
        h('div', { className: 'kvcx-seg' }, [[7, '7 días'], [30, '30 días'], [90, '90 días'], [0, 'Todo']].map(([d, t]) =>
          h('button', { key: t, type: 'button', className: days === d ? 'kvcx-on' : '', onClick: () => setDays(d) }, t))),
        h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: loadLeads }, 'Actualizar')),
      h('div', { className: 'kvcx-kpis' },
        kpi('Aperturas', st.opens, st.mobile ? pct(st.mobile, st.opens) + '% desde el teléfono' : null),
        kpi('Toques en canales', st.totalClicks, st.opens ? pct(st.touched, st.opens) + '% de las visitas tocó alguno' : null),
        kpi('Contactos guardados', st.saved, '.vcf descargados'),
        kpi('Prospectos', st.leads, st.opens ? st.conversion + '% de las aperturas' : null)),
      st.opens === 0 && st.totalClicks === 0 ? h('div', { className: 'kvcx-empty' },
        h('strong', null, 'Aún no hay visitas en este periodo'),
        h('small', null, 'Cada vez que alguien abra tu tarjeta (escaneando el QR o desde el enlace) se suma aquí, junto con los canales que toque.')) : null,
      h('section', { className: 'kvcx-chart' },
        h('h4', null, 'Toques por canal'),
        h('div', { className: 'kvcx-bars' }, CHANNELS.map(([k, label]) =>
          h('div', { key: k, className: 'kvcx-bar-row' },
            h('span', { className: 'kvcx-bar-l' }, label),
            h('span', { className: 'kvcx-bar-t' }, h('span', { className: 'kvcx-bar-f' + (k === 'whatsapp' ? ' kvcx-bar-wa' : ''), style: { width: (st.clicks[k] / maxC) * 100 + '%' } })),
            h('span', { className: 'kvcx-bar-v' }, String(st.clicks[k])))))),
      h('section', { className: 'kvcx-chart' },
        h('h4', null, 'Aperturas por día · últimos ' + (days || 30) + ' días'),
        h('div', { className: 'kvcx-days' },
          h('svg', { viewBox: '0 0 ' + W + ' ' + (H + 18), preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Aperturas por día' },
            h('line', { x1: 0, x2: W, y1: H, y2: H, className: 'kvcx-axis' }),
            st.daily.map((d, i) => {
              const hh = (d.opens / maxD) * (H - 8);
              return h('rect', { key: d.day, x: i * bw + bw * 0.15, y: H - hh, width: Math.max(1, bw * 0.7), height: Math.max(d.opens ? 2 : 0, hh), rx: 2, className: 'kvcx-day' },
                h('title', null, d.day + ': ' + d.opens));
            }),
            h('text', { x: 0, y: H + 14, className: 'kvcx-axis-t' }, st.daily[0] ? st.daily[0].day.slice(5) : ''),
            h('text', { x: W, y: H + 14, textAnchor: 'end', className: 'kvcx-axis-t' }, st.daily.length ? st.daily[st.daily.length - 1].day.slice(5) : ''),
            h('text', { x: 4, y: 12, className: 'kvcx-axis-t' }, 'máx. ' + maxD)))),
      h('div', { className: 'kvcx-kpis kvcx-kpis-3' },
        kpi('En inglés', st.opens ? pct(st.en, st.opens) + '%' : '—', st.en + ' aperturas'),
        kpi('Compartida', st.shared, 'veces desde la tarjeta'),
        kpi('QR descargado', st.qr, 'PNG desde la tarjeta')),
      refs.length ? h('section', { className: 'kvcx-chart' },
        h('h4', null, 'De dónde llegan'),
        h('ul', { className: 'kvcx-refs' }, refs.map((r) => h('li', { key: r }, h('span', null, r), h('strong', null, String(st.refs[r])))))) : null,
      h('p', { className: 'kvcx-help' }, 'Una apertura cuenta una vez por visita. «Directo o QR» incluye los escaneos y los enlaces abiertos desde WhatsApp, que no informan su origen.'));
  }

  function Component() {
    const [st, setSt] = useState({ model, ui, leads });
    useEffect(() => { listeners.add(setSt); return () => listeners.delete(setSt); }, []);
    const m = st.model, u = st.ui, p = m.profile;
    if (!KVC || !p) {
      return h('div', { className: 'kimos-vcard' },
        h('div', { className: 'kvcx-boot' },
          h('strong', null, coreErr ? 'No se pudo abrir KIMOS vCard' : 'Abriendo KIMOS vCard…'),
          coreErr ? h('small', null, coreErr) : null));
    }
    const pane = {
      perfil: h('div', { className: 'kvcx-pane' },
        h(TemplatePicker, null),
        !p.whatsapp ? h('p', { className: 'kvcx-warn' }, 'Falta tu WhatsApp (pestaña Canales): es el canal principal de la tarjeta.') : null,
        h(ImageField, { label: 'Foto de perfil', k: 'photo', kind: 'photo', profile: p }),
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'Nombre en la tarjeta', k: 'name', profile: p, wide: true }),
          h(Field, { label: 'Nombre(s)', k: 'firstName', profile: p, help: 'Para la agenda del teléfono' }),
          h(Field, { label: 'Apellidos', k: 'lastName', profile: p }),
          h(Field, { label: 'Cargo', k: 'title', profile: p }),
          h(Field, { label: 'Empresa', k: 'company', profile: p }),
          h(Field, { label: 'Frase', k: 'tagline', profile: p, area: true, wide: true })),
        h('div', { className: 'kvcx-sub' }, 'English · tarjeta en inglés'),
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'Cargo (inglés)', k: 'titleEn', profile: p, placeholder: 'CEO · Founder' }),
          h(Field, { label: 'Lema del reverso (inglés)', k: 'mottoEn', profile: p }),
          h(Field, { label: 'Frase (inglés)', k: 'taglineEn', profile: p, area: true, wide: true,
            help: 'Quien abre la tarjeta con el teléfono en inglés la ve en inglés; el botón EN/ES la cambia. Vacío = se usa el texto en español.' }))),
      canales: h('div', { className: 'kvcx-pane' },
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'WhatsApp · canal principal', k: 'whatsapp', profile: p, placeholder: '56987161097', type: 'tel', help: 'Con código de país, solo dígitos. Vacío = el del teléfono.' }),
          h(Field, { label: 'Teléfono visible', k: 'phone', profile: p, placeholder: '+56 9 8716 1097', type: 'tel' }),
          h(Field, { label: 'Mensaje inicial de WhatsApp', k: 'whatsappMsg', profile: p, area: true, wide: true }),
          h(Field, { label: 'Mensaje inicial de WhatsApp (inglés)', k: 'whatsappMsgEn', profile: p, area: true, wide: true }),
          h('label', { className: 'kvcx-check kvcx-wide' },
            h('input', { type: 'checkbox', checked: p.leadForm === 'on', onChange: (e) => updateProfile({ leadForm: e.target.checked ? 'on' : 'off' }) }),
            h('span', null, h('strong', null, 'Formulario «Déjame tus datos»'),
              h('small', null, 'Quien escanea puede dejarte nombre, empresa, correo y teléfono. Llegan a la pestaña Prospectos.'))),
          h('label', { className: 'kvcx-check kvcx-wide' },
            h('input', { type: 'checkbox', checked: p.stats === 'on', onChange: (e) => updateProfile({ stats: e.target.checked ? 'on' : 'off' }) }),
            h('span', null, h('strong', null, 'Medición'),
              h('small', null, 'Cuenta aperturas de la tarjeta y toques en cada canal. Sin cookies ni datos personales de quien la abre.'))),
          h(Field, { label: 'Correo', k: 'email', profile: p, type: 'email' }),
          h(Field, { label: 'Sitio web', k: 'website', profile: p, type: 'url' }),
          h(Field, { label: 'LinkedIn', k: 'linkedin', profile: p, type: 'url' }),
          h(Field, { label: 'Instagram', k: 'instagram', profile: p, placeholder: '@cuenta o URL' }),
          h(Field, { label: 'Dirección', k: 'address', profile: p, wide: true }),
          h(Field, { label: 'Ciudad', k: 'city', profile: p }),
          h(Field, { label: 'País', k: 'country', profile: p }))),
      marca: h('div', { className: 'kvcx-pane' },
        h(BrandPicker, { p }),
        h('div', { className: 'kvcx-sub' }, 'Ajuste manual'),
        h(ImageField, { label: 'Logo completo (tarjeta 3D)', k: 'logo', kind: 'logo', profile: p }),
        h(ImageField, { label: 'Isotipo (cabecera y centro del QR)', k: 'logoMark', kind: 'logo', profile: p }),
        h(ImageField, { label: 'Logotipo en texto (cabecera)', k: 'logoWord', kind: 'logo', profile: p }),
        h('div', { className: 'kvcx-colors' },
          h(ColorField, { label: 'Principal', k: 'primary', profile: p }),
          h(ColorField, { label: 'Acento', k: 'accent', profile: p }),
          h(ColorField, { label: 'Texto / QR', k: 'ink', profile: p }),
          h(ColorField, { label: 'Panel suave', k: 'soft', profile: p }),
          h('button', { type: 'button', className: 'kvcx-btn kvcx-btn-ghost', onClick: () => updateProfile({ theme: KVC.DEFAULT_PROFILE.theme }) }, 'Colores por defecto')),
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'ID de la tarjeta', k: 'cardId', profile: p }),
          h(Field, { label: 'Ubicación (reverso)', k: 'location', profile: p }),
          h(Field, { label: 'Lema (reverso)', k: 'motto', profile: p, area: true, wide: true }),
          h(Field, { label: 'Hashtag', k: 'hashtag', profile: p }),
          h(Field, { label: 'Tipografía', k: 'font', profile: p, help: 'Familia de la marca (si está instalada en el equipo).' }))),
      publicar: h(PublishPane, { m }),
      prospectos: h(LeadsPane, { l: st.leads, m }),
      medicion: h(StatsPane, { l: st.leads, m }),
    }[u.tab];

    return h('div', { className: 'kimos-vcard' },
      h('header', { className: 'kvcx-top' },
        h('div', { className: 'kvcx-title' },
          h('strong', null, 'KIMOS vCard'),
          h('span', { className: 'kvcx-ver', title: 'KIMOS vCard v' + APP_VERSION }, 'v' + APP_VERSION),
          m.published ? h('span', { className: 'kvcx-pill-ok' }, '● Publicada') : null),
        h('nav', { className: 'kvcx-tabs' }, TABS.map((t) =>
          h('button', { key: t.id, type: 'button', className: 'kvcx-tab' + (u.tab === t.id ? ' kvcx-tab-on' : ''), onClick: () => { setUi({ tab: t.id }); if (t.id === 'prospectos' || t.id === 'medicion') void loadLeads(); } },
            t.label,
            t.id === 'prospectos' && newLeads(st.leads) ? h('span', { className: 'kvcx-badge' }, newLeads(st.leads)) : null))),
        h('div', { className: 'kvcx-actions' },
          h('div', { className: 'kvcx-seg' },
            h('button', { type: 'button', className: u.device === 'mobile' ? 'kvcx-on' : '', onClick: () => setUi({ device: 'mobile' }) }, 'Móvil'),
            h('button', { type: 'button', className: u.device === 'desktop' ? 'kvcx-on' : '', onClick: () => setUi({ device: 'desktop' }) }, 'Escritorio')))),
      u.error ? h('div', { className: 'kvcx-error' }, u.error, h('button', { type: 'button', onClick: () => setUi({ error: '' }) }, '×')) : null,
      h('div', { className: 'kvcx-body' },
        h('section', { className: 'kvcx-editor' }, m.loaded ? pane : h('p', { className: 'kvcx-help' }, 'Cargando…')),
        h('section', { className: 'kvcx-preview' },
          h('div', { className: 'kvcx-preview-k' }, 'Así la verá quien escanee tu QR'),
          m.loaded ? h(Preview, { profile: p, qrUrl: qrTarget(), device: u.device, leads: m.published }) : null)));
  }

  return {
    Component,
    unmount() {
      disposed = true;
      clearTimeout(saveT);
      clearTimeout(pubT);
      clearInterval(leadsTimer);
      listeners.clear();
      if (typeof agentOff === 'function') agentOff();
    },
  };
}
