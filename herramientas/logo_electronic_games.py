"""Dibuja el logo de Electronic Games en vectores limpios y lo guarda en marca/:
- electronic-games-logo.ai        Adobe Illustrator, logo blanco (como el original)
- electronic-games-logo-negro.ai  Adobe Illustrator, logo negro para fondos claros
- electronic-games-logo.svg       el mismo logo blanco en SVG
- electronic-games-logo.png       2000 x 469 px con fondo transparente, como el original

Todo sale de una sola retícula, así nada queda torcido ni desparejo:
- letras de 100 de alto con trazos de 22.5 (verticales, horizontales y diagonales),
  esquinas redondeadas todas con el mismo radio y la misma letra siempre igual,
- emblema con barras de 38.75, separaciones de 22.5 (lo mismo que el trazo de las
  letras) y una sola inclinación de 35° para todos sus bordes,
- el emblema mide lo mismo que las dos líneas de texto: arriba coincide con el tope
  de ELECTRONIC y abajo con la base de GAMES; su primera separación queda a la altura
  del brazo del medio de la E.

Las medidas están en puntos: el .ai se abre en Illustrator con una mesa de trabajo de
2000 x 469, igual que la imagen original.

Correr:  python herramientas/logo_electronic_games.py
"""

import math
import os

from PIL import Image, ImageChops, ImageDraw

CARPETA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "marca")
ANCHO_MESA, ALTO_MESA = 2000, 469

# ---------- Letras ----------
ALTO = 100            # alto de las mayúsculas
S = 22.5              # trazo (también el de las diagonales, medido en perpendicular)
MEDIO = (38.75, 61.25)  # brazo del medio de E, G y S: centrado, deja huecos iguales
RE = 16               # radio de las esquinas redondeadas por fuera (C, O, G, S, R)
RI = 3                # radio de las esquinas por dentro de esas mismas letras
INTERLINEA = 22.5     # espacio entre ELECTRONIC y GAMES

# ---------- Emblema ----------
INCL = 0.7            # tan(35°): todos los bordes inclinados son paralelos
BARRA = 38.75         # alto de cada barra: 2 barras + 1 separación = alto de una línea
HUECO = S             # separación entre piezas, la misma en horizontal y en diagonal
LARGO = 367           # largo de las barras (sin contar la inclinación)
PIE = 106             # ancho de la pata de la pieza del medio y de la columna de abajo
ESPACIO_TEXTO = BARRA  # distancia entre la punta del emblema y la E


def _diagonal(m):
    """Ancho horizontal de un trazo diagonal de pendiente m (dx/dy) y grosor S."""
    return S * math.sqrt(1 + m * m)


def letra_E(w=84):
    a, b = MEDIO
    return w, [[(0, 0), (w, 0), (w, S), (S, S), (S, a), (54, a), (54, b), (S, b),
                (S, ALTO - S), (w, ALTO - S), (w, ALTO), (0, ALTO)]]


def letra_L(w=84):
    return w, [[(0, 0), (S, 0), (S, ALTO - S), (w, ALTO - S), (w, ALTO), (0, ALTO)]]


def letra_T(w=82):
    c = w / 2
    return w, [[(0, 0), (w, 0), (w, S), (c + S / 2, S), (c + S / 2, ALTO),
                (c - S / 2, ALTO), (c - S / 2, S), (0, S)]]


def letra_I():
    return S, [[(0, 0), (S, 0), (S, ALTO), (0, ALTO)]]


def letra_C(w=94, abre=(35, 65)):
    a, b = abre
    return w, [[(0, 0, RE), (w, 0, RE), (w, a), (w - S, a), (w - S, S, RI), (S, S, RI),
                (S, ALTO - S, RI), (w - S, ALTO - S, RI), (w - S, b), (w, b),
                (w, ALTO, RE), (0, ALTO, RE)]]


def letra_O(w=96):
    return w, [[(0, 0, RE), (w, 0, RE), (w, ALTO, RE), (0, ALTO, RE)],
               [(S, S, RI), (S, ALTO - S, RI), (w - S, ALTO - S, RI), (w - S, S, RI)]]


def letra_G(w=94, barra=44):
    a, b = MEDIO
    return w, [[(0, 0, RE), (w, 0), (w, S), (S, S, RI), (S, ALTO - S, RI),
                (w - S, ALTO - S, RI), (w - S, b, RI), (barra, b), (barra, a), (w, a),
                (w, ALTO, RE), (0, ALTO, RE)]]


