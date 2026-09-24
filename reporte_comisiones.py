"""Revisa las facturas de Contífico de los últimos N días y separa las que traen
el código del catálogo (EG-XXXXXX) en el campo "Referencia" de la factura.
Con eso arma un Excel con la lista y el total de comisión a cobrar.

Cómo se usa en Contífico: cuando el vendedor factura un pedido que llegó por el
catálogo web, pega el código que trae el mensaje de WhatsApp (por ejemplo
"EG-NFLI8X") en el campo "Referencia" de la factura. Si no se pega el código,
esta factura no se puede identificar como venta del catálogo.

Solo lee datos, no escribe nada en Contífico. No sube nada a internet:
el Excel se queda en esta carpeta (comisiones.xlsx, está en .gitignore).
"""

import concurrent.futures
import os
import sys
from datetime import date, timedelta

import requests
from dotenv import load_dotenv
from openpyxl import Workbook
from openpyxl.styles import Font

load_dotenv()
API_KEY = os.environ["CONTIFICO_API_KEY"]
BASE_URL = os.environ["CONTIFICO_BASE_URL"]
HEADERS = {"Authorization": API_KEY}

DIAS = int(sys.argv[1]) if len(sys.argv) > 1 else 30
TASA_COMISION = 0.05  # <- cambia este número: 0.05 = 5%. Pídele a Edu que confirme el %.
PREFIJO = "EG-"
CACHE_DIR = "ventas_cache"
SALIDA = "comisiones.xlsx"


def facturas_del_dia(d):
    ruta = os.path.join(CACHE_DIR, f"{d.isoformat()}.raw.json")
    if d != date.today() and os.path.exists(ruta):
        import json
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)

    for _ in range(3):
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
                out = [
                    {
                        "fecha": d.isoformat(),
                        "referencia": (doc.get("referencia") or "").strip(),
                        "descripcion": (doc.get("descripcion") or "").strip(),
                        "documento": doc.get("documento"),
                        "total": float(doc.get("total") or 0),
                        "local": (doc.get("pos") or {}).get("nombre") if isinstance(doc.get("pos"), dict) else doc.get("pos"),
                    }
                    for doc in docs if not doc.get("anulado")
                ]
                if d != date.today():
                    import json
                    os.makedirs(CACHE_DIR, exist_ok=True)
                    with open(ruta, "w", encoding="utf-8") as f:
                        json.dump(out, f)
                return out
        except requests.exceptions.RequestException:
            pass
    print(f"  ! No se pudo obtener {d}", flush=True)
    return []


def main():
    hoy = date.today()
    dias = [hoy - timedelta(days=i) for i in range(DIAS)]

    encontradas = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        for d, facturas in zip(dias, ex.map(facturas_del_dia, dias)):
            for f in facturas:
                texto = f"{f['referencia']} {f['descripcion']}".upper()
                if PREFIJO in texto:
                    encontradas.append(f)
            print(f"  {d}: revisadas", flush=True)

    wb = Workbook()
    ws = wb.active
    ws.title = "Comisiones"
    ws.append(["Fecha", "Local", "Documento", "Referencia", "Total factura", f"Comisión ({TASA_COMISION:.0%})"])
    for c in ws[1]:
        c.font = Font(bold=True)

    total_ventas = 0.0
    for f in sorted(encontradas, key=lambda x: x["fecha"]):
        comision = f["total"] * TASA_COMISION
        total_ventas += f["total"]
        ws.append([f["fecha"], f["local"], f["documento"], f["referencia"] or f["descripcion"], f["total"], round(comision, 2)])

    fila_total = ws.max_row + 2
    ws.cell(fila_total, 4, "TOTAL").font = Font(bold=True)
    ws.cell(fila_total, 5, round(total_ventas, 2)).font = Font(bold=True)
    ws.cell(fila_total, 6, round(total_ventas * TASA_COMISION, 2)).font = Font(bold=True)

    for col, ancho in zip("ABCDEF", (12, 16, 12, 16, 14, 16)):
        ws.column_dimensions[col].width = ancho

    wb.save(SALIDA)
    print(f"\n{len(encontradas)} facturas con código del catálogo en los últimos {DIAS} días.")
    print(f"Total vendido: ${total_ventas:.2f}  ->  Comisión ({TASA_COMISION:.0%}): ${total_ventas * TASA_COMISION:.2f}")
    print(f"Reporte guardado en {SALIDA}")


if __name__ == "__main__":
    main()
