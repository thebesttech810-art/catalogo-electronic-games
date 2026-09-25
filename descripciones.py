"""Descripción y datos de cada producto sacados de su nombre en Contífico.

Contífico no trae descripciones, pero el nombre sí dice mucho: qué es, para qué
consola, si es original o genérico, si es de medio uso y, en los combos, qué
incluye. Aquí se lee eso (sin inventar nada que el nombre no diga) y se agrega a
cada producto de docs/products.json:
  estado     "medio-uso" o ""                    (la etiqueta "Medio uso" y su filtro)
  origen     "original", "generico" o ""         (las etiquetas y el filtro por origen)
  incluye    ["palanca PS4 genérica", ...]       (solo combos de consola)
  desc_auto  texto corto para la ficha y Google (si Contífico trae "desc", manda ese)

La usan actualizar_stock.py (cada 15 minutos, antes de publicar) y paginas_producto.py."""

import re

# Consolas que se nombran en la descripción, de la más específica a la más general
# (misma idea que CONFIG.plataformas en index.html).
CONSOLAS = [
    # (?<![\w-]): "HS-PS5" es un código de modelo, no quiere decir que sea para PS5.
    ("PlayStation Portal", r"PS ?PORTAL|PLAYSTATION PORTAL"),
    ("PS5", r"(?<![\w-])PS5\b|PLAYSTATION 5"), ("PS4", r"(?<![\w-])PS4\b|PLAYSTATION 4"), ("PS3", r"(?<![\w-])PS3\b"),
    ("PS2", r"(?<![\w-])PS2\b"), ("PSP", r"\bPSP\b"), ("PS Vita", r"\bVITA\b"),
    ("Nintendo Switch 2", r"SWI[CT]{2}H ?2"), ("Nintendo Switch", r"SWI[CT]{2}H"), ("Wii U", r"\bWII ?U\b"),
    ("Wii", r"\bWII\b"), ("Nintendo 3DS", r"\b3DS\b"), ("Game Boy", r"GAME ?BOY"),
    ("Xbox Series", r"XBOX SERIES"), ("Xbox One", r"XBOX ONE"), ("Xbox 360", r"XBOX 360"), ("Xbox", r"XBOX"),
    ("Nintendo", r"NINTENDO"), ("PC", r"\bPC\b|WINDOWS"), ("Steam Deck", r"STEAM DECK"), ("iPhone", r"IPHONE"),
]
# Si aparece la específica, la general sobra ("Xbox 360" ya dice "Xbox").
CUBRE = {"Nintendo Switch 2": {"Nintendo Switch", "Nintendo"}, "Nintendo Switch": {"Nintendo"}, "Wii U": {"Wii", "Nintendo"},
         "Wii": {"Nintendo"}, "Nintendo 3DS": {"Nintendo"}, "Game Boy": {"Nintendo"},
         "Xbox Series": {"Xbox"}, "Xbox One": {"Xbox"}, "Xbox 360": {"Xbox"}}
RETRO = r"\bR36|MINI GAME|GAME ?STICK|CONSOLA SUP\b|\bX9\b|ATARI|RETRO|ARCADE"
FRANQUICIAS = [("POKEMON", "Pokémon"), ("HARRY", "Harry Potter"), ("HOGWARTS", "Harry Potter"), ("NARUTO", "Naruto"), ("ZELDA", "Zelda"),
               ("MARIO", "Mario"), ("SONIC", "Sonic"), ("MINECRAFT", "Minecraft"), ("SPIDER", "Spider-Man"),
               ("DRAGON BALL", "Dragon Ball"), ("UMBREON", "Pokémon"), ("PIKACHU", "Pokémon")]
USADO = r"MEDIO USO|\bUSAD[OA]S?\b"


def consolas_de(texto):
    halladas = []
    for nombre, patron in CONSOLAS:
        if re.search(patron, texto) and nombre not in halladas:
            halladas.append(nombre)
    sobran = set().union(*(CUBRE.get(n, set()) for n in halladas))
    return [n for n in halladas if n not in sobran]


def lista(cosas):
    return cosas[0] if len(cosas) == 1 else ", ".join(cosas[:-1]) + " y " + cosas[-1]


