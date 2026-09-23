"""Genera products.json para el catálogo web a partir de datos reales de
Contífico: catálogo completo + stock por bodega de cada producto activo con
stock, filtrado a los 3 locales públicos. Siempre consulta datos frescos."""

import concurrent.futures
import json
import os
import re
import time
import unicodedata
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.environ["CONTIFICO_API_KEY"]
BASE_URL = os.environ["CONTIFICO_BASE_URL"]
HEADERS = {"Authorization": API_KEY}

CACHE_PRODUCTOS = "productos_raw.json"
CACHE_STOCK = "stock_por_producto.json"
SALIDA = "docs/products.json"
SELECCION = "seleccion.json"  # código -> id de Contífico, para actualizar_stock.py
ROTACION = "rotacion.json"  # generado por ventas_rotacion.py

# Cuántos productos publicar por categoría (nombre exacto como en Contífico).
# Un número = los N que más rotan de esa categoría. None = todos los que tengan
# stock en algún local. CUPOS = None publica todas las categorías completas.
CUPOS = {
    "Consolas": None,
    "Palancas": None,
    "Juegos": None,
    "Accesorios": 25,
}
TOP_VENTAS = 8  # cuántos productos llevan el sticker "Top ventas"

# Palabra clave contenida en el nombre de la bodega en Contífico -> local público.
# Se busca "contenida" porque las bodegas se llaman p. ej. "BODEGA EL CONDADO".
LOCALES = {"SCALA": "scala", "CONDADO": "condado", "PLAZA DEL VALLE": "valle"}


def normalizar(texto):
    sin_tildes = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode("ascii")
    return sin_tildes.strip().upper()


def local_de_bodega(nombre_bodega):
    n = normalizar(nombre_bodega)
    for clave, local in LOCALES.items():
        if clave in n:
            return local
    return None


def slugify(texto):
    s = normalizar(texto).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def precios_con_iva(p):
    """Contífico guarda pvp1 (tarjeta) y pvp2 (efectivo) sin IVA.
    Devuelve (efectivo, tarjeta) con IVA incluido, redondeados a centavos."""
    try:
        iva = 1 + float(p.get("porcentaje_iva") or 0) / 100
        tarjeta = float(p.get("pvp1") or 0) * iva
        efectivo = float(p.get("pvp2") or 0) * iva
    except (TypeError, ValueError):
        return 0.0, 0.0
    return round(efectivo or tarjeta, 2), round(tarjeta or efectivo, 2)


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
    print("Descargando catálogo de productos de Contífico (tarda ~2 minutos)...", flush=True)
    t0 = time.time()
    r = requests.get(f"{BASE_URL}/producto/", headers=HEADERS, timeout=300)
    r.raise_for_status()
    productos = r.json()
    with open(CACHE_PRODUCTOS, "w", encoding="utf-8") as f:
        json.dump(productos, f, ensure_ascii=False)
    print(f"  {len(productos)} productos en {time.time()-t0:.0f}s", flush=True)

    r = requests.get(f"{BASE_URL}/categoria/", headers=HEADERS, timeout=30)
    r.raise_for_status()
    cat_nombre = {c["id"]: c["nombre"] for c in r.json()}

    candidatos = [
        p for p in productos
        if p.get("estado") == "A" and stock_total(p) > 0
        and (CUPOS is None or cat_nombre.get(p.get("categoria_id")) in CUPOS)
    ]
    print(f"Consultando stock por bodega de {len(candidatos)} productos...", flush=True)

    t0 = time.time()
    stock_cache = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for i, (pid, filas) in enumerate(ex.map(lambda p: (p["id"], stock_de_producto(p["id"])), candidatos), start=1):
            stock_cache[pid] = filas
            if i % 100 == 0:
                print(f"  ...{i}/{len(candidatos)} ({time.time()-t0:.0f}s)", flush=True)
    with open(CACHE_STOCK, "w", encoding="utf-8") as f:
        json.dump(stock_cache, f, ensure_ascii=False)
    print(f"Stock por bodega listo en {time.time()-t0:.0f}s", flush=True)

    rotacion = {}
    if os.path.exists(ROTACION):
        with open(ROTACION, encoding="utf-8") as f:
            rotacion = json.load(f)

    salida = []
    for p in candidatos:
        filas = stock_cache.get(p["id"], [])
        stock_local = {"scala": 0, "condado": 0, "valle": 0}
        for fila in filas:
            clave = local_de_bodega(fila.get("bodega_nombre", ""))
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
        efectivo, tarjeta = precios_con_iva(p)
        if efectivo <= 0:
            continue  # sin precio en Contífico: no se puede ofrecer

        rot =rotacion.get(p["id"], {"unidades": 0, "dias": 0})
        salida.append({
            "_rot": (rot["dias"], rot["unidades"], sum(stock_local.values())),
            "_id": p["id"],
            "code": codigo,
            "name": p.get("nombre", "").strip(),
            "cat": slugify(cat_real),
            "cat_label": cat_real,
            "price": efectivo,
            "price_efectivo": efectivo,
            "price_tarjeta": tarjeta,
            "digital": es_tarjeta,
            "stock": None if es_tarjeta else stock_local,
            "photos": [f"fotos/{codigo}/1.jpg", f"fotos/{codigo}/2.jpg", f"fotos/{codigo}/3.jpg"],
            "desc": (p.get("descripcion") or "").strip(),
        })

    con_stock = len(salida)
    # Los que más rotan primero: días con venta, unidades vendidas, stock en locales.
    salida.sort(key=lambda x: x["_rot"], reverse=True)
    if CUPOS is not None:
        elegidos = []
        for cat, cupo in CUPOS.items():
            elegidos += [x for x in salida if x["cat_label"] == cat][:cupo]
        elegidos.sort(key=lambda x: x["_rot"], reverse=True)
        salida = elegidos
    # Sticker "Top ventas" para los más vendidos (sin publicar cifras).
    for i, x in enumerate(salida):
        x["top"] = i < TOP_VENTAS and x["_rot"][1] > 0
    seleccion = {x["code"]: x["_id"] for x in salida}
    # Las cifras de venta son internas: no se publican en el JSON del sitio.
    for x in salida:
        del x["_rot"], x["_id"]
    with open(SELECCION, "w", encoding="utf-8") as f:
        json.dump(seleccion, f, ensure_ascii=False, indent=1)

    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)
    with open(os.path.join(os.path.dirname(SALIDA), "meta.json"), "w", encoding="utf-8") as f:
        json.dump({"actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds")}, f)

    print(f"\n{SALIDA} generado con {len(salida)} productos "
          f"({con_stock} con stock en los locales, de {len(candidatos)} candidatos).")


if __name__ == "__main__":
    main()
