"""Analiza el catálogo completo: cuántos productos quedan si filtramos por
'activo' (estado A) y con stock real (cantidad_stock > 0), agrupados por
categoría. Solo lectura, no modifica nada. Guarda un cache local en
productos_raw.json para no tener que volver a esperar ~2 minutos cada vez."""

import json
import os
import time
from collections import Counter

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.environ["CONTIFICO_API_KEY"]
BASE_URL = os.environ["CONTIFICO_BASE_URL"]
HEADERS = {"Authorization": API_KEY}

CACHE = "productos_raw.json"

if os.path.exists(CACHE):
    print(f"Usando cache local {CACHE}...")
    with open(CACHE, encoding="utf-8") as f:
        productos = json.load(f)
else:
    print("Pidiendo /producto/ completo (puede tardar ~2 minutos)...")
    t0 = time.time()
    r = requests.get(f"{BASE_URL}/producto/", headers=HEADERS, timeout=180)
    r.raise_for_status()
    productos = r.json()
    print(f"Listo en {time.time()-t0:.1f}s, {len(productos)} productos. Guardando cache...")
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(productos, f, ensure_ascii=False)

r = requests.get(f"{BASE_URL}/categoria/", headers=HEADERS, timeout=30)
r.raise_for_status()
cat_nombre = {c["id"]: c["nombre"] for c in r.json()}


def stock(p):
    try:
        return float(p.get("cantidad_stock") or 0)
    except (TypeError, ValueError):
        return 0.0


activos_con_stock = [p for p in productos if p.get("estado") == "A" and stock(p) > 0]
activos_sin_stock = [p for p in productos if p.get("estado") == "A" and stock(p) <= 0]
inactivos = [p for p in productos if p.get("estado") != "A"]

print()
print(f"Total productos:              {len(productos)}")
print(f"Activos CON stock (>0):       {len(activos_con_stock)}")
print(f"Activos SIN stock:            {len(activos_sin_stock)}")
print(f"Inactivos (estado != 'A'):    {len(inactivos)}")

print()
print("=== Activos con stock, por categoría (de mayor a menor) ===")
conteo = Counter(cat_nombre.get(p.get("categoria_id"), "SIN CATEGORÍA") for p in activos_con_stock)
for nombre, n in conteo.most_common(76):
    print(f"  {n:5d}  {nombre}")
