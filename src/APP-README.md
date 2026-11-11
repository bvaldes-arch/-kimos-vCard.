# KIMOS vCard (`kimos-vcard`)

Versión actual: **{{VERSION}}**

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
| `agent.control` | `GET_CARD`, `UPDATE_CARD`, `SET_PUBLISHED`. |

## Avisos del revisor que se mantienen, y por qué

- *Logo/paleta propios*: la tarjeta trae la marca FIGIT.ai **de fábrica** como
  perfil por defecto (`assets/`), pero lee y aplica `shell.brands`; los colores
  de la tarjeta viven en tokens con nombre (`--kvc-*`).
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
| **1.0.1** | Instagram oficial de FIGIT: @figit.chile. |
| **1.0.0** | Versión inicial: editor con vista previa móvil/escritorio, interfaz Hub · Tarjeta 3D · Código QR, página pública por `public.read`, verificación de URL y prueba del QR, vCard 3.0 con foto, QR en PNG HD, exportación HTML autónoma, marcas del tenant y agente. |