def letra_S(w=94):
    a, b = MEDIO
    return w, [[(0, 0, RE), (w, 0), (w, S), (S, S, RI), (S, a, RI), (w, a, RE),
                (w, ALTO, RE), (0, ALTO), (0, ALTO - S), (w - S, ALTO - S, RI),
                (w - S, b, RI), (0, b, RE)]]


def letra_R(w=96, ojo=89.5, base_ojo=65):
    # La pierna sale de la esquina interior del ojo y llega a la base en el borde derecho.
    x_in = ojo - S
    m = (w - x_in) / (ALTO - base_ojo)
    x_pie = w - _diagonal(m)
    x_arr = x_pie - m * (ALTO - base_ojo)
    return w, [[(0, 0), (ojo, 0, RE), (ojo, base_ojo, RE), (x_in, base_ojo), (w, ALTO),
                (x_pie, ALTO), (x_arr, base_ojo), (S, base_ojo, RI), (S, ALTO), (0, ALTO)],
               [(S, S, RI), (S, base_ojo - S, RI), (x_in, base_ojo - S, RI), (x_in, S, RI)]]


def letra_N(w=94):
    # Simétrica al girarla 180°: la diagonal nace en la esquina de cada palo.
    abierto = w - 2 * S
    m = 0.5
    for _ in range(60):  # pendiente con la que la diagonal mide S de grosor
        m = (abierto + _diagonal(m)) / ALTO
    y1 = abierto / m             # donde la diagonal toca el palo derecho
    y2 = ALTO - abierto / m      # donde toca el palo izquierdo
    return w, [[(0, 0), (S, 0), (w - S, y1), (w - S, 0), (w, 0), (w, ALTO), (w - S, ALTO),
                (S, y2), (S, ALTO), (0, ALTO)]]


def letra_M(w=107, fondo=MEDIO[1]):
    c = w / 2
    m = (c - S) / fondo           # la V baja hasta la altura del brazo de la E
    d = _diagonal(m)
    medio_pie = c - S - m * ALTO + d
    y_palo = d / m
    return w, [[(0, 0), (S, 0), (c, fondo), (w - S, 0), (w, 0), (w, ALTO), (w - S, ALTO),
                (w - S, y_palo), (c + medio_pie, ALTO), (c - medio_pie, ALTO), (S, y_palo),
                (S, ALTO), (0, ALTO)]]


def letra_A(w=104, barra=(MEDIO[1], MEDIO[1] + S)):
    c = w / 2
    m = (c - S / 2) / ALTO       # punta plana del ancho de un trazo
    d = _diagonal(m)
    izq = lambda y: c - S / 2 - m * y + d   # borde interior de la pierna izquierda
    y_punta = (2 * d - S) / (2 * m)
    b0, b1 = barra
    return w, [[(c - S / 2, 0), (c + S / 2, 0), (w, ALTO), (w - d, ALTO), (w - izq(b1), b1),
                (izq(b1), b1), (d, ALTO), (0, ALTO)],
               [(c, y_punta), (izq(b0), b0), (w - izq(b0), b0)]]


LETRAS = {"E": letra_E, "L": letra_L, "T": letra_T, "I": letra_I, "C": letra_C,
          "O": letra_O, "G": letra_G, "S": letra_S, "R": letra_R, "N": letra_N,
          "M": letra_M, "A": letra_A}

# Espacio a cada lado de cada letra: 7 junto a un palo recto y menos donde la letra ya
# deja aire (esquinas redondas, lados abiertos, diagonales), para que se vean parejas.
LADOS = {"E": (7, 5.5), "L": (7, 3.5), "T": (4.5, 4.5), "I": (7, 7), "C": (6, 5),
         "O": (6, 6), "G": (6, 6), "S": (6, 6), "R": (7, 2), "N": (7, 7), "M": (7, 7),
         "A": (1.5, 1.5)}


def emblema():
    """Las tres piezas del emblema, ya inclinadas, con la esquina inferior izquierda en (0, 0)
    y la y hacia abajo (alto total: 2 líneas de texto + interlínea)."""
    y = [0, BARRA]
    for _ in range(3):
        y += [y[-1] + HUECO, y[-1] + HUECO + BARRA]
    canal = _diagonal(INCL) * HUECO / S  # el canal inclinado mide HUECO en perpendicular
    piezas = [
        [(0, y[0]), (LARGO, y[0]), (LARGO, y[1]), (0, y[1])],
        [(0, y[2]), (LARGO, y[2]), (LARGO, y[3]), (PIE, y[3]), (PIE, y[5]), (0, y[5])],
        [(PIE + canal, y[4]), (LARGO, y[4]), (LARGO, y[7]), (0, y[7]), (0, y[6]),
         (LARGO - PIE, y[6]), (LARGO - PIE, y[5]), (PIE + canal, y[5])],
    ]
    alto = y[7]
    return [[[(u + INCL * (alto - v), v) for u, v in p]] for p in piezas], LARGO + INCL * alto, alto


