import { useMemo } from 'react'
import { BarraFiltros } from '../components/BarraFiltros'
import { Grafico } from '../components/Grafico'
import { Contenido, Cifra, MapaCaldas, Marca, PlacaCabecera, Posiciones, Seccion } from '../components/Lamina'
import { agrupar, sumar, unicos } from '../lib/agregar'
import { PLACAS, colorAportante, colorPrograma } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { cop, copM, num, pct } from '../lib/formato'
import { aclarar, dona, sunburst, type Nodo } from '../lib/graficos'
import { PROGRAMAS, type Programa } from '../lib/tipos'
import { useAngosto } from '../lib/angosto'
import { descripcionFiltros, pasa, useTablero } from '../lib/usarFiltrado'

const placa = PLACAS.resumen

export function Resumen() {
  const { datos, f } = useTablero()
  const angosto = useAngosto()

  const base = useMemo(() => datos.base.filter((x) => pasa(f, x.anio, x.municipio)), [datos, f])
  const baseMunicipios = useMemo(() => datos.base.filter((x) => pasa({ anios: f.anios, municipios: [] }, x.anio, x.municipio)), [datos, f.anios])
  const baseAnios = useMemo(() => datos.base.filter((x) => pasa({ anios: [], municipios: f.municipios }, x.anio, x.municipio)), [datos, f.municipios])
  const beneficiados = useMemo(() => datos.beneficiados.filter((b) => pasa(f, b.anio, b.municipio)), [datos, f])
  const estudiantes = useMemo(() => datos.estudiantes.filter((e) => /gobernaci/i.test(e.financiador) && pasa(f, null, e.municipio)), [datos, f])

  const total = sumar(base, (x) => x.valor)
  const valorDe = (re: RegExp) => sumar(base.filter((x) => re.test(x.aportante)), (x) => x.valor)
  const depto = valorDe(/depto|departamento|gobernaci/i)
  const comite = valorDe(/comit/i)
  const anios = useMemo(() => [...new Set(datos.base.map((x) => x.anio))].sort(), [datos])
  const rango = anios.length ? `${anios[0]}–${anios[anios.length - 1]}` : ''
  const instituciones = unicos(base.filter((x) => x.tipo === 'Institución'), (x) => `${x.municipio}|${x.institucion}`).size

  const porMunicipio = useMemo(() => agrupar(baseMunicipios, (x) => x.municipio, (x) => x.valor), [baseMunicipios])
  const datosMapa = useMemo(() => porMunicipio.map((p) => ({ name: p.nombre, value: p.valor })), [porMunicipio])
  const seleccion = f.municipios
  const alMunicipio = (n: string) => f.setMunicipios(alternar(f.municipios, n))

  // Aportante → programa → proyecto/proceso
  const arbol = useMemo<Nodo[]>(() => {
    const porAport = new Map<string, Map<Programa, Map<string, number>>>()
    base.forEach((x) => {
      if (x.valor <= 0) return
      const a = x.aportante || 'Sin aportante'
      const pm = porAport.get(a) ?? new Map<Programa, Map<string, number>>()
      const gm = pm.get(x.programa) ?? new Map<string, number>()
      gm.set(x.grupo, (gm.get(x.grupo) ?? 0) + x.valor)
      pm.set(x.programa, gm)
      porAport.set(a, pm)
    })
    return [...porAport.entries()].map(([a, pm]) => ({
      name: a,
      color: colorAportante(a),
      children: [...pm.entries()].map(([p, gm]) => ({
        name: PROGRAMAS[p].nombre,
        color: colorPrograma(p),
        children: [...gm.entries()].sort((x, y) => y[1] - x[1]).map(([g, v], i) => ({ name: g, value: v, color: aclarar(colorPrograma(p), Math.min(0.55, 0.12 + i * 0.1)) })),
      })),
    }))
  }, [base])

  const tablaFlujo = useMemo(() => {
    const m = new Map<string, { aportante: string; programa: string; grupo: string; valor: number }>()
    base.forEach((x) => {
      const id = `${x.aportante}|${x.programa}|${x.grupo}`
      const e = m.get(id) ?? { aportante: x.aportante || 'Sin aportante', programa: PROGRAMAS[x.programa].nombre, grupo: x.grupo, valor: 0 }
      e.valor += x.valor
      m.set(id, e)
    })
    return [...m.values()].sort((a, b) => b.valor - a.valor)
  }, [base])

  const opcionSol = useMemo(() => sunburst({ arbol, fmt: copM, centro: copM(total), sub: 'invertidos', compacto: angosto }), [arbol, total, angosto])

  const porAnio = useMemo(
    () =>
      anios.map((a) => {
        const mf = sumar(baseAnios.filter((x) => x.programa === 'mf' && x.anio === a), (x) => x.valor)
        const uc = sumar(baseAnios.filter((x) => x.programa === 'uc' && x.anio === a), (x) => x.valor)
        return { anio: a, mf, uc, total: mf + uc }
      }),
    [anios, baseAnios],
  )
  const totalAnios = sumar(porAnio, (x) => x.total)

  const maxMuni = porMunicipio[0]?.valor || 1
  const top8 = porMunicipio.slice(0, 8).map((p) => ({ nombre: p.nombre, valor: p.valor, color: placa.escala[Math.min(6, Math.floor(Math.sqrt(p.valor / maxMuni) * 7))] }))

  return (
    <>
      <PlacaCabecera placa={placa} titulo="El recurso, sobre el mapa" texto="Cuánto invirtió la Gobernación de Caldas en educación rural, quién lo aportó y a qué municipios llegó. Toca el mapa para filtrar todo lo demás." />

      <Contenido>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div className="space-y-7">
            <Cifra tam="xl" valor={cop(total)} etiqueta={`invertidos en educación rural${rango ? `, ${rango}` : ''}`} />
            <p className="text-xl leading-relaxed text-ink2 sm:text-2xl">
              El recurso llegó a <Marca>{num(unicos(base, (x) => x.municipio).size)} municipios</Marca> y <Marca>{num(instituciones)} instituciones</Marca>. Beneficiaron a <Marca>{num(sumar(beneficiados, (b) => b.beneficiados))} estudiantes</Marca> y financiaron a <Marca>{num(estudiantes.length)} estudiantes técnicos</Marca>
              {estudiantes.length > 0 && <>, de los que {pct(estudiantes.filter((e) => /^graduado$/i.test(e.estado)).length / estudiantes.length)} ya se graduó</>}.
            </p>

            <div>
              <div className="flex h-5 overflow-hidden rounded-full ring-2 ring-white" role="img" aria-label={`Departamento de Caldas ${pct(total ? depto / total : 0)}, Comité de Cafeteros ${pct(total ? comite / total : 0)}`}>
                <div style={{ width: `${total ? (depto / total) * 100 : 0}%`, background: colorAportante('Depto. de Caldas') }} />
                <div style={{ width: `${total ? (comite / total) * 100 : 0}%`, background: colorAportante('Comité de Cafeteros') }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="size-3.5 rounded-full" style={{ background: colorAportante('Depto. de Caldas') }} />
                  <span className="font-bold" style={{ color: 'var(--ink)' }}>
                    Departamento de Caldas
                  </span>
                  <span className="cota">
                    {total ? pct(depto / total) : '—'} · {copM(depto)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="size-3.5 rounded-full" style={{ background: colorAportante('Comité de Cafeteros') }} />
                  <span className="font-bold" style={{ color: 'var(--ink)' }}>
                    Comité de Cafeteros
                  </span>
                  <span className="cota">
                    {total ? pct(comite / total) : '—'} · {copM(comite)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-ink2">Mostrando: {descripcionFiltros(f)}</p>
              <BarraFiltros />
            </div>
          </div>

          <MapaCaldas datos={datosMapa} placa={placa} fmt={copM} seleccion={seleccion} alClic={alMunicipio} etiqueta="Mapa de Caldas coloreado por inversión de cada municipio" />
        </div>

        <Seccion
          titulo="¿De dónde viene y a dónde va?"
          nota="Del aportante al programa y al proyecto o proceso. Pasa el cursor sobre un tramo para ver su valor."
          tono="lavado"
          tabla={{
            archivo: 'distribucion-del-recurso',
            columnas: [
              { clave: 'aportante', titulo: 'Aportante' },
              { clave: 'programa', titulo: 'Programa' },
              { clave: 'grupo', titulo: 'Proyecto / proceso' },
              { clave: 'valor', titulo: 'Valor', tipo: 'moneda' },
            ],
            filas: tablaFlujo,
          }}
        >
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Grafico etiqueta="Distribución del recurso por aportante, programa y proyecto" alto={angosto ? 380 : 620} opcion={opcionSol} />
            <div>
              <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                Los que más recibieron
              </h3>
              <p className="mb-3 text-sm text-ink2">Toca un municipio para filtrar.</p>
              <Posiciones items={top8} fmt={copM} onClic={alMunicipio} seleccion={seleccion} />
            </div>
          </div>
        </Seccion>

        <Seccion
          titulo="Año por año"
          nota="Cada anillo reparte la inversión del año entre los dos programas. Toca un año para filtrar."
          tabla={{
            archivo: 'inversion-por-anio',
            columnas: [
              { clave: 'anio', titulo: 'Año' },
              { clave: 'mf', titulo: 'Modelos Flexibles', tipo: 'moneda' },
              { clave: 'uc', titulo: 'Universidad en el Campo', tipo: 'moneda' },
              { clave: 'total', titulo: 'Total', tipo: 'moneda' },
            ],
            filas: porAnio.map((a) => ({ anio: String(a.anio), mf: a.mf, uc: a.uc, total: a.total })),
          }}
          acciones={
            <div className="hidden items-center gap-4 text-sm font-semibold sm:flex">
              {(['mf', 'uc'] as Programa[]).map((p) => (
                <span key={p} className="flex items-center gap-2">
                  <span className="size-3.5 rounded-full" style={{ background: colorPrograma(p) }} />
                  {PROGRAMAS[p].nombre}
                </span>
              ))}
            </div>
          }
        >
          <div className="grid gap-6 sm:grid-cols-3">
            {porAnio.map((a) => {
              const on = f.anios.includes(a.anio)
              const hay = f.anios.length > 0
              return (
                <button key={a.anio} type="button" aria-pressed={on} onClick={() => f.setAnios(alternar(f.anios, a.anio))} className={`rounded-3xl bg-white p-4 text-left transition-all ${on ? 'ring-4 ring-main' : 'ring-1 ring-line hover:ring-main'} ${hay && !on ? 'opacity-50' : ''}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="display text-4xl" style={{ color: 'var(--ink)' }}>
                      {a.anio}
                    </span>
                    <span className="cota text-sm font-semibold text-ink2">{copM(a.total)}</span>
                  </div>
                  <Grafico
                    etiqueta={`Inversión ${a.anio} por programa`}
                    alto={230}
                    opcion={dona({
                      partes: [
                        { nombre: 'Modelos Flexibles', valor: a.mf, color: colorPrograma('mf') },
                        { nombre: 'Universidad en el Campo', valor: a.uc, color: colorPrograma('uc') },
                      ],
                      centro: totalAnios ? pct(a.total / totalAnios, 0) : '—',
                      sub: 'del total',
                      fmt: copM,
                    })}
                  />
                </button>
              )
            })}
          </div>
        </Seccion>
      </Contenido>
    </>
  )
}
