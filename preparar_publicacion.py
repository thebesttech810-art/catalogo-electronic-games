"""Deja docs/ lista para publicar en GitHub Pages (lo corre el workflow justo antes de subir la página).

- Crea la versión WebP de cada foto mini (docs/**/mini/*.jpg -> mismo nombre .webp, de 400 px): pesa
  mucho menos que el JPG de 600 px y alcanza para las tarjetas (miden ~180 px en celular). Si alguna falta, la página usa sola el JPG (onPhotoError en index.html).
- Pone una huella a app.js en index.html (app.js?v=...) para que cada publicación se vea al instante.
- Si se le pasa --minificar, achica docs/app.js con terser y docs/index.html (quita espacios y comentarios del HTML con html-minifier-terser; el CSS no lo toca ese
  minificador porque rompe reglas modernas y desarma el diseño en celular: el CSS lo achica lightningcss,
  que sí entiende el CSS moderno). El archivo del repositorio queda legible: solo se achica la copia que se publica.

Uso:  python preparar_publicacion.py [--minificar]
"""
import hashlib
import os
import re
import subprocess
import sys

from PIL import Image

LADO_WEBP = 400
DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")


def webp_de_minis():
    hechas = 0
    for raiz, _, archivos in os.walk(DOCS):
        if os.path.basename(raiz) != "mini":
            continue
        for nombre in archivos:
            if not nombre.lower().endswith(".jpg"):
                continue
            origen = os.path.join(raiz, nombre)
            destino = origen[:-4] + ".webp"
            if os.path.exists(destino) and os.path.getmtime(destino) >= os.path.getmtime(origen):
                continue
            try:
                with Image.open(origen) as im:
                    im = im.convert("RGB")
                    if max(im.size) > LADO_WEBP:
                        im.thumbnail((LADO_WEBP, LADO_WEBP), Image.LANCZOS)
                    im.save(destino, "WEBP", quality=80, method=6)
                hechas += 1
            except Exception as e:  # una foto dañada no frena la publicación: esa usa su JPG
                print(f"Sin WebP para {origen}: {e}")
    print(f"Fotos mini en WebP nuevas: {hechas}")


def minificar_index():
    ruta = os.path.join(DOCS, "index.html")
    antes = os.path.getsize(ruta)
    comando = ["npx", "--yes", "html-minifier-terser@7.2.0",
               "--collapse-whitespace", "--conservative-collapse", "--remove-comments",
               "--minify-js", '{"compress":false,"mangle":false}',
               "-o", ruta + ".min", ruta]
    try:
        subprocess.run(comando, check=True, capture_output=True, text=True, timeout=180)
    except Exception as e:  # si algo falla se publica el archivo normal: nunca se rompe la página
        print(f"No se pudo minificar index.html (se publica sin achicar): {e}")
        return
    os.replace(ruta + ".min", ruta)
    print(f"index.html: {antes // 1024} KB -> {os.path.getsize(ruta) // 1024} KB")


def minificar_css():
    """Achica el CSS de index.html con lightningcss (respeta el CSS moderno: no lo convierte ni reordena el diseño)."""
    ruta = os.path.join(DOCS, "index.html")
    with open(ruta, encoding="utf-8") as f:
        html = f.read()
    m = re.search(r"<style>(.*?)</style>", html, re.S)
    if not m:
        return
    tmp = ruta + ".css"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(m.group(1))
    try:
        r = subprocess.run(["npx", "--yes", "lightningcss-cli@1.33.0", "--minify", tmp],
                           check=True, capture_output=True, text=True, timeout=180)
        css = r.stdout.strip()
        if len(css) < len(m.group(1)) * 0.5:  # resultado sospechoso: mejor no tocar
            raise ValueError("el CSS achicado quedó demasiado chico")
    except Exception as e:
        print(f"No se pudo achicar el CSS (se publica igual): {e}")
        return
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    html = html[:m.start(1)] + css + html[m.end(1):]
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"CSS: {len(m.group(1)) // 1024} KB -> {len(css) // 1024} KB")


def minificar_app():
    """Achica docs/app.js (el código de la tienda) con terser, con la misma configuración prudente del HTML."""
    ruta = os.path.join(DOCS, "app.js")
    if not os.path.exists(ruta):
        return
    antes = os.path.getsize(ruta)
    comando = ["npx", "--yes", "terser@5.51.2", ruta, "--compress", "--mangle", "--ecma", "2021", "-o", ruta + ".min"]
    try:
        subprocess.run(comando, check=True, capture_output=True, text=True, timeout=180)
    except Exception as e:  # si falla se publica el archivo normal
        print(f"No se pudo minificar app.js (se publica sin achicar): {e}")
        return
    os.replace(ruta + ".min", ruta)
    print(f"app.js: {antes // 1024} KB -> {os.path.getsize(ruta) // 1024} KB")


def version_app():
    """Pone app.js?v=<huella> en index.html: cada publicación baja el código nuevo al tiro
    (sin esperar los 10 minutos de caché de GitHub) y entre publicaciones se reutiliza la copia."""
    app = os.path.join(DOCS, "app.js")
    index = os.path.join(DOCS, "index.html")
    if not os.path.exists(app):
        return
    with open(app, "rb") as f:
        huella = hashlib.sha1(f.read()).hexdigest()[:10]
    with open(index, encoding="utf-8") as f:
        html = f.read()
    html = re.sub(r'(["\'])app\.js(\?v=[0-9a-f]+)?\1', lambda m: f'{m.group(1)}app.js?v={huella}{m.group(1)}', html)
    with open(index, "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    webp_de_minis()
    if "--minificar" in sys.argv:
        minificar_index()
        minificar_css()
        minificar_app()
    version_app()
