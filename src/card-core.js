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
  var VERSION = '@@VERSION@@';

  /* ── Perfil por defecto: Bryan Valdes Ch. · FIGIT.ai ────────────────── */
  var DEFAULT_PROFILE = {
    name: 'Bryan Valdes Ch.',
    firstName: 'Bryan',
    lastName: 'Valdes Chacana',
    title: 'CEO · Fundador',
    company: 'FIGIT.ai',
    tagline: 'Transformando el futuro con Inteligencia Artificial y ecosistemas digitales.',
    phone: '+56 9 8716 1097',
    whatsapp: '56987161097',
    whatsappMsg: 'Hola Bryan, un gusto saludarte. Te contacto desde tu tarjeta digital FIGIT.ai',
    email: 'bvaldes@figit.ai',
    website: 'https://figit.ai',
    linkedin: 'https://www.linkedin.com/in/bryan-vald%C3%A9s-chacana/',
    instagram: 'https://www.instagram.com/figit.chile/',
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
    // Inglés (v1.2): si están vacíos, la tarjeta en inglés usa el texto en español.
    titleEn: 'CEO · Founder',
    taglineEn: 'Shaping the future with Artificial Intelligence and digital ecosystems.',
    whatsappMsgEn: "Hi Bryan, great to connect. I'm reaching out from your FIGIT.ai digital card",
    mottoEn: 'Strategic Artificial Intelligence, Predictive Models and High-Impact Automation.',
    leadForm: 'on',
    stats: 'on',
    // Wallet (v2.0): enlaces a un pase YA firmado (ver tools/wallet.mjs). Solo
    // guardan la tarjeta de contacto; nada que ver con pagos.
    walletApple: '',
    walletGoogle: '',
    theme: { primary: '#0052FF', ink: '#0D366B', soft: '#DDF0FF', accent: '#00D2FF' }
  };

  /* Plantilla en blanco (v1.2): lo que recibe una tarjeta nueva de otra
     persona u otra empresa. Nada de los datos de Bryan ni de FIGIT. */
  var EMPTY_PROFILE = (function () {
    var e = {};
    Object.keys(DEFAULT_PROFILE).forEach(function (k) { e[k] = k === 'theme' ? DEFAULT_PROFILE.theme : ''; });
    e.leadForm = 'on';
    e.stats = 'on';
    return e;
  })();

  var FIELDS = ['name', 'firstName', 'lastName', 'title', 'company', 'tagline', 'phone', 'whatsapp',
    'whatsappMsg', 'email', 'website', 'linkedin', 'instagram', 'address', 'city', 'region', 'country',
    'photo', 'logo', 'logoMark', 'logoWord', 'publicUrl', 'cardId', 'motto', 'location', 'hashtag', 'font', 'brandId', 'brandName',
    'titleEn', 'taglineEn', 'whatsappMsgEn', 'mottoEn', 'leadForm', 'stats', 'walletApple', 'walletGoogle'];

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
    // Sin WhatsApp propio, el del teléfono: WhatsApp es el canal principal.
    if (!out.whatsapp && out.phone) out.whatsapp = out.phone.replace(/\D/g, '');
    out.font = out.font.replace(/[^\w \-]/g, '').slice(0, 60);
    out.leadForm = out.leadForm === 'off' ? 'off' : 'on';
    out.stats = out.stats === 'off' ? 'off' : 'on';
    ['walletApple', 'walletGoogle'].forEach(function (k) { if (out[k] && !/^https:\/\//i.test(out[k])) out[k] = ''; });
    var t = p.theme || {};
    out.theme = {};
    Object.keys(DEFAULT_PROFILE.theme).forEach(function (k) {
      out.theme[k] = isHex(t[k]) ? t[k] : DEFAULT_PROFILE.theme[k];
    });
    return out;
  }


  /* ── Idioma (v1.2): español por defecto, inglés completo ────────────── */
  var EN = {
   "Actual": "Reset",
   "Al escanear se abre directamente ": "Scanning opens ",
   "Al escanear se abre tu tarjeta digital con todos tus canales.": "Scanning opens the digital card with every contact channel.",
   "Apunta la cámara de cualquier teléfono para abrir instantáneamente la tarjeta virtual y canales de contacto.": "Point any phone camera here to instantly open the digital card and contact channels.",
   "Cambiar tema": "Toggle theme",
   "Canales Oficiales": "Official Channels",
   "Cerrar": "Close",
   "Chatear por WhatsApp": "Chat on WhatsApp",
   "Compartir tarjeta": "Share card",
   "Compartir": "Share",
   "Contacto descargado: ábrelo para guardarlo en tu agenda.": "Contact downloaded: open it to save it to your phone.",
   "Copiado": "Copied",
   "Copiar Enlace": "Copy Link",
   "Copiar": "Copy",
   "Correo": "Email",
   "Código QR Dinámico": "Dynamic QR Code",
   "Código QR Oficial": "Official QR Code",
   "Código QR": "QR Code",
   "Datos de contacto (vCard 3.0)": "Contact details (vCard 3.0)",
   "Descargar .vcf": "Download .vcf",
   "Descargar Contacto (vCard)": "Download Contact (vCard)",
   "Descargar PNG HD": "Download HD PNG",
   "Destino del QR": "QR destination",
   "Destino personalizado.": "Custom destination.",
   "Ecosistema de Tarjetas Digitales Inteligentes": "Smart Digital Card Ecosystem",
   "Enlace copiado": "Link copied",
   "Enlace de Destino del QR:": "QR Destination Link:",
   "Enlace de destino del QR": "QR destination link",
   "Enlace de la tarjeta": "Card link",
   "Enlace demasiado largo para un QR": "Link too long for a QR code",
   "Enviar Correo Directo": "Send an Email",
   "Envía tu tarjeta digital por el canal que prefieras.": "Send the digital card through your preferred channel.",
   "Escanea para compartir o abrir en otro celular": "Scan to share or open on another phone",
   "Escanear contacto": "Scan contact",
   "Generador Dinámico ": "Dynamic Generator ",
   "Guardar Contacto en el Teléfono": "Save Contact to Phone",
   "Haz clic para voltear la tarjeta": "Click to flip the card",
   "Hola, te comparto la tarjeta digital de ": "Hi, here is the digital card of ",
   "Imprimir Tarjeta": "Print Card",
   "Impulsado por ": "Powered by ",
   "Instagram Oficial": "Official Instagram",
   "Llamar por Teléfono": "Call by Phone",
   "Llamar": "Call",
   "No se pudo generar el PNG": "Could not create the PNG",
   "Oficial": "Official",
   "Perfil en LinkedIn": "LinkedIn Profile",
   "Perfil verificado": "Verified profile",
   "Principal": "Main",
   "Puedes personalizar el enlace a tu propio dominio si lo requieres. Solo se aceptan direcciones https:// públicas.": "You can point it to your own domain. Only public https:// addresses are accepted.",
   "QR descargado en alta resolución": "High-resolution QR downloaded",
   "Sitio Web Oficial": "Official Website",
   "Sitio web": "Website",
   "Tarjeta 3D": "3D Card",
   "Tarjeta de Contacto Ejecutiva": "Executive Contact Card",
   "Tarjeta digital · ": "Digital card · ",
   "Tarjeta digital": "Digital card",
   "Te comparto mi tarjeta de contacto digital.": "Here is my digital contact card.",
   "Ubicación en Google Maps": "Location on Google Maps",
   "Ver Datos vCard": "View vCard Data",
   "Ver QR": "View QR",
   "Ver código QR": "View QR code",
   "Vistas": "Views",
   "Voltear": "Flip",
   "Volver a la tarjeta digital": "Back to the digital card",
   ". Todos los derechos reservados.": ". All rights reserved.",
   " El QR sigue apuntando a ": " The QR still points to ",
   "Correo electrónico": "Email",
   "Ubicación": "Location",
   "Déjame tus datos": "Leave your details",
   "Te contacto yo. Tus datos solo llegan a ": "I will get back to you. Your details only reach ",
   "Nombre": "Name",
   "Empresa": "Company",
   "WhatsApp o teléfono": "WhatsApp or phone",
   "¿En qué te puedo ayudar?": "How can I help you?",
   "Enviar mis datos": "Send my details",
   "Enviar por WhatsApp": "Send via WhatsApp",
   "Enviando…": "Sending…",
   "Escribe tu nombre.": "Please enter your name.",
   "Deja un correo o un teléfono para responderte.": "Leave an email or a phone number so I can reply.",
   "Ese correo no parece válido.": "That email does not look valid.",
   "¡Gracias! Te contactaré pronto.": "Thank you! I will contact you soon.",
   "Tus datos llegaron. ": "Your details arrived. ",
   "Se abrió WhatsApp con tus datos: solo falta tocar Enviar.": "WhatsApp opened with your details: just tap Send.",
   "No se pudo enviar. Inténtalo otra vez o escríbeme por WhatsApp.": "Could not send. Try again or message me on WhatsApp.",
   "Demasiados envíos seguidos. Espera un minuto.": "Too many submissions in a row. Please wait a minute.",
   "Vista previa: el formulario envía en la tarjeta publicada.": "Preview: the form sends from the published card.",
   "Enviar otro": "Send another",
   "Contacto sin internet": "Offline contact",
   "El contacto va dentro del QR: se guarda en la agenda sin conexión.": "The contact lives inside the QR: it saves to the phone without internet.",
   "Idioma": "Language"
  };
  EN['Agregar a inicio'] = 'Add to home screen';
  EN['Tenla a dos toques: agrégala a la pantalla de inicio de tu teléfono.'] = 'Keep it two taps away: add it to your phone home screen.';
  EN['iPhone (Safari)'] = 'iPhone (Safari)';
  EN['Toca Compartir y luego «Agregar a inicio».'] = 'Tap Share, then “Add to Home Screen”.';
  EN['Android (Chrome)'] = 'Android (Chrome)';
  EN['Toca ⋮ y luego «Agregar a la pantalla principal».'] = 'Tap ⋮, then “Add to Home screen”.';
  EN['Agregar ahora'] = 'Add now';
  EN['Agregar a'] = 'Add to'; EN['Guardar en'] = 'Save to';
  EN['Grabar en tarjeta NFC'] = 'Write to NFC tag';
  EN['Acerca la etiqueta NFC a la parte trasera del teléfono…'] = 'Hold the NFC tag to the back of the phone…';
  EN['Listo: la etiqueta abre '] = 'Done: the tag opens '; EN['tu contacto'] = 'your contact'; EN['tu tarjeta'] = 'your card';
  EN['No se pudo grabar: '] = 'Could not write: ';
  function tr(lang, s) { return lang === 'en' && EN[s] ? EN[s] : s; }
  function pickLang(opts) {
    if (opts && (opts.lang === 'es' || opts.lang === 'en')) return opts.lang;
    try { var st = localStorage.getItem('kvc-lang'); if (st === 'es' || st === 'en') return st; } catch (e) { /* sin storage */ }
    var nav = (typeof navigator !== 'undefined' && (navigator.language || '')) || '';
    return /^en/i.test(nav) ? 'en' : 'es';
  }
  /* Perfil visto en un idioma: los campos *En reemplazan a los españoles. */
  function localize(p, lang) {
    if (lang !== 'en') return p;
    var o = {}; Object.keys(p).forEach(function (k) { o[k] = p[k]; });
    ['title', 'tagline', 'whatsappMsg', 'motto'].forEach(function (k) { if (p[k + 'En']) o[k] = p[k + 'En']; });
    return o;
  }

  /* ── Equipo (v2.0) ──
     Una instancia puede publicar la tarjeta de cada persona del equipo. Lo
     personal es de cada uno; marca, empresa, web, dirección e Instagram de la
     empresa se comparten con la tarjeta principal. */
  var PERSONAL_KEYS = ['name', 'firstName', 'lastName', 'title', 'titleEn', 'tagline', 'taglineEn', 'phone', 'whatsapp',
    'whatsappMsg', 'whatsappMsgEn', 'email', 'linkedin', 'photo', 'cardId', 'walletApple', 'walletGoogle'];
  function teamMerge(main, personal) {
    var o = {};
    var m = normalize(main);
    Object.keys(m).forEach(function (k) { o[k] = m[k]; });
    PERSONAL_KEYS.forEach(function (k) { o[k] = ''; });
    Object.keys(personal || {}).forEach(function (k) { if (PERSONAL_KEYS.indexOf(k) >= 0 && personal[k] != null) o[k] = personal[k]; });
    if (!o.whatsappMsg && o.name) o.whatsappMsg = 'Hola ' + o.name.split(' ')[0] + ', te contacto desde tu tarjeta digital ' + (o.company || '') + '.';
    if (!o.whatsappMsgEn && o.name) o.whatsappMsgEn = 'Hi ' + o.name.split(' ')[0] + ", I'm reaching out from your " + (o.company || '') + ' digital card.';
    return normalize(o);
  }

  /* ── Wallet (v2.0): contenido del pase, sin firmar ──
     Apple: pase «generic» (no es de pago ni de fidelización). Google: «Generic
     pass». Ambos guardan SOLO la tarjeta de contacto: nombre, cargo, empresa,
     contacto y el QR que abre la tarjeta digital. La firma la hace
     tools/wallet.mjs con los certificados del emisor, fuera del navegador. */
  function hexToRgb(hx) { var n = parseInt(String(hx).slice(1), 16); return 'rgb(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')'; }
  function walletApplePass(p, o) {
    o = o || {};
    var L = links(p);
    var back = [];
    if (L.whatsapp) back.push({ key: 'whatsapp', label: 'WhatsApp', value: p.phone || ('+' + p.whatsapp), attributedValue: '<a href="' + L.whatsapp.split('?')[0] + '">' + (p.phone || ('+' + p.whatsapp)) + '</a>' });
    if (p.email) back.push({ key: 'email', label: 'Correo', value: p.email });
    if (L.website) back.push({ key: 'web', label: 'Sitio web', value: L.website });
    if (L.linkedin) back.push({ key: 'linkedin', label: 'LinkedIn', value: L.linkedin });
    if (L.instagram) back.push({ key: 'instagram', label: 'Instagram', value: L.instagram });
    if (p.address) back.push({ key: 'address', label: 'Dirección', value: p.address });
    if (o.cardUrl) back.push({ key: 'card', label: 'Tarjeta digital', value: o.cardUrl });
    return {
      formatVersion: 1,
      passTypeIdentifier: o.passTypeIdentifier || 'pass.com.example.vcard',
      teamIdentifier: o.teamIdentifier || 'TEAMID0000',
      serialNumber: o.serialNumber || ('vcard-' + slug(p.name).toLowerCase()),
      organizationName: p.company || p.name,
      description: 'Tarjeta de contacto de ' + p.name,
      logoText: p.company || '',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(220, 235, 255)',
      backgroundColor: hexToRgb(p.theme.primary),
      sharingProhibited: false,
      barcodes: o.cardUrl ? [{ format: 'PKBarcodeFormatQR', message: o.cardUrl, messageEncoding: 'iso-8859-1', altText: 'Escanea mi tarjeta' }] : [],
      generic: {
        primaryFields: [{ key: 'name', label: p.company || '', value: p.name }],
        secondaryFields: [{ key: 'title', label: 'Cargo', value: p.title || '' }].concat(p.phone ? [{ key: 'phone', label: 'Teléfono', value: p.phone }] : []),
        auxiliaryFields: p.email ? [{ key: 'emailf', label: 'Correo', value: p.email }] : [],
        backFields: back
      }
    };
  }
  function walletGoogleObject(p, o) {
    o = o || {};
    var L = links(p);
    var issuer = o.issuerId || '3388000000000000000';
    var suffix = (o.suffix || slug(p.name).toLowerCase()).replace(/[^\w.-]/g, '_');
    var cls = issuer + '.' + (o.classSuffix || 'tarjeta_contacto');
    var linksMod = [];
    if (L.whatsapp) linksMod.push({ uri: L.whatsapp.split('?')[0], description: 'WhatsApp ' + (p.phone || ''), id: 'wa' });
    if (p.email) linksMod.push({ uri: 'mailto:' + p.email, description: p.email, id: 'mail' });
    if (L.website) linksMod.push({ uri: L.website, description: prettyUrl(p.website), id: 'web' });
    if (L.linkedin) linksMod.push({ uri: L.linkedin, description: 'LinkedIn', id: 'li' });
    if (L.instagram) linksMod.push({ uri: L.instagram, description: igHandle(p.instagram), id: 'ig' });
    if (o.cardUrl) linksMod.push({ uri: o.cardUrl, description: 'Tarjeta digital', id: 'card' });
    var obj = {
      id: issuer + '.' + suffix,
      classId: cls,
      state: 'ACTIVE',
      cardTitle: { defaultValue: { language: 'es', value: p.company || p.name } },
      header: { defaultValue: { language: 'es', value: p.name } },
      subheader: { defaultValue: { language: 'es', value: p.title || '' } },
      hexBackgroundColor: p.theme.primary,
      textModulesData: [].concat(p.phone ? [{ id: 'phone', header: 'Teléfono', body: p.phone }] : [], p.email ? [{ id: 'email', header: 'Correo', body: p.email }] : []),
      linksModuleData: { uris: linksMod }
    };
    if (o.logoUrl) obj.logo = { sourceUri: { uri: o.logoUrl }, contentDescription: { defaultValue: { language: 'es', value: p.company || '' } } };
    if (o.heroUrl) obj.heroImage = { sourceUri: { uri: o.heroUrl } };
    if (o.cardUrl) obj.barcode = { type: 'QR_CODE', value: o.cardUrl, alternateText: 'Escanea mi tarjeta' };
    return { genericClasses: [{ id: cls }], genericObjects: [obj] };
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

  function links(p, lang) {
    var L = {};
    if (p.whatsapp) {
      L.whatsapp = 'https://wa.me/' + p.whatsapp + (p.whatsappMsg ? '?text=' + encodeURIComponent(p.whatsappMsg) : '');
    }
    var tel = (p.phone || '').replace(/[^\d+]/g, '');
    if (tel) L.phone = 'tel:' + tel;
    if (p.email) L.email = 'mailto:' + p.email + '?subject=' + encodeURIComponent((lang === 'en' ? 'Contact from your digital card ' : 'Contacto desde tu tarjeta digital ') + (p.company || ''));
    if (p.website) L.website = withProto(p.website);
    if (p.linkedin) L.linkedin = withProto(p.linkedin);
    if (p.instagram) L.instagram = igUrl(p.instagram);
    if (p.address) L.maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address);
    return L;
  }

  /* Lista ordenada de canales (WhatsApp primero: es el canal principal). */
  function channels(p, lang) {
    var L = links(p, lang);
    var _ = function (s) { return tr(lang, s); };
    var out = [];
    if (L.whatsapp) out.push({ key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', sub: p.phone || ('+' + p.whatsapp), href: L.whatsapp });
    if (L.email) out.push({ key: 'email', icon: 'mail', label: _('Correo electrónico'), sub: p.email, href: L.email });
    if (L.linkedin) out.push({ key: 'linkedin', icon: 'linkedin', label: 'LinkedIn', sub: liLabel(p.linkedin), href: L.linkedin });
    if (L.website) out.push({ key: 'website', icon: 'globe', label: _('Sitio web'), sub: prettyUrl(p.website), href: L.website });
    if (L.instagram) out.push({ key: 'instagram', icon: 'instagram', label: 'Instagram', sub: igHandle(p.instagram), href: L.instagram });
    if (L.phone) out.push({ key: 'phone', icon: 'phone', label: _('Llamar'), sub: p.phone, href: L.phone });
    if (L.maps) out.push({ key: 'maps', icon: 'map-pin', label: _('Ubicación'), sub: p.address, href: L.maps });
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

  /* vCard compacto para un QR que funciona sin internet: sin foto, sin nota
     y sin perfiles sociales, para que el código siga siendo legible. */
  function vcardLite(p) {
    var L = links(p);
    var first = p.firstName || p.name.split(' ')[0] || '';
    var last = p.lastName || p.name.split(' ').slice(1).join(' ');
    var lines = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + esc(last) + ';' + esc(first) + ';;;', 'FN:' + esc(p.name)];
    if (p.company) lines.push('ORG:' + esc(p.company));
    if (p.title) lines.push('TITLE:' + esc(p.title));
    if (p.phone) lines.push('TEL;TYPE=CELL:' + p.phone.replace(/[^\d+]/g, ''));
    if (p.email) lines.push('EMAIL:' + p.email);
    if (L.website) lines.push('URL:' + L.website);
    lines.push('END:VCARD');
    return lines.join('\n');
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

  /*
   * opts.lang          'es' | 'en' (si falta: el guardado, o el idioma del teléfono)
   * opts.leadEndpoint  URL del gateway public.submit para «Déjame tus datos».
   *                    Sin ella, el formulario abre WhatsApp con los datos escritos.
   */
  function mount(root, profile, opts) {
    var ctl = {};
    var cur = null;
    function run(o) {
      if (cur) cur.destroy();
      cur = mountOnce(root, profile, o, function (lang, view) {
        run(Object.assign({}, o, { lang: lang, view: view }));
      });
      ctl.qrUrl = cur.qrUrl; ctl.profile = cur.profile; ctl.setView = cur.setView; ctl.lang = cur.lang;
    }
    run(opts || {});
    ctl.destroy = function () { if (cur) cur.destroy(); };
    return ctl;
  }

  function mountOnce(root, profile, opts, relaunch) {
    opts = opts || {};
    var lang = pickLang(opts);
    var _ = function (s) { return tr(lang, s); };
    var p = localize(normalize(profile), lang);
    var R = function (s) { return resolveImg(s, opts.resolve); };
    var here = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
    var baseQr = [opts.qrUrl, p.publicUrl, here, links(p).website].filter(function (u) { return u && checkQrUrl(u).ok; })[0] || 'https://figit.ai';
    var qrUrl = baseQr;
    var ch = channels(p, lang);
    var L = links(p, lang);
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
      var done = function () { toast(ok || _('Copiado')); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast(text); });
      else toast(text);
    }

    /* Acciones */
    function onSave() {
      track('save');
      saveVcf(p, opts.resolve).then(function () { toast(_('Contacto descargado: ábrelo para guardarlo en tu agenda.')); });
    }
    function logoData() {
      var src = R(p.logoMark);
      if (!src || src.indexOf('data:') === 0) return Promise.resolve(src);
      return fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
      }).catch(function () { return ''; });
    }
    function onQrPng() {
      track('qr');
      logoData().then(function (logo) { return qrPng(qrUrl, { dark: p.theme.ink, logo: logo, px: 1400 }); })
        .then(function (b) { download('QR_' + slug(p.name) + '.png', b); toast(_('QR descargado en alta resolución')); })
        .catch(function () { toast(_('No se pudo generar el PNG')); });
    }
    function onShare() {
      track('share');
      var data = { title: p.name + ' · ' + p.company, text: _('Te comparto mi tarjeta de contacto digital.'), url: qrUrl };
      if (navigator.share && !opts.preview) { navigator.share(data).catch(function () { }); return; }
      openModal(shareModal());
    }

    /* Modales */
    var modalHost = h('div', { class: 'kvc-modal-host' });
    function openModal(content) {
      var close = function () { modalHost.replaceChildren(); };
      var box = h('div', { class: 'kvc-modal', role: 'dialog', 'aria-modal': 'true' },
        h('button', { type: 'button', class: 'kvc-modal-x', 'aria-label': _('Cerrar'), on: { click: close } }, '×'),
        content);
      var back = h('div', { class: 'kvc-backdrop', on: { click: function (e) { if (e.target === back) close(); } } }, box);
      modalHost.replaceChildren(back);
    }
    function shareModal() {
      var msg = _('Hola, te comparto la tarjeta digital de ') + p.name + ' (' + p.title + ', ' + p.company + '): ' + qrUrl;
      var opt = function (href, icn, cls, label) {
        return a(href, 'kvc-share-opt ' + cls, null, [h('span', { class: 'kvc-share-ic' }, icon(icn)), h('span', { text: label })]);
      };
      return h('div', null,
        h('h3', { class: 'kvc-modal-t', text: _('Compartir tarjeta') }),
        h('p', { class: 'kvc-modal-s', text: _('Envía tu tarjeta digital por el canal que prefieras.') }),
        h('div', { class: 'kvc-share-grid' },
          opt('https://wa.me/?text=' + encodeURIComponent(msg), 'whatsapp', 'kvc-c-whatsapp', 'WhatsApp'),
          opt('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(qrUrl), 'linkedin', 'kvc-c-linkedin', 'LinkedIn'),
          opt('mailto:?subject=' + encodeURIComponent(_('Tarjeta digital · ') + p.name) + '&body=' + encodeURIComponent(msg), 'mail', 'kvc-c-email', _('Correo')),
          h('button', { type: 'button', class: 'kvc-share-opt kvc-c-qr', on: { click: function () { modalHost.replaceChildren(); setView('qr'); } } },
            h('span', { class: 'kvc-share-ic' }, icon('qr-code')), h('span', { text: _('Código QR') }))),
        h('div', { class: 'kvc-copy' },
          h('input', { class: 'kvc-input', value: qrUrl, readonly: true, 'aria-label': _('Enlace de la tarjeta') }),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(qrUrl, _('Enlace copiado')); } } }, icon('copy'), h('span', { text: _('Copiar') }))));
    }
    var installEvt = null;
    function onBip(e) { e.preventDefault(); installEvt = e; }
    if (typeof window !== 'undefined' && !opts.preview) {
      window.addEventListener('beforeinstallprompt', onBip);
      cleanups.push(function () { window.removeEventListener('beforeinstallprompt', onBip); });
    }
    function homeModal() {
      var step = function (t, d) { return h('div', { class: 'kvc-home-step' }, h('strong', { text: t }), h('span', { text: d })); };
      return h('div', null,
        h('h3', { class: 'kvc-modal-t', text: _('Agregar a inicio') }),
        h('p', { class: 'kvc-modal-s', text: _('Tenla a dos toques: agrégala a la pantalla de inicio de tu teléfono.') }),
        h('div', { class: 'kvc-home' },
          step(_('iPhone (Safari)'), _('Toca Compartir y luego «Agregar a inicio».')),
          step(_('Android (Chrome)'), _('Toca ⋮ y luego «Agregar a la pantalla principal».'))),
        installEvt ? h('div', { class: 'kvc-modal-actions' },
          h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: function () { installEvt.prompt(); modalHost.replaceChildren(); } } }, icon('smartphone'), h('span', { text: _('Agregar ahora') }))) : null);
    }
    function vcardModal() {
      var text = vcard(p, '');
      return h('div', null,
        h('h3', { class: 'kvc-modal-t', text: _('Datos de contacto (vCard 3.0)') }),
        h('pre', { class: 'kvc-pre', text: text }),
        h('div', { class: 'kvc-modal-actions' },
          h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onSave } }, icon('download'), h('span', { text: _('Descargar .vcf') })),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(text, 'vCard copiada'); } } }, icon('copy'), h('span', { text: _('Copiar') }))));
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
        catch (e) { s.el.textContent = _('Enlace demasiado largo para un QR'); }
      });
    }

    /* ── Cabecera ── */
    var tabs = {};
    function tab(id, icn, label) {
      tabs[id] = h('button', { type: 'button', class: 'kvc-tab', 'data-v': id, on: { click: function () { setView(id); } } },
        icon(icn), h('span', { class: 'kvc-tab-t', text: label }));
      return tabs[id];
    }
    var themeBtn = h('button', { type: 'button', class: 'kvc-ibtn', title: _('Cambiar tema'), 'aria-label': _('Cambiar tema') }, icon(dark ? 'sun' : 'moon'));
    var langBtn = h('button', { type: 'button', class: 'kvc-ibtn kvc-lang', title: _('Idioma'), 'aria-label': lang === 'es' ? 'English' : 'Español',
      on: { click: function () {
        var next = lang === 'es' ? 'en' : 'es';
        try { if (opts.storage !== false) localStorage.setItem('kvc-lang', next); } catch (e) { /* sin storage */ }
        relaunch(next, view);
      } } }, lang === 'es' ? 'EN' : 'ES');
    var header = h('header', { class: 'kvc-head' },
      h('div', { class: 'kvc-head-in' },
        h('button', { type: 'button', class: 'kvc-head-brand', on: { click: function () { setView('hub'); } } },
          h('span', { class: 'kvc-head-logo' },
            p.logoMark ? h('img', { src: R(p.logoMark), alt: '', class: 'kvc-head-mark' }) : null,
            p.logoWord ? h('img', { src: R(p.logoWord), alt: p.company, class: 'kvc-head-word' })
              : (p.logoMark && p.logoMark === p.logo ? null : h('strong', { class: 'kvc-head-co', text: p.company }))),
          h('span', { class: 'kvc-head-meta' },
            h('span', { class: 'kvc-badge', text: _('Oficial') }),
            h('span', { class: 'kvc-head-sub', text: _('Tarjeta de Contacto Ejecutiva') }))),
        h('div', { class: 'kvc-head-actions' },
          h('nav', { class: 'kvc-tabs', 'aria-label': _('Vistas') },
            tab('hub', 'contact', 'Hub'), tab('card', 'id-card', _('Tarjeta 3D')), tab('qr', 'qr-code', _('Código QR'))),
          h('button', { type: 'button', class: 'kvc-ibtn', title: _('Compartir tarjeta'), 'aria-label': _('Compartir'), on: { click: onShare } }, icon('share-2')),
          langBtn,
          themeBtn)));

    /* ── Vista 1: Hub ── */
    var hubList = ch.map(function (c) {
      return a(c.href, 'kvc-hl kvc-c-' + c.key + (c.key === 'whatsapp' ? ' kvc-hl-main' : ''), null, [
        h('span', { class: 'kvc-hl-ic' }, icon(c.icon)),
        h('span', { class: 'kvc-hl-txt' },
          h('strong', null, _(HUB_TITLES[c.key] || c.label), c.key === 'whatsapp' ? h('em', { class: 'kvc-chip-main', text: _('Principal') }) : null),
          h('small', { text: c.sub })),
        h('span', { class: 'kvc-hl-go' }, icon('chevron-right'))]);
    });
    // Accesos rápidos: WhatsApp (principal) y llamada. El correo vive SOLO en
    // «Canales Oficiales», para no duplicarlo.
    var pills = [];
    if (L.whatsapp) pills.push(a(L.whatsapp, 'kvc-pill kvc-pill-wa kvc-c-whatsapp', null, [icon('whatsapp'), h('span', { text: 'WhatsApp' })]));
    if (L.phone) pills.push(a(L.phone, 'kvc-pill kvc-c-phone', null, [icon('phone'), h('span', { text: _('Llamar') })]));
    // Guardar en la billetera del teléfono (solo la tarjeta de contacto). Se
    // muestra el botón que corresponde al teléfono; en computador, los dos.
    function walletRow() {
      var ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      var ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
      var btns = [];
      if (p.walletApple && !android) btns.push(a(p.walletApple, 'kvc-wallet kvc-wallet-apple kvc-c-wallet', null, [icon('wallet'), h('span', null, h('small', { text: _('Agregar a') }), h('strong', { text: 'Apple Wallet' }))]));
      if (p.walletGoogle && !ios) btns.push(a(p.walletGoogle, 'kvc-wallet kvc-wallet-google kvc-c-wallet', null, [icon('wallet'), h('span', null, h('small', { text: _('Guardar en') }), h('strong', { text: 'Google Wallet' }))]));
      return btns.length ? h('div', { class: 'kvc-wallets' }, btns) : null;
    }
    function cornerLogo(cls) {
      return p.logo ? h('a', { class: 'kvc-corner-logo ' + cls, href: L.website || null, target: L.website ? '_blank' : null, rel: 'noopener noreferrer', title: p.company },
        h('img', { src: R(p.logo), alt: p.company })) : null;
    }

    /* ── Medición (v1.3) ──
       Una visita = un envío al gateway (canal 'visita') con los canales que se
       tocaron. Se manda al ocultar la página (cambiar a WhatsApp, cerrar) y
       otra vez solo si hubo toques nuevos. Sin cookies ni identificadores. */
    var stats = { sent: false, clicks: [], saved: 0, shared: 0, lead: '', qr: 0 };
    function track(what) {
      if (!opts.statsEndpoint || opts.preview) return;
      if (what === 'save') stats.saved = 1;
      else if (what === 'share') stats.shared = 1;
      else if (what === 'qr') stats.qr = 1;
      else if (what === 'lead' || what === 'lead-wa') stats.lead = what;
      else if (stats.clicks.indexOf(what) < 0) stats.clicks.push(what);
      stats.dirty = true;
    }
    function flushStats(force) {
      if (!opts.statsEndpoint || opts.preview) return;
      if (stats.sent && !stats.dirty) return;
      if (!stats.sent && !force && !stats.dirty) { /* visita sin toques: también cuenta */ }
      var payload = JSON.stringify({
        visit: stats.sent ? '0' : '1', clicks: stats.clicks.join(','), saved: String(stats.saved), shared: String(stats.shared),
        qr: String(stats.qr), lead: stats.lead, lang: lang, view: view,
        ref: (typeof document !== 'undefined' && document.referrer ? String(document.referrer).split('/')[2] || '' : '').slice(0, 80),
        mobile: /Mobi|Android|iPhone/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? '1' : '0',
        m: (opts.member && opts.member.key) || ''
      });
      stats.sent = true; stats.dirty = false; stats.clicks = []; stats.saved = 0; stats.shared = 0; stats.qr = 0; stats.lead = '';
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(opts.statsEndpoint, new Blob([payload], { type: 'text/plain' }))) return;
      } catch (e) { /* sigue con fetch */ }
      try { fetch(opts.statsEndpoint, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {}); } catch (e) { /* nada */ }
    }
    if (opts.statsEndpoint && !opts.preview && typeof document !== 'undefined') {
      var onHide = function () { if (document.visibilityState === 'hidden') flushStats(true); };
      var onPageHide = function () { flushStats(true); };
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', onPageHide);
      cleanups.push(function () { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onPageHide); });
      // Quien abre y se queda mirando sin cambiar de app también cuenta.
      var firstT = setTimeout(function () { if (!stats.sent) flushStats(true); }, 15000);
      cleanups.push(function () { clearTimeout(firstT); });
    }

    /* «Déjame tus datos» (v1.2). Con gateway (tarjeta publicada en KIMOS) el
       envío llega a la app como prospecto. Sin gateway (HTML alojado en otro
       sitio) abre WhatsApp con los datos ya escritos: nunca se pierden. */
    var leadBox = null;
    if (p.leadForm === 'on' && (opts.leadEndpoint || L.whatsapp)) {
      var direct = !opts.leadEndpoint;
      var first = (p.firstName || p.name.split(' ')[0] || '').trim();
      var f = {};
      var leadField = function (id, label, type, req, area) {
        var inp = h(area ? 'textarea' : 'input', {
          class: 'kvc-input kvc-lead-in', id: 'kvc-lead-' + id, name: id, type: area ? null : type, rows: area ? '3' : null,
          maxlength: area ? '600' : '120', autocomplete: { name: 'name', company: 'organization', email: 'email', phone: 'tel' }[id] || 'off'
        });
        f[id] = inp;
        return h('label', { class: 'kvc-lead-f' + (area ? ' kvc-lead-wide' : ''), for: 'kvc-lead-' + id }, h('span', { text: _(label) + (req ? ' *' : '') }), inp);
      };
      var hp = h('input', { type: 'text', name: '_hp', tabindex: '-1', autocomplete: 'off', class: 'kvc-hp', 'aria-hidden': 'true' });
      var leadMsg = h('p', { class: 'kvc-lead-msg', role: 'status', 'aria-live': 'polite' });
      // El botón es siempre «Enviar mis datos». Con gateway, el prospecto se
      // registra en la app; sin él (HTML no conectado), los datos le llegan
      // al dueño de la tarjeta por WhatsApp, ya escritos.
      var sendBtn = h('button', { type: 'submit', class: 'kvc-lead-send' },
        icon('send'), h('span', { text: _('Enviar mis datos') }));
      var form = h('form', { class: 'kvc-lead-form', novalidate: true },
        leadField('name', 'Nombre', 'text', true), leadField('company', 'Empresa', 'text'),
        leadField('email', 'Correo', 'email'), leadField('phone', 'WhatsApp o teléfono', 'tel'),
        leadField('message', '¿En qué te puedo ayudar?', 'text', false, true), hp, sendBtn, leadMsg);
      var setMsg = function (t, kind) { leadMsg.textContent = t; leadMsg.className = 'kvc-lead-msg' + (kind ? ' kvc-lead-' + kind : ''); };
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = {};
        Object.keys(f).forEach(function (k) { v[k] = String(f[k].value || '').trim(); });
        if (!v.name) { setMsg(_('Escribe tu nombre.'), 'err'); f.name.focus(); return; }
        if (!v.email && !v.phone) { setMsg(_('Deja un correo o un teléfono para responderte.'), 'err'); f.email.focus(); return; }
        if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) { setMsg(_('Ese correo no parece válido.'), 'err'); f.email.focus(); return; }
        if (opts.preview && direct) { setMsg(_('Vista previa: el formulario envía en la tarjeta publicada.'), ''); return; }
        lastValues = v;
        if (direct) { openWa(v); return; }
        sendBtn.disabled = true;
        setMsg(_('Enviando…'), '');
        waFallback.hidden = true;
        // text/plain = petición «simple»: sin preflight CORS, funciona desde
        // cualquier dominio. El gateway lee el cuerpo como JSON igual.
        fetch(opts.leadEndpoint, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ name: v.name, company: v.company, email: v.email, phone: v.phone, message: v.message, lang: lang,
            source: opts.preview ? 'vista previa' : (opts.source || 'tarjeta'), page: here.slice(0, 200),
            for: (opts.member && opts.member.key) || '', forName: (opts.member && opts.member.key) ? p.name : '', _hp: hp.value })
        }).then(function (r) {
          sendBtn.disabled = false;
          if (r.status === 429) { setMsg(_('Demasiados envíos seguidos. Espera un minuto.'), 'err'); waFallback.hidden = false; return; }
          if (!r.ok) { setMsg(_('No se pudo enviar. Inténtalo otra vez o escríbeme por WhatsApp.'), 'err'); waFallback.hidden = false; return; }
          form.hidden = true;
          thanks.hidden = false;
          track('lead');
          if (typeof opts.onLead === 'function') { try { opts.onLead(v); } catch (e2) { /* el host decide */ } }
        }).catch(function () {
          sendBtn.disabled = false;
          setMsg(_('No se pudo enviar. Inténtalo otra vez o escríbeme por WhatsApp.'), 'err');
          waFallback.hidden = false;
        });
      });
      // Si el envío no llega (sin red, servidor caído), los datos no se pierden:
      // un toque y salen por WhatsApp.
      var lastValues = null;
      function openWa(v) {
          var txt = lang === 'en'
            ? 'Hi ' + first + ', I am ' + v.name + (v.company ? ' from ' + v.company : '') + '.' + (v.message ? ' ' + v.message.replace(/\s*$/, '').replace(/([^.!?])$/, '$1.') : '') +
              (v.email ? ' My email: ' + v.email + '.' : '') + (v.phone ? ' My phone: ' + v.phone + '.' : '')
            : 'Hola ' + first + ', soy ' + v.name + (v.company ? ' de ' + v.company : '') + '.' + (v.message ? ' ' + v.message.replace(/\s*$/, '').replace(/([^.!?])$/, '$1.') : '') +
              (v.email ? ' Mi correo: ' + v.email + '.' : '') + (v.phone ? ' Mi teléfono: ' + v.phone + '.' : '');
          var link = h('a', { href: 'https://wa.me/' + p.whatsapp + '?text=' + encodeURIComponent(txt), target: '_blank', rel: 'noopener noreferrer', style: 'display:none' });
          document.body.appendChild(link); link.click(); link.remove();
          setMsg(_('Se abrió WhatsApp con tus datos: solo falta tocar Enviar.'), 'ok');
          track('lead-wa');
      }
      var waFallback = h('button', { type: 'button', class: 'kvc-lead-fallback', hidden: true, on: { click: function () { if (lastValues) openWa(lastValues); } } },
        icon('whatsapp'), h('span', { text: _('Enviar por WhatsApp') }));
      form.appendChild(waFallback);
      var thanks = h('div', { class: 'kvc-lead-thanks', hidden: true },
        h('span', { class: 'kvc-lead-ok' }, icon('check')),
        h('strong', { text: _('¡Gracias! Te contactaré pronto.') }),
        h('button', { type: 'button', class: 'kvc-mini-btn', on: { click: function () { form.reset(); setMsg('', ''); thanks.hidden = true; form.hidden = false; } } }, _('Enviar otro')));
      leadBox = h('section', { class: 'kvc-lead', id: 'kvc-lead' },
        h('div', { class: 'kvc-divider' }, h('span', { text: _('Déjame tus datos') })),
        h('p', { class: 'kvc-lead-intro', text: _('Te contacto yo. Tus datos solo llegan a ') + (first || p.name) + '.' }),
        form, thanks);
    }

    var hub = h('section', { class: 'kvc-view kvc-hub', 'data-view': 'hub' },
      h('div', { class: 'kvc-panel' },
        h('div', { class: 'kvc-panel-bar' }),
        cornerLogo('kvc-corner-tl'),
        h('div', { class: 'kvc-profile' },
          h('div', { class: 'kvc-avatar' },
            h('div', { class: 'kvc-avatar-ring' },
              p.photo ? h('img', { src: R(p.photo), alt: p.name, class: 'kvc-avatar-img' })
                : h('div', { class: 'kvc-avatar-ph', text: (p.name || '?').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('') })),
            h('span', { class: 'kvc-verified', title: _('Perfil verificado') }, icon('check'))),
          h('h1', { class: 'kvc-name', text: p.name }),
          h('div', { class: 'kvc-role' },
            h('span', { class: 'kvc-title' }, h('span', { class: 'kvc-dot' }), p.title),
            p.company ? h('span', { class: 'kvc-company', text: p.company }) : null),
          p.tagline ? h('p', { class: 'kvc-tagline', text: p.tagline }) : null,
          h('button', { type: 'button', class: 'kvc-save', on: { click: onSave } },
            icon('user-plus', 'kvc-bounce'), h('span', { text: _('Guardar Contacto en el Teléfono') }), h('span', { class: 'kvc-save-chip', text: 'vCard .VCF' })),
          pills.length ? h('div', { class: 'kvc-pills kvc-pills-' + pills.length }, pills) : null,
          walletRow()),
        h('div', { class: 'kvc-divider' }, h('span', { text: _('Canales Oficiales') })),
        h('div', { class: 'kvc-hlist' }, hubList),
        leadBox,
        h('div', { class: 'kvc-mini' },
          h('button', { type: 'button', class: 'kvc-mini-qr', 'aria-label': _('Ver código QR'), on: { click: function () { setView('qr'); } } }, qrSlot('', false)),
          h('div', { class: 'kvc-mini-txt' },
            h('strong', { text: _('Código QR Dinámico') }),
            h('small', { text: _('Escanea para compartir o abrir en otro celular') })),
          h('button', { type: 'button', class: 'kvc-mini-btn', on: { click: function () { setView('qr'); } } }, _('Ver QR'))),
        h('div', { class: 'kvc-powered' },
          h('div', null, h('span', { text: _('Impulsado por ') }), h('strong', { text: p.company || 'KIMOS' })),
          h('small', { text: _('Ecosistema de Tarjetas Digitales Inteligentes') }))));

    /* ── Vista 2: Tarjeta 3D ── */
    var waDigits = p.whatsapp, telDigits = (p.phone || '').replace(/\D/g, '');
    var rowsDef = [
      L.whatsapp && ['whatsapp', 'whatsapp', (p.phone && telDigits === waDigits ? p.phone : '+' + waDigits) + ' · WhatsApp', L.whatsapp],
      L.phone && telDigits !== waDigits && ['phone', 'phone', p.phone, L.phone],
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
          h('div', { class: 'kvc-front-qr' }, qrSlot('kvc-front-qrbox', false), h('span', { text: _('Escanear contacto') }))),
        h('div', { class: 'kvc-front-main' },
          p.logo ? h('div', { class: 'kvc-front-logo' }, h('img', { src: R(p.logo), alt: p.company })) : null,
          h('div', { class: 'kvc-front-head' },
            h('h2', { class: 'kvc-front-name', text: p.name }),
            h('p', { class: 'kvc-front-title', text: p.title }),
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
        h('span', null, icon('rotate-cw'), h('span', { text: _('Haz clic para voltear la tarjeta') })),
        h('button', { type: 'button', class: 'kvc-btn-xs', on: { click: flip } }, icon('repeat'), h('span', { text: _('Voltear') }))),
      scene,
      h('div', { class: 'kvc-card-actions' },
        h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onSave } }, icon('download'), h('span', { text: _('Descargar Contacto (vCard)') })),
        opts.preview ? null : h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { window.print(); } } }, icon('printer'), h('span', { text: _('Imprimir Tarjeta') })),
        h('button', { type: 'button', class: 'kvc-btn-s', on: { click: onShare } }, icon('share-2'), h('span', { text: _('Compartir') }))));

    /* ── Vista 3: Código QR ── */
    /* Tarjeta NFC (v2.0): Chrome en Android graba el destino del QR en una
       etiqueta NFC. Acercar un teléfono a la etiqueta abre la tarjeta. */
    function nfcBox() {
      if (opts.preview || typeof window === 'undefined' || !('NDEFReader' in window)) return null;
      var msg = h('small', { class: 'kvc-nfc-msg', role: 'status' });
      var btn = h('button', { type: 'button', class: 'kvc-btn-s kvc-nfc-btn', on: { click: function () {
        var isVcard = qrUrl.indexOf('BEGIN:VCARD') === 0;
        var rec = isVcard
          ? { recordType: 'mime', mediaType: 'text/vcard', data: new TextEncoder().encode(qrUrl) }
          : { recordType: 'url', data: qrUrl };
        msg.textContent = _('Acerca la etiqueta NFC a la parte trasera del teléfono…');
        try {
          new window.NDEFReader().write({ records: [rec] }).then(function () {
            msg.textContent = _('Listo: la etiqueta abre ') + (isVcard ? _('tu contacto') : _('tu tarjeta')) + '.';
            track('nfc');
          }).catch(function (e) { msg.textContent = _('No se pudo grabar: ') + ((e && e.message) || e); });
        } catch (e) { msg.textContent = _('No se pudo grabar: ') + ((e && e.message) || e); }
      } } }, icon('nfc'), h('span', { text: _('Grabar en tarjeta NFC') }));
      return h('div', { class: 'kvc-nfc' }, btn, msg);
    }
    var urlInput = h('input', { class: 'kvc-input kvc-mono', value: qrUrl, 'aria-label': _('Enlace de destino del QR'), spellcheck: 'false' });
    var urlMsg = h('small', { class: 'kvc-field-err' });
    // Destinos sugeridos: todos son enlaces https reales que abren el canal
    // directamente al escanear. La tarjeta digital es el destino por defecto.
    var dests = [{ key: 'card', icon: 'contact', label: _('Tarjeta digital'), url: baseQr }];
    if (L.whatsapp) dests.push({ key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', url: L.whatsapp });
    if (L.website) dests.push({ key: 'website', icon: 'globe', label: _('Sitio web'), url: L.website });
    if (L.instagram) dests.push({ key: 'instagram', icon: 'instagram', label: 'Instagram', url: L.instagram });
    if (L.linkedin) dests.push({ key: 'linkedin', icon: 'linkedin', label: 'LinkedIn', url: L.linkedin });
    if (p.name && (p.phone || p.email)) dests.push({ key: 'vcard', icon: 'user-plus', label: _('Contacto sin internet'), url: vcardLite(p) });
    var destBtns = [];
    var destHint = h('small', { class: 'kvc-dest-hint' });
    function markDest() {
      var cur = dests.filter(function (d) { return d.url === qrUrl; })[0];
      destBtns.forEach(function (b) { b.classList.toggle('kvc-on', !!cur && b.getAttribute('data-k') === cur.key); });
      destHint.textContent = !cur ? _('Destino personalizado.')
        : cur.key === 'card' ? _('Al escanear se abre tu tarjeta digital con todos tus canales.')
        : cur.key === 'vcard' ? _('El contacto va dentro del QR: se guarda en la agenda sin conexión.')
        : _('Al escanear se abre directamente ') + cur.label + '.';
    }
    function setDest(u) {
      qrUrl = u;
      urlInput.value = u.indexOf('BEGIN:VCARD') === 0 ? 'vCard · ' + p.name : u;
      urlInput.readOnly = u.indexOf('BEGIN:VCARD') === 0;
      urlMsg.textContent = ''; paintQr(); markDest();
    }
    var destRow = h('div', { class: 'kvc-dests', role: 'group', 'aria-label': _('Destino del QR') }, dests.map(function (d) {
      var b = h('button', { type: 'button', class: 'kvc-dest kvc-c-' + (d.key === 'card' || d.key === 'vcard' ? 'qr' : d.key), 'data-k': d.key, on: { click: function () { setDest(d.url); } } },
        icon(d.icon), h('span', { text: d.label }));
      destBtns.push(b);
      return b;
    }));
    urlInput.addEventListener('input', function () {
      var v = urlInput.value.trim();
      var c = checkQrUrl(v || baseQr);
      urlMsg.textContent = c.ok ? (c.warn || '') : c.reason + _(' El QR sigue apuntando a ') + qrUrl;
      if (c.ok) { qrUrl = v || baseQr; paintQr(); }
      markDest();
    });
    markDest();
    var qrView = h('section', { class: 'kvc-view kvc-qrview', 'data-view': 'qr' },
      h('div', { class: 'kvc-panel kvc-panel-qr' },
        cornerLogo('kvc-corner-tr'),
        h('span', { class: 'kvc-kicker' }, icon('qr-code'), h('span', { text: _('Generador Dinámico ') + (p.company.replace(/\.ai$/i, '').toUpperCase() || 'KIMOS') })),
        h('h2', { class: 'kvc-qr-title', text: _('Código QR Oficial') }),
        h('p', { class: 'kvc-qr-sub', text: _('Apunta la cámara de cualquier teléfono para abrir instantáneamente la tarjeta virtual y canales de contacto.') }),
        h('div', { class: 'kvc-qr-frame' }, h('div', { class: 'kvc-qr-white' }, qrSlot('kvc-qr-big', true))),
        h('div', { class: 'kvc-field' },
          h('label', null, h('span', { text: _('Enlace de Destino del QR:') }), h('em', { text: '100% Dinámico' })),
          destRow,
          h('div', { class: 'kvc-field-row' }, urlInput,
            h('button', { type: 'button', class: 'kvc-reset', title: _('Volver a la tarjeta digital'), on: { click: function () { setDest(baseQr); } } }, _('Actual'))),
          destHint,
          urlMsg,
          h('small', { text: _('Puedes personalizar el enlace a tu propio dominio si lo requieres. Solo se aceptan direcciones https:// públicas.') })),
        nfcBox(),
        h('div', { class: 'kvc-qr-actions' },
          h('button', { type: 'button', class: 'kvc-btn-s kvc-btn-s-primary', on: { click: onQrPng } }, icon('download'), h('span', { text: _('Descargar PNG HD') })),
          h('button', { type: 'button', class: 'kvc-btn-s', on: { click: function () { copy(qrUrl, _('Enlace copiado')); } } }, icon('copy'), h('span', { text: _('Copiar Enlace') })))));

    /* ── Pie ── */
    var footer = h('footer', { class: 'kvc-foot' },
      h('div', { class: 'kvc-foot-in' },
        h('p', { text: '© ' + new Date().getFullYear() + ' ' + (p.company || '') + ' • ' + p.name + _('. Todos los derechos reservados.') }),
        h('div', { class: 'kvc-foot-links' },
          L.website ? a(L.website, '', null, [prettyUrl(p.website)]) : null,
          L.linkedin ? h('span', { text: '•' }) : null,
          L.linkedin ? a(L.linkedin, '', null, ['LinkedIn']) : null,
          h('span', { text: '•' }),
          h('button', { type: 'button', on: { click: function () { openModal(vcardModal()); } } }, _('Ver Datos vCard')),
          opts.preview ? null : h('span', { text: '•' }),
          opts.preview ? null : h('button', { type: 'button', class: 'kvc-home-link', on: { click: function () { openModal(homeModal()); } } }, _('Agregar a inicio')))));

    var bg = h('div', { class: 'kvc-bg', 'aria-hidden': 'true' }, contour('kvc-bg-a', 5), contour('kvc-bg-b', 3));
    var wrap = h('div', {
      class: 'kvc' + (dark ? ' kvc-dark' : '') + (opts.preview ? ' kvc-preview' : ''),
      style: '--kvc-primary:' + p.theme.primary + ';--kvc-ink:' + p.theme.ink + ';--kvc-soft:' + p.theme.soft + ';--kvc-accent:' + p.theme.accent +
        (p.font ? ';font-family:"' + p.font + '","Plus Jakarta Sans",Inter,-apple-system,"Segoe UI",Roboto,sans-serif' : '')
    }, bg, header, h('main', { class: 'kvc-body' }, hub, cardView, qrView), footer, modalHost, toastEl);

    wrap.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('a[class*="kvc-c-"], a.kvc-pill, a.kvc-fr, a.kvc-hl, a.kvc-q') : null;
      if (!el) return;
      var m = /kvc-c-(\w+)/.exec(el.className || '');
      if (m) track(m[1]);
    }, true);

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
      lang: lang,
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

  /* ── Imagen para compartir (v1.3) ──
     1200×630, el formato que WhatsApp, LinkedIn y Slack muestran como vista
     previa del enlace. Se dibuja en canvas con la marca de la tarjeta. */
  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  function shareImage(profile, o) {
    o = o || {};
    var p = localize(normalize(profile), o.lang || 'es');
    var R = function (s) { return resolveImg(s, o.resolve); };
    var W = 1200, H = 630;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    var F = '"Plus Jakarta Sans", Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    var qrSrc = o.qrUrl ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(qrSvg(o.qrUrl, { dark: p.theme.ink }))) : '';
    return Promise.all([loadImg(R(p.photo)), loadImg(R(p.logo)), loadImg(qrSrc)]).then(function (im) {
      var photo = im[0], logo = im[1], qr = im[2];
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
      // panel suave de la marca
      g.fillStyle = p.theme.soft; g.fillRect(0, 0, 420, H);
      g.fillStyle = p.theme.ink; g.fillRect(420, 0, 6, H);
      var grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, p.theme.primary); grad.addColorStop(1, p.theme.accent);
      g.fillStyle = grad; g.fillRect(0, 0, W, 10);
      // ondas
      g.save(); g.globalAlpha = 0.18; g.strokeStyle = p.theme.primary; g.lineWidth = 1.4;
      for (var i = 0; i < 14; i++) { g.beginPath(); var x = 760 + i * 26; g.moveTo(x, -10); g.bezierCurveTo(x + 120, 180, x - 140, 380, x + 60, H + 10); g.stroke(); }
      g.restore();
      // foto
      var cx = 210, cy = 210, r = 130;
      g.save(); g.beginPath(); g.arc(cx, cy, r + 8, 0, Math.PI * 2); g.fillStyle = grad; g.fill(); g.restore();
      g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.clip();
      g.fillStyle = '#FFFFFF'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (photo) { var s = Math.max((r * 2) / photo.naturalWidth, (r * 2) / photo.naturalHeight); var w = photo.naturalWidth * s, hh = photo.naturalHeight * s; g.drawImage(photo, cx - w / 2, cy - hh * 0.4, w, hh); }
      else { g.fillStyle = p.theme.primary; g.font = '800 96px ' + F; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((p.name || '?').split(' ').map(function (x) { return x[0]; }).slice(0, 2).join(''), cx, cy); }
      g.restore();
      // logo
      if (logo) {
        var lh = 120, lw = logo.naturalWidth * (lh / logo.naturalHeight);
        if (lw > 260) { lw = 260; lh = logo.naturalHeight * (lw / logo.naturalWidth); }
        g.fillStyle = '#FFFFFF'; roundRect(g, cx - lw / 2 - 16, 400, lw + 32, lh + 24, 18); g.fill();
        g.drawImage(logo, cx - lw / 2, 412, lw, lh);
      }
      // textos
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      var X = 480;
      g.fillStyle = p.theme.ink; g.font = '800 62px ' + F; fitText(g, p.name, X, 150, 660, 62, '800', F);
      g.fillStyle = p.theme.primary; g.font = '800 30px ' + F; fitText(g, (p.title || '').toUpperCase(), X, 200, 660, 30, '800', F);
      g.fillStyle = '#475569'; g.font = '600 28px ' + F; g.fillText(p.company || '', X, 242);
      g.fillStyle = grad; g.fillRect(X, 270, 180, 6);
      var rows = [];
      if (p.phone || p.whatsapp) rows.push(['#10B981', (p.phone || '+' + p.whatsapp) + '  ·  WhatsApp']);
      if (p.email) rows.push(['#C084FC', p.email]);
      if (p.website) rows.push(['#0EA5E9', prettyUrl(p.website)]);
      if (p.instagram) rows.push(['#DB2777', igHandle(p.instagram)]);
      g.font = '500 27px ' + F;
      rows.slice(0, 4).forEach(function (row, k) {
        var y = 336 + k * 50;
        g.fillStyle = row[0]; g.beginPath(); g.arc(X + 9, y - 9, 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1E293B'; fitText(g, row[1], X + 32, y, qr ? 480 : 640, 27, '500', F);
      });
      if (qr) {
        g.fillStyle = '#FFFFFF'; roundRect(g, W - 230, H - 236, 196, 196, 20); g.fill();
        g.strokeStyle = '#E2E8F0'; g.lineWidth = 2; roundRect(g, W - 230, H - 236, 196, 196, 20); g.stroke();
        g.drawImage(qr, W - 220, H - 226, 176, 176);
      }
      return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('PNG')); }, 'image/png'); });
    });
  }
  function roundRect(g, x, y, w, h2, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h2, r); g.arcTo(x + w, y + h2, x, y + h2, r);
    g.arcTo(x, y + h2, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function fitText(g, t, x, y, maxW, size, weight, F) {
    var s2 = size;
    g.font = weight + ' ' + s2 + 'px ' + F;
    while (g.measureText(t).width > maxW && s2 > 14) { s2 -= 2; g.font = weight + ' ' + s2 + 'px ' + F; }
    g.fillText(t, x, y);
  }

  /* ── Estilos de la tarjeta (todo bajo .kvc) ─────────────────────────── */
  var CSS = /*@@CSS@@*/ '';
  /* Los estilos van ligados a la versión: KIMOS no recarga la página al
     actualizar una app, así que una hoja vieja en <head> se reemplaza. */
  function injectCss(doc, extraId, extraCss) {
    doc = doc || document;
    var put = function (id, css) {
      var s = doc.getElementById(id);
      if (s && s.getAttribute('data-v') === VERSION) return;
      if (!s) { s = doc.createElement('style'); s.id = id; (doc.head || doc.documentElement).appendChild(s); }
      s.setAttribute('data-v', VERSION);
      s.textContent = css;
    };
    put('kvc-card-css', CSS);
    if (extraId && extraCss) put(extraId, extraCss);
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
      (extra.icon ? '<link rel="icon" href="' + htmlEsc(extra.icon) + '">\n<link rel="apple-touch-icon" href="' + htmlEsc(extra.touchIcon || extra.icon) + '">\n' : '') +
      (extra.manifest ? '<link rel="manifest" href="' + htmlEsc(extra.manifest) + '">\n' : '') +
      '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
      '<meta name="apple-mobile-web-app-title" content="' + htmlEsc(p.name.split(' ')[0] + ' · ' + (p.company || 'Tarjeta')) + '">\n' +
      '<style>html,body{margin:0;padding:0;background:#F8FAFC}#kvc-root{min-height:100vh;display:flex;flex-direction:column}#kvc-root>.kvc{flex:1}</style>\n' +
      '</head>\n<body>\n<div id="kvc-root"></div>\n<script>\n' + String(coreSrc).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--') + '\n' +
      'KVC.injectCss();(function(){var P=' + json + ',O={qrUrl:' + JSON.stringify(extra.qrUrl || '') + '||undefined,' +
        'leadEndpoint:' + JSON.stringify(extra.leadEndpoint || '') + ',statsEndpoint:' + JSON.stringify(extra.statsEndpoint || '') + ',source:"sitio propio"};' +
        // kvc-config.json (opcional, junto al HTML): {"gateway":"…/api/public/app/{instancia}/submit/"}
        // conecta formulario y medición con la app sin regenerar la página.
        'function go(){KVC.mount(document.getElementById("kvc-root"),P,O);}' +
        (extra.configUrl ? 'var done=false,t=setTimeout(function(){if(!done){done=true;go();}},2500);' +
          'fetch(' + JSON.stringify(extra.configUrl) + ',{cache:"no-cache"}).then(function(r){return r.ok?r.json():{};}).catch(function(){return {};}).then(function(c){' +
          'if(done)return;done=true;clearTimeout(t);var g=String((c&&c.gateway)||"").trim();' +
          'if(g.slice(0,8)==="https://"&&/\\/submit\\/?$/.test(g)){if(g.charAt(g.length-1)!=="/")g+="/";O.leadEndpoint=g+"lead";O.statsEndpoint=g+"visita";}'+
          'go();});'
          : 'go();') +
        '})();\n' +
      '</script>\n</body>\n</html>\n';
  }

  return {
    VERSION: VERSION,
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    EMPTY_PROFILE: EMPTY_PROFILE,
    PERSONAL_KEYS: PERSONAL_KEYS,
    teamMerge: teamMerge,
    walletApplePass: walletApplePass,
    walletGoogleObject: walletGoogleObject,
    shareImage: shareImage,
    vcardLite: vcardLite,
    localize: localize,
    tr: tr,
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
