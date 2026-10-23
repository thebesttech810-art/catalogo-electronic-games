"""Deja docs/ lista para publicar en GitHub Pages (lo corre el workflow justo antes de subir la página).

- Crea la versión WebP de cada foto mini (docs/**/mini/*.jpg -> mismo nombre .webp, de 400 px): pesa
  mucho menos que el JPG de 600 px y alcanza para las tarjetas (miden ~180 px en celular). Si alguna falta, la página usa sola el JPG (onPhotoError en index.html).
- Si se le pasa --minificar, achica docs/index.html (quita espacios y comentarios del HTML y achica el JS; el CSS se deja igual porque
  el minificador rompe reglas modernas y desarma el diseño en celular) con
  html-minifier-terser. El archivo del repositorio queda legible: solo se achica la copia que se publica.

Uso:  python preparar_publicacion.py [--minificar]
"""
import os
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


if __name__ == "__main__":
    webp_de_minis()
    if "--minificar" in sys.argv:
        minificar_index()