# ---------- Caminos con esquinas redondeadas ----------

def _area(puntos):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(puntos, puntos[1:] + puntos[:1])) / 2


def camino(vertices, dx=0.0, dy=0.0, agujero=False):
    """Convierte vértices (x, y[, radio]) en comandos M/L/C/Z con arcos exactos en las
    esquinas que llevan radio. Los agujeros van en sentido contrario al contorno."""
    v = [(p[0], p[1], p[2] if len(p) > 2 else 0) for p in vertices]
    if (_area([p[:2] for p in v]) < 0) != agujero:
        v.reverse()
    n = len(v)
    tramos = []
    for i in range(n):
        x, y, r = v[i]
        if not r:
            tramos.append(("P", (x, y)))
            continue
        ax, ay = v[i - 1][:2]
        bx, by = v[(i + 1) % n][:2]
        u1 = (ax - x, ay - y)
        u2 = (bx - x, by - y)
        l1, l2 = math.hypot(*u1), math.hypot(*u2)
        u1 = (u1[0] / l1, u1[1] / l1)
        u2 = (u2[0] / l2, u2[1] / l2)
        giro = math.pi - math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])))
        t = r * math.tan(giro / 2)
        h = 4 / 3 * math.tan(giro / 4) * r
        p0 = (x + u1[0] * t, y + u1[1] * t)
        p3 = (x + u2[0] * t, y + u2[1] * t)
        tramos.append(("A", p0, (p0[0] - u1[0] * h, p0[1] - u1[1] * h),
                       (p3[0] - u2[0] * h, p3[1] - u2[1] * h), p3))
    cmds = []
    for k, t in enumerate(tramos):
        inicio = t[1]
        cmds.append(("M" if k == 0 else "L", inicio))
        if t[0] == "A":
            cmds.append(("C", t[2], t[3], t[4]))
    cmds.append(("Z",))
    return [(c[0],) + tuple((p[0] + dx, p[1] + dy) for p in c[1:]) for c in cmds]


def armar():
    """Devuelve las figuras del logo centrado en la mesa de trabajo:
    [(nombre, grupo, [contorno, ...])], cada contorno como lista de comandos."""
    piezas, ancho_emb, alto_emb = emblema()
    lineas = ["ELECTRONIC", "GAMES"]
    glifos = {k: f() for k, f in LETRAS.items()}

    def ancho_linea(texto):
        total = sum(glifos[ch][0] for ch in texto)
        return total + sum(LADOS[a][1] + LADOS[b][0] for a, b in zip(texto, texto[1:]))

    x_texto = ancho_emb + ESPACIO_TEXTO
    ancho_total = x_texto + max(ancho_linea(t) for t in lineas)
    assert abs(alto_emb - (2 * ALTO + INTERLINEA)) < 1e-9
    x0 = round((ANCHO_MESA - ancho_total) / 2, 3)
    y0 = round((ALTO_MESA - alto_emb) / 2, 3)

    figuras = []
    for i, pieza in enumerate(piezas, 1):
        figuras.append((f"Emblema {i}", "Emblema", [camino(pieza[0], x0, y0)]))
    for n, texto in enumerate(lineas):
        x = x0 + x_texto
        y = y0 + n * (ALTO + INTERLINEA)
        for k, ch in enumerate(texto):
            w, contornos = glifos[ch]
            figuras.append((f"{k + 1} {ch}", texto,
                            [camino(c, x, y, agujero=j > 0) for j, c in enumerate(contornos)]))
            if k + 1 < len(texto):
                x += w + LADOS[ch][1] + LADOS[texto[k + 1]][0]
    return figuras


# ---------- Archivos ----------

def _n(v):
    s = f"{v:.3f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def guardar_svg(ruta, figuras, color="#FFFFFF"):
    grupos = {}
    for nombre, grupo, contornos in figuras:
        d = " ".join(c[0] + " " + " ".join(f"{_n(x)} {_n(y)}" for x, y in c[1:]) if c[0] != "Z" else "Z"
                     for cont in contornos for c in cont)
        grupos.setdefault(grupo, []).append(f'    <path id="{grupo}-{nombre.replace(" ", "-")}" d="{d}"/>')
    cuerpo = "\n".join(f'  <g id="{g}">\n' + "\n".join(p) + "\n  </g>" for g, p in grupos.items())
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<svg xmlns="http://www.w3.org/2000/svg" width="{ANCHO_MESA}" height="{ALTO_MESA}" '
                f'viewBox="0 0 {ANCHO_MESA} {ALTO_MESA}">\n'
                f'<title>Electronic Games</title>\n'
                f'<g fill="{color}" fill-rule="evenodd">\n{cuerpo}\n</g>\n</svg>\n')


