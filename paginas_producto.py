"""Crea una página propia para cada producto en docs/p/<código>.html y el sitemap.

Sirve para dos cosas:
- Cuando alguien comparte un producto por WhatsApp, Instagram o Facebook, la vista
  previa muestra la foto, el nombre y el precio de ESE producto (no la imagen general).
- Google puede encontrar cada producto por separado.

Solo lee docs/products.json (no usa Contífico ni claves), así que se puede correr
en cualquier momento. La llama actualizar_stock.py cada 15 minutos, antes de publicar.
Las páginas no se guardan en el repositorio (docs/p/ está en .gitignore): se
vuelven a crear en cada publicación con el stock y los precios del momento."""

import html
import json
import os
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from descripciones import detalles

SITIO = "https://thebesttech810-art.github.io/catalogo-electronic-games/"
PRODUCTOS = "docs/products.json"
CARPETA = "docs/p"
SITEMAP = "docs/sitemap.xml"
WHATSAPP = "593980807721"
TIENDA = "Electronic Games"
ANALITICA_ID = "1f84c623-7a7b-4d1f-90cd-ef1e1a646852"  # id del sitio en Umami (el mismo de CONFIG.analitica en index.html); vacío = sin medir
LOCALES = [
    ("condado", "Condado Shopping", "Quito, Isla 21"),
    ("scala", "Scala Shopping", "Cumbayá, Isla 5"),
    ("valle", "Plaza del Valle", "Sangolquí, Local B17"),
]
LOGO = '<g fill="#FE8903" transform="matrix(1 0 -.7 1 51.8 0)"><path d="M27.5 44.8H125V56H27.5z"/><path d="M27.5 60.7H125V72H56v16H27.5z"/><path d="M65 77.6h60v14.7a12 12 0 0 1-12 12H27.5V93H97v-5H65z"/></g>'  # logo de Electronic Games, vectorizado del original
POCAS = 2  # desde cuántas unidades se avisa "últimas unidades" (igual que en la página)
ECUADOR = timezone(timedelta(hours=-5))  # Ecuador no cambia de hora en el año


def archivo_de(codigo):
    """Nombre del archivo de un producto. index.html usa la misma regla (paginaDe)."""
    return re.sub(r"[^A-Za-z0-9._-]", "-", codigo) + ".html"


def dinero(n):
    return f"${n:,.2f}"


def disponibles(n):
    return "Agotado" if not n else f"{n} disponible{'s' if n > 1 else ''}"


