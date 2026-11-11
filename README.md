# KIMOS vCard

Tarjeta de contacto virtual con **código QR real** para KIMOS Enterprise.
Quien escanea el QR abre la tarjeta digital —**Hub** de canales, **Tarjeta 3D**
y **Código QR**— con WhatsApp como canal principal, correo, LinkedIn, sitio web,
Instagram, llamada y ubicación, y guarda el contacto (.vcf con foto) en su
agenda en un toque.

Perfil de fábrica: **Bryan Valdes Ch. · CEO & Fundador · FIGIT.ai**. Para otra
empresa, la app asume su identidad desde el registro de marcas de KIMOS
(colores, logos, tipografía) y la persona conectada.

## Entregables

| Archivo | Qué es |
|---|---|
| [`kimos-vcard-1.1.0.kapp`](kimos-vcard-1.1.0.kapp) | La app para KIMOS: Tienda → *Instalar desde archivo* (superadmin). |
| [`docs/index.html`](docs/index.html) | La tarjeta pública autónoma (lo que se abre al escanear). Publicada con GitHub Pages. |
| [`docs/Bryan_Valdes_FIGIT_Tarjeta_Digital.pdf`](docs/Bryan_Valdes_FIGIT_Tarjeta_Digital.pdf) | PDF interactivo: QR protagonista + botones con enlace (WhatsApp, contacto, correo, LinkedIn, web, Instagram, llamar, ubicación) y la tarjeta ejecutiva. |
| [`docs/contacto.vcf`](docs/contacto.vcf) | Contacto con foto, enlazado desde el PDF («Guardar contacto»). |
| [`app/kimos-vcard/`](app/kimos-vcard) | La app desempaquetada, con la misma forma que `kimos-packages/apps/kimos-vcard`. |

## Activar el enlace del QR (una sola vez)

El QR del PDF y de `docs/` apunta a **https://bvaldes-arch.github.io/-kimos-vCard./**.
Para que esa dirección responda:

1. GitHub → este repositorio → **Settings → Pages**.
2. *Source*: **Deploy from a branch** · rama con estos archivos · carpeta **`/docs`** → *Save*.
3. En 1–2 minutos la tarjeta queda en línea. Ábrela una vez en tu teléfono para confirmarlo.

¿Prefieres tu dominio (p. ej. `figit.ai/bryan`)? Sube el contenido de `docs/`
a esa ruta y regenera con tu URL:

```bash
KVC_PUBLIC_URL=https://figit.ai/bryan/ node tools/build.mjs
```

```bash
KVC_PUBLIC_URL=https://figit.ai/bryan/ node tools/make-pdf.mjs
```

Dentro de KIMOS no hace falta nada de esto: al **Publicar**, el QR apunta a
`{tu KIMOS}/api/apps/kimos-vcard/asset/card.html?i={documento}`, que sirve el
propio KIMOS. El botón **Probar el QR** comprueba que ese enlace abre tu tarjeta.

## QR 100 % reales

- Solo se generan QR hacia direcciones `https://` públicas. Se rechazan `blob:`,
  `file:`, `data:`, `localhost` y redes locales: funcionan en la pantalla de
  quien los crea y en la cámara de otro teléfono no abren nada.
- `tools/test.mjs` decodifica **cada** QR visible (y el PNG HD con el logo al
  centro) con jsQR y exige la URL exacta; también revisa cada enlace de canal y
  el vCard. `tools/make-pdf.mjs` no genera el PDF si su QR no decodifica bien.

## Desarrollo

```
src/card-core.js   núcleo compartido: interfaz Hub · Tarjeta 3D · Código QR, QR, vCard
src/card.css       estilos de la tarjeta (tokens --kvc-*, re-definibles por marca)
src/app.js         la app de KIMOS (editor, vista previa, publicar, marcas, agente)
src/app.css        estilos de la app (tokens del tema del host, APP-SPEC §9)
src/card.html      página pública del QR servida por KIMOS
src/img/           foto y logo oficial FIGIT.ai
tools/             build, pruebas, PDF y empaquetador (.kapp)
```

```bash
node tools/build.mjs        # app/kimos-vcard + docs/
```

```bash
node tools/test.mjs         # pruebas en Chromium (Playwright)
```

```bash
node tools/make-pdf.mjs     # PDF interactivo
```

```bash
node tools/pack.mjs app/kimos-vcard   # .kapp
```

Sin dependencias de npm en runtime: React lo pone el host; QR
([qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT) e
íconos ([Simple Icons](https://simpleicons.org), CC0 · [Lucide](https://lucide.dev), ISC)
van embebidos. Las pruebas usan [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0)
y el Playwright/Chromium del entorno.
