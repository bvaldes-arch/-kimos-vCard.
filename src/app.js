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

/*@@CORE@@*/

const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'canales', label: 'Canales' },
  { id: 'marca', label: 'Marca' },
  { id: 'publicar', label: 'Publicar' },
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

export default function mount(shell) {
  const React = globalThis.React;
  const h = React.createElement;
  const { useState, useEffect, useRef, useMemo } = React;

  const instanceId = (shell.app && shell.app.instanceId) || '';
  const resolveAsset = (name) => { try { return shell.assetUrl(name); } catch (e) { return name; } };

  /* ── Estado (un modelo en el closure; UI y agente mutan lo mismo) ── */
  let model = { profile: KVC.normalize(KVC.DEFAULT_PROFILE), published: false, publishedAt: '', loaded: false };
  let ui = { tab: 'perfil', device: 'mobile', busy: '', error: '' };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l({ model, ui }));
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
  async function seedNewInstance() {
    let me = null;
    try {
      const req = typeof shell.authFetch === 'function' ? shell.authFetch : null;
      if (req) {
        const res = await req('/api/identity/me', { cache: 'no-store' });
        if (res.ok) me = await res.json();
      }
    } catch (e) { /* opcional */ }
    const email = String((me && me.email) || '').toLowerCase();
    const fold = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    const def = KVC.DEFAULT_PROFILE;
    // ¿Es la persona del perfil de fábrica (Bryan · FIGIT.ai)? Entonces su
    // tarjeta FIGIT se queda tal cual: ni se reemplaza por el perfil de KIMOS
    // (cargo «Administrador…», sin teléfono) ni se re-marca con la marca del tenant.
    const meName = fold(me && (me.displayName || me.name));
    const isOwner = email === def.email || (meName && fold(def.name).indexOf(meName.split(' ').slice(0, 2).join(' ')) === 0);
    if (isOwner) return;
    if (email) {
      const name = String(me.displayName || me.name || email);
      const phone = String(me.phone || '');
      const first = name.split(' ')[0];
      updateProfile({
        name, firstName: first, lastName: name.split(' ').slice(1).join(' '),
        title: String(me.description || ''), email, phone, whatsapp: phone.replace(/\D/g, ''),
        tagline: '', website: '', motto: '',
        whatsappMsg: 'Hola ' + first + ', te contacto desde tu tarjeta digital.',
        photo: String(me.photoUrl || ''), linkedin: '', instagram: '', address: '', city: '', region: '',
        location: String(me.location || ''), cardId: '', hashtag: '', publicUrl: '',
      });
    }
    if (shell.brands && shell.brands.current) {
      try {
        const cur = await shell.brands.current();
        // FIGIT ya viene de fábrica: solo se aplica una marca distinta.
        if (cur && !/figit/i.test(cur.name || '')) applyBrand(cur, true);
      } catch (e) { /* tenant sin marca: se queda la paleta por defecto */ }
    }
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
        channels: [],
        // Lo que ve el mundo: SOLO la tarjeta. Es información de contacto
        // pensada para compartirse; nada más de la instancia sale de aquí.
        data: enabled ? { profile: model.profile, app: APP_ID, version: APP_VERSION } : {},
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
      const html = KVC.standaloneHtml(p, coreSrc, { qrUrl: qrTarget() });
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
        { name: 'SET_PUBLISHED', description: 'Publica (true) o despublica (false) la página pública que abre el QR.', inputSchema: { type: 'object', properties: { published: { type: 'boolean' } }, required: ['published'] } },
      ],
      getSnapshot: () => ({
        app: APP_ID, version: APP_VERSION, profile: Object.assign({}, model.profile, {
          photo: model.profile.photo ? '(imagen)' : '', logo: '(imagen)', logoMark: '(imagen)', logoWord: '(imagen)',
        }), published: model.published, qrUrl: qrTarget(), kimosPublicUrl: kimosUrl(),
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
      shell.documents.onLoad((cfg) => { if (cfg && cfg.profile) commit({ profile: KVC.normalize(cfg.profile) }); });
    } catch (e) { /* host sin documentos */ }
  }

  KVC.injectCss();
  void load();
  void loadBrands();

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

  function Preview({ profile, qrUrl, device }) {
    const ref = useRef(null);
    const key = useMemo(() => JSON.stringify(profile) + '|' + qrUrl, [profile, qrUrl]);
    useEffect(() => {
      if (!ref.current) return undefined;
      let inst = null;
      const t = setTimeout(() => {
        inst = KVC.mount(ref.current, profile, { preview: true, storage: false, resolve: resolveAsset, qrUrl });
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
        h('button', { type: 'button', className: 'kvcx-btn', onClick: () => KVC.saveVcf(m.profile, resolveAsset) }, 'Descargar contacto .vcf')));
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

  function Component() {
    const [st, setSt] = useState({ model, ui });
    useEffect(() => { listeners.add(setSt); return () => listeners.delete(setSt); }, []);
    const m = st.model, u = st.ui, p = m.profile;
    const pane = {
      perfil: h('div', { className: 'kvcx-pane' },
        h('div', { className: 'kvcx-preset' },
          h('div', null,
            h('strong', null, 'Tarjeta de fábrica: Bryan Valdes Ch. · FIGIT.ai'),
            h('small', null, 'Restaura foto, cargo, canales, logos y colores FIGIT. El enlace público se mantiene.')),
          h('button', { type: 'button', className: 'kvcx-btn', onClick: () => {
            if (typeof confirm === 'function' && !confirm('¿Reemplazar los datos actuales por la tarjeta FIGIT de fábrica?')) return;
            commit({ profile: KVC.normalize(Object.assign({}, KVC.DEFAULT_PROFILE, { publicUrl: model.profile.publicUrl })) });
          } }, 'Restaurar')),
        !p.whatsapp ? h('p', { className: 'kvcx-warn' }, 'Falta tu WhatsApp (pestaña Canales): es el canal principal de la tarjeta.') : null,
        h(ImageField, { label: 'Foto de perfil', k: 'photo', kind: 'photo', profile: p }),
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'Nombre en la tarjeta', k: 'name', profile: p, wide: true }),
          h(Field, { label: 'Nombre(s)', k: 'firstName', profile: p, help: 'Para la agenda del teléfono' }),
          h(Field, { label: 'Apellidos', k: 'lastName', profile: p }),
          h(Field, { label: 'Cargo', k: 'title', profile: p }),
          h(Field, { label: 'Empresa', k: 'company', profile: p }),
          h(Field, { label: 'Frase', k: 'tagline', profile: p, area: true, wide: true }))),
      canales: h('div', { className: 'kvcx-pane' },
        h('div', { className: 'kvcx-grid' },
          h(Field, { label: 'WhatsApp · canal principal', k: 'whatsapp', profile: p, placeholder: '56987161097', type: 'tel', help: 'Con código de país, solo dígitos. Vacío = el del teléfono.' }),
          h(Field, { label: 'Teléfono visible', k: 'phone', profile: p, placeholder: '+56 9 8716 1097', type: 'tel' }),
          h(Field, { label: 'Mensaje inicial de WhatsApp', k: 'whatsappMsg', profile: p, area: true, wide: true }),
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
    }[u.tab];

    return h('div', { className: 'kimos-vcard' },
      h('header', { className: 'kvcx-top' },
        h('div', { className: 'kvcx-title' },
          h('strong', null, 'KIMOS vCard'),
          h('span', { className: 'kvcx-ver', title: 'KIMOS vCard v' + APP_VERSION }, 'v' + APP_VERSION),
          m.published ? h('span', { className: 'kvcx-pill-ok' }, '● Publicada') : null),
        h('nav', { className: 'kvcx-tabs' }, TABS.map((t) =>
          h('button', { key: t.id, type: 'button', className: 'kvcx-tab' + (u.tab === t.id ? ' kvcx-tab-on' : ''), onClick: () => setUi({ tab: t.id }) }, t.label))),
        h('div', { className: 'kvcx-actions' },
          h('div', { className: 'kvcx-seg' },
            h('button', { type: 'button', className: u.device === 'mobile' ? 'kvcx-on' : '', onClick: () => setUi({ device: 'mobile' }) }, 'Móvil'),
            h('button', { type: 'button', className: u.device === 'desktop' ? 'kvcx-on' : '', onClick: () => setUi({ device: 'desktop' }) }, 'Escritorio')))),
      u.error ? h('div', { className: 'kvcx-error' }, u.error, h('button', { type: 'button', onClick: () => setUi({ error: '' }) }, '×')) : null,
      h('div', { className: 'kvcx-body' },
        h('section', { className: 'kvcx-editor' }, m.loaded ? pane : h('p', { className: 'kvcx-help' }, 'Cargando…')),
        h('section', { className: 'kvcx-preview' },
          h('div', { className: 'kvcx-preview-k' }, 'Así la verá quien escanee tu QR'),
          m.loaded ? h(Preview, { profile: p, qrUrl: qrTarget(), device: u.device }) : null)));
  }

  return {
    Component,
    unmount() {
      disposed = true;
      clearTimeout(saveT);
      clearTimeout(pubT);
      listeners.clear();
      if (typeof agentOff === 'function') agentOff();
    },
  };
}
