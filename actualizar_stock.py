"""Actualiza el stock y los precios de los productos ya publicados en
docs/products.json (unas 160 consultas a Contífico, ~15 segundos). La selección
de productos la recalcula generar_catalogo.py una vez al día."""

import concurrent.futures
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

import paginas_producto
from descripciones import completar
from generar_catalogo import (
    BASE_URL, HEADERS, SALIDA, SELECCION, fotos_de, local_de_bodega, precios_con_iva,
    stock_de_producto,
)


HORAS_PARA_AVISAR = 6


def horas_sin_actualizar():
    """Horas desde la última actualización publicada, o None si no se sabe. Se mira la página
    en vivo: el docs/meta.json del repositorio solo cambia una vez al día."""
    try:
        r = requests.get(paginas_producto.SITIO + "meta.json", timeout=15, headers={"Cache-Control": "no-cache"})
        antes = datetime.fromisoformat(r.json()["actualizado"])
        return (datetime.now(timezone.utc) - antes).total_seconds() / 3600
    except (requests.exceptions.RequestException, ValueError, KeyError, TypeError):
        return None


def ficha_de_producto(pid, intentos=3):
    for intento in range(intentos):
        try:
            r = requests.get(f"{BASE_URL}/producto/{pid}/", headers=HEADERS, timeout=20)
            if r.status_code == 200:
                return r.json()
        except requests.exceptions.RequestException:
            pass
        time.sleep(1 + intento)
    return None


def main():
    with open(SALIDA, encoding="utf-8") as f:
        productos = json.load(f)
    with open(SELECCION, encoding="utf-8") as f:
        ids = json.load(f)

    publicados = [p for p in productos if p["code"] in ids]
    for p in productos:
        p["photos"] = fotos_de(p["code"])
    completar(productos)   # estado, origen, lo que incluye y descripción, leídos del nombre

    def consultar(p):
        pid = ids[p["code"]]
        filas = [] if p["digital"] else stock_de_producto(pid)
        return p, ficha_de_producto(pid), filas

    fallidos = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for p, ficha, filas in ex.map(consultar, publicados):
            # Si una consulta falla se conserva el dato anterior en vez de publicar
            # "agotado" o un precio en cero por error.
            if ficha is None or (not p["digital"] and not filas):
                fallidos += 1
            if ficha is not None:
                efectivo, tarjeta = precios_con_iva(ficha)
                if efectivo > 0:
                    p["price"] = p["price_efectivo"] = efectivo
                    p["price_tarjeta"] = tarjeta
            if filas:
                stock = {"scala": 0, "condado": 0, "valle": 0}
                for fila in filas:
                    local = local_de_bodega(fila.get("bodega_nombre", ""))
                    if local:
                        try:
                            stock[local] += int(float(fila.get("cantidad") or 0))
                        except (TypeError, ValueError):
                            pass
                p["stock"] = stock

    if publicados and fallidos == len(publicados):
        # Contífico no respondió. Si es un corte pasajero, la página sigue con el último stock
        # y la próxima corrida (en ~15 minutos) lo actualiza: no se marca como error. Solo si
        # lleva horas sin poder actualizar se da por fallida, porque ahí sí hay que revisar
        # (por ejemplo, la clave de Contífico).
        horas = horas_sin_actualizar()
        if horas is not None and horas < HORAS_PARA_AVISAR:
            print(f"::warning::Contífico no respondió; se mantiene lo publicado hace {horas:.1f} h y se reintenta en la próxima corrida.")
            # Esta vez no se publica (lo de la página en vivo es más nuevo que lo del repositorio).
            if os.environ.get("GITHUB_OUTPUT"):
                with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
                    f.write("publicar=false\n")
            return
        print(f"No se pudo consultar ningún producto en Contífico (sin actualizar hace {'?' if horas is None else f'{horas:.1f}'} h).", file=sys.stderr)
        sys.exit(1)

    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(productos, f, ensure_ascii=False, indent=2)
    with open("docs/meta.json", "w", encoding="utf-8") as f:
        json.dump({"actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds")}, f)
    print(f"Stock y precios actualizados: {len(publicados) - fallidos} productos, {fallidos} con fallas.")
    # Página propia de cada producto (vista previa al compartir y Google), con el stock recién leído.
    paginas_producto.main()


if __name__ == "__main__":
    main()