def parte_legible(texto):
    """'PALANCA PS4 GENERICA' -> 'palanca PS4 genérica' (para la lista de lo que incluye)."""
    t = re.sub(r"\s+", " ", texto).strip(" -+").lower()
    femenino = t.startswith("palanca")
    for a, b in [("generic[oa]", "genérica" if femenino else "genérico"), ("usad[oa]", "usada" if femenino else "usado"),
                 ("medio uso", "de medio uso"), ("hdmi", "HDMI"), ("kinect", "Kinect"), ("xbox", "Xbox"), ("dj hero", "DJ Hero")]:
        t = re.sub(rf"\b{a}\b", b, t)
    t = re.sub(r"\b(ps\d|psp|tb|gb)\b", lambda m: m.group(1).upper(), t)
    t = re.sub(r"\b(\d+)(tb|gb)\b", lambda m: m.group(1) + m.group(2).upper(), t)
    return t


def detalles(p):
    """Devuelve estado, origen, incluye y desc_auto de un producto."""
    nombre = re.sub(r"\s+", " ", p.get("name", "")).upper()
    nombre = re.sub(r"-C\b", "", nombre)
    cat = p.get("cat", "")
    # En un combo ("CONSOLA PS4 + PALANCA GENERICA + ...") el estado y el origen son los de lo
    # primero que se nombra: una palanca genérica no vuelve genérica a la consola.
    partes = [x.strip() for x in nombre.split("+") if x.strip()] if cat == "consolas" else [nombre]
    principal = partes[0] if partes else nombre
    estado = "medio-uso" if re.search(USADO, principal) else ""
    origen = "original" if re.search(r"\bORIGINAL(ES)?\b", principal) else "generico" if re.search(r"GENERIC[OA]S?\b", principal) else ""
    incluye = [parte_legible(x) for x in partes[1:]]
    consolas = consolas_de(nombre)
    para = lista(consolas) if consolas else ""

    frases = []
    if cat == "juegos":
        if "JUEGO DE MESA" in nombre:
            frases.append("Juego de mesa.")
        elif not nombre.startswith("JUEGO") or not para:
            pass   # algo que no es un videojuego (o sin consola en el nombre): mejor no decir nada
        elif p.get("digital"):
            frases.append(f"Código digital{' para ' + para if para else ''}: te lo enviamos por WhatsApp al confirmar el pago.")
        else:
            frases.append(f"Juego físico{' para ' + para if para else ''}.")
    elif cat == "palancas":
        tipo = "Control original" if origen == "original" else "Control genérico (no es de la marca)" if origen == "generico" else "Control"
        conexion = " inalámbrico" if re.search(r"INALAMBRIC|WIRELESS", nombre) else " con cable" if "CON CABLE" in nombre else ""
        frases.append(f"{tipo}{conexion}{', compatible con ' if origen == 'generico' else ' para '}{para}." if para else f"{tipo}{conexion}.")
    elif cat == "consolas":
        base = consolas_de(principal)
        if "PlayStation Portal" in base:
            frases.append("PlayStation Portal: reproductor remoto para jugar tu PS5 desde otra pantalla.")
        elif base:
            frases.append(f"Consola {lista(base)}{', original' if origen == 'original' else ''}.")
        elif re.search(RETRO, nombre):
            frases.append("Consola retro." if "PORTATIL" not in nombre and "R36" not in nombre else "Consola retro portátil.")
        else:
            frases.append("Consola.")
        if incluye:
            frases.append(f"Incluye {lista(incluye)}.")
    else:
        franquicia = next((b for a, b in FRANQUICIAS if a in nombre), "")
        if para:
            frases.append(f"Accesorio{' original' if origen == 'original' else ' genérico' if origen == 'generico' else ''} compatible con {para}.")
        elif franquicia:
            frases.append(f"Artículo de {franquicia} para coleccionar o regalar.")
    if estado:
        frases.append("Es de medio uso (no es nuevo).")
    return {"estado": estado, "origen": origen, "incluye": incluye, "desc_auto": " ".join(frases)}


def completar(productos):
    for p in productos:
        p.update(detalles(p))
    return productos


if __name__ == "__main__":
    import json
    import sys
    with open(sys.argv[1] if len(sys.argv) > 1 else "docs/products.json", encoding="utf-8") as f:
        for p in json.load(f):
            d = detalles(p)
            print(f"{p['cat'][:4]} | {p['name'][:60]:60} | {d['estado']:9} | {d['origen']:8} | {d['desc_auto']}")
