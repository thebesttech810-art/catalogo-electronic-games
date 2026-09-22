"""Calcula la rotación de cada producto: unidades vendidas en los últimos N días,
a partir de las facturas de venta de Contífico. Solo lectura.
Guarda cada día consultado en ventas_cache/ para no repetir llamadas, y el
resultado agregado en rotacion.json ({producto_id: {"unidades": x, "dias": y}})."""

import concurrent.futures
import json
import os
import sys
from datetime import date, timedelta

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.environ["CONTIFICO_API_KEY"]
BASE_URL = os.environ["CONTIFICO_BASE_URL"]
HEADERS = {"Authorization": API_KEY}

DIAS = int(sys.argv[1]) if len(sys.argv) > 1 else 30
CACHE_DIR = "ventas_cache"
SALIDA = "rotacion.json"


def ventas_del_dia(d):
    ruta = os.path.join(CACHE_DIR, f"{d.isoformat()}.json")
    # El día de hoy no se cachea porque todavía puede tener ventas nuevas.
    if d != date.today() and os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)

    for intento in range(3):
        try:
            r = requests.get(
                f"{BASE_URL}/registro/documento/",
                headers=HEADERS,
                params={"tipo_registro": "CLI", "tipo": "FAC", "fecha_emision": d.strftime("%d/%m/%Y")},
                timeout=90,
            )
            if r.status_code == 200:
                data = r.json()
                docs = data.get("data", []) if isinstance(data, dict) else data
                lineas = [
                    {"producto_id": it.get("producto_id"), "cantidad": float(it.get("cantidad") or 0)}
                    for doc in docs if not doc.get("anulado")
                    for it in doc.get("detalles", [])
                    if it.get("producto_id")
                ]
                if d != date.today():
                    with open(ruta, "w", encoding="utf-8") as f:
                        json.dump(lineas, f)
                return lineas
        except requests.exceptions.RequestException:
            pass
    print(f"  ! No se pudo obtener {d}", flush=True)
    return []


def main():
    os.makedirs(CACHE_DIR, exist_ok=True)
    hoy = date.today()
    dias = [hoy - timedelta(days=i) for i in range(DIAS)]

    rotacion = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        for d, lineas in zip(dias, ex.map(ventas_del_dia, dias)):
            print(f"  {d}: {len(lineas)} líneas vendidas", flush=True)
            vistos_hoy = set()
            for ln in lineas:
                r = rotacion.setdefault(ln["producto_id"], {"unidades": 0.0, "dias": 0})
                r["unidades"] += ln["cantidad"]
                if ln["producto_id"] not in vistos_hoy:
                    r["dias"] += 1
                    vistos_hoy.add(ln["producto_id"])

    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(rotacion, f)
    print(f"\n{len(rotacion)} productos distintos vendidos en los últimos {DIAS} días -> {SALIDA}")


if __name__ == "__main__":
    main()