def guardar_ai(ruta, figuras, rgb=(1, 1, 1)):
    """Archivo .ai compatible con PDF (el formato que usa Illustrator desde la versión CS):
    cada letra y cada pieza del emblema es un trazado editable, sin máscaras ni imágenes."""
    lineas = ["%s %s %s rg" % tuple(_n(c) for c in rgb)]
    for _, _, contornos in figuras:
        for cont in contornos:
            for c in cont:
                pts = " ".join(f"{_n(x)} {_n(ALTO_MESA - y)}" for x, y in c[1:])
                lineas.append({"M": f"{pts} m", "L": f"{pts} l", "C": f"{pts} c", "Z": "h"}[c[0]])
        lineas.append("f*")
    contenido = ("\n".join(lineas) + "\n").encode("ascii")
    caja = f"[0 0 {ANCHO_MESA} {ALTO_MESA}]"
    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (f"<< /Type /Page /Parent 2 0 R /MediaBox {caja} /CropBox {caja} /TrimBox {caja} "
         f"/ArtBox {caja} /Resources << >> /Contents 4 0 R >>").encode("ascii"),
        f"<< /Length {len(contenido)} >>\nstream\n".encode("ascii") + contenido + b"endstream",
        b"<< /Title (Electronic Games - Logo) /Creator (herramientas/logo_electronic_games.py) >>",
    ]
    salida = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
    posiciones = []
    for i, obj in enumerate(objetos, 1):
        posiciones.append(len(salida))
        salida += f"{i} 0 obj\n".encode("ascii") + obj + b"\nendobj\n"
    xref = len(salida)
    salida += f"xref\n0 {len(objetos) + 1}\n0000000000 65535 f \n".encode("ascii")
    salida += b"".join(f"{p:010d} 00000 n \n".encode("ascii") for p in posiciones)
    salida += (f"trailer\n<< /Size {len(objetos) + 1} /Root 1 0 R /Info 5 0 R >>\n"
               f"startxref\n{xref}\n%%EOF\n").encode("ascii")
    with open(ruta, "wb") as f:
        f.write(salida)


def _poligono(cont, escala, pasos=24):
    pts = []
    for c in cont:
        if c[0] in "ML":
            pts.append(c[1])
        elif c[0] == "C":
            p0, (p1, p2, p3) = pts[-1], c[1:]
            for k in range(1, pasos + 1):
                t = k / pasos
                a, b, cc, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
                pts.append((a * p0[0] + b * p1[0] + cc * p2[0] + d * p3[0],
                            a * p0[1] + b * p1[1] + cc * p2[1] + d * p3[1]))
    return [(x * escala, y * escala) for x, y in pts]


def mascara(figuras, escala=1, suavizado=4):
    """Dibuja el logo como máscara en escala de grises (255 = tinta), con bordes suaves."""
    e = escala * suavizado
    tam = (round(ANCHO_MESA * e), round(ALTO_MESA * e))
    total = Image.new("1", tam, 0)
    for _, _, contornos in figuras:
        for cont in contornos:
            capa = Image.new("1", tam, 0)
            ImageDraw.Draw(capa).polygon(_poligono(cont, e), fill=1)
            total = ImageChops.logical_xor(total, capa)
    return total.convert("L").resize((round(ANCHO_MESA * escala), round(ALTO_MESA * escala)), Image.BOX)


def guardar_png(ruta, figuras, color=(255, 255, 255)):
    alfa = mascara(figuras)
    img = Image.new("RGBA", alfa.size, color + (0,))
    img.putalpha(alfa)
    img.save(ruta, optimize=True)


def main():
    os.makedirs(CARPETA, exist_ok=True)
    figuras = armar()
    base = os.path.join(CARPETA, "electronic-games-logo")
    guardar_ai(base + ".ai", figuras)
    guardar_ai(base + "-negro.ai", figuras, rgb=(0, 0, 0))
    guardar_svg(base + ".svg", figuras)
    guardar_png(base + ".png", figuras)
    print("Listo:", ", ".join(os.path.basename(base) + s for s in (".ai", "-negro.ai", ".svg", ".png")))


if __name__ == "__main__":
    main()
