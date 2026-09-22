"""Genera products.json para el catálogo web a partir de datos reales de
Contífico: catálogo completo (cacheado) + stock por bodega de cada producto
activo con stock, filtrado a los 3 locales públicos."""

import concurrent.futures
import json
import os
import re
import time
import unicodedata

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.environ["CONTIFICO_API_KEY"]
BASE_URL = os.environ["CONTIFICO_BASE_URL"]
HEADERS = {"Authorization": API_KEY}

CACHE_PRODUCTOS = "productos_raw.json"
CACHE_STOCK = "stock_por_producto.json"
SALIDA = "docs/products.json"
ROTACION = "rotacion.json"  # generado por ventas_rotacion.py

# Máximo de productos a publicar, priorizando los que más rotan.
# None = publicar todos los que tengan stock (sin importar si se venden).
MAX_PRODUCTOS = 200

LOCALES = {"SCALA": "scala", "CONDADO": "condado", "PLAZA DEL VALLE": "valle"}


def normalizar(texto):
    sin_tildes = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode("ascii")
    return sin_tildes.strip().upper()


def slugify(texto):
    s = normalizar(texto).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def stock_total(p):
    try:
        return float(p.get("cantidad_stock") or 0)
    except (TypeError, ValueError):
        return 0.0


def stock_de_producto(pid, intentos=3):
    for intento in range(intentos):
        try:
            r = requests.get(f"{BASE_URL}/producto/{pid}/stock/", headers=HEADERS, timeout=20)
            if r.status_code == 200:
                return r.json()
        except requests.exceptions.RequestException:
            pass
        time.sleep(1 + intento)
    return []


def main():
    with open(CACHE_PRODUCTOS, encoding="utf-8") as f:
        productos = json.load(f)

    r = requests.get(f"{BASE_URL}/categoria/", headers=HEADERS, timeout=30)
    r.raise_for_status()
    cat_nombre = {c["id"]: c["nombre"] for c in r.json()}

    candidatos = [p for p in productos if p.get("estado") == "A" and stock_total(p) > 0]
    print(f"Candidatos (activos con stock total > 0): {len(candidatos)}")

    if os.path.exists(CACHE_STOCK):
        with open(CACHE_STOCK, encoding="utf-8") as f:
            stock_cache = json.load(f)
        print(f"Cache de stock por bodega encontrada: {len(stock_cache)} productos")
    else:
        stock_cache = {}

    faltantes = [p for p in candidatos if p["id"] not in stock_cache]
    print(f"Consultando stock por bodega de {len(faltantes)} productos nuevos...")

    def trabajo(p):
        return p["id"], stock_de_producto(p["id"])

    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for i, (pid, filas) in enumerate(ex.map(trabajo, faltantes), start=1):
            stock_cache[pid] = filas
            if i % 100 == 0:
                elapsed = time.time() - t0
                print(f"  ...{i}/{len(faltantes)} ({elapsed:.0f}s)")
                with open(CACHE_STOCK, "w", encoding="utf-8") as f:
                    json.dump(stock_cache, f, ensure_ascii=False)

    with open(CACHE_STOCK, "w", encoding="utf-8") as f:
        json.dump(stock_cache, f, ensure_ascii=False)
    print(f"Stock por bodega listo en {time.time()-t0:.0f}s")

    rotacion = {}
    if os.path.exists(ROTACION):
        with open(ROTACION, encoding="utf-8") as f:
            rotacion = json.load(f)

    salida = []
    for p in candidatos:
        filas = stock_cache.get(p["id"], [])
        stock_local = {"scala": 0, "condado": 0, "valle": 0}
        for fila in filas:
            clave = LOCALES.get(normalizar(fila.get("bodega_nombre", "")).replace("BODEGA ", "").strip())
            if clave:
                try:
                    stock_local[clave] += int(float(fila.get("cantidad") or 0))
                except (TypeError, ValueError):
                    pass

        cat_real = cat_nombre.get(p.get("categoria_id"), "otros")
        es_tarjeta = cat_real.strip().lower() == "tarjetas"
        if not es_tarjeta and sum(stock_local.values()) <= 0:
            continue  # sin stock en los 3 locales públicos y no es digital

        codigo = p.get("codigo") or p["id"]
        try:
            precio = float(p.get("pvp2") or p.get("pvp1") or 0)
        except (TypeError, ValueError):
            precio = 0.0

        rot = rotacion.get(p["id"], {"unidades": 0, "dias": 0})
        salida.append({
            "_rot": (rot["dias"], rot["unidades"]),
            "code": codigo,
            "name": p.get("nombre", "").strip(),
            "cat": slugify(cat_real),
            "cat_label": cat_real,
            "price": round(precio, 2),
            "digital": es_tarjeta,
            "stock": None if es_tarjeta else stock_local,
            "photos": [f"fotos/{codigo}/1.jpg", f"fotos/{codigo}/2.jpg", f"fotos/{codigo}/3.jpg"],
            "desc": (p.get("descripcion") or "").strip(),
        })

    con_stock = len(salida)
    # Los que más rotan primero: días distintos con venta, luego unidades vendidas.
    salida.sort(key=lambda x: x["_rot"], reverse=True)
    if MAX_PRODUCTOS is not None:
        salida = [x for x in salida if x["_rot"][1] > 0][:MAX_PRODUCTOS]
    # Las cifras de venta son internas: no se publican en el JSON del sitio.
    for x in salida:
        del x["_rot"]

    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)

    print(f"\n{SALIDA} generado con {len(salida)} productos "
          f"({con_stock} con stock en los locales, de {len(candidatos)} candidatos).")


if __name__ == "__main__":
    main()
