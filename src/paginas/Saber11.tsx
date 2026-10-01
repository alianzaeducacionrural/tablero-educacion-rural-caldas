import { useMemo, useState } from 'react'
import { ConFiltros, PanelFiltros, etiquetasDe, type GrupoFiltro } from '../components/Filtros'
import { Segmentado } from '../components/controles'
import { Grafico } from '../components/Grafico'
import { Icono } from '../components/Icono'
import { BotonExcel, Cifra, MapaCaldas, Marca, PlacaCabecera, Posiciones, Seccion, TablaAnios } from '../components/Lamina'
import { Modal } from '../components/Modal'
import { RankingBarras } from '../components/Ranking'
import { agrupar, alfa, unicos } from '../lib/agregar'
import { PLACAS, colorClasificacion, tinte } from '../lib/colores'
import { alternar, fraseFiltros, fraseValores } from '../lib/filtros'
import { num, num1, pct } from '../lib/formato'
import { altoBarras, apiladasH, columnas, dona } from '../lib/graficos'
import type { Saber11 as FilaSaber11 } from '../lib/tipos'
import { useTablero } from '../lib/usarFiltrado'

const placa = PLACAS.saber11
const ORDEN_CLASIF = ['A+', 'A', 'B', 'C', 'D']
const promedio = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0
}
const redondear = (n: number) => Math.round(n * 10) / 10

