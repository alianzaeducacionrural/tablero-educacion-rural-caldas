import { useMemo, useState } from 'react'
import { Grafico } from '../components/Grafico'
import { Segmentado } from '../components/controles'
import { Tabla } from '../components/Tabla'
import { Aviso, Kpi, Kpis, Tarjeta } from '../components/Tarjetas'
import { sumar, unicos } from '../lib/agregar'
import { colorAportante } from '../lib/colores'
import { cant, cop, copM, ejeM, num, pct } from '../lib/formato'
import { columnas } from '../lib/graficos'
import { useTema } from '../lib/tema'
import { PROGRAMAS, type Meta, type Programa } from '../lib/tipos'
import { useTablero } from '../lib/usarFiltrado'

type Estado = 'sin' | 'curso' | 'cumple' | 'supera'

function estadoMeta(m: Meta): Estado {
  if (m.meta <= 0) return 'sin'
  const r = m.ejecutado / m.meta
  if (r > 1.0001) return 'supera'
  if (r >= 0.9999) return 'cumple'
  return 'curso'
}

/** Barra de avance: siempre con icono y texto, nunca solo color. */
function Avance({ m }: { m: Meta }) {
  const e = estadoMeta(m)
  if (e === 'sin') return <span className="text-muted">Sin meta</span>
  const r = m.ejecutado / m.meta
  const color = e === 'curso' ? 'var(--accent)' : '#0ca30c'
  const icono = e === 'curso' ? '◔' : e === 'cumple' ? '✓' : '▲'
  const texto = e === 'curso' ? 'En curso' : e === 'cumple' ? 'Cumplida' : 'Superada'
  return (
    <div className="flex min-w-44 items-center gap-2">
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(r * 100))} aria-label={`Avance de ${m.actividad}`} className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-grid">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, r * 100)}%`, background: color }} />
      </div>
      <span className="tabular whitespace-nowrap text-xs text-ink2">
        <span aria-hidden="true">{icono}</span> {pct(r, 0)} · {texto}
      </span>
    </div>
  )
}

