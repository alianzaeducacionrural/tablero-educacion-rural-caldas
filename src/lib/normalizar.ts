import type { Alias, Beneficiado, Datos, Estudiante, FilaBase, HojaCruda, Meta, Programa, RespuestaDatos } from './tipos'

export const limpiar = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()
export const plegar = (s: unknown) =>
  limpiar(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const CONVOCADO = /\s*-\s*convocado\s*-\s*no\s+asisti[oó]\s*$/i

type Fila = Record<string, unknown>
function objetos(h: HojaCruda | undefined): Fila[] {
  if (!h) return []
  return h.filas.map((f) => {
    const o: Fila = {}
    h.columnas.forEach((c, i) => (o[c] = f[i]))
    return o
  })
}

/** Pasa las hojas del Sheet a objetos tipados, sin tocar los textos. */
export function parsear(r: RespuestaDatos): Datos {
  const base: FilaBase[] = []
  ;(['mf', 'uc'] as Programa[]).forEach((programa) => {
    objetos(r.hojas[`${programa}_base`]).forEach((o) => {
      const a = o.asistio
      base.push({
        programa,
        anio: num(o.anio),
        municipio: limpiar(o.municipio),
        institucion: limpiar(o.institucion),
        tipo: limpiar(o.tipo_beneficiario) || 'Institución',
        estado: limpiar(o.estado),
        grupo: limpiar(programa === 'mf' ? o.proyecto : o.proceso),
        actividad: limpiar(o.actividad),
        asistio: !(a === false || String(a).toUpperCase() === 'FALSE'),
        cantidad: num(o.cantidad),
        valor: num(o.valor),
        aportante: limpiar(o.aportante),
      })
    })
  })

  const beneficiados: Beneficiado[] = objetos(r.hojas.beneficiados).map((o) => ({
    anio: num(o.anio),
    municipio: limpiar(o.municipio),
    institucion: limpiar(o.institucion),
    sede: limpiar(o.sede),
    beneficiados: num(o.beneficiados),
  }))

  const estudiantes: Estudiante[] = objetos(r.hojas.estudiantes).map((o) => ({
    anioIngreso: num(o.anio_ingreso),
    municipio: limpiar(o.municipio),
    institucion: limpiar(o.institucion),
    universidad: limpiar(o.universidad),
    programa: limpiar(o.programa),
    genero: limpiar(o.genero),
    estado: limpiar(o.estado),
    financiador: limpiar(o.financiador),
    anioGraduacion: o.anio_graduacion === '' || o.anio_graduacion == null ? null : num(o.anio_graduacion),
  }))

  const metas: Meta[] = []
  ;(['mf', 'uc'] as Programa[]).forEach((programa) => {
    objetos(r.hojas[`metas_${programa}`]).forEach((o) => {
      metas.push({
        programa,
        vigencia: num(o.vigencia),
        grupo: limpiar(programa === 'mf' ? o.proyecto : o.proceso),
        actividad: limpiar(o.actividad),
        valorUnitario: num(o.valor_unitario),
        meta: num(o.meta),
        valorMeta: num(o.valor_meta),
        ejecutado: num(o.ejecutado),
        valorEjecutado: num(o.valor_ejecutado),
        faltante: num(o.faltante),
        valorFaltante: num(o.valor_faltante),
        adicional: num(o.adicional),
        reinversion: num(o.reinversion),
        departamento: num(o.departamento),
        comite: num(o.comite),
      })
    })
  })

  const alias: Alias[] = objetos(r.hojas.alias).map((o) => ({
    tipo: limpiar(o.tipo),
    ambito: limpiar(o.ambito),
    crudo: limpiar(o.crudo),
    normalizado: limpiar(o.normalizado),
    filas: num(o.filas),
  }))

  return { generado: r.generado, base, beneficiados, estudiantes, metas, alias }
}

/** Elige, por (ámbito, texto plegado), la variante más frecuente como nombre canónico. */
class Canon {
  private cuentas = new Map<string, Map<string, number>>()
  private mapa = new Map<string, string>()
  ver(ambito: string, valor: string, peso = 1) {
    const k = ambito + '|' + plegar(valor)
    const m = this.cuentas.get(k) ?? new Map<string, number>()
    m.set(valor, (m.get(valor) ?? 0) + peso)
    this.cuentas.set(k, m)
  }
  cerrar() {
    this.cuentas.forEach((m, k) => {
      const orden = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      this.mapa.set(k, orden[0][0])
    })
    return this
  }
  usar(ambito: string, valor: string) {
    return this.mapa.get(ambito + '|' + plegar(valor)) ?? valor
  }
}

/** Convierte "X - Convocado - No Asistió" en { nombre: 'X', asistio: false }. */
function separarAsistencia(actividad: string, asistio: boolean) {
  const m = CONVOCADO.exec(actividad)
  return m ? { actividad: actividad.slice(0, m.index).trim(), asistio: false } : { actividad, asistio }
}

/**
 * Unifica mayúsculas, tildes y espacios, y aplica la tabla `alias`, para que una fila escrita a mano en el Sheet
 * con otra variante no parta los totales. "Convocado - No Asistió" no se fusiona: pasa a la columna asistio.
 */
export function normalizar(d: Datos): Datos {
  const alias = new Map(d.alias.map((a) => [`${a.tipo}|${a.ambito}|${a.crudo}`, a.normalizado]))
  const ap = (tipo: string, ambito: string, v: string) => alias.get(`${tipo}|${ambito}|${v}`) ?? v

  const base = d.base.map((f) => ({ ...f, ...separarAsistencia(f.actividad, f.asistio) }))

  // Municipios
  const cMuni = new Canon()
  const muniAlias = (v: string) => ap('municipio', '', v)
  ;[base, d.beneficiados, d.estudiantes].forEach((arr) => arr.forEach((f) => cMuni.ver('', muniAlias(f.municipio))))
  cMuni.cerrar()
  const muni = (v: string) => cMuni.usar('', muniAlias(v))

  // Instituciones (el ámbito es el municipio: "Pío XII" existe en 3 municipios)
  const cInst = new Canon()
  const inst = (m: string, v: string) => ap('institucion', m, v)
  ;[base, d.beneficiados, d.estudiantes].forEach((arr) => arr.forEach((f) => cInst.ver(muni(f.municipio), inst(muni(f.municipio), f.institucion))))
  cInst.cerrar()
  const instCanon = (m: string, v: string) => cInst.usar(muni(m), inst(muni(m), v))

  // Actividades: el nombre de las metas gana el desempate
  const cAct = new Canon()
  const act = (v: string) => ap('actividad', '', v)
  base.forEach((f) => cAct.ver('', act(f.actividad)))
  d.metas.forEach((m) => cAct.ver('', act(m.actividad), 1000))
  cAct.cerrar()

  const simple = (tipo: string, valores: string[]) => {
    const c = new Canon()
    valores.forEach((v) => c.ver('', ap(tipo, '', v)))
    c.cerrar()
    return (v: string) => c.usar('', ap(tipo, '', v))
  }
  const gProyecto = simple('proyecto', [...base.filter((f) => f.programa === 'mf').map((f) => f.grupo), ...d.metas.filter((m) => m.programa === 'mf').map((m) => m.grupo)])
  const gProceso = simple('proceso', [...base.filter((f) => f.programa === 'uc').map((f) => f.grupo), ...d.metas.filter((m) => m.programa === 'uc').map((m) => m.grupo)])
  const grupo = (p: Programa, v: string) => (p === 'mf' ? gProyecto(v) : gProceso(v))
  const estado = simple('estado', base.map((f) => f.estado))
  const aportante = simple('aportante', base.map((f) => f.aportante))
  const sede = simple('sede', d.beneficiados.map((b) => b.sede))
  const universidad = simple('universidad', d.estudiantes.map((e) => e.universidad))
  const programaEst = simple('programa', d.estudiantes.map((e) => e.programa))
  const estadoEst = simple('estado_estudiante', d.estudiantes.map((e) => e.estado))
  const genero = simple('genero', d.estudiantes.map((e) => e.genero))

  return {
    ...d,
    base: base.map((f) => ({
      ...f,
      municipio: muni(f.municipio),
      institucion: instCanon(f.municipio, f.institucion),
      actividad: cAct.usar('', act(f.actividad)),
      grupo: grupo(f.programa, f.grupo),
      estado: estado(f.estado),
      aportante: aportante(f.aportante),
    })),
    beneficiados: d.beneficiados.map((b) => ({ ...b, municipio: muni(b.municipio), institucion: instCanon(b.municipio, b.institucion), sede: sede(b.sede) })),
    estudiantes: d.estudiantes.map((e) => ({
      ...e,
      municipio: muni(e.municipio),
      institucion: instCanon(e.municipio, e.institucion),
      universidad: universidad(e.universidad),
      programa: programaEst(e.programa),
      estado: estadoEst(e.estado),
      genero: genero(e.genero),
    })),
    metas: d.metas.map((m) => ({ ...m, actividad: cAct.usar('', act(m.actividad)), grupo: grupo(m.programa, m.grupo) })),
  }
}

export interface GrupoDuplicado {
  tipo: string
  ambito: string
  variantes: { valor: string; filas: number }[]
  sugerido: string
}

/** Variantes del mismo valor escritas distinto, en los datos tal como están en el Sheet (sin normalizar). */
export function detectarDuplicados(d: Datos): GrupoDuplicado[] {
  const cubetas = new Map<string, { tipo: string; ambito: string; cuentas: Map<string, number> }>()
  const ver = (tipo: string, ambito: string, valor: string) => {
    if (!valor) return
    const k = `${tipo}|${ambito}|${plegar(valor)}`
    const c = cubetas.get(k) ?? { tipo, ambito, cuentas: new Map<string, number>() }
    c.cuentas.set(valor, (c.cuentas.get(valor) ?? 0) + 1)
    cubetas.set(k, c)
  }
  d.base.forEach((f) => {
    const a = separarAsistencia(f.actividad, f.asistio).actividad
    ver('municipio', '', f.municipio)
    ver('institucion', f.municipio, f.institucion)
    ver('actividad', '', a)
    ver('estado', '', f.estado)
    ver('aportante', '', f.aportante)
    ver(f.programa === 'mf' ? 'proyecto' : 'proceso', '', f.grupo)
  })
  d.metas.forEach((m) => {
    ver('actividad', '', m.actividad)
    ver(m.programa === 'mf' ? 'proyecto' : 'proceso', '', m.grupo)
  })
  d.beneficiados.forEach((b) => {
    ver('municipio', '', b.municipio)
    ver('institucion', b.municipio, b.institucion)
    ver('sede', '', b.sede)
  })
  d.estudiantes.forEach((e) => {
    ver('municipio', '', e.municipio)
    ver('institucion', e.municipio, e.institucion)
  })

  const out: GrupoDuplicado[] = []
  cubetas.forEach((c) => {
    if (c.cuentas.size < 2) return
    const variantes = [...c.cuentas.entries()].map(([valor, filas]) => ({ valor, filas })).sort((a, b) => b.filas - a.filas || a.valor.localeCompare(b.valor))
    out.push({ tipo: c.tipo, ambito: c.ambito, variantes, sugerido: variantes[0].valor })
  })
  return out.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.sugerido.localeCompare(b.sugerido))
}
