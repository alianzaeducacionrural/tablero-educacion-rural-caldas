"""Lectura tipada de los CSV de datos/sheet: comparten datos_local.py y subir_a_sheet.py."""
import csv
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSV = RAIZ / "datos" / "sheet"

# Orden de carga = orden de las pestañas en el Sheet.
HOJAS = ["mf_base", "uc_base", "beneficiados", "estudiantes", "metas_mf", "metas_uc", "mapa_proyectos", "alias", "auditoria"]

_TEXTO_METAS = {"proyecto", "proceso", "actividad"}
NUMERICAS = {
    "mf_base": {"anio", "cantidad", "valor"},
    "uc_base": {"anio", "cantidad", "valor"},
    "beneficiados": {"anio", "beneficiados"},
    "estudiantes": {"anio_ingreso", "anio_graduacion"},
    "alias": {"filas"},
}
BOOLEANAS = {"mf_base": {"asistio"}, "uc_base": {"asistio"}}


def _numero(v):
    if v == "":
        return ""
    f = float(v)
    return int(f) if f == int(f) else f


def leer_hoja(nombre):
    """Devuelve (columnas, filas) con números y booleanos de verdad; el resto queda como texto."""
    with open(CSV / f"{nombre}.csv", encoding="utf-8", newline="") as f:
        lector = csv.reader(f)
        columnas = next(lector)
        crudas = list(lector)
    if nombre.startswith("metas_"):
        num = {c for c in columnas if c not in _TEXTO_METAS}
    else:
        num = NUMERICAS.get(nombre, set())
    boo = BOOLEANAS.get(nombre, set())
    filas = []
    for r in crudas:
        fila = []
        for c, v in zip(columnas, r):
            if c in num:
                fila.append(_numero(v))
            elif c in boo:
                fila.append(v.upper() == "TRUE")
            else:
                fila.append(v)
        filas.append(fila)
    return columnas, filas
