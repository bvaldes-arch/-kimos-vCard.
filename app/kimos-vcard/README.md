# KIMOS vCard (`kimos-vcard`)

Versión actual: **2.0.0**

Tarjeta de contacto virtual con **código QR real**. Quien escanea abre la
tarjeta digital —Hub de canales, Tarjeta 3D y Código QR— con **WhatsApp como
canal principal**, correo, LinkedIn, sitio web, Instagram, llamada y ubicación,
y guarda el contacto (vCard 3.0 con foto) en su agenda en un toque.

## Cómo funciona el QR

```
QR ──► {api}/api/apps/kimos-vcard/asset/card.html?i={instanceId}
         └─ lee /api/public/app/{instanceId}/definition   (gateway public.read)
```

- **Publicar** escribe el item `definition` con `public.enabled: true` y, en
  `data`, solo la tarjeta. Despublicar lo apaga: el gateway responde 403 y la
  página dice «no publicada».
- Con la tarjeta publicada, cada cambio se republica solo (1,5 s).
- **Dominio propio** (opcional): «Exportar HTML autónomo» genera un único
  `.html` con todo embebido; súbelo como `index.html` a tu dominio y escribe esa
  dirección en *Dominio propio*. El QR pasa a apuntar ahí.
- **Solo URLs reales**: el QR acepta únicamente direcciones `https://` (o
  `http://` con aviso) públicas. Se rechazan `blob:`, `file:`, `data:`,
  `localhost` y redes locales, que funcionan en la pantalla de quien las
  genera y en la cámara de otro teléfono no abren nada.
- **Probar el QR** comprueba el enlace como lo hará el teléfono que escanee:
  pide la definición pública y verifica que traiga esta tarjeta.

## Marca de cada empresa

Con `brand.read`, la pestaña **Marca** lista TODAS las marcas del registro de
KIMOS (marca general y submarcas) y aplica la elegida: color base y acento,
color de texto, superficie suave, logotipos (el de fondo claro) y la tipografía
de títulos. Lo personal no se toca. En una instancia nueva de otra empresa, la
tarjeta nace con la persona conectada (`/api/identity/me`) y la marca por
defecto del tenant. Sin registro de marcas, todo se ajusta a mano.

## Permisos

| Permiso | Para qué |
|---|---|
| `instance.read` / `instance.write` | Guardar la tarjeta y su item `definition`. |
| `public.read` | Que la página del QR lea lo publicado, sin sesión. |
| `files.write` | Subir foto y logos con ruta gestionada por el host (§7.e). Sin él, se embeben comprimidos. |
| `brand.read` | Asumir colores, logos y tipografía del registro de marcas (§7.f). |
| `public.submit` | Recibir «Déjame tus datos» como prospectos (canal `lead`) y la medición de visitas (canal `visita`). |
| `records.link` | «Pasar a Clientes»: crea o reutiliza el contacto en la identidad compartida. |
| `agent.control` | `GET_CARD`, `UPDATE_CARD`, `LIST_LEADS`, `GET_STATS`, `SET_PUBLISHED`. |

## Avisos del revisor que se mantienen, y por qué

- *Logo/paleta propios*: la tarjeta trae la marca FIGIT.ai **de fábrica** como
  perfil por defecto (`assets/`), pero lee y aplica `shell.brands`; los colores
  de la tarjeta viven en tokens con nombre (`--kvc-*`).
- *¿Debería otra app poder alimentarla?* No: los prospectos entran solo por
  el formulario público de la tarjeta y salen a Clientes con `shell.records`.
  No se publica `dataSchema` a propósito; la pasarela queda cerrada.
- *`agent.ask` no se declara*: un `.kapp` con ese permiso se rechaza en KIMOS
  anterior a 0.96.0. La app ya usa `shell.agents` si existe; al actualizar
  KIMOS, basta añadir el permiso y publicar una 2.0.x.
- *Colores de canal*: verde WhatsApp, azul LinkedIn, degradado Instagram, etc.
  son colores de marcas de terceros y van en tokens con nombre.

## Estructura

