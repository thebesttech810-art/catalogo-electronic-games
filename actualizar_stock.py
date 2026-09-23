"""Actualiza solo el stock de los productos ya publicados en docs/products.json
(unas 80 consultas a Contífico, ~10 segundos). La selección de productos y los
precios los recalcula generar_catalogo.py una vez al día."""

import concurrent.futures
import json
import sys
from datetime import datetime, timezone

from generar_catalogo import SALIDA, SELECCION, local_de_bodega, stock_de_producto


def main():
    with open(SALIDA, encoding="utf-8") as f:
        productos = json.load(f)
    with open(SELECCION, encoding="utf-8") as f:
        ids = json.load(f)

    fisicos = [p for p in productos if not p["digital"] and p["code"] in ids]

    def consultar(p):
        return p, stock_de_producto(ids[p["code"]])

    fallidos = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for p, filas in ex.map(consultar, fisicos):
            # Contífico siempre devuelve una fila por bodega: vacío = la consulta falló,
            # y se conserva el stock anterior en vez de mostrar "agotado" por error.
            if not filas:
                fallidos += 1
                continue
            stock = {"scala": 0, "condado": 0, "valle": 0}
            for fila in filas:
                local = local_de_bodega(fila.get("bodega_nombre", ""))
                if local:
                    try:
                        stock[local] += int(float(fila.get("cantidad") or 0))
                    except (TypeError, ValueError):
                        pass
            p["stock"] = stock

    if fisicos and fallidos == len(fisicos):
        print("No se pudo consultar ningún producto en Contífico.", file=sys.stderr)
        sys.exit(1)

    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(productos, f, ensure_ascii=False, indent=2)
    with open("docs/meta.json", "w", encoding="utf-8") as f:
        json.dump({"actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds")}, f)
    print(f"Stock actualizado: {len(fisicos) - fallidos} productos, {fallidos} fallidos.")


if __name__ == "__main__":
    main()
