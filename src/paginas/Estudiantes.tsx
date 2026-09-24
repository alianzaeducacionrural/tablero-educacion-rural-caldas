import { useMemo, useState } from 'react'
import { ConFiltros, PanelFiltros, etiquetasDe, type GrupoFiltro } from '../components/Filtros'
import { Grafico } from '../components/Grafico'
import { BotonExcel, Cifra, MapaCaldas, Marca, PlacaCabecera, Posiciones, Seccion } from '../components/Lamina'
import { agrupar, alfa, unicos } from '../lib/agregar'
import { PLACAS, colorEstadoEstudiante } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { num, pct } from '../lib/formato'
import { altoBarras, apiladasH, columnas, dona } from '../lib/graficos'
import { MUNICIPIOS_RURALES } from '../lib/municipios'
import type { Estudiante } from '../lib/tipos'
import { pasa, useTablero } from '../lib/usarFiltrado'

type Local = 'universidad' | 'programa' | 'estado' | 'institucion' | 'financiador'
type Dim = Local | 'municipio' | 'anio'
const placa = PLACAS.estudiantes
const ORDEN_ESTADO = ['Graduado', 'Activo', 'Pendiente de grado', 'En riesgo', 'Desertor']
const ordenEstado = (e: string) => (ORDEN_ESTADO.indexOf(e) < 0 ? 99 : ORDEN_ESTADO.indexOf(e))
const VACIO: Record<Local, string[]> = { universidad: [], programa: [], estado: [], institucion: [], financiador: [] }
/** Gobernación de Caldas frente al resto de aliados que financian estudiantes. */
const esGob = (financiador: string) => /gobernaci|depto|departamento/i.test(financiador)
/** "Técnico Profesional" se acorta a "T.P." para que el nombre del programa quepa en las barras. */
const abrevPrograma = (p: string) => p.replace(/técnico profesional/i, 'T.P.')

