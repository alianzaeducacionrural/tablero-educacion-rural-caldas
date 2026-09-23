import { useMemo, useState } from 'react'
import { Segmentado } from '../components/controles'
import { Grafico } from '../components/Grafico'
import { Icono } from '../components/Icono'
import { Aviso, Cifra, Contenido, Marca, PlacaCabecera, Seccion } from '../components/Lamina'
import { Tabla } from '../components/Tabla'
import { sumar } from '../lib/agregar'
import { PLACAS, colorAportante } from '../lib/colores'
import { cant, cop, copM, num, pct } from '../lib/formato'
import { aclarar, sunburst, type Nodo } from '../lib/graficos'
import { PROGRAMAS, type Meta, type Programa } from '../lib/tipos'
import { useAngosto } from '../lib/angosto'
import { useTablero } from '../lib/usarFiltrado'

const placa = PLACAS.cumplimiento
type Estado = 'sin' | 'curso' | 'cumple' | 'supera'
const COLOR_ESTADO: Record<Estado, string> = { supera: '#0E8F4E', cumple: '#3CC47C', curso: '#2F6BFF', sin: '#BDB9D6' }
const TEXTO_ESTADO: Record<Estado, string> = { supera: 'Superada', cumple: 'Cumplida', curso: 'En curso', sin: 'Sin meta' }

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
  return (
    <div className="flex min-w-48 items-center gap-2.5">
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(r * 100))} aria-label={`Avance de ${m.actividad}`} className="h-2.5 w-24 shrink-0 overflow-hidden rounded-full bg-wash">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, r * 100)}%`, background: COLOR_ESTADO[e] }} />
      </div>
      <span className="cota inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-ink">
        <Icono n={e === 'curso' ? 'encurso' : e === 'cumple' ? 'check' : 'arriba'} size={13} />
        {pct(r, 0)} · {TEXTO_ESTADO[e]}
      </span>
    </div>
  )
}

export function Cumplimiento() {
  const { datos } = useTablero()
  const angosto = useAngosto()
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

  // Sunburst: proyecto/proceso → actividad, del tamaño de su valor meta y del color de su estado
  const arbol = useMemo<Nodo[]>(
    () =>
      grupos.map(([g, filas], i) => ({
        name: g,
        color: placa.apoyo[i % placa.apoyo.length],
        children: filas.filter((m) => m.valorMeta > 0).map((m) => ({ name: m.actividad, value: m.valorMeta, color: COLOR_ESTADO[estadoMeta(m)] })),
      })).filter((n) => n.children.length),
    [grupos],
  )
  const opcionSol = useMemo(() => sunburst({ arbol, fmt: copM, centro: copM(valorMeta), sub: 'valor de las metas', compacto: angosto, sinEtiquetas: true }), [arbol, valorMeta, angosto])

  // Cofinanciación (Universidad en el Campo)
  const arbolCofin = useMemo<Nodo[]>(() => {
    const parte = (nombre: string, k: 'departamento' | 'comite'): Nodo => ({
      name: nombre,
      color: colorAportante(nombre),
      children: grupos.map(([g, filas], i) => ({ name: g, value: sumar(filas, (m) => m[k]), color: aclarar(colorAportante(nombre), Math.min(0.5, i * 0.09)) })).filter((c) => c.value > 0),
    })
    return [parte('Departamento de Caldas', 'departamento'), parte('Comité de Cafeteros', 'comite')].filter((n) => (n.children?.length ?? 0) > 0)
  }, [grupos])
  const totalCofin = arbolCofin.reduce((s, n) => s + (n.children ?? []).reduce((t, c) => t + (c.value ?? 0), 0), 0)
  const opcionCofin = useMemo(() => sunburst({ arbol: arbolCofin, fmt: copM, centro: copM(totalCofin), sub: 'cofinanciación', compacto: angosto }), [arbolCofin, totalCofin, angosto])

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
    <>
      <PlacaCabecera placa={placa} titulo="Lo prometido frente a lo hecho" texto="La meta del convenio contra lo ejecutado, actividad por actividad. Las metas y lo ejecutado se actualizan desde el panel de administración.">
        <Segmentado sobreCampo etiqueta="Programa" valor={programa} onChange={(p) => { setPrograma(p); setVigenciaSel(null) }} opciones={[{ id: 'mf', texto: 'Modelos Flexibles' }, { id: 'uc', texto: 'Universidad en el Campo' }]} />
        {vigencias.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-bold">
            Vigencia
            <select value={vigencia} onChange={(e) => setVigenciaSel(Number(e.target.value))} className="cota rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink outline-none">
              {vigencias.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
      </PlacaCabecera>

      <Contenido>
        {metas.length === 0 ? (
          <Aviso>No hay metas registradas para {cfg.nombre}. Se cargan desde el panel de administración.</Aviso>
        ) : (
          <>
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
              <div className="space-y-7">
                <Cifra tam="xl" valor={valorMeta ? pct(valorEj / valorMeta) : '—'} etiqueta={`del valor de las metas ya se ejecutó · vigencia ${vigencia}`} color="var(--ink)" />
                <p className="text-xl leading-relaxed text-ink2">
                  Se ejecutaron <Marca>{copM(valorEj)}</Marca> de <Marca>{copM(valorMeta)}</Marca>. De <Marca>{num(conMeta.length)} actividades con meta</Marca>, <Marca color="#BFEBCF">{num(cumplidas)} están cumplidas</Marca> y <Marca color="#BFEBCF">{num(superadas)} superaron su meta</Marca>.
                </p>
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink2">Anillo interior: {cfg.grupo.toLowerCase()}. Anillo exterior: cada actividad, del color de su avance.</p>
                  <ul className="mb-4 space-y-1.5">
                    {arbol.map((n) => (
                      <li key={n.name} className="flex items-center gap-2.5 text-sm font-bold" style={{ color: 'var(--ink)' }}>
                        <span className="size-3.5 shrink-0 rounded-full" style={{ background: n.color }} />
                        {n.name}
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                  {(['supera', 'cumple', 'curso'] as Estado[]).map((e) => (
                    <li key={e} className="flex items-center gap-2">
                      <span className="size-3.5 rounded-full" style={{ background: COLOR_ESTADO[e] }} />
                      {TEXTO_ESTADO[e]}
                    </li>
                  ))}
                </ul>
              </div>
              <Grafico etiqueta={`Metas de ${cfg.nombre} por ${cfg.grupo.toLowerCase()} y actividad, coloreadas por avance`} alto={angosto ? 380 : 600} opcion={opcionSol} />
            </div>

            <Seccion titulo={`Metas por ${cfg.grupo.toLowerCase()} y actividad`} nota="Meta y ejecutado en las unidades de cada actividad; valores en pesos.">
              <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-white">
                    <tr>
                      {['Actividad', 'Meta', 'Ejecutado', 'Avance', 'Faltante', 'Adicional', 'Valor meta', 'Valor ejecutado'].map((h, i) => (
                        <th key={h} scope="col" className={`border-b-2 border-main px-3 py-2.5 font-bold ${i === 0 || i === 3 ? 'text-left' : 'text-right'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map(([g, filas]) => (
                      <FragmentoGrupo key={g} grupo={g} filas={filas} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>

            {arbolCofin.length > 0 && (
              <Seccion titulo="Cofinanciación" nota="Cuánto aportan el Departamento de Caldas y el Comité de Cafeteros a cada proceso." tono="lavado" tabla={{ archivo: 'cofinanciacion', columnas: [{ clave: 'a', titulo: 'Aportante' }, { clave: 'g', titulo: cfg.grupo }, { clave: 'v', titulo: 'Valor', tipo: 'moneda' }], filas: arbolCofin.flatMap((n) => (n.children ?? []).map((c) => ({ a: n.name, g: c.name, v: c.value ?? 0 }))) }}>
                <div className="mx-auto max-w-2xl">
                  <Grafico etiqueta="Cofinanciación por aportante y proceso" alto={520} opcion={opcionCofin} />
                </div>
              </Seccion>
            )}

            {convocados.length > 0 && (
              <Seccion titulo="Convocados que no asistieron" nota="Se convocó y se invirtió, pero no hubo asistencia. Cuenta en la inversión total y aquí se ve aparte.">
                <Tabla
                  archivo="convocados-que-no-asistieron"
                  columnas={[{ clave: 'actividad', titulo: 'Actividad' }, { clave: 'convocados', titulo: 'Convocatorias sin asistencia', tipo: 'cantidad' }, { clave: 'municipios', titulo: 'Municipios', tipo: 'numero' }, { clave: 'valor', titulo: 'Valor', tipo: 'moneda' }]}
                  filas={convocados}
                />
              </Seccion>
            )}
          </>
        )}
      </Contenido>
    </>
  )
}