export function Cumplimiento() {
  const { datos } = useTablero()
  const { tema } = useTema()
  const [programa, setPrograma] = useState<Programa>('mf')
  const [vigenciaSel, setVigenciaSel] = useState<number | null>(null)
  const cfg = PROGRAMAS[programa]

  const deProg = useMemo(() => datos.metas.filter((m) => m.programa === programa), [datos, programa])
  const vigencias = useMemo(() => [...new Set(deProg.map((m) => m.vigencia))].sort(), [deProg])
  const vigencia = vigenciaSel !== null && vigencias.includes(vigenciaSel) ? vigenciaSel : vigencias[vigencias.length - 1]
  const metas = useMemo(() => deProg.filter((m) => m.vigencia === vigencia), [deProg, vigencia])

  const grupos = useMemo(() => {
    const m = new Map<string, Meta[]>()
    metas.forEach((x) => m.set(x.grupo, [...(m.get(x.grupo) ?? []), x]))
    return [...m.entries()]
  }, [metas])

  const conMeta = metas.filter((m) => m.meta > 0)
  const valorMeta = sumar(metas, (m) => m.valorMeta)
  const valorEj = sumar(metas, (m) => m.valorEjecutado)
  const cumplidas = conMeta.filter((m) => ['cumple', 'supera'].includes(estadoMeta(m))).length
  const superadas = conMeta.filter((m) => estadoMeta(m) === 'supera').length

  const cofin = useMemo(() => {
    const cats = [...unicos(metas, (m) => m.grupo)]
    const suma = (g: string, k: 'departamento' | 'comite') => sumar(metas.filter((m) => m.grupo === g), (m) => m[k])
    return { cats, depto: cats.map((g) => suma(g, 'departamento')), comite: cats.map((g) => suma(g, 'comite')) }
  }, [metas])
  const hayCofin = sumar(cofin.depto, (x) => x) + sumar(cofin.comite, (x) => x) > 0

  const convocados = useMemo(() => {
    const m = new Map<string, { actividad: string; convocados: number; valor: number; municipios: Set<string> }>()
    datos.base
      .filter((x) => x.programa === programa && !x.asistio)
      .forEach((x) => {
        const e = m.get(x.actividad) ?? { actividad: x.actividad, convocados: 0, valor: 0, municipios: new Set<string>() }
        e.convocados += x.cantidad
        e.valor += x.valor
        e.municipios.add(x.municipio)
        m.set(x.actividad, e)
      })
    return [...m.values()].map((e) => ({ actividad: e.actividad, convocados: e.convocados, valor: e.valor, municipios: e.municipios.size })).sort((a, b) => b.valor - a.valor)
  }, [datos, programa])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Cumplimiento de metas</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink2">Meta del convenio frente a lo ejecutado, por actividad. Las metas y lo ejecutado se actualizan desde el panel de administración.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmentado etiqueta="Programa" valor={programa} onChange={(p) => { setPrograma(p); setVigenciaSel(null) }} opciones={[{ id: 'mf', texto: 'Modelos Flexibles' }, { id: 'uc', texto: 'Universidad en el Campo' }]} />
          {vigencias.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              Vigencia
              <select value={vigencia} onChange={(e) => setVigenciaSel(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink">
                {vigencias.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      {metas.length === 0 ? (
        <Aviso>No hay metas registradas para {cfg.nombre}. Se cargan desde el panel de administración.</Aviso>
      ) : (
        <>
          <Kpis>
            <Kpi heroe titulo={`Avance del valor meta · ${vigencia}`} valor={valorMeta ? pct(valorEj / valorMeta) : '—'} detalle={`${copM(valorEj)} ejecutados de ${copM(valorMeta)}`} />
            <Kpi titulo="Actividades con meta" valor={num(conMeta.length)} detalle={`${num(cumplidas)} cumplidas`} />
            <Kpi titulo="Metas superadas" valor={num(superadas)} detalle={conMeta.length ? `${pct(superadas / conMeta.length, 0)} de las actividades` : undefined} />
          </Kpis>

          <Tarjeta titulo={`Metas por ${cfg.grupo.toLowerCase()} y actividad`} nota="Meta y ejecutado en unidades de cada actividad; valores en pesos.">
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-surface">
                  <tr className="text-ink2">
                    <th scope="col" className="border-b border-line px-3 py-2 text-left font-medium">Actividad</th>
                    <th scope="col" className="border-b border-line px-3 py-2 text-right font-medium">Meta</th>
                    <th scope="col" className="border-b border-line px-3 py-2 text-right font-medium">Ejecutado</th>
                    <th scope="col" className="border-b border-line px-3 py-2 text-left font-medium">Avance</th>
                    <th scope="col" className="border-b border-line px-3 py-2 text-right font-medium">Faltante</th>
                    <th scope="col" className="border-b border-line px-3 py-2 text-right font-medium">Adicional</th>
                    <th scope="col" className="border-b border-line px-3 py-2 text-right font-medium">Valor meta</th>
                    <th scope="col" className="border-b border-line px-3 py-2 text-right font-medium">Valor ejecutado</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(([g, filas]) => (
                    <FragmentoGrupo key={g} grupo={g} filas={filas} />
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>

          {hayCofin && (
            <Tarjeta
              titulo="Cofinanciación por proceso"
              nota="Cuánto aportan el Departamento y el Comité de Cafeteros en cada proceso."
              tabla={{
                archivo: 'cofinanciacion-por-proceso',
                columnas: [{ clave: 'g', titulo: cfg.grupo }, { clave: 'd', titulo: 'Departamento de Caldas', tipo: 'moneda' }, { clave: 'c', titulo: 'Comité de Cafeteros', tipo: 'moneda' }],
                filas: cofin.cats.map((g, i) => ({ g, d: cofin.depto[i], c: cofin.comite[i] })),
              }}
            >
              <Grafico
                etiqueta="Cofinanciación del Departamento y del Comité por proceso"
                alto={320}
                opcion={columnas({
                  categorias: cofin.cats,
                  series: [
                    { nombre: 'Departamento de Caldas', color: colorAportante(tema, 'Depto. de Caldas'), datos: cofin.depto },
                    { nombre: 'Comité de Cafeteros', color: colorAportante(tema, 'Comité de Cafeteros'), datos: cofin.comite },
                  ],
                  tema,
                  fmt: copM,
                  fmtEje: ejeM,
                  totales: true,
                })}
              />
            </Tarjeta>
          )}

          {convocados.length > 0 && (
            <Tarjeta titulo="Convocados que no asistieron" nota="Se convocó y se invirtió, pero no hubo asistencia. Cuenta en la inversión total, y aquí se ve aparte.">
              <Tabla
                archivo="convocados-que-no-asistieron"
                columnas={[{ clave: 'actividad', titulo: 'Actividad' }, { clave: 'convocados', titulo: 'Convocatorias sin asistencia', tipo: 'cantidad' }, { clave: 'municipios', titulo: 'Municipios', tipo: 'numero' }, { clave: 'valor', titulo: 'Valor', tipo: 'moneda' }]}
                filas={convocados}
              />
            </Tarjeta>
          )}
        </>
      )}
    </div>
  )
}

function FragmentoGrupo({ grupo, filas }: { grupo: string; filas: Meta[] }) {
  const vm = sumar(filas, (m) => m.valorMeta)
  const ve = sumar(filas, (m) => m.valorEjecutado)
  return (
    <>
      <tr className="bg-wash">
        <th scope="colgroup" colSpan={6} className="px-3 py-1.5 text-left font-semibold text-ink">{grupo}</th>
        <td className="tabular px-3 py-1.5 text-right font-semibold">{cop(vm)}</td>
        <td className="tabular px-3 py-1.5 text-right font-semibold">{cop(ve)}</td>
      </tr>
      {filas.map((m, i) => (
        <tr key={i} className="border-b border-line last:border-0 hover:bg-wash">
          <td className="px-3 py-1.5 pl-6">{m.actividad}</td>
          <td className="tabular px-3 py-1.5 text-right">{cant(m.meta)}</td>
          <td className="tabular px-3 py-1.5 text-right">{cant(m.ejecutado)}</td>
          <td className="px-3 py-1.5"><Avance m={m} /></td>
          <td className="tabular px-3 py-1.5 text-right">{m.faltante > 0 ? cant(m.faltante) : '—'}</td>
          <td className="tabular px-3 py-1.5 text-right">{m.adicional ? cant(m.adicional) : '—'}</td>
          <td className="tabular px-3 py-1.5 text-right">{cop(m.valorMeta)}</td>
          <td className="tabular px-3 py-1.5 text-right">{cop(m.valorEjecutado)}</td>
        </tr>
      ))}
    </>
  )
}
