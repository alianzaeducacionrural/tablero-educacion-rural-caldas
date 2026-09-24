#!/usr/bin/env python3
"""Siembra del tablero: Excel (export de Power BI en Drive + Excel raíz) -> un CSV por pestaña del Sheet.

- Normaliza mayúsculas, tildes y espacios (misma cosa escrita distinto = un solo valor).
- `- Convocado - No Asistió` NO se fusiona: se convierte en la columna `asistio`.
- Añade `tipo_beneficiario` (Institución / Grupo / Red de maestros / Microcentro).
- Estudiantes: todos los aportantes (Gobernación y otros aliados) y SIN nombres (el tablero es público).
- Estado de los estudiantes: si existe el Listado General (cohortes 2024 en adelante), su estado actualizado
  reemplaza al del Excel de Drive. El cruce usa el nombre solo en memoria; nunca sale en los CSV.
- Falla si la normalización cambia filas o totales, o si algún nombre de estudiante llega a la salida.
"""
import argparse
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parent.parent

# Cifras de la última verificación (informativas: si cambian los datos, se muestran como "difiere").
FOTO = {
    "mf_filas": 3594, "mf_valor": 2995880347,
    "uc_filas": 740, "uc_valor": 2816620848,
    "consolidado": 5812501195,
    "depto": 5100432060, "comite": 712069135,
    "beneficiados": 34279, "estudiantes": 2342,
}

CONVOCADO = re.compile(r"\s*-\s*convocado\s*-\s*no\s+asisti[oó]\s*$", re.I)


def limpiar(s):
    return re.sub(r"\s+", " ", str(s)).strip()


def plegar(s):
    s = unicodedata.normalize("NFKD", limpiar(s))
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def separar_asistencia(actividad):
    act = limpiar(actividad)
    m = CONVOCADO.search(act)
    if m:
        return act[: m.start()].strip(), False
    if "convocado" in act.lower():
        raise ValueError(f"Actividad con 'convocado' que no sigue el patrón esperado: {act!r}")
    return act, True


class Canon:
    """Elige, por (ámbito, valor plegado), la variante más frecuente como nombre canónico."""

    def __init__(self, tipo):
        self.tipo = tipo
        self.cuentas = defaultdict(Counter)  # con peso: decide el nombre canónico
        self.reales = defaultdict(Counter)   # filas reales de datos: es lo que se reporta

    def ver(self, ambito, valor, peso=1):
        k = (ambito, plegar(valor))
        self.cuentas[k][limpiar(valor)] += peso
        if peso == 1:
            self.reales[k][limpiar(valor)] += 1

    def cerrar(self):
        self.mapa = {k: sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] for k, c in self.cuentas.items()}
        return self

    def __call__(self, ambito, valor):
        return self.mapa[(ambito, plegar(valor))]

    def alias(self):
        filas = []
        for (ambito, _), cnt in self.cuentas.items():  # noqa: B007
            if len(cnt) < 2:
                continue
            canon = self.mapa[(ambito, _)]
            for crudo in cnt:
                n = self.reales[(ambito, _)][crudo]
                if crudo != canon and n:
                    filas.append({"tipo": self.tipo, "ambito": ambito, "crudo": crudo, "normalizado": canon, "filas": n})
        return filas


def tipo_beneficiario(institucion):
    p = plegar(institucion)
    if p.startswith("grupo "):
        return "Grupo de instituciones"
    if p.startswith("red de maestros"):
        return "Red de maestros"
    if p.startswith("formacion docente") or p.startswith("microcentro"):
        return "Microcentro / formación docente"
    if p in ("egresados", "empresarios"):
        return p.capitalize()
    return "Institución"


def num(x, dec=2):
    if pd.isna(x):
        return ""
    x = round(float(x), dec)
    return str(int(x)) if x == int(x) else f"{x:.{dec}f}".rstrip("0").rstrip(".")


def leer(path, hoja, renombrar, esperadas=None):
    df = pd.read_excel(path, sheet_name=hoja)
    faltan = [c for c in renombrar if c not in df.columns]
    if faltan:
        raise SystemExit(f"[ERROR] {Path(path).name} / {hoja}: faltan columnas {faltan}. Hay: {list(df.columns)}")
    return df[list(renombrar)].rename(columns=renombrar)


