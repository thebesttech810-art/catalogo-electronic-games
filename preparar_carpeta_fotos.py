"""Arma la carpeta "FOTOS CATALOGO" para la persona que toma las fotos:
una subcarpeta por categoría y, dentro, una por producto, llamada
"NNN - CÓDIGO - NOMBRE" (NNN = prioridad: lo que más se vende primero).
También genera "LISTA DE PRODUCTOS.xlsx" con dónde encontrar cada producto.

Se puede volver a correr cuando entren productos nuevos: solo agrega las
carpetas que falten, nunca borra nada."""

import json
import os
import re
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from generar_catalogo import CUPOS, SALIDA, fotos_de

CARPETA = sys.argv[1] if len(sys.argv) > 1 else "FOTOS CATALOGO"
LOCALES = [("condado", "Condado"), ("scala", "Scala"), ("valle", "Plaza del Valle")]


def nombre_seguro(texto, largo=70):
    limpio = re.sub(r'[\\/:*?"<>|]+', "-", texto)
    limpio = re.sub(r"\s+", " ", limpio).strip(" .-")
    return limpio[:largo].rstrip(" .-")


def main():
    with open(SALIDA, encoding="utf-8") as f:
        productos = json.load(f)

    orden = list(CUPOS) if CUPOS else sorted({p["cat_label"] for p in productos})
    orden += sorted({p["cat_label"] for p in productos} - set(orden))

    filas, nuevas = [], 0
    for n_cat, cat in enumerate(orden, start=1):
        carpeta_cat = os.path.join(CARPETA, f"{n_cat}. {nombre_seguro(cat)}")
        de_cat = [p for p in productos if p["cat_label"] == cat]
        for rank, p in enumerate(de_cat, start=1):
            nombre = f"{rank:03d} - {p['code']} - {nombre_seguro(p['name'])}"
            ruta = os.path.join(carpeta_cat, nombre)
            if not os.path.isdir(ruta):
                os.makedirs(ruta)
                nuevas += 1
            stock = p.get("stock") or {}
            donde = ", ".join(f"{etq} ({stock[k]})" for k, etq in LOCALES if stock.get(k))
            filas.append([
                rank, cat, p["code"], p["name"], p["price_efectivo"],
                donde or ("Digital" if p.get("digital") else "Sin stock"),
                "Sí" if fotos_de(p["code"]) else "", nombre,
            ])

    wb = Workbook()
    ws = wb.active
    ws.title = "Productos"
    encabezados = ["Prioridad", "Categoría", "Código", "Producto", "Precio",
                   "Dónde está (unidades)", "¿Ya tiene foto en la web?", "Nombre de la carpeta"]
    ws.append(encabezados)
    for fila in filas:
        ws.append(fila)

    naranja = PatternFill("solid", fgColor="FF7A00")
    for celda in ws[1]:
        celda.font = Font(bold=True, color="000000")
        celda.fill = naranja
        celda.alignment = Alignment(vertical="center", wrap_text=True)
    for celda in ws["E"][1:]:
        celda.number_format = '"$"#,##0.00'
    anchos = [10, 13, 22, 60, 10, 34, 14, 80]
    for i, ancho in enumerate(anchos, start=1):
        ws.column_dimensions[get_column_letter(i)].width = ancho
    ws.row_dimensions[1].height = 32
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions

    os.makedirs(CARPETA, exist_ok=True)
    wb.save(os.path.join(CARPETA, "LISTA DE PRODUCTOS.xlsx"))
    print(f"{CARPETA}: {len(filas)} productos, {nuevas} carpetas nuevas creadas.")


if __name__ == "__main__":
    main()