def pagina(p, cuando):
    e = html.escape
    efectivo = p.get("price_efectivo") or p.get("price") or 0
    tarjeta = p.get("price_tarjeta") or efectivo
    stock = p.get("stock") or {}
    total = sum(stock.values())
    agotado = not p.get("digital") and total == 0
    url = SITIO + "p/" + quote(archivo_de(p["code"]))
    foto = p["photos"][0] if p.get("photos") else ""
    og_img = SITIO + foto if foto else SITIO + "og.png"

    if p.get("digital"):
        dispo = "Código digital, se entrega por WhatsApp"
    elif agotado:
        dispo = "Agotado por ahora"
    else:
        en = sum(1 for k, _, _ in LOCALES if stock.get(k))
        dispo = "Disponible en los 3 locales" if en == len(LOCALES) else f"Disponible en {en} local{'es' if en > 1 else ''}"

    entero, dec = f"{efectivo:.2f}".split(".")
    # Descripción: la de Contífico si existe; si no, la que se arma con el nombre (descripciones.py).
    info = detalles(p)
    desc = (p.get("desc") or "").strip() or info["desc_auto"]
    ahorro = tarjeta - efectivo
    filas = "" if p.get("digital") else "".join(
        f'<li><span>{e(nombre)}<small>{e(lugar)}</small></span>'
        f'<span class="st {"out" if not stock.get(k) else "low" if stock.get(k) <= POCAS else "ok"}"><i></i>{disponibles(stock.get(k, 0))}</span></li>'
        for k, nombre, lugar in LOCALES)
    mensaje = (f"Hola {TIENDA}, avísenme cuando llegue: {p['name']} ({p['code']})." if agotado else
               f"Hola {TIENDA}, me interesa: {p['name']} ({p['code']}), a {dinero(efectivo)} en efectivo. ¿Está disponible?")
    datos = {
        "@context": "https://schema.org", "@type": "Product", "name": p["name"], "sku": p["code"],
        "category": p.get("cat_label", ""), "image": og_img, "url": url,
        "brand": {"@type": "Brand", "name": TIENDA},
        "offers": {"@type": "Offer", "price": f"{efectivo:.2f}", "priceCurrency": "USD", "url": url,
                   "availability": "https://schema.org/OutOfStock" if agotado else "https://schema.org/InStock",
                   "seller": {"@type": "Organization", "name": TIENDA}},
    }
    if desc:
        datos["description"] = desc
    if info["estado"]:
        datos["offers"]["itemCondition"] = "https://schema.org/UsedCondition"
    analitica = (f'<script defer src="https://cloud.umami.is/script.js" data-website-id="{e(ANALITICA_ID)}" data-domains="thebesttech810-art.github.io"></script>'
                 if ANALITICA_ID else "")
    img = (f'<img src="../{e(foto)}" alt="{e(p["name"])}" width="600" height="600">' if foto else
           '<svg viewBox="0 0 500 500" role="img" aria-label="Foto próximamente">'
           f'<svg x="140" y="170" width="220" height="95" viewBox="6 44.5 140 60">{LOGO}</svg>'
           '<text x="250" y="340" text-anchor="middle" font-family="monospace" font-size="16" fill="#8A8178" letter-spacing="2">FOTO PRÓXIMAMENTE</text></svg>')
    principal = (f'<a class="btn wa" id="wa" href="https://wa.me/{WHATSAPP}?text={quote(mensaje)}" target="_blank" rel="noopener">Avísame cuando llegue</a>'
                 f'<a class="btn ghost" href="../?cat={quote(p.get("cat", ""))}#catalogo">Ver productos parecidos</a>'
                 if agotado else
                 f'<a class="btn brand" href="../?p={quote(p["code"])}">Agregar a mi pedido</a>'
                 f'<a class="btn wa" id="wa" href="https://wa.me/{WHATSAPP}?text={quote(mensaje)}" target="_blank" rel="noopener">Preguntar por WhatsApp</a>')

    return f"""<!doctype html>
<html lang="es-EC">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(p["name"])} · {dinero(efectivo)} · {TIENDA}</title>
<meta name="description" content="{e(p["name"])} a {dinero(efectivo)} en efectivo, IVA incluido. {e(desc)} {e(dispo)}. Retira en Condado, Scala o Plaza del Valle, o pide por WhatsApp.">
<meta name="theme-color" content="#0A0A0B">
<link rel="canonical" href="{url}">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="manifest" href="../manifest.webmanifest">
<meta property="og:type" content="product">
<meta property="og:site_name" content="{TIENDA}">
<meta property="og:locale" content="es_EC">
<meta property="og:title" content="{e(p["name"])} · {dinero(efectivo)}">
<meta property="og:description" content="{e(dispo)}. Pídelo por WhatsApp en {TIENDA}, Quito.">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og_img}">
<meta property="og:image:alt" content="{e(p["name"])}">
<meta property="product:price:amount" content="{efectivo:.2f}">
<meta property="product:price:currency" content="USD">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps(datos, ensure_ascii=False).replace("</", "<\\/")}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,400..900;1,700..900&display=swap" rel="stylesheet">
{analitica}
<style>
:root{{--bg:#0A0A0B;--surface:#151416;--line:#2C2A2F;--ink:#F7F4EF;--muted:#A39C94;--brand:#FF7A00;--brand-hi:#FF9A2E;--brand-ink:#140900;--ok:#3DDC84;--low:#FFC61A;--out:#FF5A5A;--wa:#25D366;--wa-ink:#052912;color-scheme:dark}}
*{{box-sizing:border-box}}
@view-transition{{navigation:auto}}
@media (prefers-reduced-motion:reduce){{::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){{animation:none!important}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:"Rubik",system-ui,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}}
a{{color:inherit}}
:focus-visible{{outline:2px solid var(--brand-hi);outline-offset:2px}}
.wrap{{max-width:1080px;margin:0 auto;padding:0 20px}}
header{{border-bottom:1px solid var(--line)}}
header .wrap{{display:flex;align-items:center;justify-content:space-between;gap:16px;height:64px}}
.marca{{display:inline-flex;align-items:center;gap:10px;font-weight:900;font-style:italic;text-transform:uppercase;text-decoration:none;font-size:1.1rem}}
.marca b{{color:var(--brand)}}
header nav a{{font-weight:700;font-size:.92rem;color:var(--muted);text-decoration:none;padding:10px 0}}
header nav a:hover{{color:var(--ink)}}
.ficha{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;padding-block:32px 56px;align-items:start}}
.foto{{aspect-ratio:1/1;border-radius:18px;overflow:hidden;background:radial-gradient(120% 95% at 50% 8%,#fff 0%,#F4F1EC 58%,#E4DED4 100%)}}
.foto img,.foto svg{{width:100%;height:100%;object-fit:contain;padding:2%;mix-blend-mode:multiply;display:block}}
.migas{{font-size:.85rem;color:var(--muted)}}
.migas a{{color:var(--brand-hi);font-weight:700;text-decoration:none}}
h1{{margin:10px 0 6px;font-size:clamp(1.6rem,3.4vw,2.3rem);line-height:1.1;text-wrap:balance}}
.code{{font-family:ui-monospace,monospace;font-size:.8rem;color:var(--muted);margin:0}}
.precio{{margin:18px 0 2px;font-weight:900;font-style:italic;font-size:2.8rem;line-height:1;font-variant-numeric:tabular-nums}}
.precio span{{color:var(--brand);font-size:.6em}}
.precio small{{font-size:.5em}}
.tag{{margin:6px 0 0;color:var(--muted);font-size:.9rem}}
.tag b{{color:var(--ink)}}
.desc{{margin:14px 0 0;color:#d9d3cc;font-size:1rem;max-width:52ch}}
.ahorro{{margin:12px 0 0;padding:10px 14px;border-radius:12px;background:rgba(61,220,132,.12);border:1px solid rgba(61,220,132,.35);color:var(--ok);font-weight:700;font-size:.92rem}}
ul{{list-style:none;margin:20px 0 0;padding:0;border-top:1px solid var(--line)}}
li{{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}}
li small{{display:block;color:var(--muted);font-size:.8rem}}
.st{{display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:.85rem;white-space:nowrap}}
.st i{{width:8px;height:8px;border-radius:50%;background:currentColor}}
.ok{{color:var(--ok)}} .low{{color:var(--low)}} .out{{color:var(--out)}}
.dispo{{margin:18px 0 0;font-weight:700}}
.acciones{{display:grid;gap:10px;margin-top:22px}}
.btn{{display:flex;align-items:center;justify-content:center;min-height:54px;padding:14px 18px;border-radius:14px;font-weight:800;text-decoration:none;text-align:center}}
.brand{{background:var(--brand);color:var(--brand-ink)}} .brand:hover{{background:var(--brand-hi)}}
.wa{{background:var(--wa);color:var(--wa-ink)}}
.ghost{{border:1px solid var(--line)}} .ghost:hover{{border-color:var(--brand)}}
.pie{{margin:16px 0 0;color:var(--muted);font-size:.85rem}}
footer{{border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}}
footer .wrap{{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;padding-block:20px 28px}}
footer a{{color:var(--ink)}}
@media (max-width:760px){{.ficha{{grid-template-columns:minmax(0,1fr);gap:24px;padding-top:20px}}}}
</style>
</head>
<body>
<header><div class="wrap"><a class="marca" href="../"><svg viewBox="6 44.5 140 60" width="47" height="20" aria-hidden="true">{LOGO}</svg>Electronic <b>Games</b></a><nav><a href="../#catalogo">Ver todo el catálogo</a></nav></div></header>
<main class="wrap ficha">
  <div class="foto">{img}</div>
  <div>
    <nav class="migas" aria-label="Ubicación"><a href="../#catalogo">Catálogo</a> / <a href="../?cat={quote(p.get("cat", ""))}#catalogo">{e(p.get("cat_label", ""))}</a></nav>
    <h1>{e(p["name"])}</h1>
    <p class="code">Código {e(p["code"])}</p>
    <p class="precio"><span>$</span>{entero}<small>.{dec}</small></p>
    <p class="tag">Efectivo o transferencia, IVA incluido{f" · Con tarjeta: <b>{dinero(tarjeta)}</b>" if tarjeta > efectivo else ""}</p>
    {f'<p class="ahorro">Pagando en efectivo o transferencia ahorras {dinero(ahorro)}</p>' if ahorro > 0.009 else ""}
    {f'<p class="desc">{e(desc)}</p>' if desc else ""}
    {f"<ul>{filas}</ul>" if filas else f'<p class="dispo">{e(dispo)}</p>'}
    <div class="acciones">{principal}</div>
    <p class="pie">Stock actualizado {cuando}. Te confirmamos disponibilidad por chat antes de cobrar.</p>
  </div>
</main>
<footer><div class="wrap"><span>© {datetime.now(ECUADOR).year} {TIENDA} · Quito, Cumbayá y Sangolquí</span><a href="https://www.instagram.com/electronicgamesec/" target="_blank" rel="noopener">Instagram @electronicgamesec</a></div></footer>
<script>
// Código corto del pedido en el mensaje de WhatsApp (el mismo control de comisión que el catálogo).
var wa = document.getElementById("wa");
if (wa) wa.href += encodeURIComponent(" (Código EG-" + (Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4)).toUpperCase() + ")");
</script>
</body>
</html>
"""


