"""Exploración de solo lectura: ver cómo son los productos reales de Contífico
antes de armar el catálogo. No crea ni modifica nada en Contífico."""

import json
import os

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ["CONTIFICO_API_KEY"]
BASE_URL = os.environ["CONTIFICO_BASE_URL"]
HEADERS = {"Authorization": API_KEY}


def get(path, timeout=30, **params):
    r = requests.get(f"{BASE_URL}{path}", headers=HEADERS, params=params, timeout=timeout)
    r.raise_for_status()
    return r.json()


print("=== Intentando /producto/ con página 1 (por si soporta paginación) ===")
try:
    import time
    t0 = time.time()
    data = get("/producto/", timeout=170)
    print(f"(tardó {time.time()-t0:.1f}s)")
    if isinstance(data, dict):
        print("Es un dict con llaves:", list(data.keys()))
        print("count:", data.get("count"))
        print("next:", data.get("next"))
        muestra = data.get("results", [])
    else:
        print(f"Es una lista de {len(data)} elementos (parece que no pagina)")
        muestra = data
    print()
    print("--- Primeros 3 productos, tal cual los devuelve Contífico ---")
    for p in muestra[:3]:
        print(json.dumps(p, indent=2, ensure_ascii=False))
        print("---")

    if muestra:
        primero = muestra[0]
        pid = primero.get("id")
        print()
        print(f"=== Stock por bodega de: {primero.get('nombre')} ({primero.get('codigo')}) id={pid} ===")
        stock = get(f"/producto/{pid}/stock/", timeout=30)
        print(json.dumps(stock, indent=2, ensure_ascii=False))
except Exception as e:
    print("ERROR:", repr(e))
