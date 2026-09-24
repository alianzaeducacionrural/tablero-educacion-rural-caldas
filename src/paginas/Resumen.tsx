import { useMemo } from 'react'
import { ConFiltros, PanelFiltros, etiquetasDe, type GrupoFiltro } from '../components/Filtros'
import { Grafico } from '../components/Grafico'
import { Cifra, MapaCaldas, Marca, PlacaCabecera, Seccion, TablaAnios } from '../components/Lamina'
import { agrupar, alfa, sumar, unicos } from '../lib/agregar'
import { useAngosto } from '../lib/angosto'
import { PLACAS, colorAportante, colorPrograma } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { cop, num } from '../lib/formato'
import { aclarar, altoBarras, apiladasH, columnas, pastel, sunburst, type Nodo } from '../lib/graficos'
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
  const porMunicipioPrograma = useMemo(() => {
    const m = new Map<string, { mf: number; uc: number }>()
    baseMunicipios.forEach((x) => {
      const e = m.get(x.municipio) ?? { mf: 0, uc: 0 }
      if (x.programa === 'mf') e.mf += x.valor
      else e.uc += x.valor
      m.set(x.municipio, e)
    })
    return [...m.entries()].map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.mf + b.uc - (a.mf + a.uc) || alfa(a.nombre, b.nombre))
  }, [baseMunicipios])
  const opcionMunicipios = useMemo(
    () =>
      apiladasH({
        filas: porMunicipioPrograma.map((p) => ({
          nombre: p.nombre,
          partes: [
            { nombre: PROGRAMAS.mf.nombre, valor: p.mf, color: colorPrograma('mf') },
            { nombre: PROGRAMAS.uc.nombre, valor: p.uc, color: colorPrograma('uc') },
          ],
        })),
        fmt: cop,
        mostrarTotal: true,
      }),
    [porMunicipioPrograma],
  )

  // Programa → proyecto/proceso
  const arbol = useMemo<Nodo[]>(() => {
    const porPrograma = new Map<Programa, Map<string, number>>()
    base.forEach((x) => {
      if (x.valor <= 0) return
      const gm = porPrograma.get(x.programa) ?? new Map<string, number>()
      gm.set(x.grupo, (gm.get(x.grupo) ?? 0) + x.valor)
      porPrograma.set(x.programa, gm)
    })
    return [...porPrograma.entries()].map(([p, gm]) => ({
      name: PROGRAMAS[p].nombre,
      color: colorPrograma(p),
      children: [...gm.entries()].sort((x, y) => y[1] - x[1]).map(([g, v], i) => ({ name: g, value: v, color: aclarar(colorPrograma(p), Math.min(0.55, 0.12 + i * 0.1)) })),
    }))
  }, [base])
  const tablaFlujo = useMemo(() => {
    const m = new Map<string, { programa: string; grupo: string; valor: number }>()
    base.forEach((x) => {
      const id = `${x.programa}|${x.grupo}`
      const e = m.get(id) ?? { programa: PROGRAMAS[x.programa].nombre, grupo: x.grupo, valor: 0 }
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
  const opcionAportante = useMemo(
    () => pastel({ partes: [{ nombre: 'Departamento de Caldas', valor: depto, color: colorAportante('Depto. de Caldas') }, { nombre: 'Comité de Cafeteros', valor: comite, color: colorAportante('Comité de Cafeteros') }], fmt: cop, mostrarValor: true }),
    [depto, comite],
  )

  const municipiosDisp = useMemo(() => [...new Set([...datos.base.map((x) => x.municipio), ...datos.beneficiados.map((b) => b.municipio)])].sort(alfa), [datos])
  const grupos: GrupoFiltro[] = [{ clave: 'municipio', titulo: 'Municipio', opciones: municipiosDisp, valor: f.municipios, onChange: f.setMunicipios, abierto: true }]
  const anioFiltro = { anios, valor: f.anios, onChange: f.setAnios }
  const etiquetas = etiquetasDe(anioFiltro, grupos)

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Resumen de la inversión" texto="Inversión en educación rural de Caldas, entre Modelos Educativos Flexibles y Universidad en el Campo: cuánto, quién lo aportó y a qué municipios llegó. Toca el mapa para filtrar todo lo demás." />

      <ConFiltros panel={<PanelFiltros anios={anioFiltro} grupos={grupos} etiquetas={etiquetas} onLimpiar={f.limpiar} />} etiquetas={etiquetas} onLimpiar={f.limpiar}>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="space-y-6">
            <Cifra tam="md" valor={cop(total)} etiqueta={`invertidos en educación rural${f.anios.length ? `, ${[...f.anios].sort().join(', ')}` : rango ? `, ${rango}` : ''}`} />
            <p className="text-lg leading-relaxed text-ink2">
              Llegó a <Marca>{num(unicos(base, (x) => x.municipio).size)} municipios</Marca> y <Marca>{num(instituciones)} instituciones</Marca>. Beneficiaron a <Marca>{num(sumar(beneficiados, (b) => b.beneficiados))} estudiantes</Marca> y financiaron a <Marca>{num(estudiantes.length)} estudiantes técnicos</Marca>{f.anios.length > 0 && <> que ingresaron en {f.anios.join(', ')}</>}
              .
            </p>
          </div>
          <MapaCaldas datos={datosMapa} placa={placa} fmt={cop} seleccion={f.municipios} alClic={alMunicipio} etiqueta="Mapa de Caldas coloreado por inversión de cada municipio" />
        </div>

        <Seccion
          titulo="¿A dónde va el recurso?"
          nota="Del programa al proyecto o proceso."
          tono="lavado"
          tabla={{
            archivo: 'distribucion-del-recurso',
            columnas: [
              { clave: 'programa', titulo: 'Programa' },
              { clave: 'grupo', titulo: 'Proyecto / proceso' },
              { clave: 'valor', titulo: 'Valor', tipo: 'moneda' },
            ],
            filas: tablaFlujo,
          }}
        >
          <Grafico etiqueta="Distribución del recurso por programa y proyecto" alto={angosto ? 380 : 600} opcion={opcionSol} />
        </Seccion>

        <Seccion titulo="Distribución por municipio" nota="Modelos Educativos Flexibles frente a Universidad en el Campo, en cada municipio. Toca uno para filtrar; el valor es la inversión total.">
          <div className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
            <Grafico etiqueta="Distribución de la inversión por municipio, dividida entre Modelos Educativos Flexibles y Universidad en el Campo" alto={altoBarras(porMunicipioPrograma.length)} alClic={alMunicipio} opcion={opcionMunicipios} />
          </div>
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
            <div className="space-y-8">
              <div>
                <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                  Distribución por programa
                </h3>
                <Grafico etiqueta="Distribución de la inversión por programa" alto={260} opcion={opcionPastel} />
              </div>
              <div>
                <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                  Distribución por aportante
                </h3>
                <Grafico etiqueta="Distribución de la inversión entre el Departamento de Caldas y el Comité de Cafeteros" alto={260} opcion={opcionAportante} />
              </div>
            </div>
          </div>
        </Seccion>
      </ConFiltros>
    </>
  )
}
