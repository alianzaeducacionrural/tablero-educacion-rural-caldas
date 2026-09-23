import { useMemo, useState } from 'react'
import { Grafico } from '../components/Grafico'
import { Fila, MultiSelect, Segmentado } from '../components/controles'
import { Kpi, Kpis, Tarjeta } from '../components/Tarjetas'
import type { TablaDatos } from '../components/Tabla'
import { agrupar, sumar, top, unicos, type Par } from '../lib/agregar'
import { colorAportante, colorEstadoActividad, colorPrograma } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { cant, cop, copM, ejeM, num, pct } from '../lib/formato'
import { altoBarras, barrasH, columnas } from '../lib/graficos'
import { useTema } from '../lib/tema'
import { PROGRAMAS, type FilaBase, type Programa as Prog } from '../lib/tipos'
import { pasa, useTablero } from '../lib/usarFiltrado'

type Local = 'grupo' | 'estado' | 'aportante' | 'institucion' | 'actividad'
type Dim = Local | 'municipio' | 'anio'
const TOP = 12

export function Programa({ programa }: { programa: Prog }) {
  const { datos, f } = useTablero()
  const { tema } = useTema()
  const cfg = PROGRAMAS[programa]
  const [medida, setMedida] = useState<'valor' | 'cantidad'>('valor')
  const [sel, setSel] = useState<Record<Local, string[]>>({ grupo: [], estado: [], aportante: [], institucion: [], actividad: [] })

  const filas = useMemo(() => datos.base.filter((x) => x.programa === programa), [datos, programa])

  // "Pío XII" existe en 3 municipios: solo se añade el municipio cuando el nombre se repite.
  const repetidos = useMemo(() => {
    const m = new Map<string, Set<string>>()
    filas.forEach((x) => m.set(x.institucion, (m.get(x.institucion) ?? new Set()).add(x.municipio)))
    return new Set([...m].filter(([, s]) => s.size > 1).map(([n]) => n))
  }, [filas])
  const etiquetaInst = (x: FilaBase) => (repetidos.has(x.institucion) ? `${x.institucion} (${x.municipio})` : x.institucion)

  // Cada gráfico se calcula con todos los filtros MENOS el suyo: así sus barras hermanas siguen visibles
  // y la seleccionada queda resaltada (como el resaltado cruzado de Power BI).
  const vistas = useMemo(() => {
    const ok = (x: FilaBase, omitir?: Dim) =>
      (omitir === 'anio' || pasa(f, x.anio, null)) &&
      (omitir === 'municipio' || pasa(f, null, x.municipio)) &&
      (omitir === 'grupo' || !sel.grupo.length || sel.grupo.includes(x.grupo)) &&
      (omitir === 'estado' || !sel.estado.length || sel.estado.includes(x.estado)) &&
      (omitir === 'aportante' || !sel.aportante.length || sel.aportante.includes(x.aportante)) &&
      (omitir === 'institucion' || !sel.institucion.length || sel.institucion.includes(etiquetaInst(x))) &&
      (omitir === 'actividad' || !sel.actividad.length || sel.actividad.includes(x.actividad))
    const de = (omitir?: Dim) => filas.filter((x) => ok(x, omitir))
    return { todas: de(), grupo: de('grupo'), estado: de('estado'), aportante: de('aportante'), institucion: de('institucion'), actividad: de('actividad'), municipio: de('municipio'), anio: de('anio') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, f, sel, repetidos])

  const v = (x: FilaBase) => (medida === 'valor' ? x.valor : x.cantidad)
  const fmt = medida === 'valor' ? copM : cant
  const fmtEje = medida === 'valor' ? ejeM : num
  const titulo = medida === 'valor' ? 'Valor' : 'Cantidad'
  const colorPrincipal = colorPrograma(tema, programa)

  const opciones = useMemo(() => {
    const u = (c: (x: FilaBase) => string) => [...unicos(filas, c)]
    return { grupo: u((x) => x.grupo), estado: u((x) => x.estado), aportante: u((x) => x.aportante), institucion: u(etiquetaInst), actividad: u((x) => x.actividad) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, repetidos])

  const alt = (d: Local) => (n: string) => setSel((s) => ({ ...s, [d]: alternar(s[d], n) }))
  const hayLocales = Object.values(sel).some((l) => l.length)

  const total = sumar(vistas.todas, (x) => x.valor)
  const depto = sumar(vistas.todas.filter((x) => /depto|departamento|gobernaci/i.test(x.aportante)), (x) => x.valor)
  const comite = sumar(vistas.todas.filter((x) => /comit/i.test(x.aportante)), (x) => x.valor)
  const noAsistio = vistas.todas.filter((x) => !x.asistio)
  const extra = sumar(vistas.todas.filter((x) => !/^convenio$/i.test(x.estado)), (x) => x.valor)

  const tabla = (nombreCol: string, pares: Par[], archivo: string): TablaDatos => ({
    archivo,
    columnas: [
      { clave: 'nombre', titulo: nombreCol },
      { clave: 'valor', titulo, tipo: medida === 'valor' ? 'moneda' : 'cantidad' },
    ],
    filas: pares.map((p) => ({ nombre: p.nombre, valor: p.valor })),
  })

  const pGrupo = agrupar(vistas.grupo, (x) => x.grupo, v)
  const pMuni = agrupar(vistas.municipio, (x) => x.municipio, v)
  const pInst = agrupar(vistas.institucion, etiquetaInst, v)
  const pAct = agrupar(vistas.actividad, (x) => x.actividad, v)
  const pEstado = agrupar(vistas.estado, (x) => x.estado, v)
  const pAport = agrupar(vistas.aportante, (x) => x.aportante, v)

  const anios = [...new Set(filas.map((x) => x.anio))].sort()
  const aportantes = [...new Set(filas.map((x) => x.aportante))].sort()

  const barras = (pares: Par[], color: string, opts: { alClic: (n: string) => void; sel: string[]; ancho?: number; nombre: string; colorDe?: (n: string) => string; alto?: number }) => {
    const items = top(pares, TOP).map((p) => ({ ...p, color: opts.colorDe?.(p.nombre) }))
    return (
      <Grafico
        etiqueta={`${titulo} por ${opts.nombre}`}
        alto={opts.alto ?? altoBarras(items.length)}
        alClic={opts.alClic}
        opcion={barrasH({ items, color, tema, fmt, fmtEje, seleccion: opts.sel, etiquetas: true, anchoEtiqueta: opts.ancho })}
      />
    )
  }
  const nota = (n: number, todos: number) => (todos > n ? `Los ${n} mayores de ${num(todos)}. La tabla muestra todos.` : undefined)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{cfg.nombre}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink2">
            Toca una barra para filtrar; vuelve a tocarla para quitarla. {medida === 'cantidad' && 'La cantidad suma unidades de actividades distintas (visitas, dotaciones, capacitaciones…): sirve para comparar volumen de gestión.'}
          </p>
        </div>
        <Segmentado etiqueta="Medida" valor={medida} onChange={setMedida} opciones={[{ id: 'valor', texto: 'Valor' }, { id: 'cantidad', texto: 'Cantidad' }]} />
      </div>

      <Fila>
        <MultiSelect etiqueta={cfg.grupo} opciones={opciones.grupo} valor={sel.grupo} onChange={(l) => setSel((s) => ({ ...s, grupo: l }))} />
        <MultiSelect etiqueta="Estado" opciones={opciones.estado} valor={sel.estado} onChange={(l) => setSel((s) => ({ ...s, estado: l }))} />
        <MultiSelect etiqueta="Aportante" opciones={opciones.aportante} valor={sel.aportante} onChange={(l) => setSel((s) => ({ ...s, aportante: l }))} />
        <MultiSelect etiqueta="Institución" opciones={opciones.institucion} valor={sel.institucion} onChange={(l) => setSel((s) => ({ ...s, institucion: l }))} ancho="w-80" />
        <MultiSelect etiqueta="Actividad" opciones={opciones.actividad} valor={sel.actividad} onChange={(l) => setSel((s) => ({ ...s, actividad: l }))} ancho="w-96" />
        {hayLocales && (
          <button type="button" onClick={() => setSel({ grupo: [], estado: [], aportante: [], institucion: [], actividad: [] })} className="rounded-lg px-2.5 py-1.5 text-sm text-accentink hover:bg-wash">
            Quitar estos filtros
          </button>
        )}
      </Fila>

      <Kpis columnas={3}>
        <Kpi titulo="Inversión" valor={cop(total)} detalle={copM(total)} />
        <Kpi titulo="Cantidad de actividades" valor={cant(sumar(vistas.todas, (x) => x.cantidad))} detalle={`${num(unicos(vistas.todas, (x) => x.actividad).size)} tipos de actividad`} />
        <Kpi titulo="Municipios" valor={num(unicos(vistas.todas, (x) => x.municipio).size)} detalle={`${num(unicos(vistas.todas.filter((x) => x.tipo === 'Institución'), (x) => `${x.municipio}|${x.institucion}`).size)} instituciones educativas`} />
        <Kpi titulo="Aporte del Departamento" valor={total ? pct(depto / total) : '—'} detalle={copM(depto)} />
        <Kpi titulo="Aporte del Comité de Cafeteros" valor={total ? pct(comite / total) : '—'} detalle={copM(comite)} />
        {programa === 'mf' && noAsistio.length > 0 ? (
          <Kpi titulo="Convocados que no asistieron" valor={num(sumar(noAsistio, (x) => x.cantidad))} detalle={`${cop(sumar(noAsistio, (x) => x.valor))} invertidos`} />
        ) : (
          <Kpi titulo="Adicional al convenio y reinversión" valor={copM(extra)} detalle={total ? pct(extra / total) + ' del total' : undefined} />
        )}
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Tarjeta titulo={`${titulo} por ${cfg.grupo.toLowerCase()}`} tabla={tabla(cfg.grupo, pGrupo, `${programa}-por-${cfg.grupo.toLowerCase()}`)}>
          {barras(pGrupo, colorPrincipal, { alClic: alt('grupo'), sel: sel.grupo, nombre: cfg.grupo.toLowerCase(), ancho: 220, alto: 320 })}
        </Tarjeta>

        <Tarjeta
          titulo={`${titulo} por año`}
          nota="Apilado por aportante. Toca una columna para filtrar por año."
          tabla={{
            archivo: `${programa}-por-anio`,
            columnas: [{ clave: 'anio', titulo: 'Año' }, ...aportantes.map((a) => ({ clave: a, titulo: a, tipo: (medida === 'valor' ? 'moneda' : 'cantidad') as 'moneda' | 'cantidad' }))],
            filas: anios.map((a) => ({ anio: String(a), ...Object.fromEntries(aportantes.map((p) => [p, sumar(vistas.anio.filter((x) => x.anio === a && x.aportante === p), v)])) })),
          }}
        >
          <Grafico
            etiqueta={`${titulo} por año y aportante`}
            alto={300}
            alClic={(n) => f.setAnios(alternar(f.anios, Number(n)))}
            opcion={columnas({
              categorias: anios.map(String),
              series: aportantes.map((p) => ({ nombre: p, color: colorAportante(tema, p), datos: anios.map((a) => sumar(vistas.anio.filter((x) => x.anio === a && x.aportante === p), v)) })),
              tema,
              fmt,
              fmtEje,
              totales: true,
              seleccion: f.anios.map(String),
            })}
          />
        </Tarjeta>

        <Tarjeta titulo={`${titulo} por municipio`} nota={nota(TOP, pMuni.length)} tabla={tabla('Municipio', pMuni, `${programa}-por-municipio`)}>
          {barras(pMuni, colorPrincipal, { alClic: (n) => f.setMunicipios(alternar(f.municipios, n)), sel: f.municipios, nombre: 'municipio' })}
        </Tarjeta>

        <Tarjeta titulo={`${titulo} por institución`} nota={nota(TOP, pInst.length)} tabla={tabla('Institución', pInst, `${programa}-por-institucion`)}>
          {barras(pInst, colorPrincipal, { alClic: alt('institucion'), sel: sel.institucion, nombre: 'institución' })}
        </Tarjeta>

        <Tarjeta titulo={`${titulo} por actividad`} nota={nota(TOP, pAct.length)} tabla={tabla('Actividad', pAct, `${programa}-por-actividad`)} className="lg:col-span-2">
          {barras(pAct, colorPrincipal, { alClic: alt('actividad'), sel: sel.actividad, nombre: 'actividad', ancho: 330 })}
        </Tarjeta>

        <Tarjeta titulo={`${titulo} por estado`} nota="Convenio frente a lo que se hizo además del convenio." tabla={tabla('Estado', pEstado, `${programa}-por-estado`)}>
          {barras(pEstado, colorPrincipal, { alClic: alt('estado'), sel: sel.estado, nombre: 'estado', colorDe: (n) => colorEstadoActividad(tema, n, programa) })}
        </Tarjeta>

        <Tarjeta titulo={`${titulo} por aportante`} tabla={tabla('Aportante', pAport, `${programa}-por-aportante`)}>
          {barras(pAport, colorPrincipal, { alClic: alt('aportante'), sel: sel.aportante, nombre: 'aportante', colorDe: (n) => colorAportante(tema, n) })}
        </Tarjeta>
      </div>
    </div>
  )
}