```
manifest.json
dist/index.js        bundle ESM (React del host, sin JSX)
dist/index.css       estilos de la app (tokens del host)
assets/card.html     página pública del QR
assets/kvc-core.js   núcleo de la tarjeta (QR, vCard, interfaz)
assets/*.jpg|png     foto y logos por defecto
```

Fuente y build: repositorio `kimos-vcard` (`node tools/build.mjs`).

## Versiones

| Versión | Cambios |
|---|---|
| **2.0.0** | «Equipo». **Tarjetas para todo el equipo** desde el directorio de KIMOS (`/api/identity/actors`): cada persona tiene su enlace (`&m=`), su QR y su vista previa, con la marca de la tarjeta principal; sus prospectos y su medición llegan marcados con su nombre (filtro por persona). **Seguimiento**: borrador del primer mensaje (breve, cordial o formal; WhatsApp o correo; ES/EN) listo para enviar, y con `shell.agents` (KIMOS ≥ 0.96 + `agent.ask`) lo redacta el agente elegido. **Apple Wallet y Google Wallet**: pase que guarda SOLO la tarjeta de contacto, firmado con `tools/wallet.mjs` y los certificados del emisor; la tarjeta muestra el botón que corresponde al teléfono. **NFC**: en Chrome para Android, «Grabar en tarjeta NFC» escribe el enlace (o la vCard) en una etiqueta. Tools `LIST_TEAM`, `SET_TEAM_MEMBER`, `DRAFT_FOLLOW_UP`. **Cambio de formato**: el documento guarda `team`. |
| **1.3.0** | «Medición». **Todo formulario registra al prospecto**: la página de KIMOS, la vista previa de la app (marcado «vista previa») y el HTML exportado alojado en otro dominio (GitHub Pages, figit.ai), por el gateway público; si el envío falla, un botón lo manda por WhatsApp. Estilos ligados a la versión (KIMOS dejaba la hoja anterior al actualizar sin recargar). Pestaña **Medición**: aperturas, toques por canal, contactos guardados, prospectos y conversión, aperturas por día, idioma y origen (canal `visita`, una por visita, sin cookies). **Imagen para compartir** 1200×630 (og:image del HTML exportado). **Un solo núcleo**: el bundle carga `assets/kvc-core.js` (de 203 KB a 76 KB). **Agregar a inicio**: ícono, título y guía para iPhone y Android. Tool de agente `GET_STATS`. |
| **1.2.0** | «Captura». Formulario «Déjame tus datos» en la tarjeta pública (gateway `public.submit`, canal `lead`, honeypot) con pestaña **Prospectos**: WhatsApp/correo al prospecto, archivar y **Pasar a Clientes** (`shell.records`, contacto sin duplicar). Fuera de KIMOS el formulario abre WhatsApp con los datos escritos. **QR sin internet**: destino «Contacto sin internet» (vCard dentro del QR) y PNG en Publicar. **Inglés**: botón ES/EN, detección del idioma del teléfono y campos en inglés. **Plantillas**: FIGIT (fábrica), en blanco y una por cada marca del registro; una tarjeta nueva de otra persona nunca recibe los datos de Bryan. Permisos nuevos: `public.submit`, `records.link`. |
| **1.1.0** | WhatsApp siempre presente: acceso rápido en el Hub, fila en la Tarjeta 3D y destino del QR (si falta, se toma del teléfono). Correo solo una vez en el Hub. Destino del QR elegible entre tarjeta digital, WhatsApp, sitio web, Instagram y LinkedIn. Logo de la marca en la esquina superior izquierda del Hub, superior derecha de la Tarjeta 3D (con QR más grande) y superior derecha de Código QR. Cargo bajo el nombre y empresa debajo. Botón «Restaurar» de la tarjeta FIGIT; la instancia del dueño ya no se reemplaza con el perfil de KIMOS ni se re-marca. El HTML exportado lleva el QR del enlace público. |
| **1.0.1** | Instagram oficial de FIGIT: @figit.chile. |
| **1.0.0** | Versión inicial: editor con vista previa móvil/escritorio, interfaz Hub · Tarjeta 3D · Código QR, página pública por `public.read`, verificación de URL y prueba del QR, vCard 3.0 con foto, QR en PNG HD, exportación HTML autónoma, marcas del tenant y agente. |
