import { useMemo } from 'react'
import { ConFiltros, PanelFiltros, etiquetasDe, type GrupoFiltro } from '../components/Filtros'
import { Grafico } from '../components/Grafico'
import { Cifra, MapaCaldas, Marca, PlacaCabecera, Seccion, TablaAnios } from '../components/Lamina'
import { RankingBarras } from '../components/Ranking'
import { agrupar, alfa, sumar, unicos } from '../lib/agregar'
import { useAngosto } from '../lib/angosto'
import { PLACAS, colorAportante, colorPrograma } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { cop, num, pct } from '../lib/formato'
import { aclarar, columnas, pastel, sunburst, type Nodo } from '../lib/graficos'
import { PROGRAMAS, type Programa } from '../lib/tipos'
import { pasa, useTablero } from '../lib/usarFiltrado'

const placa = PLACAS.resumen

export function Resumen() {
  const { datos, f } = useTablero()
  const angosto = useAngosto()

  const base = useMemo(() => datos.base.filter((x) => pasa(f, x.anio, x.municipio)), [datos, f])
  const baseMunicipios = useMemo(() => datos.base.filter((x) => pasa({ anios: f.anios, municipios: [] }, x.anio, x.municipio)), [datos, f.anios])
  const baseAnios = useMemo(() => datos.base.filter((x) => pasa({ anios: [], municipios: f.municipios }, x.anio, x.municipio)), [datos, f.municipios])
  const beneficiados = useMemo(() => datos.beneficiados.filter((b) => pasa(f, b.anio, b.municipio)), [datos, f])
  // Un estudiante pertenece al año en que ingresó (su cohorte): así el filtro de año también lo mueve.
  const estudiantes = useMemo(() => datos.estudiantes.filter((e) => /gobernaci/i.test(e.financiador) && pasa(f, e.anioIngreso, e.municipio)), [datos, f])

  const total = sumar(base, (x) => x.valor)
  const valorDe = (re: RegExp) => sumar(base.filter((x) => re.test(x.aportante)), (x) => x.valor)
  const depto = valorDe(/depto|departamento|gobernaci/i)
  const comite = valorDe(/comit/i)
  const anios = useMemo(() => [...new Set(datos.base.map((x) => x.anio))].sort(), [datos])
  const rango = anios.length ? `${anios[0]}–${anios[anios.length - 1]}` : ''
  const instituciones = unicos(base.filter((x) => x.tipo === 'Institución'), (x) => `${x.municipio}|${x.institucion}`).size

  const porMunicipio = useMemo(() => agrupar(baseMunicipios, (x) => x.municipio, (x) => x.valor), [baseMunicipios])
  const datosMapa = useMemo(() => porMunicipio.map((p) => ({ name: p.nombre, value: p.valor })), [porMunicipio])
  const alMunicipio = (n: string) => f.setMunicipios(alternar(f.municipios, n))
  const maxMuni = porMunicipio[0]?.valor || 1
  const rankingMuni = porMunicipio.map((p) => ({ nombre: p.nombre, valor: p.valor, color: placa.escala[Math.min(6, Math.floor(Math.sqrt(p.valor / maxMuni) * 7))] }))

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
  const opcionSol = useMemo(() => sunburst({ arbol, fmt: cop, centro: cop(total), sub: 'invertidos', compacto: angosto }), [arbol, total, angosto])

  // Comparación entre años
  const porAnio = useMemo(
    () =>
      anios.map((a) => ({
        anio: a,
        mf: sumar(baseAnios.filter((x) => x.programa === 'mf' && x.anio === a), (x) => x.valor),
        uc: sumar(baseAnios.filter((x) => x.programa === 'uc' && x.anio === a), (x) => x.valor),
      })),
    [anios, baseAnios],
  )
  const seriesAnio = [
    { nombre: 'Modelos Educativos Flexibles', color: colorPrograma('mf') },
    { nombre: 'Universidad en el Campo', color: colorPrograma('uc') },
  ]
  const opcionAnios = useMemo(
    () => columnas({ categorias: porAnio.map((a) => String(a.anio)), series: seriesAnio.map((s, i) => ({ ...s, datos: porAnio.map((a) => (i === 0 ? a.mf : a.uc)) })), fmt: cop, seleccion: f.anios.map(String) }),
    [porAnio, f.anios], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const totalMf = sumar(base.filter((x) => x.programa === 'mf'), (x) => x.valor)
  const opcionPastel = useMemo(
    () => pastel({ partes: [{ nombre: 'Modelos Educativos Flexibles', valor: totalMf, color: colorPrograma('mf') }, { nombre: 'Universidad en el Campo', valor: total - totalMf, color: colorPrograma('uc') }], fmt: cop }),
    [totalMf, total],
  )

  const municipiosDisp = useMemo(() => [...new Set([...datos.base.map((x) => x.municipio), ...datos.beneficiados.map((b) => b.municipio)])].sort(alfa), [datos])
  const grupos: GrupoFiltro[] = [{ clave: 'municipio', titulo: 'Municipio', opciones: municipiosDisp, valor: f.municipios, onChange: f.setMunicipios, abierto: true }]
  const anioFiltro = { anios, valor: f.anios, onChange: f.setAnios }
  const etiquetas = etiquetasDe(anioFiltro, grupos)

  return (
    <>
      <PlacaCabecera placa={placa} titulo="El recurso, sobre el mapa" texto="Cuánto invirtió la Gobernación de Caldas en educación rural, quién lo aportó y a qué municipios llegó. Toca el mapa para filtrar todo lo demás." />

      <ConFiltros panel={<PanelFiltros anios={anioFiltro} grupos={grupos} etiquetas={etiquetas} onLimpiar={f.limpiar} />} etiquetas={etiquetas} onLimpiar={f.limpiar}>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="space-y-6">
            <Cifra tam="md" valor={cop(total)} etiqueta={`invertidos en educación rural${f.anios.length ? `, ${[...f.anios].sort().join(', ')}` : rango ? `, ${rango}` : ''}`} />
            <p className="text-lg leading-relaxed text-ink2">
              Llegó a <Marca>{num(unicos(base, (x) => x.municipio).size)} municipios</Marca> y <Marca>{num(instituciones)} instituciones</Marca>. Beneficiaron a <Marca>{num(sumar(beneficiados, (b) => b.beneficiados))} estudiantes</Marca> y financiaron a <Marca>{num(estudiantes.length)} estudiantes técnicos</Marca>{f.anios.length > 0 && <> que ingresaron en {f.anios.join(', ')}</>}
              .
            </p>
            <div>
              <div className="flex h-5 overflow-hidden rounded-full ring-2 ring-white" role="img" aria-label={`Departamento de Caldas ${pct(total ? depto / total : 0)}, Comité de Cafeteros ${pct(total ? comite / total : 0)}`}>
                <div style={{ width: `${total ? (depto / total) * 100 : 0}%`, background: colorAportante('Depto. de Caldas') }} />
                <div style={{ width: `${total ? (comite / total) * 100 : 0}%`, background: colorAportante('Comité de Cafeteros') }} />
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { n: 'Departamento de Caldas', c: colorAportante('Depto. de Caldas'), v: depto },
                  { n: 'Comité de Cafeteros', c: colorAportante('Comité de Cafeteros'), v: comite },
                ].map((a) => (
                  <div key={a.n} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span className="size-3.5 rounded-full" style={{ background: a.c }} />
                    <span className="font-bold" style={{ color: 'var(--ink)' }}>
                      {a.n}
                    </span>
                    <span className="cota text-sm">
                      {total ? pct(a.v / total) : '—'} · {cop(a.v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <MapaCaldas datos={datosMapa} placa={placa} fmt={cop} seleccion={f.municipios} alClic={alMunicipio} etiqueta="Mapa de Caldas coloreado por inversión de cada municipio" />
        </div>

        <Seccion
          titulo="¿De dónde viene y a dónde va?"
          nota="Del aportante al programa y al proyecto o proceso."
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
          <Grafico etiqueta="Distribución del recurso por aportante, programa y proyecto" alto={angosto ? 380 : 600} opcion={opcionSol} />
        </Seccion>

        <Seccion titulo="Los municipios que más recibieron" nota="Toca uno para filtrar. La barra muestra su parte de la inversión." tabla={{ archivo: 'inversion-por-municipio', columnas: [{ clave: 'nombre', titulo: 'Municipio' }, { clave: 'valor', titulo: 'Valor', tipo: 'moneda' }], filas: porMunicipio.map((p) => ({ nombre: p.nombre, valor: p.valor })) }}>
          <RankingBarras items={rankingMuni} fmtValor={cop} colorBase={placa.main} seleccion={f.municipios} onClic={alMunicipio} limite={12} />
        </Seccion>

        <Seccion
          titulo="Año por año"
          nota="Cómo cambió la inversión de un año al siguiente. Toca un año para filtrar."
          tabla={{ archivo: 'inversion-por-anio', columnas: [{ clave: 'anio', titulo: 'Año' }, { clave: 'mf', titulo: 'Modelos Educativos Flexibles', tipo: 'moneda' }, { clave: 'uc', titulo: 'Universidad en el Campo', tipo: 'moneda' }], filas: porAnio.map((a) => ({ anio: String(a.anio), mf: a.mf, uc: a.uc })) }}
        >
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="space-y-5">
              <Grafico etiqueta="Inversión por año y programa" alto={340} alClic={(n) => f.setAnios(alternar(f.anios, Number(n)))} opcion={opcionAnios} />
              <TablaAnios filas={porAnio.map((a) => ({ anio: a.anio, valores: [a.mf, a.uc] }))} series={seriesAnio} fmt={cop} nota="El año más reciente puede estar incompleto si su vigencia sigue en curso." />
            </div>
            <div>
              <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                Reparto por programa
              </h3>
              <Grafico etiqueta="Reparto de la inversión por programa" alto={320} opcion={opcionPastel} />
            </div>
          </div>
        </Seccion>
      </ConFiltros>
    </>
  )
}