export function Estudiantes() {
  const { datos, f } = useTablero()
  const [sel, setSel] = useState<Record<Local, string[]>>(VACIO)

  // Todos los estudiantes, sin importar el aportante. Solo municipios rurales de Caldas (sin Manizales, que tiene su propio convenio). Sin nombres: el tablero es público.
  const filas = useMemo(() => datos.estudiantes.filter((e) => MUNICIPIOS_RURALES.has(e.municipio)), [datos])

  // El año elegido (filtro global) es el año de ingreso de cada estudiante: su cohorte.
  const vistas = useMemo(() => {
    const valorDe: Record<Local, (e: Estudiante) => string> = { universidad: (e) => e.universidad, programa: (e) => abrevPrograma(e.programa), estado: (e) => e.estado, institucion: (e) => e.institucion, financiador: (e) => e.financiador }
    const ok = (e: Estudiante, omitir?: Dim) =>
      (omitir === 'anio' || pasa({ anios: f.anios, municipios: [] }, e.anioIngreso, null)) &&
      (omitir === 'municipio' || pasa(f, null, e.municipio)) &&
      (Object.keys(valorDe) as Local[]).every((d) => d === omitir || !sel[d].length || sel[d].includes(valorDe[d](e)))
    const de = (omitir?: Dim) => filas.filter((e) => ok(e, omitir))
    return { todas: de(), anio: de('anio'), universidad: de('universidad'), programa: de('programa'), estado: de('estado'), municipio: de('municipio') }
  }, [filas, f, sel])

  const alt = (d: Local) => (n: string) => setSel((s) => ({ ...s, [d]: alternar(s[d], n) }))
  const set = (d: Local) => (l: string[]) => setSel((s) => ({ ...s, [d]: l }))

  const t = vistas.todas
  const graduados = t.filter((e) => /^graduado$/i.test(e.estado)).length
  const desertores = t.filter((e) => /desert/i.test(e.estado)).length
  const gobTotal = t.filter((e) => esGob(e.financiador)).length

  const estados = useMemo(() => [...new Set(filas.map((e) => e.estado))].sort((a, b) => ordenEstado(a) - ordenEstado(b)), [filas])
  const cohortes = useMemo(() => [...new Set(filas.map((e) => String(e.anioIngreso)))].sort(), [filas])
  const pEstado = agrupar(t, (e) => e.estado, () => 1).sort((a, b) => ordenEstado(a.nombre) - ordenEstado(b.nombre))

  const porMuni = useMemo(() => agrupar(vistas.municipio, (e) => e.municipio, () => 1), [vistas.municipio])
  const datosMapa = useMemo(() => porMuni.map((p) => ({ name: p.nombre, value: p.valor })), [porMuni])

  // Cada barra (universidad, programa) se divide entre la Gobernación de Caldas y los demás aliados.
  const colorGob = placa.main
  const colorOtros = placa.apoyo[1]
  const conAportante = (base: Estudiante[], clave: (e: Estudiante) => string) => {
    const m = new Map<string, { gob: number; otros: number }>()
    base.forEach((e) => {
      const k = clave(e)
      const fila = m.get(k) ?? { gob: 0, otros: 0 }
      if (esGob(e.financiador)) fila.gob++
      else fila.otros++
      m.set(k, fila)
    })
    return [...m.entries()].map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.gob + b.otros - (a.gob + a.otros) || alfa(a.nombre, b.nombre))
  }
  const filasAportante = (filas: { nombre: string; gob: number; otros: number }[]) =>
    filas.map((x) => ({ nombre: x.nombre, partes: [{ nombre: 'Gobernación de Caldas', valor: x.gob, color: colorGob }, { nombre: 'Otros aliados', valor: x.otros, color: colorOtros }] }))

  const pUni = useMemo(() => conAportante(vistas.universidad, (e) => e.universidad), [vistas.universidad]) // eslint-disable-line react-hooks/exhaustive-deps
  const opcionUni = useMemo(() => apiladasH({ filas: filasAportante(pUni), fmt: num, mostrarTotal: true }), [pUni]) // eslint-disable-line react-hooks/exhaustive-deps
  const pProg = useMemo(() => conAportante(vistas.programa, (e) => abrevPrograma(e.programa)), [vistas.programa]) // eslint-disable-line react-hooks/exhaustive-deps
  const opcionProg = useMemo(() => apiladasH({ filas: filasAportante(pProg), fmt: num, mostrarTotal: true, ancho: 330 }), [pProg]) // eslint-disable-line react-hooks/exhaustive-deps
  const pGenero = agrupar(t, (e) => e.genero || 'Sin dato', () => 1)
  const coloresGenero = ['#0B8F58', '#7B5CFF', '#FFB000', '#17A6B8']
  const opcionGenero = useMemo(() => dona({ partes: pGenero.map((g, i) => ({ nombre: g.nombre, valor: g.valor, color: coloresGenero[i % coloresGenero.length] })), centro: num(t.length), sub: 'estudiantes', fmt: num }), [pGenero, t.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cohortes: cada año de ingreso, según su estado hoy
  const opcionCohortes = useMemo(() => columnas({ categorias: cohortes, series: estados.map((e) => ({ nombre: e, color: colorEstadoEstudiante(e), datos: cohortes.map((c) => vistas.anio.filter((x) => String(x.anioIngreso) === c && x.estado === e).length) })), fmt: num, apilada: true, seleccion: f.anios.map(String) }), [cohortes, estados, vistas.anio, f.anios])
  // Independiente del filtro de año de ingreso: quien filtra por un año también quiere ver cuántos se graduaron ese año.
  const aniosGrad = [...new Set(vistas.anio.map((e) => e.anioGraduacion).filter((a): a is number => a !== null))].sort()
  const opcionGrad = useMemo(() => columnas({ categorias: aniosGrad.map(String), series: [{ nombre: 'Graduados', color: placa.main, datos: aniosGrad.map((a) => vistas.anio.filter((e) => e.anioGraduacion === a).length) }], fmt: num }), [aniosGrad, vistas.anio])

  const u = (c: (e: Estudiante) => string) => [...unicos(filas, c)]
  const grupos: GrupoFiltro[] = [
    { clave: 'universidad', titulo: 'Universidad', opciones: u((e) => e.universidad), valor: sel.universidad, onChange: set('universidad') },
    { clave: 'programa', titulo: 'Programa', opciones: u((e) => abrevPrograma(e.programa)), valor: sel.programa, onChange: set('programa') },
    { clave: 'financiador', titulo: 'Aportante', opciones: u((e) => e.financiador), valor: sel.financiador, onChange: set('financiador') },
    { clave: 'estado', titulo: 'Estado', opciones: u((e) => e.estado), valor: sel.estado, onChange: set('estado') },
    { clave: 'municipio', titulo: 'Municipio', opciones: u((e) => e.municipio).sort(alfa), valor: f.municipios, onChange: f.setMunicipios },
    { clave: 'institucion', titulo: 'Institución Educativa', opciones: u((e) => e.institucion), valor: sel.institucion, onChange: set('institucion') },
  ]
  const anioFiltro = { anios: cohortes.map(Number), valor: f.anios, onChange: f.setAnios }
  const etiquetas = etiquetasDe(anioFiltro, grupos, 'Año de ingreso')
  const limpiar = () => {
    setSel(VACIO)
    f.limpiar()
  }
  const tablaAportante = (col: string, filas: { nombre: string; gob: number; otros: number }[], archivo: string) => ({
    archivo,
    columnas: [{ clave: 'nombre', titulo: col }, { clave: 'gob', titulo: 'Gobernación de Caldas', tipo: 'numero' as const }, { clave: 'otros', titulo: 'Otros aliados', tipo: 'numero' as const }, { clave: 'total', titulo: 'Total', tipo: 'numero' as const }],
    filas: filas.map((x) => ({ nombre: x.nombre, gob: x.gob, otros: x.otros, total: x.gob + x.otros })),
  })
  const tablaMunicipioT = { archivo: 'estudiantes-por-municipio', columnas: [{ clave: 'nombre', titulo: 'Municipio' }, { clave: 'valor', titulo: 'Estudiantes', tipo: 'numero' as const }], filas: porMuni.map((p) => ({ nombre: p.nombre, valor: p.valor })) }
  const tablaUniT = tablaAportante('Universidad', pUni, 'estudiantes-por-universidad')
  const tablaProgT = tablaAportante('Programa', pProg, 'estudiantes-por-programa')
  const tablaGeneroT = { archivo: 'estudiantes-por-genero', columnas: [{ clave: 'nombre', titulo: 'Género' }, { clave: 'valor', titulo: 'Estudiantes', tipo: 'numero' as const }], filas: pGenero.map((p) => ({ nombre: p.nombre, valor: p.valor })) }
  const tablaCohorteT = { archivo: 'estudiantes-por-cohorte-y-estado', columnas: [{ clave: 'cohorte', titulo: 'Año de ingreso' }, ...estados.map((e) => ({ clave: e, titulo: e, tipo: 'numero' as const }))], filas: cohortes.map((c) => Object.fromEntries([['cohorte', c], ...estados.map((e) => [e, vistas.anio.filter((x) => String(x.anioIngreso) === c && x.estado === e).length])])) }
  const tablaGradT = { archivo: 'graduados-por-anio', columnas: [{ clave: 'anio', titulo: 'Año de grado' }, { clave: 'valor', titulo: 'Graduados', tipo: 'numero' as const }], filas: aniosGrad.map((a) => ({ anio: String(a), valor: vistas.anio.filter((e) => e.anioGraduacion === a).length })) }
  const tablaResumenT = {
    archivo: 'resumen',
    columnas: [{ clave: 'indicador', titulo: 'Indicador' }, { clave: 'valor', titulo: 'Valor', tipo: 'numero' as const }],
    filas: [
      { indicador: 'Estudiantes técnicos profesionales', valor: t.length },
      { indicador: 'Financiados por la Gobernación de Caldas', valor: gobTotal },
      { indicador: 'Financiados por otros aliados', valor: t.length - gobTotal },
      { indicador: 'Graduados', valor: graduados },
      { indicador: 'Desertores', valor: desertores },
    ],
  }
  const hojasExcel = [
    { nombre: 'Resumen', tabla: tablaResumenT },
    { nombre: 'Municipio', tabla: tablaMunicipioT },
    { nombre: 'Universidad', tabla: tablaUniT },
    { nombre: 'Programa', tabla: tablaProgT },
    { nombre: 'Género', tabla: tablaGeneroT },
    { nombre: 'Cohorte y estado', tabla: tablaCohorteT },
    { nombre: 'Graduados por año', tabla: tablaGradT },
  ]

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Técnicos Profesionales" texto="Estudiantes técnicos profesionales de Universidad en el Campo, en los municipios rurales de Caldas. No se muestran nombres.">
        <BotonExcel archivo="tecnicos-profesionales-educacion-rural-caldas" hojas={hojasExcel} />
      </PlacaCabecera>

      <ConFiltros panel={<PanelFiltros anios={anioFiltro} tituloAnios="Año de ingreso" grupos={grupos} etiquetas={etiquetas} onLimpiar={limpiar} />} etiquetas={etiquetas} onLimpiar={limpiar}>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <div>
            <Grafico etiqueta="Estudiantes por cohorte y estado" alto={380} alClic={(c) => f.setAnios(alternar(f.anios, Number(c)))} opcion={opcionCohortes} />
            <p className="mt-5 max-w-xl text-sm text-ink2">Cada barra es una cohorte (el año en que ingresó), dividida por su estado hoy. Toca un año para filtrar. El año es el de ingreso, y es el mismo filtro de año del resto del tablero.</p>
          </div>
          <div className="space-y-6">
            <Cifra tam="lg" valor={num(t.length)} etiqueta="estudiantes técnicos profesionales" />
            <p className="text-lg leading-relaxed text-ink2">
              <Marca color={placa.wash}>{num(gobTotal)}</Marca> financiados por la Gobernación de Caldas y <Marca color="#D6E4FF">{num(t.length - gobTotal)}</Marca> por otros aliados.
            </p>
            <p className="text-lg leading-relaxed text-ink2">
              <Marca color="#BFEBCF">{t.length ? pct(graduados / t.length) : '—'}</Marca> ya se graduó y <Marca color="#FFC9CB">{t.length ? pct(desertores / t.length) : '—'}</Marca> desertó.
            </p>
            <Posiciones items={pEstado.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorEstadoEstudiante(p.nombre) }))} fmt={num} onClic={alt('estado')} seleccion={sel.estado} />
          </div>
        </div>

        <div className="grid items-start gap-12 2xl:grid-cols-2">
          <Seccion titulo="¿De dónde son?" nota="Estudiantes por municipio. Toca uno para filtrar." tabla={tablaMunicipioT}>
            <MapaCaldas datos={datosMapa} placa={placa} fmt={num} seleccion={f.municipios} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} etiqueta="Estudiantes técnicos por municipio" />
          </Seccion>
          <Seccion titulo="¿Dónde estudian?" nota="Estudiantes por universidad, divididos entre la Gobernación y otros aliados. Toca una barra para filtrar." tono="lavado" tabla={tablaUniT}>
            <Grafico etiqueta="Estudiantes por universidad, divididos entre la Gobernación de Caldas y otros aliados" alto={altoBarras(pUni.length)} alClic={alt('universidad')} opcion={opcionUni} />
          </Seccion>
        </div>

        <Seccion titulo="Programas" nota="Estudiantes por programa, divididos entre la Gobernación y otros aliados. Toca una barra para filtrar." tabla={tablaProgT}>
          <Grafico etiqueta="Estudiantes por programa, divididos entre la Gobernación de Caldas y otros aliados" alto={altoBarras(pProg.length)} alClic={alt('programa')} opcion={opcionProg} />
        </Seccion>

        <Seccion titulo="Género" tono="lavado" tabla={tablaGeneroT}>
          <div className="grid items-center gap-6 sm:grid-cols-2">
            <Grafico etiqueta="Estudiantes por género" alto={260} opcion={opcionGenero} />
            <Posiciones items={pGenero.map((g, i) => ({ nombre: g.nombre, valor: g.valor, color: coloresGenero[i % coloresGenero.length] }))} fmt={num} />
          </div>
        </Seccion>

        <Seccion titulo="Graduados por año de grado" nota="Cuántos se graduaron cada año, sin importar en cuál entraron." tono="lavado">
          <Grafico etiqueta="Graduados por año de grado" alto={340} opcion={opcionGrad} />
        </Seccion>
      </ConFiltros>
    </>
  )
}