def actualizar_estado(est, nombre_est, ruta):
    """Reemplaza `estado` con el del Listado General (solo cohortes que trae, hoy 2024 en adelante).

    Cruce por nombre plegado y misma cohorte. Primero exacto; luego, para lo que queda, parecido (>= 0.92, mismo
    municipio, candidato único) porque el mismo estudiante aparece a veces con tildes u orden de apellidos distinto.
    Los nombres se usan solo aquí, en memoria. Devuelve un resumen (sin nombres) para el reporte."""
    lst = pd.read_excel(ruta, usecols=["Nombre Completo", "Municipio", "Cohorte", "Estado"])
    lst["k"] = lst["Nombre Completo"].map(plegar)
    lst["muni"] = lst["Municipio"].map(plegar)
    lst["cohorte"] = pd.to_numeric(lst["Cohorte"], errors="coerce")
    lst = lst[lst["k"] != ""].copy()

    canon = {plegar(e): e for e in est["estado"].unique()}  # respeta la escritura ya usada ("Activo", "Graduado"…)

    def estado_canonico(e):
        p = plegar(e)
        if "riesgo" in p:  # decisión del equipo: "En riesgo" se cuenta como Activo
            p = "activo"
        return canon.get(p, limpiar(e).capitalize())

    viejo = pd.DataFrame({"k": nombre_est, "muni": est["municipio"].map(plegar), "cohorte": pd.to_numeric(est["anio_ingreso"], errors="coerce")})
    n_viejo = viejo["k"].value_counts()
    n_lista = lst["k"].value_counts()

    usados, cruces = set(), {}  # índice de est -> fila de la lista
    for i, r in lst.iterrows():
        if n_lista[r["k"]] != 1:
            continue
        cand = viejo.index[(viejo["k"] == r["k"]) & (viejo["cohorte"] == r["cohorte"])]
        if len(cand) == 1 and n_viejo[r["k"]] == 1:
            cruces[cand[0]] = i
            usados.add(i)
    exactos = len(cruces)

    libres = viejo[~viejo.index.isin(cruces)]
    difusos = 0
    for i, r in lst.iterrows():
        if i in usados:
            continue
        pool = libres[(libres["cohorte"] == r["cohorte"]) & (libres["muni"] == r["muni"]) & ~libres.index.isin(cruces)]
        if pool.empty:
            continue
        sc = sorted(((SequenceMatcher(None, " ".join(sorted(r["k"].split())), " ".join(sorted(k.split()))).ratio(), j) for j, k in pool["k"].items()), reverse=True)
        if sc[0][0] >= 0.92 and (len(sc) == 1 or sc[0][0] - sc[1][0] >= 0.05):
            cruces[sc[0][1]] = i
            usados.add(i)
            difusos += 1

    cambios = Counter()
    for j, i in cruces.items():
        nuevo = estado_canonico(lst.at[i, "Estado"])
        if plegar(est.at[j, "estado"]) != plegar(nuevo):
            cambios[(est.at[j, "estado"], nuevo)] += 1
            est.at[j, "estado"] = nuevo
    return {
        "lista": len(lst), "exactos": exactos, "difusos": difusos, "sin_cruce": len(lst) - len(usados),
        "cambios": cambios, "cohortes": sorted(int(c) for c in lst["cohorte"].dropna().unique()),
        "nombres": set(lst["k"]),
    }