def main():
    with open(PRODUCTOS, encoding="utf-8") as f:
        productos = json.load(f)
    ahora = datetime.now(ECUADOR)
    cuando = f"el {ahora.day}/{ahora.month} a las {ahora:%H:%M}"

    os.makedirs(CARPETA, exist_ok=True)
    nuevos = set()
    for p in productos:
        nombre = archivo_de(p["code"])
        nuevos.add(nombre)
        with open(os.path.join(CARPETA, nombre), "w", encoding="utf-8") as f:
            f.write(pagina(p, cuando))
    # Productos que salieron del catálogo: su enlace lleva a la página 404, que manda al catálogo.
    for viejo in os.listdir(CARPETA):
        if viejo.endswith(".html") and viejo not in nuevos:
            os.remove(os.path.join(CARPETA, viejo))

    hoy = ahora.date().isoformat()
    urls = [f"  <url><loc>{SITIO}</loc><lastmod>{hoy}</lastmod><changefreq>hourly</changefreq></url>"]
    urls += [f"  <url><loc>{SITIO}p/{quote(archivo_de(p['code']))}</loc><lastmod>{hoy}</lastmod></url>" for p in productos]
    with open(SITEMAP, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                + "\n".join(urls) + "\n</urlset>\n")
    print(f"{len(productos)} páginas de producto en {CARPETA}/ y sitemap actualizado.")


if __name__ == "__main__":
    main()
