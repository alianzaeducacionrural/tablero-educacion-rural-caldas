import { useMemo, useState } from 'react'
import { Segmentado } from '../components/controles'
import { Grafico } from '../components/Grafico'
import { Icono } from '../components/Icono'
import { Aviso, Cifra, Contenido, Marca, PlacaCabecera, Posiciones, Progreso, Seccion } from '../components/Lamina'
import { sumar } from '../lib/agregar'
import { PLACAS, colorAportante } from '../lib/colores'
import { cant, cop, num, pct } from '../lib/formato'
import { apiladasH, dona, pastel } from '../lib/graficos'
import { PROGRAMAS, type Meta, type Programa } from '../lib/tipos'
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

/** Barra de avance de una actividad: siempre con icono y texto, nunca solo color. */
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
  const cuentaEstado = (e: Estado) => metas.filter((m) => estadoMeta(m) === e).length
  const cumplidas = cuentaEstado('cumple') + cuentaEstado('supera')

  // Anillo: cuántas actividades hay en cada estado de avance
  const partesEstado = (['supera', 'cumple', 'curso'] as Estado[]).map((e) => ({ nombre: TEXTO_ESTADO[e], valor: cuentaEstado(e), color: COLOR_ESTADO[e] })).filter((p) => p.valor > 0)
  const opcionEstado = useMemo(() => dona({ partes: partesEstado, centro: num(conMeta.length), sub: 'actividades con meta', fmt: (n) => `${num(n)} actividades` }), [metas]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cofinanciación (Universidad en el Campo)
  const filasCofin = useMemo(
    () =>
      grupos
        .map(([g, filas]) => ({ nombre: g, partes: [{ nombre: 'Departamento de Caldas', valor: sumar(filas, (m) => m.departamento), color: colorAportante('Departamento de Caldas') }, { nombre: 'Comité de Cafeteros', valor: sumar(filas, (m) => m.comite), color: colorAportante('Comité de Cafeteros') }] }))
        .filter((f) => f.partes.some((p) => p.valor > 0)),
    [grupos],
  )
  const opcionCofin = useMemo(() => apiladasH({ filas: filasCofin, fmt: cop }), [filasCofin])
  const totalDepto = sumar(filasCofin, (f) => f.partes[0].valor)
  const totalComite = sumar(filasCofin, (f) => f.partes[1].valor)
  const opcionPastelCofin = useMemo(() => pastel({ partes: [{ nombre: 'Departamento de Caldas', valor: totalDepto, color: colorAportante('Departamento de Caldas') }, { nombre: 'Comité de Cafeteros', valor: totalComite, color: colorAportante('Comité de Cafeteros') }], fmt: cop }), [totalDepto, totalComite])

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Lo prometido frente a lo hecho" texto="La meta del convenio contra lo ejecutado, actividad por actividad. Las metas y lo ejecutado se actualizan desde el panel de administración.">
        <Segmentado sobreCampo etiqueta="Programa" valor={programa} onChange={(p) => { setPrograma(p); setVigenciaSel(null) }} opciones={[{ id: 'mf', texto: PROGRAMAS.mf.nombre }, { id: 'uc', texto: PROGRAMAS.uc.nombre }]} />
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
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
              <div className="space-y-7">
                <Cifra tam="xl" valor={valorMeta ? pct(valorEj / valorMeta) : '—'} etiqueta={`del valor de las metas ya se ejecutó · vigencia ${vigencia}`} />
                <p className="text-xl leading-relaxed text-ink2">
                  Se ejecutaron <Marca>{cop(valorEj)}</Marca> de <Marca>{cop(valorMeta)}</Marca>. De <Marca>{num(conMeta.length)} actividades con meta</Marca>, <Marca color="#BFEBCF">{num(cumplidas)} están cumplidas o superadas</Marca>.
                </p>
              </div>
              <div className="grid items-center gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Grafico etiqueta="Actividades por estado de avance" alto={260} opcion={opcionEstado} />
                <Posiciones items={partesEstado.map((p) => ({ nombre: p.nombre, valor: p.valor, color: p.color }))} fmt={(n) => `${num(n)} act.`} />
              </div>
            </div>

            <Seccion titulo={`Avance por ${cfg.grupo.toLowerCase()}`} nota="Valor ejecutado frente al valor de la meta." tono="lavado">
              <div className="grid gap-x-12 gap-y-7 lg:grid-cols-2">
                {grupos.map(([g, filas], i) => (
                  <Progreso key={g} etiqueta={g} valor={sumar(filas, (m) => m.valorEjecutado)} meta={sumar(filas, (m) => m.valorMeta)} fmt={cop} color={placa.apoyo[i % placa.apoyo.length]} />
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Meta y ejecutado, actividad por actividad" nota="Meta y ejecutado en las unidades de cada actividad; valores en pesos.">
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

            {filasCofin.length > 0 && (
              <Seccion
                titulo="Cofinanciación"
                nota="Cuánto aportan el Departamento de Caldas y el Comité de Cafeteros a cada proceso."
                tono="lavado"
                tabla={{ archivo: 'cofinanciacion', columnas: [{ clave: 'g', titulo: cfg.grupo }, { clave: 'd', titulo: 'Departamento de Caldas', tipo: 'moneda' }, { clave: 'c', titulo: 'Comité de Cafeteros', tipo: 'moneda' }], filas: filasCofin.map((f) => ({ g: f.nombre, d: f.partes[0].valor, c: f.partes[1].valor })) }}
              >
                <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                  <Grafico etiqueta="Cofinanciación del Departamento y del Comité por proceso" alto={Math.max(220, filasCofin.length * 60 + 60)} opcion={opcionCofin} />
                  <div>
                    <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                      Distribución total
                    </h3>
                    <Grafico etiqueta="Distribución total de la cofinanciación" alto={280} opcion={opcionPastelCofin} />
                  </div>
                </div>
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