function FragmentoGrupo({ grupo, filas }: { grupo: string; filas: Meta[] }) {
  const vm = sumar(filas, (m) => m.valorMeta)
  const ve = sumar(filas, (m) => m.valorEjecutado)
  return (
    <>
      <tr className="bg-wash/70">
        <th scope="colgroup" colSpan={6} className="px-3 py-2 text-left text-base font-extrabold" style={{ color: 'var(--ink)' }}>
          {grupo}
        </th>
        <td className="cota px-3 py-2 text-right font-bold">{cop(vm)}</td>
        <td className="cota px-3 py-2 text-right font-bold">{cop(ve)}</td>
      </tr>
      {filas.map((m, i) => (
        <tr key={i} className="border-b border-line last:border-0 hover:bg-wash/40">
          <td className="px-3 py-2 pl-6">{m.actividad}</td>
          <td className="cota px-3 py-2 text-right">{cant(m.meta)}</td>
          <td className="cota px-3 py-2 text-right">{cant(m.ejecutado)}</td>
          <td className="px-3 py-2">
            <Avance m={m} />
          </td>
          <td className="cota px-3 py-2 text-right">{m.faltante > 0 ? cant(m.faltante) : '—'}</td>
          <td className="cota px-3 py-2 text-right">{m.adicional ? cant(m.adicional) : '—'}</td>
          <td className="cota px-3 py-2 text-right">{cop(m.valorMeta)}</td>
          <td className="cota px-3 py-2 text-right">{cop(m.valorEjecutado)}</td>
        </tr>
      ))}
    </>
  )
}