export function Saber11() {
  const { datos, f } = useTablero()
  const [institucionSel, setInstitucionSel] = useState<string[]>([])
  const [clasificacionSel, setClasificacionSel] = useState<string[]>([])

  // "Pío XII" existe en 3 municipios: solo se añade el municipio cuando el nombre se repite.
  const repetidos = useMemo(() => {
    const m = new Map<string, Set<string>>()
    datos.saber11.forEach((s) => m.set(s.institucion, (m.get(s.institucion) ?? new Set()).add(s.municipio)))
    return new Set([...m].filter(([, s]) => s.size > 1).map(([n]) => n))
  }, [datos])
  const etiquetaInst = (s: FilaSaber11) => (repetidos.has(s.institucion) ? `${s.institucion} (${s.municipio})` : s.institucion)

  const anios = useMemo(() => [...new Set(datos.saber11.map((s) => s.anio))].sort(), [datos])
  const [anioFoco, setAnioFoco] = useState(() => (anios.length ? anios[anios.length - 1] : 2025)) // eslint-disable-line react-hooks/exhaustive-deps
  const anioIdx = anios.indexOf(anioFoco)
  const anioAnterior = anioIdx > 0 ? anios[anioIdx - 1] : null
  const coloresAnio = useMemo(() => anios.map((_, i) => tinte(placa.escala, anios.length > 1 ? 0.15 + (i / (anios.length - 1)) * 0.75 : 0.5)), [anios])

  // El filtro de clasificación mira la del año activo: una institución entra o sale según cómo quedó ese año.
  const clasifPorInstAnioFoco = useMemo(() => {
    const m = new Map<string, string>()
    datos.saber11.forEach((s) => { if (s.anio === anioFoco) m.set(etiquetaInst(s), s.clasificacion) })
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, anioFoco])
  const conMuni = (m: string) => f.municipios.length === 0 || f.municipios.includes(m)
  const conInst = (s: FilaSaber11) => institucionSel.length === 0 || institucionSel.includes(etiquetaInst(s))
  const conClasif = (s: FilaSaber11) => clasificacionSel.length === 0 || clasificacionSel.includes(clasifPorInstAnioFoco.get(etiquetaInst(s)) ?? '')
  const filas = useMemo(() => datos.saber11.filter((s) => conMuni(s.municipio) && conInst(s) && conClasif(s)), [datos, f.municipios, institucionSel, clasificacionSel, clasifPorInstAnioFoco]) // eslint-disable-line react-hooks/exhaustive-deps

  // Comparador por años: promedio de cada área, año a año, con los filtros de municipio/institución aplicados.
  const porAnio = useMemo(
    () =>
      anios.map((a) => {
        const del = filas.filter((s) => s.anio === a)
        return {
          anio: a,
          global: promedio(del.map((s) => s.puntajeGlobal)),
          lectura: promedio(del.map((s) => s.lecturaCritica)),
          matematicas: promedio(del.map((s) => s.matematicas)),
          sociales: promedio(del.map((s) => s.socialesCiudadanas)),
          ciencias: promedio(del.map((s) => s.cienciasNaturales)),
          ingles: promedio(del.map((s) => s.ingles)),
        }
      }),
    [filas, anios],
  )
  const AREAS = [
    { nombre: 'Lectura crítica', clave: 'lectura' as const },
    { nombre: 'Matemáticas', clave: 'matematicas' as const },
    { nombre: 'Sociales y ciudadanas', clave: 'sociales' as const },
    { nombre: 'Ciencias naturales', clave: 'ciencias' as const },
    { nombre: 'Inglés', clave: 'ingles' as const },
  ]
  const opcionAreas = useMemo(
    () =>
      columnas({
        categorias: AREAS.map((a) => a.nombre),
        series: anios.map((a, i) => {
          const p = porAnio.find((x) => x.anio === a)
          return { nombre: String(a), color: coloresAnio[i], datos: AREAS.map((ar) => (p ? p[ar.clave] : 0)) }
        }),
        fmt: num1,
      }),
    [anios, porAnio, coloresAnio], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // Cuánto subió o bajó cada área frente al año anterior (mismo criterio que la comparación general).
  const cambiosAreas = useMemo(() => {
    if (anioAnterior == null) return null
    const actual = porAnio.find((a) => a.anio === anioFoco)
    const previo = porAnio.find((a) => a.anio === anioAnterior)
    if (!actual || !previo) return null
    return AREAS.map((ar) => ({ nombre: ar.nombre, actual: actual[ar.clave], previo: previo[ar.clave], delta: previo[ar.clave] > 0 ? (actual[ar.clave] - previo[ar.clave]) / previo[ar.clave] : null }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porAnio, anioFoco, anioAnterior])

  const promedioFoco = porAnio.find((a) => a.anio === anioFoco)?.global ?? 0

  // Cuántas instituciones subieron, bajaron o se mantuvieron igual frente al año anterior (mismo filtro).
  const comparacion = useMemo(() => {
    if (anioAnterior == null) return null
    const actual = new Map(filas.filter((s) => s.anio === anioFoco && s.puntajeGlobal != null).map((s) => [etiquetaInst(s), s.puntajeGlobal as number]))
    const previo = new Map(filas.filter((s) => s.anio === anioAnterior && s.puntajeGlobal != null).map((s) => [etiquetaInst(s), s.puntajeGlobal as number]))
    let subieron = 0, bajaron = 0, igual = 0 // eslint-disable-line prefer-const
    actual.forEach((v, k) => {
      const p = previo.get(k)
      if (p == null) return
      if (v > p) subieron++
      else if (v < p) bajaron++
      else igual++
    })
    return { subieron, bajaron, igual }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, anioFoco, anioAnterior])

  // Municipios: promedio del año activo (ignora el filtro de municipio, igual que en las demás pestañas).
  const [vistaMuni, setVistaMuni] = useState<'total' | 'anio'>('total')
  const filasTodosMuni = useMemo(() => datos.saber11.filter((s) => conInst(s) && conClasif(s) && s.anio === anioFoco), [datos, institucionSel, clasificacionSel, clasifPorInstAnioFoco, anioFoco]) // eslint-disable-line react-hooks/exhaustive-deps
  const porMuni = useMemo(() => {
    const m = new Map<string, { suma: number; n: number }>()
    filasTodosMuni.forEach((s) => {
      if (s.puntajeGlobal == null) return
      const e = m.get(s.municipio) ?? { suma: 0, n: 0 }
      e.suma += s.puntajeGlobal
      e.n += 1
      m.set(s.municipio, e)
    })
    return [...m.entries()].map(([nombre, e]) => ({ nombre, valor: e.n ? e.suma / e.n : 0, cantidad: e.n })).sort((a, b) => b.valor - a.valor || alfa(a.nombre, b.nombre))
  }, [filasTodosMuni])
  const filasTodosMuniAnio = useMemo(() => datos.saber11.filter((s) => conInst(s) && conClasif(s)), [datos, institucionSel, clasificacionSel, clasifPorInstAnioFoco]) // eslint-disable-line react-hooks/exhaustive-deps
  const porMunicipioAnio = useMemo(() => {
    const m = new Map<string, Map<number, { suma: number; n: number }>>()
    filasTodosMuniAnio.forEach((s) => {
      if (s.puntajeGlobal == null) return
      const e = m.get(s.municipio) ?? new Map<number, { suma: number; n: number }>()
      const x = e.get(s.anio) ?? { suma: 0, n: 0 }
      x.suma += s.puntajeGlobal
      x.n += 1
      e.set(s.anio, x)
      m.set(s.municipio, e)
    })
    const prom = (e?: { suma: number; n: number }) => (e && e.n ? e.suma / e.n : 0)
    return [...m.entries()]
      .map(([nombre, e]) => ({ nombre, partes: anios.map((a, i) => ({ nombre: String(a), valor: prom(e.get(a)), color: coloresAnio[i] })) }))
      .sort((a, b) => b.partes.reduce((s, p) => s + p.valor, 0) - a.partes.reduce((s, p) => s + p.valor, 0) || alfa(a.nombre, b.nombre))
  }, [filasTodosMuniAnio, anios, coloresAnio])
  const opcionMunicipiosAnio = useMemo(() => apiladasH({ filas: porMunicipioAnio, fmt: num1, agrupadas: true, mostrarValores: true }), [porMunicipioAnio])
  // El puntaje nunca se acerca a 0 (va de ~150 a ~300): con el valor tal cual, la escala del mapa (pensada para
  // dinero, que sí parte de 0) pintaría todos los municipios del mismo color. Se desplaza al mínimo de los datos
  // para que el color sí distinga mejor from peor; el mapa y la leyenda muestran el puntaje real (se le suma de vuelta).
  const pisoMapa = useMemo(() => (porMuni.length ? Math.min(...porMuni.map((p) => p.valor)) : 0), [porMuni])
  const datosMapa = useMemo(() => porMuni.map((p) => ({ name: p.nombre, value: redondear(p.valor - pisoMapa) })), [porMuni, pisoMapa])
  const extraMapa = useMemo(() => Object.fromEntries(porMuni.map((p) => [p.nombre, `${num(p.cantidad)} instituciones`])), [porMuni])

  // Instituciones: puntaje del año activo (ignora el filtro de institución), coloreadas por su clasificación.
  const [vistaInst, setVistaInst] = useState<'total' | 'anio'>('total')
  const filasTodasInst = useMemo(() => datos.saber11.filter((s) => conMuni(s.municipio) && conClasif(s) && s.anio === anioFoco), [datos, f.municipios, clasificacionSel, clasifPorInstAnioFoco, anioFoco]) // eslint-disable-line react-hooks/exhaustive-deps
  const porInstDatos = useMemo(
    () =>
      filasTodasInst
        .filter((s) => s.puntajeGlobal != null)
        .map((s) => ({ nombre: etiquetaInst(s), valor: s.puntajeGlobal as number, clasificacion: s.clasificacion }))
        .sort((a, b) => b.valor - a.valor || alfa(a.nombre, b.nombre)),
    [filasTodasInst], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const porInst = useMemo(() => porInstDatos.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorClasificacion(p.clasificacion) })), [porInstDatos])
  const filasTodasInstAnio = useMemo(() => datos.saber11.filter((s) => conMuni(s.municipio) && conClasif(s)), [datos, f.municipios, clasificacionSel, clasifPorInstAnioFoco]) // eslint-disable-line react-hooks/exhaustive-deps
  const porInstitucionAnio = useMemo(() => {
    const m = new Map<string, Map<number, number>>()
    filasTodasInstAnio.forEach((s) => {
      if (s.puntajeGlobal == null) return
      const k = etiquetaInst(s)
      const e = m.get(k) ?? new Map<number, number>()
      e.set(s.anio, s.puntajeGlobal)
      m.set(k, e)
    })
    return [...m.entries()]
      .map(([nombre, e]) => ({ nombre, partes: anios.map((a, i) => ({ nombre: String(a), valor: e.get(a) ?? 0, color: coloresAnio[i] })) }))
      .sort((a, b) => b.partes.reduce((s, p) => s + p.valor, 0) - a.partes.reduce((s, p) => s + p.valor, 0) || alfa(a.nombre, b.nombre))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasTodasInstAnio, anios, coloresAnio])
  const opcionInstitucionesAnio = useMemo(() => apiladasH({ filas: porInstitucionAnio, fmt: num1, agrupadas: true, mostrarValores: true }), [porInstitucionAnio])

  // Clasificación: distribución del año activo.
  const delAnioFoco = useMemo(() => filas.filter((s) => s.anio === anioFoco), [filas, anioFoco])
  // Instituciones con puntaje en el año activo: la misma base que "frente a [año anterior]", para que los números del encabezado coincidan.
  const conDatoAnioFoco = useMemo(() => delAnioFoco.filter((s) => s.puntajeGlobal != null), [delAnioFoco])
  const pClasif = useMemo(() => {
    const p = agrupar(delAnioFoco.filter((s) => s.clasificacion), (s) => s.clasificacion, () => 1)
    return [...p].sort((a, b) => ORDEN_CLASIF.indexOf(a.nombre) - ORDEN_CLASIF.indexOf(b.nombre))
  }, [delAnioFoco])
  const opcionClasif = useMemo(
    () => dona({ partes: pClasif.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorClasificacion(p.nombre) })), centro: num(pClasif.reduce((s, p) => s + p.valor, 0)), sub: 'instituciones', fmt: num, seleccion: clasificacionSel }),
    [pClasif, clasificacionSel],
  )
  // Mezcla de clasificaciones por municipio (ignora el filtro de municipio y el de clasificación: es justo lo que muestra).
  const filasClasifPorMuni = useMemo(() => datos.saber11.filter((s) => conInst(s) && s.anio === anioFoco), [datos, institucionSel, anioFoco]) // eslint-disable-line react-hooks/exhaustive-deps
  const clasifPorMuni = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    filasClasifPorMuni.forEach((s) => {
      if (!s.clasificacion) return
      const e = m.get(s.municipio) ?? new Map<string, number>()
      e.set(s.clasificacion, (e.get(s.clasificacion) ?? 0) + 1)
      m.set(s.municipio, e)
    })
    const necesitaApoyo = (e: Map<string, number>) => {
      const total = [...e.values()].reduce((s, v) => s + v, 0)
      return total ? ((e.get('C') ?? 0) + (e.get('D') ?? 0)) / total : 0
    }
    return [...m.entries()]
      .map(([nombre, e]) => {
        const total = [...e.values()].reduce((s, v) => s + v, 0)
        return { nombre, necesitaApoyo: necesitaApoyo(e), partes: ORDEN_CLASIF.map((c) => ({ nombre: c, valor: total ? ((e.get(c) ?? 0) / total) * 100 : 0, color: colorClasificacion(c) })) }
      })
      .sort((a, b) => b.necesitaApoyo - a.necesitaApoyo || alfa(a.nombre, b.nombre))
  }, [filasClasifPorMuni])
  const opcionClasifPorMuni = useMemo(() => apiladasH({ filas: clasifPorMuni.map(({ nombre, partes }) => ({ nombre, partes })), fmt: (n) => pct(n / 100, 0) }), [clasifPorMuni])

  // Detalle completo: una fila por institución (la del año activo), con buscador; el clic abre el historial completo.
  const [buscarDetalle, setBuscarDetalle] = useState('')
  const [modalInst, setModalInst] = useState<string | null>(null)
  const detalleInst = useMemo(() => {
    const t = buscarDetalle.trim().toLowerCase()
    return [...delAnioFoco]
      .filter((s) => !t || s.municipio.toLowerCase().includes(t) || etiquetaInst(s).toLowerCase().includes(t))
      .sort((a, b) => alfa(a.municipio, b.municipio) || alfa(etiquetaInst(a), etiquetaInst(b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delAnioFoco, buscarDetalle])
  const registrosModal = useMemo(() => (modalInst ? [...datos.saber11].filter((s) => etiquetaInst(s) === modalInst).sort((a, b) => a.anio - b.anio) : []), [datos, modalInst]) // eslint-disable-line react-hooks/exhaustive-deps
  const opcionModal = useMemo(
    () => columnas({ categorias: registrosModal.map((r) => String(r.anio)), series: [{ nombre: 'Puntaje global', color: placa.main, datos: registrosModal.map((r) => r.puntajeGlobal ?? 0) }], fmt: num1 }),
    [registrosModal],
  )

  // Filtros
  const municipiosDisp = useMemo(() => [...new Set(datos.saber11.map((s) => s.municipio))].sort(alfa), [datos])
  const institucionesDisp = useMemo(() => [...new Set(datos.saber11.map(etiquetaInst))].sort(alfa), [datos]) // eslint-disable-line react-hooks/exhaustive-deps
  const grupos: GrupoFiltro[] = [
    { clave: 'municipio', titulo: 'Municipio', opciones: municipiosDisp, valor: f.municipios, onChange: f.setMunicipios, abierto: true },
    { clave: 'institucion', titulo: 'Institución Educativa', opciones: institucionesDisp, valor: institucionSel, onChange: setInstitucionSel },
    { clave: 'clasificacion', titulo: `Clasificación (${anioFoco})`, opciones: ORDEN_CLASIF, valor: clasificacionSel, onChange: setClasificacionSel },
  ]
  const etiquetas = etiquetasDe(undefined, grupos)
  const limpiar = () => {
    f.setMunicipios([])
    setInstitucionSel([])
    setClasificacionSel([])
  }
  const contextoFiltros = fraseFiltros(fraseValores(f.municipios, 'municipios'), fraseValores(institucionSel, 'instituciones'), fraseValores(clasificacionSel, 'clasificaciones'))

  // Tablas (Excel y toggle Visual/Tabla)
  const tablaAnioT = {
    archivo: 'saber11-por-anio',
    columnas: [
      { clave: 'anio', titulo: 'Año' },
      { clave: 'global', titulo: 'Puntaje global', tipo: 'numero' as const },
      { clave: 'lectura', titulo: 'Lectura crítica', tipo: 'numero' as const },
      { clave: 'matematicas', titulo: 'Matemáticas', tipo: 'numero' as const },
      { clave: 'sociales', titulo: 'Sociales y ciudadanas', tipo: 'numero' as const },
      { clave: 'ciencias', titulo: 'Ciencias naturales', tipo: 'numero' as const },
      { clave: 'ingles', titulo: 'Inglés', tipo: 'numero' as const },
    ],
    filas: porAnio.map((a) => ({ anio: String(a.anio), global: redondear(a.global), lectura: redondear(a.lectura), matematicas: redondear(a.matematicas), sociales: redondear(a.sociales), ciencias: redondear(a.ciencias), ingles: redondear(a.ingles) })),
  }
  const tablaMunicipioTotalT = {
    archivo: 'saber11-municipios',
    columnas: [{ clave: 'nombre', titulo: 'Municipio' }, { clave: 'valor', titulo: 'Puntaje global promedio', tipo: 'numero' as const }, { clave: 'cantidad', titulo: 'Instituciones', tipo: 'numero' as const }],
    filas: porMuni.map((p) => ({ nombre: p.nombre, valor: redondear(p.valor), cantidad: p.cantidad })),
  }
  const tablaMunicipioAnioT = {
    archivo: 'saber11-municipios-por-anio',
    columnas: [{ clave: 'nombre', titulo: 'Municipio' }, ...anios.map((a) => ({ clave: String(a), titulo: String(a), tipo: 'numero' as const }))],
    filas: porMunicipioAnio.map((m) => ({ nombre: m.nombre, ...Object.fromEntries(m.partes.map((p) => [p.nombre, redondear(p.valor)])) })),
  }
  const tablaMunicipioT = vistaMuni === 'anio' ? tablaMunicipioAnioT : tablaMunicipioTotalT
  const tablaInstitucionTotalT = {
    archivo: 'saber11-instituciones',
    columnas: [{ clave: 'nombre', titulo: 'Institución' }, { clave: 'valor', titulo: 'Puntaje global', tipo: 'numero' as const }, { clave: 'clasificacion', titulo: 'Clasificación' }],
    filas: porInstDatos.map((p) => ({ nombre: p.nombre, valor: p.valor, clasificacion: p.clasificacion || '—' })),
  }
  const tablaInstitucionAnioT = {
    archivo: 'saber11-instituciones-por-anio',
    columnas: [{ clave: 'nombre', titulo: 'Institución' }, ...anios.map((a) => ({ clave: String(a), titulo: String(a), tipo: 'numero' as const }))],
    filas: porInstitucionAnio.map((m) => ({ nombre: m.nombre, ...Object.fromEntries(m.partes.map((p) => [p.nombre, p.valor])) })),
  }
  const tablaInstitucionT = vistaInst === 'anio' ? tablaInstitucionAnioT : tablaInstitucionTotalT
  const tablaBaseT = {
    archivo: 'saber11-base-de-datos',
    columnas: [
      { clave: 'municipio', titulo: 'Municipio' },
      { clave: 'institucion', titulo: 'Institución' },
      { clave: 'anio', titulo: 'Año' },
      { clave: 'puntaje_global', titulo: 'Puntaje global', tipo: 'numero' as const },
      { clave: 'lectura_critica', titulo: 'Lectura crítica', tipo: 'numero' as const },
      { clave: 'matematicas', titulo: 'Matemáticas', tipo: 'numero' as const },
      { clave: 'sociales_ciudadanas', titulo: 'Sociales y ciudadanas', tipo: 'numero' as const },
      { clave: 'ciencias_naturales', titulo: 'Ciencias naturales', tipo: 'numero' as const },
      { clave: 'ingles', titulo: 'Inglés', tipo: 'numero' as const },
      { clave: 'clasificacion', titulo: 'Clasificación' },
    ],
    filas: [...filas]
      .sort((a, b) => alfa(a.municipio, b.municipio) || alfa(etiquetaInst(a), etiquetaInst(b)) || a.anio - b.anio)
      .map((s) => ({
        municipio: s.municipio, institucion: etiquetaInst(s), anio: String(s.anio),
        puntaje_global: s.puntajeGlobal ?? '', lectura_critica: s.lecturaCritica ?? '', matematicas: s.matematicas ?? '',
        sociales_ciudadanas: s.socialesCiudadanas ?? '', ciencias_naturales: s.cienciasNaturales ?? '', ingles: s.ingles ?? '',
        clasificacion: s.clasificacion || '',
      })),
  }
  const hojasExcel = [
    { nombre: 'Base de datos', tabla: tablaBaseT },
    { nombre: 'Año tras año', tabla: tablaAnioT },
    { nombre: 'Municipio', tabla: tablaMunicipioT },
    { nombre: 'Institución', tabla: tablaInstitucionT },
  ]

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Saber 11" texto="Puntajes y clasificación de las pruebas Saber 11, 2023-2025, en las instituciones educativas rurales que acompañamos.">
        <BotonExcel archivo="saber11-educacion-rural-caldas" hojas={hojasExcel} />
      </PlacaCabecera>

      <ConFiltros
        panel={
          <div>
            <h2 className="display flex items-center gap-2 pb-3 text-2xl" style={{ color: 'var(--ink)' }}>
              Año
            </h2>
            <div role="radiogroup" aria-label="Año" className="mb-5 flex flex-wrap gap-2">
              {anios.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={anioFoco === a} onClick={() => setAnioFoco(a)} className={`cota rounded-full px-4 py-2 text-sm font-semibold transition-colors ${anioFoco === a ? 'bg-main text-on' : 'bg-soft ring-1 ring-line hover:ring-main'}`}>
                  {a}
                </button>
              ))}
            </div>
            <PanelFiltros grupos={grupos} etiquetas={etiquetas} onLimpiar={limpiar} />
          </div>
        }
        etiquetas={etiquetas}
        onLimpiar={limpiar}
      >
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <MapaCaldas datos={datosMapa} placa={placa} fmt={(n) => num1(n + pisoMapa)} seleccion={f.municipios} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} etiqueta={`Puntaje global promedio por municipio, ${anioFoco}`} extra={extraMapa} />
          <div className="space-y-6 rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
            <Cifra tam="lg" valor={num1(promedioFoco)} etiqueta={`puntaje global promedio, ${anioFoco}`} />
            <p className="text-lg leading-relaxed text-ink2">
              En <Marca>{num(unicos(conDatoAnioFoco, (s) => s.municipio).size)} municipios</Marca> y <Marca>{num(unicos(conDatoAnioFoco, etiquetaInst).size)} instituciones</Marca> con puntaje en {anioFoco}.
              {contextoFiltros && <> Datos de <Marca>{contextoFiltros}</Marca>.</>}
            </p>
            {comparacion && (
              <p className="text-lg leading-relaxed text-ink2">
                Frente a {anioAnterior}: <Marca color="#BFEBCF">{num(comparacion.subieron)} subieron</Marca>, <Marca color="#FFC9CB">{num(comparacion.bajaron)} bajaron</Marca> y <Marca>{num(comparacion.igual)} se mantuvieron igual</Marca>.
              </p>
            )}
          </div>
        </div>

        <Seccion titulo="Año tras año" nota="Puntaje global promedio y el de cada área, comparados entre 2023, 2024 y 2025." tabla={tablaAnioT}>
          <div className="space-y-8">
            <TablaAnios filas={porAnio.map((a) => ({ anio: a.anio, valores: [redondear(a.global)] }))} series={[{ nombre: 'Puntaje global', color: placa.main }]} fmt={num1} />
            <Grafico etiqueta="Puntaje promedio por área, comparado entre años" alto={340} opcion={opcionAreas} />
            {cambiosAreas && (
              <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-left font-bold">Área</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">{anioAnterior}</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">{anioFoco}</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Cambio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambiosAreas.map((c) => (
                      <tr key={c.nombre} className="border-b border-line last:border-0">
                        <td className="px-3 py-2.5 font-bold" style={{ color: 'var(--ink)' }}>{c.nombre}</td>
                        <td className="cota px-3 py-2.5 text-right">{num1(c.previo)}</td>
                        <td className="cota px-3 py-2.5 text-right font-semibold">{num1(c.actual)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {c.delta === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <span className={`cota inline-flex items-center gap-1 font-bold ${c.delta >= 0 ? 'text-good' : 'text-bad'}`}>
                              <Icono n={c.delta >= 0 ? 'arriba' : 'abajo'} size={13} />
                              {pct(Math.abs(c.delta), 1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Seccion>

        <Seccion titulo="Municipios" nota="Puntaje global promedio de cada municipio. Toca uno para filtrar." tono="lavado" acciones={<Segmentado etiqueta="Dividir por" valor={vistaMuni} onChange={setVistaMuni} opciones={[{ id: 'total', texto: 'Total' }, { id: 'anio', texto: 'Por año' }]} />} tabla={tablaMunicipioT}>
          <div className="max-h-[480px] overflow-y-auto rounded-3xl bg-white p-5 ring-1 ring-line">
            {vistaMuni === 'total' ? (
              <RankingBarras items={porMuni} fmtValor={num1} fmtCantidad={num} tituloValor="Puntaje global" tituloCantidad="Instituciones" colorBase={placa.main} seleccion={f.municipios} onClic={(n) => f.setMunicipios(alternar(f.municipios, n))} limite={porMuni.length} escalaDesdeMinimo />
            ) : (
              <Grafico etiqueta="Puntaje global por municipio, dividido por año" alto={altoBarras(porMunicipioAnio.length, 1.7)} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} opcion={opcionMunicipiosAnio} sinRecuadro />
            )}
          </div>
        </Seccion>

        <Seccion
          titulo="Instituciones"
          nota={`Puntaje global de cada institución en ${anioFoco}, coloreado por su clasificación. Toca una para filtrar.`}
          acciones={<Segmentado etiqueta="Dividir por" valor={vistaInst} onChange={setVistaInst} opciones={[{ id: 'total', texto: 'Total' }, { id: 'anio', texto: 'Por año' }]} />}
          tabla={tablaInstitucionT}
        >
          <div className="max-h-[480px] overflow-y-auto rounded-3xl bg-white p-5 ring-1 ring-line">
            {vistaInst === 'total' ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 text-xs font-semibold text-ink2">
                  {ORDEN_CLASIF.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: colorClasificacion(c) }} />
                      {c}
                    </span>
                  ))}
                </div>
                <RankingBarras items={porInst} fmtValor={num1} tituloValor="Puntaje global" colorBase={placa.main} seleccion={institucionSel} onClic={(n) => setInstitucionSel(alternar(institucionSel, n))} limite={porInst.length} escalaDesdeMinimo />
              </>
            ) : (
              <Grafico etiqueta="Puntaje global por institución, dividido por año" alto={altoBarras(porInstitucionAnio.length, 1.7)} alClic={(n) => setInstitucionSel(alternar(institucionSel, n))} opcion={opcionInstitucionesAnio} sinRecuadro />
            )}
          </div>
        </Seccion>

        <Seccion titulo="Clasificación" nota={`Cuántas instituciones quedaron en cada categoría del MEN en ${anioFoco}: A+ y A sobresalen, B es medio, C y D necesitan más apoyo.`} tono="lavado">
          <div className="grid items-center gap-6 sm:grid-cols-2">
            <Grafico etiqueta={`Instituciones por clasificación, ${anioFoco}`} alto={300} opcion={opcionClasif} />
            <Posiciones items={pClasif.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorClasificacion(p.nombre) }))} fmt={num} onClic={(n) => setClasificacionSel(alternar(clasificacionSel, n))} seleccion={clasificacionSel} />
          </div>
          <div className="mt-8">
            <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
              Por municipio
            </h3>
            <p className="mb-4 max-w-2xl text-sm text-ink2">
              Mezcla de clasificaciones en cada municipio, en {anioFoco}. Ordenados de más a menos instituciones en C o D. Toca uno para filtrar.
            </p>
            <div className="max-h-[480px] overflow-y-auto rounded-3xl bg-white p-5 ring-1 ring-line">
              <Grafico etiqueta={`Clasificación por municipio, ${anioFoco}`} alto={altoBarras(clasifPorMuni.length)} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} opcion={opcionClasifPorMuni} sinRecuadro />
            </div>
          </div>
        </Seccion>

        <Seccion
          titulo="Detalle completo"
          nota={`Una fila por institución, con sus datos de ${anioFoco}. Toca una para ver su historial completo.`}
          acciones={
            <div className="relative">
              <Icono n="buscar" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={buscarDetalle} onChange={(e) => setBuscarDetalle(e.target.value)} placeholder="Buscar municipio o institución…" aria-label="Buscar municipio o institución" className="w-56 rounded-full bg-white py-2 pl-9 pr-3 text-sm outline-none ring-1 ring-line focus:ring-main" />
            </div>
          }
        >
          <div className="max-h-[640px] overflow-auto rounded-2xl bg-white ring-1 ring-line">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-left font-bold">Municipio</th>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-left font-bold">Institución</th>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Puntaje global</th>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Lectura crítica</th>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Matemáticas</th>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Sociales y ciudadanas</th>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Ciencias naturales</th>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Inglés</th>
                  <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Clasificación</th>
                </tr>
              </thead>
              <tbody>
                {detalleInst.map((s) => (
                  <tr
                    key={s.dane}
                    tabIndex={0}
                    role="button"
                    onClick={() => setModalInst(etiquetaInst(s))}
                    onKeyDown={(e) => e.key === 'Enter' && setModalInst(etiquetaInst(s))}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-wash/60"
                  >
                    <td className="px-3 py-2">{s.municipio}</td>
                    <td className="px-3 py-2 font-bold" style={{ color: 'var(--ink)' }}>{etiquetaInst(s)}</td>
                    <td className="cota px-3 py-2 text-center font-semibold">{s.puntajeGlobal != null ? num1(s.puntajeGlobal) : '—'}</td>
                    <td className="cota px-3 py-2 text-center">{s.lecturaCritica != null ? num1(s.lecturaCritica) : '—'}</td>
                    <td className="cota px-3 py-2 text-center">{s.matematicas != null ? num1(s.matematicas) : '—'}</td>
                    <td className="cota px-3 py-2 text-center">{s.socialesCiudadanas != null ? num1(s.socialesCiudadanas) : '—'}</td>
                    <td className="cota px-3 py-2 text-center">{s.cienciasNaturales != null ? num1(s.cienciasNaturales) : '—'}</td>
                    <td className="cota px-3 py-2 text-center">{s.ingles != null ? num1(s.ingles) : '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {s.clasificacion ? (
                        <span className="cota inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: colorClasificacion(s.clasificacion) }}>
                          {s.clasificacion}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
                {detalleInst.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-muted">Sin instituciones con los filtros actuales</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 px-1 text-xs text-ink2">{num(detalleInst.length)} instituciones.</p>
        </Seccion>
      </ConFiltros>

      {modalInst && (
        <Modal titulo={modalInst} subtitulo={registrosModal[0]?.municipio} onCerrar={() => setModalInst(null)}>
          {registrosModal.length > 0 && (
            <div className="space-y-6">
              <Grafico etiqueta={`Puntaje global de ${modalInst} por año`} alto={240} opcion={opcionModal} />
              <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-left font-bold">Año</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Puntaje global</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Lectura crítica</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Matemáticas</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Sociales y ciudadanas</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Ciencias naturales</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Inglés</th>
                      <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-center font-bold">Clasificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosModal.map((r) => (
                      <tr key={r.anio} className="border-b border-line last:border-0">
                        <td className="display px-3 py-2.5 text-xl" style={{ color: 'var(--ink)' }}>{r.anio}</td>
                        <td className="cota px-3 py-2.5 text-center font-semibold">{r.puntajeGlobal != null ? num1(r.puntajeGlobal) : '—'}</td>
                        <td className="cota px-3 py-2.5 text-center">{r.lecturaCritica != null ? num1(r.lecturaCritica) : '—'}</td>
                        <td className="cota px-3 py-2.5 text-center">{r.matematicas != null ? num1(r.matematicas) : '—'}</td>
                        <td className="cota px-3 py-2.5 text-center">{r.socialesCiudadanas != null ? num1(r.socialesCiudadanas) : '—'}</td>
                        <td className="cota px-3 py-2.5 text-center">{r.cienciasNaturales != null ? num1(r.cienciasNaturales) : '—'}</td>
                        <td className="cota px-3 py-2.5 text-center">{r.ingles != null ? num1(r.ingles) : '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          {r.clasificacion ? (
                            <span className="cota inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: colorClasificacion(r.clasificacion) }}>
                              {r.clasificacion}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
