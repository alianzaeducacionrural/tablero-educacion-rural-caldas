import { useMemo, useState } from 'react'
import { Grafico } from '../components/Grafico'
import { Fila, MultiSelect } from '../components/controles'
import type { TablaDatos } from '../components/Tabla'
import { Kpi, Kpis, Tarjeta } from '../components/Tarjetas'
import { agrupar, top, unicos, type Par } from '../lib/agregar'
import { colorEstadoEstudiante, serie } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { num, pct } from '../lib/formato'
import { altoBarras, barrasH, columnas } from '../lib/graficos'
import { useTema } from '../lib/tema'
import type { Estudiante } from '../lib/tipos'
import { pasa, useTablero } from '../lib/usarFiltrado'

type Local = 'cohorte' | 'universidad' | 'programa' | 'estado' | 'genero' | 'institucion'
type Dim = Local | 'municipio'
const TOP = 12
const ORDEN_ESTADO = ['Graduado', 'Activo', 'Pendiente de grado', 'Desertor']
const ordenEstado = (e: string) => (ORDEN_ESTADO.indexOf(e) < 0 ? 99 : ORDEN_ESTADO.indexOf(e))

export function Estudiantes() {
  const { datos, f } = useTablero()
  const { tema } = useTema()
  const [sel, setSel] = useState<Record<Local, string[]>>({ cohorte: [], universidad: [], programa: [], estado: [], genero: [], institucion: [] })

  // Solo los financiados por la Gobernación. Sin nombres: el tablero es público.
  const filas = useMemo(() => datos.estudiantes.filter((e) => /gobernaci/i.test(e.financiador)), [datos])

  const vistas = useMemo(() => {
    const valorDe: Record<Local, (e: Estudiante) => string> = {
      cohorte: (e) => String(e.anioIngreso),
      universidad: (e) => e.universidad,
      programa: (e) => e.programa,
      estado: (e) => e.estado,
      genero: (e) => e.genero,
      institucion: (e) => e.institucion,
    }
    const ok = (e: Estudiante, omitir?: Dim) => (omitir === 'municipio' || pasa(f, null, e.municipio)) && (Object.keys(valorDe) as Local[]).every((d) => d === omitir || !sel[d].length || sel[d].includes(valorDe[d](e)))
    const de = (omitir?: Dim) => filas.filter((e) => ok(e, omitir))
    return { todas: de(), cohorte: de('cohorte'), universidad: de('universidad'), programa: de('programa'), estado: de('estado'), genero: de('genero'), institucion: de('institucion'), municipio: de('municipio') }
  }, [filas, f, sel])

  const opciones = useMemo(() => {
    const u = (c: (e: Estudiante) => string) => [...unicos(filas, c)]
    return { cohorte: u((e) => String(e.anioIngreso)), universidad: u((e) => e.universidad), programa: u((e) => e.programa), estado: u((e) => e.estado), institucion: u((e) => e.institucion) }
  }, [filas])

  const alt = (d: Local) => (n: string) => setSel((s) => ({ ...s, [d]: alternar(s[d], n) }))
  const set = (d: Local) => (l: string[]) => setSel((s) => ({ ...s, [d]: l }))
  const hayLocales = Object.values(sel).some((l) => l.length)

  const t = vistas.todas
  const cuenta = (re: RegExp) => t.filter((e) => re.test(e.estado)).length
  const graduados = t.filter((e) => /^graduado$/i.test(e.estado)).length
  const desertores = cuenta(/desert/i)
  const pendientes = cuenta(/pendiente/i)
  const activos = t.filter((e) => /^activo$/i.test(e.estado)).length

  const uno = () => 1
  const pares = (v: Estudiante[], clave: (e: Estudiante) => string): Par[] => agrupar(v, clave, uno)
  const pEstado = pares(vistas.estado, (e) => e.estado).sort((a, b) => ordenEstado(a.nombre) - ordenEstado(b.nombre))
  const pUni = pares(vistas.universidad, (e) => e.universidad)
  const pProg = pares(vistas.programa, (e) => e.programa)
  const pMuni = pares(vistas.municipio, (e) => e.municipio)
  const pInst = pares(vistas.institucion, (e) => e.institucion)
  const pGen = pares(vistas.genero, (e) => e.genero)

  const cohortes = [...new Set(filas.map((e) => e.anioIngreso))].sort()
  const estados = [...new Set(filas.map((e) => e.estado))].sort((a, b) => ordenEstado(a) - ordenEstado(b))
  const aniosGrad = [...new Set(t.map((e) => e.anioGraduacion).filter((a): a is number => a !== null))].sort()

  const tabla = (col: string, p: Par[], archivo: string): TablaDatos => ({
    archivo,
    columnas: [{ clave: 'nombre', titulo: col }, { clave: 'valor', titulo: 'Estudiantes', tipo: 'numero' }],
    filas: p.map((x) => ({ nombre: x.nombre, valor: x.valor })),
  })
  const barras = (p: Par[], nombre: string, alClic: (n: string) => void, seleccion: string[], ancho?: number, colorDe?: (n: string) => string) => {
    const items = top(p, TOP).map((x) => ({ ...x, color: colorDe?.(x.nombre) }))
    return <Grafico etiqueta={`Estudiantes por ${nombre}`} alto={altoBarras(items.length)} alClic={alClic} opcion={barrasH({ items, color: serie(tema, 0), tema, fmt: num, seleccion, etiquetas: true, anchoEtiqueta: ancho })} />
  }
  const nota = (todos: number) => (todos > TOP ? `Los ${TOP} mayores de ${num(todos)}. La tabla muestra todos.` : undefined)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Estudiantes técnicos y tecnólogos</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink2">Estudiantes de Universidad en el Campo cuya formación financia la Gobernación de Caldas. No se muestran nombres. El filtro de año no aplica aquí: usa la cohorte (año de ingreso).</p>
      </div>

      <Fila>
        <MultiSelect etiqueta="Cohorte" opciones={opciones.cohorte} valor={sel.cohorte} onChange={set('cohorte')} ancho="w-44" />
        <MultiSelect etiqueta="Universidad" opciones={opciones.universidad} valor={sel.universidad} onChange={set('universidad')} />
        <MultiSelect etiqueta="Programa" opciones={opciones.programa} valor={sel.programa} onChange={set('programa')} ancho="w-96" />
        <MultiSelect etiqueta="Estado" opciones={opciones.estado} valor={sel.estado} onChange={set('estado')} />
        <MultiSelect etiqueta="Institución" opciones={opciones.institucion} valor={sel.institucion} onChange={set('institucion')} ancho="w-80" />
        {hayLocales && (
          <button type="button" onClick={() => setSel({ cohorte: [], universidad: [], programa: [], estado: [], genero: [], institucion: [] })} className="rounded-lg px-2.5 py-1.5 text-sm text-accentink hover:bg-wash">
            Quitar estos filtros
          </button>
        )}
      </Fila>

      <Kpis columnas={5}>
        <Kpi titulo="Estudiantes financiados" valor={num(t.length)} detalle={`${num(unicos(t, (e) => e.municipio).size)} municipios · ${num(unicos(t, (e) => e.programa).size)} programas`} />
        <Kpi titulo="Graduados" valor={num(graduados)} detalle={t.length ? `▲ ${pct(graduados / t.length)} del total` : undefined} />
        <Kpi titulo="Deserción" valor={num(desertores)} detalle={t.length ? `▼ ${pct(desertores / t.length)} del total` : undefined} />
        <Kpi titulo="Activos" valor={num(activos)} />
        <Kpi titulo="Pendientes de grado" valor={num(pendientes)} />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Tarjeta titulo="Estado de los estudiantes" nota="Toca una barra para filtrar por estado." tabla={tabla('Estado', pEstado, 'estudiantes-por-estado')}>
          {barras(pEstado, 'estado', alt('estado'), sel.estado, 150, (n) => colorEstadoEstudiante(tema, n))}
        </Tarjeta>

        <Tarjeta
          titulo="¿Cómo va cada cohorte?"
          nota="Estudiantes por año de ingreso, según su estado hoy."
          tabla={{
            archivo: 'estudiantes-por-cohorte',
            columnas: [{ clave: 'cohorte', titulo: 'Cohorte' }, ...estados.map((e) => ({ clave: e, titulo: e, tipo: 'numero' as const }))],
            filas: cohortes.map((c) => ({ cohorte: String(c), ...Object.fromEntries(estados.map((e) => [e, vistas.cohorte.filter((x) => x.anioIngreso === c && x.estado === e).length])) })),
          }}
        >
          <Grafico
            etiqueta="Estudiantes por cohorte y estado"
            alto={300}
            alClic={alt('cohorte')}
            opcion={columnas({
              categorias: cohortes.map(String),
              series: estados.map((e) => ({ nombre: e, color: colorEstadoEstudiante(tema, e), datos: cohortes.map((c) => vistas.cohorte.filter((x) => x.anioIngreso === c && x.estado === e).length) })),
              tema,
              fmt: num,
              totales: true,
              seleccion: sel.cohorte,
            })}
          />
        </Tarjeta>

        <Tarjeta titulo="Por universidad" tabla={tabla('Universidad', pUni, 'estudiantes-por-universidad')}>
          {barras(pUni, 'universidad', alt('universidad'), sel.universidad, 190)}
        </Tarjeta>

        <Tarjeta titulo="Por programa" nota={nota(pProg.length)} tabla={tabla('Programa', pProg, 'estudiantes-por-programa')}>
          {barras(pProg, 'programa', alt('programa'), sel.programa, 300)}
        </Tarjeta>

        <Tarjeta titulo="Por municipio" nota={nota(pMuni.length)} tabla={tabla('Municipio', pMuni, 'estudiantes-por-municipio')}>
          {barras(pMuni, 'municipio', (n) => f.setMunicipios(alternar(f.municipios, n)), f.municipios)}
        </Tarjeta>

        <Tarjeta titulo="Por institución educativa" nota={nota(pInst.length)} tabla={tabla('Institución', pInst, 'estudiantes-por-institucion')}>
          {barras(pInst, 'institución', alt('institucion'), sel.institucion, 200)}
        </Tarjeta>

        <Tarjeta titulo="Por género" tabla={tabla('Género', pGen, 'estudiantes-por-genero')}>
          {barras(pGen, 'género', alt('genero'), sel.genero, 110)}
        </Tarjeta>

        <Tarjeta
          titulo="Graduados por año de grado"
          tabla={{
            archivo: 'graduados-por-anio',
            columnas: [{ clave: 'anio', titulo: 'Año de grado' }, { clave: 'n', titulo: 'Graduados', tipo: 'numero' }],
            filas: aniosGrad.map((a) => ({ anio: String(a), n: t.filter((e) => e.anioGraduacion === a).length })),
          }}
        >
          <Grafico
            etiqueta="Graduados por año de grado"
            alto={260}
            opcion={columnas({ categorias: aniosGrad.map(String), series: [{ nombre: 'Graduados', color: serie(tema, 0), datos: aniosGrad.map((a) => t.filter((e) => e.anioGraduacion === a).length) }], tema, fmt: num })}
          />
        </Tarjeta>
      </div>
    </div>
  )
}
