"""Toma la carpeta de fotos que devuelve la persona de las fotos (por defecto
"FOTOS CATALOGO", o la que se arrastre sobre subir_fotos.bat), mejora cada foto
(fondo blanco, recorte, cuadrada y más nítida: ver mejorar_fotos.py), la guarda en
docs/fotos/<código>/1.jpg, 2.jpg... y la publica en GitHub.

Cada carpeta de producto se reconoce por el código que lleva en su nombre
("NNN - CÓDIGO - NOMBRE"). Las fotos de un producto reemplazan a las anteriores."""

import json
import os
import re
import shutil
import subprocess
import sys

from PIL import Image

from generar_catalogo import FOTOS_DIR, SALIDA, SELECCION
from mejorar_fotos import guardar, mejorar

EXT_OK = {".jpg", ".jpeg", ".png", ".webp"}
EXT_HEIC = {".heic", ".heif"}
MAX_FOTOS = 5


def orden_natural(nombre):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", nombre)]


def codigo_de_carpeta(nombre, codigos):
    for parte in [nombre] + nombre.split(" - "):
        if parte.strip() in codigos:
            return parte.strip()
    return None


def guardar_foto(origen, destino):
    with Image.open(origen) as im:
        guardar(mejorar(im), destino)


def git(*args):
    exe = shutil.which("git") or r"C:\Program Files\Git\cmd\git.exe"
    return subprocess.run([exe, *args], capture_output=True, text=True)


def main():
    origen = sys.argv[1] if len(sys.argv) > 1 else "FOTOS CATALOGO"
    if not os.path.isdir(origen):
        print(f"No encuentro la carpeta: {origen}")
        return

    codigos = {p["code"] for p in json.load(open(SALIDA, encoding="utf-8"))}
    if os.path.exists(SELECCION):
        codigos |= set(json.load(open(SELECCION, encoding="utf-8")))

    listos, sin_codigo, solo_heic, con_error = [], [], [], []
    for raiz, _, archivos in os.walk(origen):
        fotos = sorted((f for f in archivos if os.path.splitext(f)[1].lower() in EXT_OK), key=orden_natural)
        heics = [f for f in archivos if os.path.splitext(f)[1].lower() in EXT_HEIC]
        if not fotos and not heics:
            continue
        codigo = codigo_de_carpeta(os.path.basename(raiz), codigos)
        if not codigo:
            sin_codigo.append(raiz)
            continue
        if not fotos:
            solo_heic.append(raiz)
            continue

        destino = os.path.join(FOTOS_DIR, codigo)
        os.makedirs(destino, exist_ok=True)
        anteriores = [f for f in os.listdir(destino) if f.lower().endswith(".jpg")]
        try:
            nuevas = []
            for i, f in enumerate(fotos[:MAX_FOTOS], start=1):
                tmp = os.path.join(destino, f"_nueva_{i}.jpg")
                guardar_foto(os.path.join(raiz, f), tmp)
                nuevas.append(tmp)
        except Exception as e:
            for tmp in nuevas:
                os.remove(tmp)
            con_error.append(f"{raiz}: {e}")
            continue
        for f in anteriores:
            os.remove(os.path.join(destino, f))
        for i, tmp in enumerate(nuevas, start=1):
            os.replace(tmp, os.path.join(destino, f"{i}.jpg"))
        listos.append((codigo, len(nuevas)))

    print(f"\nProductos con fotos listas: {len(listos)}")
    for codigo, n in listos:
        print(f"  OK  {codigo}  ({n} foto{'s' if n > 1 else ''})")
    if sin_codigo:
        print(f"\nCarpetas con fotos pero sin un código válido en el nombre ({len(sin_codigo)}):")
        for r in sin_codigo:
            print("  ?? ", r)
    if solo_heic:
        print(f"\nCarpetas con fotos HEIC de iPhone, que hay que pasar a JPG ({len(solo_heic)}):")
        for r in solo_heic:
            print("  !! ", r)
    if con_error:
        print(f"\nFotos que no se pudieron abrir ({len(con_error)}):")
        for r in con_error:
            print("  !! ", r)

    if not listos:
        print("\nNo hay fotos nuevas para publicar.")
        return

    git("add", FOTOS_DIR)
    if git("diff", "--cached", "--quiet", "--", FOTOS_DIR).returncode == 0:
        print("\nEstas fotos ya estaban publicadas. No hay nada nuevo que subir.")
        return
    print("\nPublicando en la web...")
    r = git("commit", "-m", f"Fotos de {len(listos)} productos", "--", FOTOS_DIR)
    if r.returncode != 0:
        print("No se pudo guardar el cambio:\n", r.stdout, r.stderr)
        return
    r = git("pull", "--rebase", "--autostash")
    if r.returncode != 0:
        print("No se pudo sincronizar con GitHub:\n", r.stdout, r.stderr)
        return
    r = git("push")
    if r.returncode != 0:
        print("No se pudo subir a GitHub:\n", r.stdout, r.stderr)
        return
    print("Listo. Las fotos aparecen en la página en unos 2 minutos.")


if __name__ == "__main__":
    main()
