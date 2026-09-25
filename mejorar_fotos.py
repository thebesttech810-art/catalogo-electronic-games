"""Deja cada foto de producto lista para la tienda, todas con el mismo aspecto:
- fondo blanco puro (corrige el gris o el tono de color que deja la luz del local),
- sin el blanco sobrante alrededor: el producto ocupa siempre lo mismo del cuadro,
- foto cuadrada (como las tarjetas del catálogo), de 1000 px de lado,
- un poco más de contraste, color y nitidez, sin exagerar.

La usa subir_fotos.py con cada foto nueva. También se puede correr sola para
mejorar las fotos que ya están publicadas:  python mejorar_fotos.py
Una foto ya mejorada lleva una marca adentro y no se vuelve a procesar.

Si el fondo no es claro (una portada que llega al borde, o una foto sobre una mesa
oscura) no se recorta ni se blanquea, porque no se sabe con certeza dónde termina el
producto: solo se completa con blanco hasta quedar cuadrada y se afina. Lo ideal es
tomar las fotos sobre fondo blanco."""

import os
import sys

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

LADO = 1000          # lado de la foto final, en píxeles
OCUPA = 0.86         # el producto ocupa este tanto del lado más largo del cuadro
MARCA = b"EG-mejorada-v1"
CARPETA = "docs/fotos"


def color_de_fondo(im):
    """Mediana del borde de la foto (los 2% de cada lado): ahí casi siempre hay solo fondo."""
    w, h = im.size
    b = max(2, int(min(w, h) * 0.02))
    tiras = [im.crop((0, 0, w, b)), im.crop((0, h - b, w, h)), im.crop((0, 0, b, h)), im.crop((w - b, 0, w, h))]
    pix = [px for t in tiras for px in t.getdata()]
    return tuple(sorted(p[c] for p in pix)[len(pix) // 2] for c in range(3))   # mediana por canal


def es_claro(fondo):
    return min(fondo) >= 200 and max(fondo) - min(fondo) <= 30


def blanquear(im, fondo):
    """Lleva el fondo a blanco puro canal por canal (corrige también el tono), sin tocar los oscuros."""
    tablas = []
    for c in range(3):
        k = min(1.25, 255 / max(1, fondo[c]))
        tablas += [min(255, round(v * k)) for v in range(256)]
    return im.point(tablas)


def recortar(im, umbral=24):
    """Caja del producto: todo lo que se aleja del blanco más que el umbral (ignora ruido suelto)."""
    dif = ImageChops.difference(im, Image.new("RGB", im.size, (255, 255, 255))).convert("L")
    dif = dif.point(lambda v: 255 if v > umbral else 0).filter(ImageFilter.MinFilter(3))
    caja = dif.getbbox()
    if not caja:
        return im
    x0, y0, x1, y1 = caja
    if (x1 - x0) * (y1 - y0) < im.size[0] * im.size[1] * 0.02:   # casi nada: mejor no tocar
        return im
    return im.crop(caja)


def cuadrar(im, fondo=(255, 255, 255)):
    w, h = im.size
    lado = max(1, round(max(w, h) / OCUPA))
    lienzo = Image.new("RGB", (lado, lado), fondo)
    lienzo.paste(im, ((lado - w) // 2, (lado - h) // 2))
    return lienzo


def mejorar(im, ampliar=None):
    """Devuelve la foto mejorada (RGB, LADO x LADO). ampliar(im) puede agrandar las fotos
    chicas con un método mejor que el de Pillow (la mejora con IA de una sola vez lo usa)."""
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        blanco = Image.new("RGB", im.size, (255, 255, 255))
        blanco.paste(im, mask=im.split()[-1])
        im = blanco
    else:
        im = im.convert("RGB")
    fondo = color_de_fondo(im)
    if es_claro(fondo):
        im = recortar(blanquear(im, fondo))
    # Si no, la foto llega hasta el borde (una portada, por ejemplo): se deja entera y se completa con blanco.
    chica = max(im.size) < LADO * OCUPA
    if chica and ampliar:
        im = ampliar(im)   # solo el producto (sin el fondo que se agrega después): más rápido
    im = cuadrar(im).resize((LADO, LADO), Image.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.04)
    im = ImageEnhance.Color(im).enhance(1.06)
    return im.filter(ImageFilter.UnsharpMask(radius=1.4 if chica else 1.0, percent=70 if chica else 45, threshold=2))


def guardar(im, destino):
    im.save(destino, "JPEG", quality=86, optimize=True, progressive=True, comment=MARCA)


def ya_mejorada(ruta):
    with Image.open(ruta) as im:
        return im.info.get("comment") == MARCA


def main(carpeta=CARPETA):
    hechas = saltadas = 0
    for raiz, _, archivos in os.walk(carpeta):
        for f in sorted(archivos):
            if not f.lower().endswith(".jpg"):
                continue
            ruta = os.path.join(raiz, f)
            if ya_mejorada(ruta):
                saltadas += 1
                continue
            with Image.open(ruta) as im:
                nueva = mejorar(im)
            guardar(nueva, ruta)
            hechas += 1
    print(f"Fotos mejoradas: {hechas}. Ya estaban mejoradas: {saltadas}.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else CARPETA)
