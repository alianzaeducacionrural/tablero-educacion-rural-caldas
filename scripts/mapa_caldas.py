#!/usr/bin/env python3
"""Genera src/data/caldas.json: los 27 municipios de Caldas con sus contornos, simplificados para la web.

Dos fuentes públicas, ambas derivadas del Marco Geoestadístico Nacional del DANE:
  - MGN 2018 (caticoa3/colombia_mapa): solo para saber cuáles son los 27 municipios de Caldas (código 17) y su nombre.
  - geoBoundaries COL-ADM2 2020 (CC BY 4.0): los contornos, con ~220 puntos por municipio.

Uso: python scripts/mapa_caldas.py [tosco.geojson detallado.geojson]
"""
import json
import sys
import unicodedata
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = Path(__file__).resolve().parent.parent
URL_TOSCO = "https://raw.githubusercontent.com/caticoa3/colombia_mapa/master/co_2018_MGN_MPIO_POLITICO.geojson"
URL_DETALLE = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/COL/ADM2/geoBoundaries-COL-ADM2_simplified.geojson"
TOLERANCIA = 0.0005  # grados (~55 m): invisible a escala de departamento
NOMBRES = {"SAN JOSÉ": "San José", "LA DORADA": "La Dorada", "LA MERCED": "La Merced"}


def plegar(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def titulo(n):
    return NOMBRES.get(n) or " ".join(w.capitalize() for w in n.split())


def cargar(arg, url):
    if arg:
        return json.loads(Path(arg).read_text(encoding="utf-8"))
    return json.loads(urllib.request.urlopen(url, timeout=180).read().decode("utf-8"))


def poligonos(f):
    g = f["geometry"]
    return g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]


def centro(f):
    xs, ys = [], []
    for poli in poligonos(f):
        for x, y in poli[0]:
            xs.append(x)
            ys.append(y)
    return sum(xs) / len(xs), sum(ys) / len(ys)


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norma = (dx * dx + dy * dy) ** 0.5 or 1e-12
        mayor, idx = 0.0, None
        for i in range(a + 1, b):
            x0, y0 = pts[i]
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norma
            if d > mayor:
                mayor, idx = d, i
        if idx is not None and mayor > eps:
            keep[idx] = True
            pila += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def anillo(r):
    """Un anillo es cerrado (primer punto = último): se parte en el punto más lejano del inicio y se simplifica cada mitad."""
    pts = [(p[0], p[1]) for p in r]
    x0, y0 = pts[0]
    lejano = max(range(len(pts)), key=lambda i: (pts[i][0] - x0) ** 2 + (pts[i][1] - y0) ** 2)
    a, b = rdp(pts[: lejano + 1], TOLERANCIA), rdp(pts[lejano:], TOLERANCIA)
    s = a[:-1] + b
    if len(s) < 4:
        return None
    return [[round(x, 4), round(y, 4)] for x, y in s]


def main():
    tosco = cargar(sys.argv[1] if len(sys.argv) > 2 else None, URL_TOSCO)
    detalle = cargar(sys.argv[2] if len(sys.argv) > 2 else None, URL_DETALLE)
    por_nombre = {}
    for f in detalle["features"]:
        por_nombre.setdefault(plegar(f["properties"]["shapeName"]), []).append(f)

    salida, faltan = [], []
    for t in tosco["features"]:
        if str(t["properties"]["DPTO_CCDGO"]) != "17":
            continue
        nombre = titulo(t["properties"]["MPIO_CNMBR"])
        cx, cy = centro(t)
        # varios municipios del país comparten nombre (Riosucio, San José…): gana el que queda más cerca del de Caldas
        cand = [(((centro(c)[0] - cx) ** 2 + (centro(c)[1] - cy) ** 2) ** 0.5, c) for c in por_nombre.get(plegar(nombre), [])]
        cand = [c for c in cand if c[0] < 0.3]
        if not cand:
            faltan.append(nombre)
            continue
        f = min(cand, key=lambda c: c[0])[1]
        polis = []
        for poli in poligonos(f):
            anillos = [a for a in (anillo(r) for r in poli) if a]
            if anillos:
                polis.append(anillos)
        salida.append({"type": "Feature", "properties": {"nombre": nombre, "codigo": t["properties"]["MPIO_CCNCT"]}, "geometry": {"type": "MultiPolygon", "coordinates": polis}})
    if faltan:
        raise SystemExit(f"[ERROR] Sin contorno detallado para: {faltan}")
    salida.sort(key=lambda x: x["properties"]["nombre"])
    destino = RAIZ / "src" / "data" / "caldas.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps({"type": "FeatureCollection", "features": salida}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    puntos = sum(len(r) for f in salida for p in f["geometry"]["coordinates"] for r in p)
    print(f"{len(salida)} municipios, {puntos:,} puntos, {destino.stat().st_size / 1024:,.0f} KB -> {destino}")


if __name__ == "__main__":
    main()
