import { useMemo, useState } from 'react'
import { Segmentado } from '../components/controles'
import { ConFiltros, PanelFiltros, etiquetasDe, type GrupoFiltro } from '../components/Filtros'
import { Grafico } from '../components/Grafico'
import { BotonExcel, Cifra, MapaCaldas, Marca, PlacaCabecera, Posiciones, Seccion, TablaAnios } from '../components/Lamina'
import { agrupar, alfa, sumar, unicos } from '../lib/agregar'
import { PLACAS, colorAportante, colorPrograma, tinte } from '../lib/colores'
import { alternar, fraseAnios, fraseFiltros, fraseValores } from '../lib/filtros'
import { cop, num } from '../lib/formato'
import { altoBarras, apiladasH, columnas, dona, pastel } from '../lib/graficos'
import { PROGRAMAS } from '../lib/tipos'
import { pasa, useTablero } from '../lib/usarFiltrado'

const placa = PLACAS.resumen

export function Resumen() {
  const { datos, f } = useTablero()
  const [institucionSel, setInstitucionSel] = useState<string[]>([])
  const conInst = (v: string) => institucionSel.length === 0 || institucionSel.includes(v)

  const base = useMemo(() => datos.base.filter((x) => pasa(f, x.anio, x.municipio) && conInst(x.institucion)), [datos, f, institucionSel])
  const baseMunicipios = useMemo(() => datos.base.filter((x) => pasa({ anios: f.anios, municipios: [] }, x.anio, x.municipio) && conInst(x.institucion)), [datos, f.anios, institucionSel])
  const baseAnios = useMemo(() => datos.base.filter((x) => pasa({ anios: [], municipios: f.municipios }, x.anio, x.municipio) && conInst(x.institucion)), [datos, f.municipios, institucionSel])
  const beneficiados = useMemo(() => datos.beneficiados.filter((b) => pasa(f, b.anio, b.municipio) && conInst(b.institucion)), [datos, f, institucionSel])
  // Un estudiante pertenece al año en que ingresó (su cohorte): así el filtro de año también lo mueve.
  const estudiantes = useMemo(() => datos.estudiantes.filter((e) => /gobernaci/i.test(e.financiador) && pasa(f, e.anioIngreso, e.municipio) && conInst(e.institucion)), [datos, f, institucionSel])

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

  // Para "por año": mismo criterio que "por municipio" (ignora el filtro que el propio gráfico representa), pero
  // ignorando también el filtro de año, porque aquí el año es lo que se quiere comparar.
  const baseMunicipiosAnio = useMemo(() => datos.base.filter((x) => conInst(x.institucion)), [datos, institucionSel]) // eslint-disable-line react-hooks/exhaustive-deps
  const porMunicipioAnio = useMemo(() => {
    const m = new Map<string, Map<number, number>>()
    baseMunicipiosAnio.forEach((x) => {
      const e = m.get(x.municipio) ?? new Map<number, number>()
      e.set(x.anio, (e.get(x.anio) ?? 0) + x.valor)
      m.set(x.municipio, e)
    })
    const total = (porAnio: number[]) => porAnio.reduce((s, v) => s + v, 0)
    return [...m.entries()]
      .map(([nombre, e]) => ({ nombre, porAnio: anios.map((a) => e.get(a) ?? 0) }))
      .sort((a, b) => total(b.porAnio) - total(a.porAnio) || alfa(a.nombre, b.nombre))
  }, [baseMunicipiosAnio, anios])
  const coloresAnio = useMemo(() => anios.map((_, i) => tinte(placa.escala, anios.length > 1 ? 0.15 + (i / (anios.length - 1)) * 0.75 : 0.5)), [anios])

  const [vistaMuni, setVistaMuni] = useState<'programa' | 'anio'>('programa')
  const filasMuniPrograma = useMemo(
    () =>
      porMunicipioPrograma.map((p) => ({
        nombre: p.nombre,
        partes: [
          { nombre: PROGRAMAS.mf.nombre, valor: p.mf, color: colorPrograma('mf') },
          { nombre: PROGRAMAS.uc.nombre, valor: p.uc, color: colorPrograma('uc') },
        ],
      })),
    [porMunicipioPrograma],
  )
  const filasMuniAnio = useMemo(
    () => porMunicipioAnio.map((p) => ({ nombre: p.nombre, partes: anios.map((a, i) => ({ nombre: String(a), valor: p.porAnio[i], color: coloresAnio[i] })) })),
    [porMunicipioAnio, anios, coloresAnio],
  )
  const filasMuni = vistaMuni === 'programa' ? filasMuniPrograma : filasMuniAnio
  const [verTodosMuni, setVerTodosMuni] = useState(false)
  const municipiosMostrados = verTodosMuni ? filasMuni : filasMuni.slice(0, 10)
  const opcionMunicipios = useMemo(
    () => (vistaMuni === 'anio' ? apiladasH({ filas: municipiosMostrados, fmt: cop, agrupadas: true, mostrarValores: true }) : apiladasH({ filas: municipiosMostrados, fmt: cop, mostrarTotal: true })),
    [municipiosMostrados, vistaMuni],
  )

  // Programa → proyecto/proceso (el detalle solo se ve en la tabla y el Excel; el gráfico muestra el total por programa)
  const totalMf = sumar(base.filter((x) => x.programa === 'mf'), (x) => x.valor)
  const opcionPrograma = useMemo(
    () => dona({ partes: [{ nombre: 'Modelos Educativos Flexibles', valor: totalMf, color: colorPrograma('mf') }, { nombre: 'Universidad en el Campo', valor: total - totalMf, color: colorPrograma('uc') }], centro: cop(total), sub: 'invertidos', fmt: cop }),
    [totalMf, total],
  )
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
  const opcionPastel = useMemo(
    () => pastel({ partes: [{ nombre: 'Modelos Educativos Flexibles', valor: totalMf, color: colorPrograma('mf') }, { nombre: 'Universidad en el Campo', valor: total - totalMf, color: colorPrograma('uc') }], fmt: cop, mostrarValor: true }),
    [totalMf, total],
  )
  const opcionAportante = useMemo(
    () => pastel({ partes: [{ nombre: 'Departamento de Caldas', valor: depto, color: colorAportante('Depto. de Caldas') }, { nombre: 'Comité de Cafeteros', valor: comite, color: colorAportante('Comité de Cafeteros') }], fmt: cop, mostrarValor: true }),
    [depto, comite],
  )

  const municipiosDisp = useMemo(() => [...new Set([...datos.base.map((x) => x.municipio), ...datos.beneficiados.map((b) => b.municipio)])].sort(alfa), [datos])
  const institucionesDisp = useMemo(() => [...new Set([...datos.base.map((x) => x.institucion), ...datos.beneficiados.map((b) => b.institucion)])].sort(alfa), [datos])
  const grupos: GrupoFiltro[] = [
    { clave: 'municipio', titulo: 'Municipio', opciones: municipiosDisp, valor: f.municipios, onChange: f.setMunicipios, abierto: true },
    { clave: 'institucion', titulo: 'Institución Educativa', opciones: institucionesDisp, valor: institucionSel, onChange: setInstitucionSel },
  ]
  const anioFiltro = { anios, valor: f.anios, onChange: f.setAnios }
  const etiquetas = etiquetasDe(anioFiltro, grupos)
  const limpiar = () => {
    f.limpiar()
    setInstitucionSel([])
  }
  const contextoFiltros = fraseFiltros(fraseAnios(f.anios, anios), fraseValores(f.municipios, 'municipios'), fraseValores(institucionSel, 'instituciones'))

  const tablaFlujoT = { archivo: 'distribucion-del-recurso', columnas: [{ clave: 'programa', titulo: 'Programa' }, { clave: 'grupo', titulo: 'Proyecto / proceso' }, { clave: 'valor', titulo: 'Valor', tipo: 'moneda' as const }], filas: tablaFlujo }
  const tablaMunicipioT =
    vistaMuni === 'programa'
      ? { archivo: 'inversion-por-municipio', columnas: [{ clave: 'nombre', titulo: 'Municipio' }, { clave: 'mf', titulo: 'Modelos Educativos Flexibles', tipo: 'moneda' as const }, { clave: 'uc', titulo: 'Universidad en el Campo', tipo: 'moneda' as const }, { clave: 'total', titulo: 'Total', tipo: 'moneda' as const }], filas: porMunicipioPrograma.map((p) => ({ nombre: p.nombre, mf: p.mf, uc: p.uc, total: p.mf + p.uc })) }
      : {
          archivo: 'inversion-por-municipio-y-anio',
          columnas: [{ clave: 'nombre', titulo: 'Municipio' }, ...anios.map((a) => ({ clave: String(a), titulo: String(a), tipo: 'moneda' as const })), { clave: 'total', titulo: 'Total', tipo: 'moneda' as const }],
          filas: porMunicipioAnio.map((p) => ({ nombre: p.nombre, total: p.porAnio.reduce((s, v) => s + v, 0), ...Object.fromEntries(anios.map((a, i) => [String(a), p.porAnio[i]])) })),
        }
  const tablaAnioT = { archivo: 'inversion-por-anio', columnas: [{ clave: 'anio', titulo: 'Año' }, { clave: 'mf', titulo: 'Modelos Educativos Flexibles', tipo: 'moneda' as const }, { clave: 'uc', titulo: 'Universidad en el Campo', tipo: 'moneda' as const }], filas: porAnio.map((a) => ({ anio: String(a.anio), mf: a.mf, uc: a.uc })) }
  const tablaResumenT = {
    archivo: 'resumen',
    columnas: [{ clave: 'indicador', titulo: 'Indicador' }, { clave: 'valor', titulo: 'Valor', tipo: 'numero' as const }],
    filas: [
      { indicador: `Total invertido${f.anios.length ? ` (${[...f.anios].sort().join(', ')})` : ''}`, valor: total },
      { indicador: 'Departamento de Caldas', valor: depto },
      { indicador: 'Comité de Cafeteros', valor: comite },
      { indicador: 'Municipios', valor: unicos(base, (x) => x.municipio).size },
      { indicador: 'Instituciones', valor: instituciones },
      { indicador: 'Estudiantes beneficiados (Modelos Educativos Flexibles)', valor: sumar(beneficiados, (b) => b.beneficiados) },
      { indicador: 'Estudiantes técnicos financiados (Universidad en el Campo)', valor: estudiantes.length },
    ],
  }
  const tablaBaseT = {
    archivo: 'resumen-base-de-datos',
    columnas: [
      { clave: 'programa', titulo: 'Programa' },
      { clave: 'anio', titulo: 'Año', tipo: 'numero' as const },
      { clave: 'municipio', titulo: 'Municipio' },
      { clave: 'institucion', titulo: 'Institución' },
      { clave: 'grupo', titulo: 'Proyecto / proceso' },
      { clave: 'actividad', titulo: 'Actividad' },
      { clave: 'estado', titulo: 'Estado' },
      { clave: 'aportante', titulo: 'Aportante' },
      { clave: 'asistio', titulo: 'Asistió' },
      { clave: 'cantidad', titulo: 'Cantidad', tipo: 'cantidad' as const },
      { clave: 'valor', titulo: 'Valor', tipo: 'moneda' as const },
    ],
    // Agrupada por institución: todas las filas de una misma IE quedan juntas, de corrido.
    filas: [...base]
      .sort((a, b) => alfa(a.municipio, b.municipio) || alfa(a.institucion, b.institucion) || a.anio - b.anio)
      .map((x) => ({ programa: PROGRAMAS[x.programa].nombre, anio: x.anio, municipio: x.municipio, institucion: x.institucion, grupo: x.grupo, actividad: x.actividad, estado: x.estado, aportante: x.aportante, asistio: x.asistio ? 'Sí' : 'No', cantidad: x.cantidad, valor: x.valor })),
  }
  const hojasExcel = [
    { nombre: 'Base de datos', tabla: tablaBaseT },
    { nombre: 'Resumen', tabla: tablaResumenT },
    { nombre: 'Programa y proyecto', tabla: tablaFlujoT },
    { nombre: 'Municipio', tabla: tablaMunicipioT },
    { nombre: 'Año', tabla: tablaAnioT },
  ]

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Resumen de la inversión" texto="Inversión en educación rural de Caldas, entre Modelos Educativos Flexibles y Universidad en el Campo.">
        <BotonExcel archivo="resumen-educacion-rural-caldas" hojas={hojasExcel} />
      </PlacaCabecera>

      <ConFiltros panel={<PanelFiltros anios={anioFiltro} grupos={grupos} etiquetas={etiquetas} onLimpiar={limpiar} />} etiquetas={etiquetas} onLimpiar={limpiar}>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <MapaCaldas datos={datosMapa} placa={placa} fmt={cop} seleccion={f.municipios} alClic={alMunicipio} etiqueta="Mapa de Caldas coloreado por inversión de cada municipio" />
          <div className="space-y-6 rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
            <Cifra tam="md" valor={cop(total)} etiqueta={`invertidos en educación rural${f.anios.length ? `, ${[...f.anios].sort().join(', ')}` : rango ? `, ${rango}` : ''}`} />
            <p className="text-lg leading-relaxed text-ink2">
              Llegó a <Marca>{num(unicos(base, (x) => x.municipio).size)} municipios</Marca> y <Marca>{num(instituciones)} instituciones</Marca>. Beneficiaron a <Marca>{num(sumar(beneficiados, (b) => b.beneficiados))} estudiantes</Marca> y financiaron a <Marca>{num(estudiantes.length)} estudiantes técnicos</Marca>.
              {contextoFiltros && <> Datos de <Marca>{contextoFiltros}</Marca>.</>}
            </p>
          </div>
        </div>

        <Seccion
          titulo="Distribución por municipio"
          nota={vistaMuni === 'programa' ? 'Modelos Educativos Flexibles frente a Universidad en el Campo, en cada municipio. Toca uno para filtrar; el valor es la inversión total.' : 'Cómo cambió la inversión de un año a otro, en cada municipio. Toca uno para filtrar; el valor es la inversión total.'}
          acciones={<Segmentado etiqueta="Dividir por" valor={vistaMuni} onChange={setVistaMuni} opciones={[{ id: 'programa', texto: 'Por programa' }, { id: 'anio', texto: 'Por año' }]} />}
          tabla={tablaMunicipioT}
        >
          <div className={verTodosMuni ? 'rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6' : 'max-h-[480px] overflow-y-auto rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6'}>
            <Grafico etiqueta={vistaMuni === 'programa' ? 'Distribución de la inversión por municipio, dividida entre Modelos Educativos Flexibles y Universidad en el Campo' : 'Distribución de la inversión por municipio, dividida por año'} alto={altoBarras(municipiosMostrados.length, vistaMuni === 'anio' ? 1.7 : 1)} alClic={alMunicipio} opcion={opcionMunicipios} sinRecuadro />
          </div>
          {filasMuni.length > 10 && (
            <button type="button" onClick={() => setVerTodosMuni((v) => !v)} className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-accentink ring-1 ring-line hover:bg-wash">
              {verTodosMuni ? 'Ver los 10 principales' : `Ver los ${filasMuni.length} municipios`}
            </button>
          )}
        </Seccion>

        <Seccion titulo="Distribución del recurso" nota="Modelos Educativos Flexibles frente a Universidad en el Campo. El detalle por proyecto o proceso está en la tabla." tono="lavado" tabla={tablaFlujoT}>
          <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
            <Grafico etiqueta="Distribución de la inversión entre Modelos Educativos Flexibles y Universidad en el Campo" alto={320} opcion={opcionPrograma} />
            <Posiciones
              items={[
                { nombre: 'Modelos Educativos Flexibles', valor: totalMf, color: colorPrograma('mf') },
                { nombre: 'Universidad en el Campo', valor: total - totalMf, color: colorPrograma('uc') },
              ]}
              fmt={cop}
            />
          </div>
        </Seccion>

        <Seccion titulo="Año por año" nota="Cómo cambió la inversión de un año al siguiente. Toca un año para filtrar." tabla={tablaAnioT}>
          <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
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