def leer_metas(path, n_cols, nombres):
    df = pd.read_excel(path, sheet_name="Gobernación").iloc[:, :n_cols]
    df.columns = nombres
    df = df[df["actividad"].notna()].copy()
    df["actividad"] = df["actividad"].map(limpiar)
    return df


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    docs = RAIZ / "docs"
    ap.add_argument("--mf-drive", type=Path, default=docs / "origen-drive" / "Modelos Flexibles - Gobernación.xlsx")
    ap.add_argument("--uc-drive", type=Path, default=docs / "origen-drive" / "U Campo - Gobernación.xlsx")
    ap.add_argument("--mf-raiz", type=Path, default=docs / "Informe Modelos Flexibles.xlsx")
    ap.add_argument("--uc-raiz", type=Path, default=docs / "Informe U Campo.xlsx")
    ap.add_argument("--estado-tecnicos", type=Path, default=docs / "estado técnicos" / "Listado_General_Estudiantes.xlsx", help="Listado General con el estado actualizado de los estudiantes (cohortes 2024 en adelante). Opcional.")
    ap.add_argument("--vigencia-metas", type=int, default=2024, help="Vigencia a la que se asignan las metas (PROVISIONAL).")
    ap.add_argument("--out", type=Path, default=RAIZ / "datos" / "sheet")
    a = ap.parse_args()

    log = []

    def p(*t):
        linea = " ".join(str(x) for x in t)
        log.append(linea)
        print(linea)

    # ---------- lectura ----------
    mf = leer(a.mf_drive, "Base de datos", {"Año": "anio", "Municipio": "municipio", "Institucion": "institucion", "Estado Actividad": "estado", "Proyecto": "proyecto", "Actividad": "actividad", "Cantidad": "cantidad", "Valor": "valor", "Aportante": "aportante"})
    uc = leer(a.uc_drive, "Base de datos", {"Año": "anio", "Municipio": "municipio", "Institucion": "institucion", "Estado Convenio": "estado", "Proceso": "proceso", "Actividad": "actividad", "Cantidad": "cantidad", "Valor": "valor", "Aportante": "aportante"})
    ben = leer(a.mf_drive, "Beneficiados", {"Año": "anio", "Municipio": "municipio", "Institucion": "institucion", "Sede": "sede", "Beneficiados": "beneficiados"})
    est_todo = pd.read_excel(a.uc_drive, sheet_name="Estudiantes")
    nombres = {plegar(n) for n in est_todo["Nombres y Apellidos"].dropna()}
    est = leer(a.uc_drive, "Estudiantes", {"Año": "anio_ingreso", "Municipio": "municipio", "Institución Educativa": "institucion", "Universidad": "universidad", "Programa": "programa", "Género": "genero", "Estado": "estado", "Financiador": "financiador", "Año Graduación": "anio_graduacion"})
    # Nombre de cada estudiante, alineado con `est` (mismo índice): solo sirve para cruzar con el Listado General.
    nombre_est = est_todo["Nombres y Apellidos"].map(lambda x: plegar(x) if pd.notna(x) else "")

    metas_mf = leer_metas(a.mf_raiz, 10, ["proyecto", "actividad", "valor_unitario", "meta", "valor_meta", "ejecutado", "valor_ejecutado", "faltante", "valor_faltante", "adicional"])
    metas_uc = leer_metas(a.uc_raiz, 13, ["proceso", "actividad", "valor_unitario", "meta", "valor_meta", "ejecutado", "valor_ejecutado", "faltante", "valor_faltante", "adicional", "reinversion", "departamento", "comite"])

    # El export de Power BI multiplica por 1e8 algunas cantidades decimales (0,97149831 -> 97149831).
    # Ninguna cantidad real pasa de 50, así que todo valor >= 1e6 es ese artefacto y se repara con certeza.
    reparadas = []
    for nombre, df in (("Modelos Flexibles", mf), ("Universidad en el Campo", uc)):
        malas = df["cantidad"] >= 1e6
        if malas.any():
            reparadas.append((nombre, int(malas.sum()), [round(float(x), 8) for x in (df.loc[malas, "cantidad"] / 1e8)][:3]))
            df.loc[malas, "cantidad"] = df.loc[malas, "cantidad"] / 1e8
        if df["cantidad"].max() > 1000:
            raise SystemExit(f"[ERROR] {nombre}: quedan cantidades > 1000 tras la reparación (máx {df['cantidad'].max():,.0f}). Revisar el export.")

    src = {
        "mf_filas": len(mf), "mf_valor": mf["valor"].sum(), "mf_cant": mf["cantidad"].sum(),
        "uc_filas": len(uc), "uc_valor": uc["valor"].sum(), "uc_cant": uc["cantidad"].sum(),
        "ben_filas": len(ben), "ben_total": ben["beneficiados"].sum(), "est_filas": len(est),
    }

    # ---------- asistencia (antes de plegar nombres de actividad) ----------
    for df in (mf, uc):
        par = df["actividad"].map(separar_asistencia)
        df["actividad"] = par.map(lambda t: t[0])
        df["asistio"] = par.map(lambda t: t[1])

    # ---------- canónicos ----------
    c_muni, c_inst, c_act, c_estado = Canon("municipio"), Canon("institucion"), Canon("actividad"), Canon("estado")
    c_otros = {k: Canon(k) for k in ("proyecto", "proceso", "aportante", "universidad", "programa", "sede")}
    for df in (mf, uc, ben, est):
        for m in df["municipio"]:
            c_muni.ver("", m)
    c_muni.cerrar()
    for df in (mf, uc, ben, est):
        df["municipio"] = df["municipio"].map(lambda v: c_muni("", v))
        for m, i in zip(df["municipio"], df["institucion"]):
            c_inst.ver(m, i)
    c_inst.cerrar()
    for df in (mf, uc, ben, est):
        df["institucion"] = [c_inst(m, i) for m, i in zip(df["municipio"], df["institucion"])]

    for df in (mf, uc):
        for v in df["actividad"]:
            c_act.ver("", v)
        for v in df["estado"]:
            c_estado.ver("", v)
    for df in (metas_mf, metas_uc):
        for v in df["actividad"]:
            c_act.ver("", v, peso=1000)  # el nombre "oficial" de las metas gana el desempate
    c_act.cerrar(); c_estado.cerrar()
    for df in (mf, uc):
        df["actividad"] = df["actividad"].map(lambda v: c_act("", v))
        df["estado"] = df["estado"].map(lambda v: c_estado("", v))
    for df in (metas_mf, metas_uc):
        df["actividad"] = df["actividad"].map(lambda v: c_act("", v))

    for col, df in (("proyecto", mf), ("proceso", uc), ("aportante", mf), ("aportante", uc), ("universidad", est), ("programa", est), ("sede", ben)):
        for v in df[col]:
            c_otros[col].ver("", v)
    for c in c_otros.values():
        c.cerrar()
    for col, df in (("proyecto", mf), ("proceso", uc), ("aportante", mf), ("aportante", uc), ("universidad", est), ("programa", est), ("sede", ben)):
        df[col] = df[col].map(lambda v: c_otros[col]("", v))
    for df in (mf, uc, est):
        df["estado"] = df["estado"].map(limpiar)
    est["genero"] = est["genero"].map(limpiar)
    est["financiador"] = est["financiador"].map(limpiar)

    cruce = None
    if a.estado_tecnicos.exists():
        cruce = actualizar_estado(est, nombre_est, a.estado_tecnicos)
        nombres |= cruce["nombres"]  # el Listado también cuenta para la revisión de fugas de nombres

    # Decisión del equipo: quien sigue Activo habiendo ingresado en 2024 o antes está pendiente de grado.
    ESTADO_PENDIENTE = next((e for e in est["estado"].unique() if plegar(e) == "pendiente de grado"), "Pendiente de grado")
    a_pendiente = (est["estado"].map(plegar) == "activo") & (pd.to_numeric(est["anio_ingreso"], errors="coerce") <= 2024)
    n_a_pendiente = int(a_pendiente.sum())
    est.loc[a_pendiente, "estado"] = ESTADO_PENDIENTE

    for df in (mf, uc):
        df["tipo_beneficiario"] = df["institucion"].map(tipo_beneficiario)

    # ---------- mapa de proyectos (metas <-> base) ----------
    base_mf = {plegar(x): x for x in mf["proyecto"].unique()}
    base_uc = {plegar(x): x for x in uc["proceso"].unique()}
    mapa = []
    sin_mapa = []
    for prog, nombres_meta, base in (("Modelos Flexibles", metas_mf["proyecto"].unique(), base_mf), ("Universidad en el Campo", metas_uc["proceso"].unique(), base_uc)):
        for nm in nombres_meta:
            for parte in [limpiar(x) for x in str(nm).split(" - ")]:
                if plegar(parte) in base:
                    mapa.append({"programa": prog, "nombre_meta": limpiar(nm), "nombre_base": base[plegar(parte)]})
                else:
                    sin_mapa.append((prog, nm, parte))
    metas_mf["proyecto"] = metas_mf["proyecto"].map(limpiar)
    metas_uc["proceso"] = metas_uc["proceso"].map(limpiar)
    metas_mf.insert(0, "vigencia", a.vigencia_metas)
    metas_uc.insert(0, "vigencia", a.vigencia_metas)

    # ---------- salidas ----------
    def fmt(df, dec_cols):
        out = df.copy()
        for c, d in dec_cols.items():
            out[c] = out[c].map(lambda x, d=d: num(x, d))
        return out

    if "asistio" in mf:
        for df in (mf, uc):
            df["asistio"] = df["asistio"].map(lambda b: "TRUE" if b else "FALSE")
    est["anio_graduacion"] = est["anio_graduacion"].map(lambda x: num(x, 0))
    ben["beneficiados"] = ben["beneficiados"].map(lambda x: num(x, 0))
    for df in (mf, uc, ben):
        df["anio"] = df["anio"].map(lambda x: num(x, 0))
    est["anio_ingreso"] = est["anio_ingreso"].map(lambda x: num(x, 0))

    alias = []
    for c in (c_muni, c_inst, c_act, c_estado, *c_otros.values()):
        alias += c.alias()
    alias = pd.DataFrame(alias, columns=["tipo", "ambito", "crudo", "normalizado", "filas"])

    metas_num_mf = {c: 2 for c in ("valor_unitario", "meta", "valor_meta", "ejecutado", "valor_ejecutado", "faltante", "valor_faltante", "adicional")}
    metas_num_uc = {**metas_num_mf, "reinversion": 2, "departamento": 2, "comite": 2}
    salidas = {
        "mf_base": fmt(mf, {"cantidad": 6, "valor": 2})[["anio", "municipio", "institucion", "tipo_beneficiario", "estado", "proyecto", "actividad", "asistio", "cantidad", "valor", "aportante"]],
        "uc_base": fmt(uc, {"cantidad": 6, "valor": 2})[["anio", "municipio", "institucion", "tipo_beneficiario", "estado", "proceso", "actividad", "asistio", "cantidad", "valor", "aportante"]],
        "beneficiados": ben[["anio", "municipio", "institucion", "sede", "beneficiados"]],
        "estudiantes": est[["anio_ingreso", "municipio", "institucion", "universidad", "programa", "genero", "estado", "financiador", "anio_graduacion"]],
        "metas_mf": fmt(metas_mf, metas_num_mf),
        "metas_uc": fmt(metas_uc, metas_num_uc),
        "mapa_proyectos": pd.DataFrame(mapa, columns=["programa", "nombre_meta", "nombre_base"]).drop_duplicates(),
        "alias": alias.sort_values(["tipo", "ambito", "normalizado", "filas"], ascending=[True, True, True, False]),
        "auditoria": pd.DataFrame(columns=["fecha", "usuario", "accion", "detalle"]),
    }
    a.out.mkdir(parents=True, exist_ok=True)
    for nombre, df in salidas.items():
        df.to_csv(a.out / f"{nombre}.csv", index=False, encoding="utf-8", lineterminator="\n")

    # ---------- control ----------
    fallos = []

    def exige(ok, msg):
        p(("  OK    " if ok else "  FALLA ") + msg)
        if not ok:
            fallos.append(msg)

    out_mf, out_uc = salidas["mf_base"], salidas["uc_base"]
    v_mf, v_uc = out_mf["valor"].astype(float).sum(), out_uc["valor"].astype(float).sum()
    p("\n=== INVARIANTES (la normalización no puede cambiar totales) ===")
    exige(len(out_mf) == src["mf_filas"] and round(v_mf) == round(src["mf_valor"]), f"Modelos Flexibles: {len(out_mf)} filas, ${v_mf:,.0f} (origen {src['mf_filas']} / ${src['mf_valor']:,.0f})")
    exige(abs(out_mf["cantidad"].astype(float).sum() - src["mf_cant"]) < 0.01, "Modelos Flexibles: cantidad total intacta")
    exige(len(out_uc) == src["uc_filas"] and round(v_uc) == round(src["uc_valor"]), f"U Campo: {len(out_uc)} filas, ${v_uc:,.0f} (origen {src['uc_filas']} / ${src['uc_valor']:,.0f})")
    exige(abs(out_uc["cantidad"].astype(float).sum() - src["uc_cant"]) < 0.01, "U Campo: cantidad total intacta")
    exige(len(ben) == src["ben_filas"] and int(ben["beneficiados"].astype(float).sum()) == int(src["ben_total"]), f"Beneficiados: {len(ben)} filas, {int(ben['beneficiados'].astype(float).sum()):,}")
    exige(len(est) == src["est_filas"], f"Estudiantes (todos los aportantes): {len(est)} filas")
    if cruce:
        p("\n=== ESTADO DE ESTUDIANTES (Listado General) ===")
        p(f"  Cohortes en el Listado: {cruce['cohortes']} · {cruce['lista']} estudiantes")
        p(f"  Cruzados por nombre exacto: {cruce['exactos']} · por nombre parecido (mismo municipio y cohorte): {cruce['difusos']}")
        p(f"  Del Listado sin cruzar con el Excel de Drive (no se agregan: no traen financiador ni año de grado): {cruce['sin_cruce']}")
        p(f"  Estados que cambiaron: {sum(cruce['cambios'].values())}")
        for (antes, despues), n in cruce["cambios"].most_common():
            p(f"    {antes} -> {despues}: {n}")
        p(f"  Estados resultantes: {dict(est['estado'].value_counts())}")
    p(f"  Activos con ingreso en 2024 o antes pasados a '{ESTADO_PENDIENTE}': {n_a_pendiente}")
    p(f"  Estados finales: {dict(est['estado'].value_counts())}")
    p(f"  Financiador: {dict(est['financiador'].value_counts())}")
    exige(not sin_mapa, f"Todas las metas cruzan con la base (sin cruce: {sin_mapa})")

    p("\n=== PRIVACIDAD ===")
    columnas = {c for df in salidas.values() for c in df.columns}
    persona = re.compile(r"^nombres?$|apellid|c[eé]dula|documento|identificaci|correo|tel[eé]fono", re.I)
    exige(not any(persona.search(c) for c in columnas), "Ninguna columna de datos personales (nombres, documento, contacto)")
    fugas = set()
    for df in salidas.values():
        for c in df.select_dtypes(include="object").columns:
            fugas |= {v for v in df[c].dropna().map(plegar).unique() if v in nombres}
    exige(not fugas, f"Ningún nombre de estudiante ({len(nombres)} en origen) aparece en la salida")
    texto = "".join((a.out / f"{n}.csv").read_text(encoding="utf-8") for n in salidas)
    exige("Nombres y Apellidos" not in texto, "El encabezado 'Nombres y Apellidos' no aparece en ningún CSV")

    p("\n=== FOTO DE REFERENCIA (informativa) ===")
    depto = sum(float(x) for df in (out_mf, out_uc) for x in df.loc[df["aportante"].map(plegar).str.startswith("depto"), "valor"])
    comite = sum(float(x) for df in (out_mf, out_uc) for x in df.loc[df["aportante"].map(plegar).str.contains("comite"), "valor"])
    for k, v in (("Consolidado", v_mf + v_uc), ("Depto. de Caldas", depto), ("Comité de Cafeteros", comite), ("Beneficiados", ben["beneficiados"].astype(float).sum()), ("Estudiantes", len(est))):
        ref = {"Consolidado": "consolidado", "Depto. de Caldas": "depto", "Comité de Cafeteros": "comite", "Beneficiados": "beneficiados", "Estudiantes": "estudiantes"}[k]
        p(f"  {k:<22}{v:>18,.0f}   {'= foto' if round(v) == FOTO[ref] else 'DIFIERE de la foto (' + format(FOTO[ref], ',') + ')'}")

    p("\n=== NORMALIZACIÓN APLICADA ===")
    for nombre, n, ej in reparadas:
        p(f"  Cantidades reparadas en {nombre}: {n} filas (el export multiplicó x1e8; p. ej. {ej})")
    cmax = max(out_mf["cantidad"].astype(float).max(), out_uc["cantidad"].astype(float).max())
    exige(cmax <= 1000, f"Cantidades en rango tras la reparación (máx {cmax:,.2f})")
    p(f"  Cantidad total: MF {out_mf['cantidad'].astype(float).sum():,.1f} · UC {out_uc['cantidad'].astype(float).sum():,.1f}")
    p(f"  Alias generados: {len(alias)} (tipos: {dict(alias['tipo'].value_counts())})")
    conv = out_mf[out_mf["asistio"] == "FALSE"]
    p(f"  Convocados que no asistieron (asistio=FALSE): {len(conv)} filas, ${conv['valor'].astype(float).sum():,.0f}")
    er = out_mf[(out_mf["actividad"].map(plegar) == "encuentro de rectores")]
    p(f"  'Encuentro de rectores': {er[er.asistio == 'TRUE']['cantidad'].astype(float).sum():,.0f} asistieron + {er[er.asistio == 'FALSE']['cantidad'].astype(float).sum():,.0f} convocados sin asistir")
    p(f"  tipo_beneficiario MF: {dict(out_mf['tipo_beneficiario'].value_counts())}")
    p(f"  tipo_beneficiario UC: {dict(out_uc['tipo_beneficiario'].value_counts())}")
    p(f"\n  !! Metas asignadas a la vigencia {a.vigencia_metas} de forma PROVISIONAL (--vigencia-metas). Confirmar.")

    (a.out / "reporte_siembra.txt").write_text("\n".join(log), encoding="utf-8")
    p(f"\nCSV escritos en {a.out}")
    if fallos:
        p(f"\n[ERROR] {len(fallos)} control(es) fallaron.")
        sys.exit(1)


if __name__ == "__main__":
    main()
