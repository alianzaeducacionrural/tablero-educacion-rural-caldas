import { useMemo, useState } from 'react'
import { ConFiltros, PanelFiltros, etiquetasDe, type GrupoFiltro } from '../components/Filtros'
import { Grafico } from '../components/Grafico'
import { Cafetal, Cifra, MapaCaldas, Marca, PlacaCabecera, Posiciones, Seccion } from '../components/Lamina'
import { RankingBarras } from '../components/Ranking'
import { agrupar, alfa, unicos } from '../lib/agregar'
import { PLACAS, colorEstadoEstudiante } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { num, pct } from '../lib/formato'
import { columnas, dona, pastel } from '../lib/graficos'
import type { Estudiante } from '../lib/tipos'
import { pasa, useTablero } from '../lib/usarFiltrado'

type Local = 'universidad' | 'programa' | 'estado' | 'institucion'
type Dim = Local | 'municipio' | 'anio'
const placa = PLACAS.estudiantes
const ORDEN_ESTADO = ['Graduado', 'Activo', 'Pendiente de grado', 'Desertor']
const ordenEstado = (e: string) => (ORDEN_ESTADO.indexOf(e) < 0 ? 99 : ORDEN_ESTADO.indexOf(e))
const VACIO: Record<Local, string[]> = { universidad: [], programa: [], estado: [], institucion: [] }

export function Estudiantes() {
  const { datos, f } = useTablero()
  const [sel, setSel] = useState<Record<Local, string[]>>(VACIO)

  // Solo los financiados por la Gobernación. Sin nombres: el tablero es público.
  const filas = useMemo(() => datos.estudiantes.filter((e) => /gobernaci/i.test(e.financiador)), [datos])

  // El año elegido (filtro global) es el año de ingreso de cada estudiante: su cohorte.
  const vistas = useMemo(() => {
    const valorDe: Record<Local, (e: Estudiante) => string> = { universidad: (e) => e.universidad, programa: (e) => e.programa, estado: (e) => e.estado, institucion: (e) => e.institucion }
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

  const estados = useMemo(() => [...new Set(filas.map((e) => e.estado))].sort((a, b) => ordenEstado(a) - ordenEstado(b)), [filas])
  const cohortes = useMemo(() => [...new Set(filas.map((e) => String(e.anioIngreso)))].sort(), [filas])
  const conteoCohortes = useMemo(() => cohortes.map((c) => ({ cohorte: c, conteos: Object.fromEntries(estados.map((e) => [e, vistas.anio.filter((x) => String(x.anioIngreso) === c && x.estado === e).length])) })), [cohortes, estados, vistas.anio])
  const pEstado = agrupar(t, (e) => e.estado, () => 1).sort((a, b) => ordenEstado(a.nombre) - ordenEstado(b.nombre))

  const porMuni = useMemo(() => agrupar(vistas.municipio, (e) => e.municipio, () => 1), [vistas.municipio])
  const datosMapa = useMemo(() => porMuni.map((p) => ({ name: p.nombre, value: p.valor })), [porMuni])

  const pUni = agrupar(vistas.universidad, (e) => e.universidad, () => 1)
  const opcionUni = useMemo(() => pastel({ partes: pUni.map((p, i) => ({ nombre: p.nombre, valor: p.valor, color: placa.apoyo[i % placa.apoyo.length] })), fmt: num, seleccion: sel.universidad }), [pUni, sel.universidad]) // eslint-disable-line react-hooks/exhaustive-deps
  const pProg = agrupar(vistas.programa, (e) => e.programa, () => 1)
  const pGenero = agrupar(t, (e) => e.genero || 'Sin dato', () => 1)
  const coloresGenero = ['#0B8F58', '#7B5CFF', '#FFB000', '#17A6B8']
  const opcionGenero = useMemo(() => dona({ partes: pGenero.map((g, i) => ({ nombre: g.nombre, valor: g.valor, color: coloresGenero[i % coloresGenero.length] })), centro: num(t.length), sub: 'estudiantes', fmt: num }), [pGenero, t.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cohortes: cada año de ingreso, según su estado hoy
  const opcionCohortes = useMemo(() => columnas({ categorias: cohortes, series: estados.map((e) => ({ nombre: e, color: colorEstadoEstudiante(e), datos: cohortes.map((c) => vistas.anio.filter((x) => String(x.anioIngreso) === c && x.estado === e).length) })), fmt: num, apilada: true, seleccion: f.anios.map(String) }), [cohortes, estados, vistas.anio, f.anios])
  const aniosGrad = [...new Set(t.map((e) => e.anioGraduacion).filter((a): a is number => a !== null))].sort()
  const opcionGrad = useMemo(() => columnas({ categorias: aniosGrad.map(String), series: [{ nombre: 'Graduados', color: placa.main, datos: aniosGrad.map((a) => t.filter((e) => e.anioGraduacion === a).length) }], fmt: num }), [aniosGrad, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const u = (c: (e: Estudiante) => string) => [...unicos(filas, c)]
  const grupos: GrupoFiltro[] = [
    { clave: 'universidad', titulo: 'Universidad', opciones: u((e) => e.universidad), valor: sel.universidad, onChange: set('universidad') },
    { clave: 'programa', titulo: 'Programa', opciones: u((e) => e.programa), valor: sel.programa, onChange: set('programa') },
    { clave: 'estado', titulo: 'Estado', opciones: u((e) => e.estado), valor: sel.estado, onChange: set('estado') },
    { clave: 'municipio', titulo: 'Municipio', opciones: u((e) => e.municipio).sort(alfa), valor: f.municipios, onChange: f.setMunicipios },
    { clave: 'institucion', titulo: 'Institución', opciones: u((e) => e.institucion), valor: sel.institucion, onChange: set('institucion') },
  ]
  const anioFiltro = { anios: cohortes.map(Number), valor: f.anios, onChange: f.setAnios }
  const etiquetas = etiquetasDe(anioFiltro, grupos)
  const limpiar = () => {
    setSel(VACIO)
    f.limpiar()
  }

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Cada punto, un estudiante" texto="Estudiantes técnicos y tecnólogos de Universidad en el Campo cuya formación financia la Gobernación de Caldas. No se muestran nombres." />

      <ConFiltros panel={<PanelFiltros anios={anioFiltro} tituloAnios="Año de ingreso" grupos={grupos} activos={etiquetas.length} onLimpiar={limpiar} />} etiquetas={etiquetas} onLimpiar={limpiar}>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <div>
            <Cafetal cohortes={conteoCohortes} estados={estados} colorDe={colorEstadoEstudiante} seleccionEstado={sel.estado} seleccionCohorte={f.anios.map(String)} alClicEstado={alt('estado')} alClicCohorte={(c) => f.setAnios(alternar(f.anios, Number(c)))} />
            <p className="mt-5 max-w-xl text-sm text-ink2">Cada punto es un estudiante, agrupado por el año en que ingresó y pintado por su estado hoy. Toca un color o un año para filtrar. El año es el de ingreso, y es el mismo filtro de año del resto del tablero.</p>
          </div>
          <div className="space-y-6">
            <Cifra tam="lg" valor={num(t.length)} etiqueta="estudiantes financiados por la Gobernación" />
            <p className="text-lg leading-relaxed text-ink2">
              <Marca color="#BFEBCF">{t.length ? pct(graduados / t.length) : '—'}</Marca> ya se graduó y <Marca color="#FFC9CB">{t.length ? pct(desertores / t.length) : '—'}</Marca> desertó.
            </p>
            <Posiciones items={pEstado.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorEstadoEstudiante(p.nombre) }))} fmt={num} onClic={alt('estado')} seleccion={sel.estado} />
          </div>
        </div>

        <div className="grid items-start gap-12 2xl:grid-cols-2">
          <Seccion titulo="¿De dónde son?" nota="Estudiantes por municipio. Toca uno para filtrar." tabla={{ archivo: 'estudiantes-por-municipio', columnas: [{ clave: 'nombre', titulo: 'Municipio' }, { clave: 'valor', titulo: 'Estudiantes', tipo: 'numero' }], filas: porMuni.map((p) => ({ nombre: p.nombre, valor: p.valor })) }}>
            <MapaCaldas datos={datosMapa} placa={placa} fmt={num} seleccion={f.municipios} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} etiqueta="Estudiantes técnicos por municipio" />
          </Seccion>
          <Seccion titulo="¿Dónde estudian?" nota="Estudiantes por universidad. Toca una porción para filtrar." tono="lavado" tabla={{ archivo: 'estudiantes-por-universidad', columnas: [{ clave: 'nombre', titulo: 'Universidad' }, { clave: 'valor', titulo: 'Estudiantes', tipo: 'numero' }], filas: pUni.map((p) => ({ nombre: p.nombre, valor: p.valor })) }}>
            <Grafico etiqueta="Estudiantes por universidad" alto={420} alClic={alt('universidad')} opcion={opcionUni} />
          </Seccion>
        </div>

        <div className="grid items-start gap-12 2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Seccion titulo="Programas" nota="Estudiantes por programa. Toca uno para filtrar." tabla={{ archivo: 'estudiantes-por-programa', columnas: [{ clave: 'nombre', titulo: 'Programa' }, { clave: 'valor', titulo: 'Estudiantes', tipo: 'numero' }], filas: pProg.map((p) => ({ nombre: p.nombre, valor: p.valor })) }}>
            <RankingBarras items={pProg} fmtValor={num} tituloValor="Estudiantes" colorBase={placa.main} seleccion={sel.programa} onClic={alt('programa')} limite={17} />
          </Seccion>
          <Seccion titulo="Género" tabla={{ archivo: 'estudiantes-por-genero', columnas: [{ clave: 'nombre', titulo: 'Género' }, { clave: 'valor', titulo: 'Estudiantes', tipo: 'numero' }], filas: pGenero.map((p) => ({ nombre: p.nombre, valor: p.valor })) }}>
            <div className="grid items-center gap-4 sm:grid-cols-2 2xl:grid-cols-1">
              <Grafico etiqueta="Estudiantes por género" alto={260} opcion={opcionGenero} />
              <Posiciones items={pGenero.map((g, i) => ({ nombre: g.nombre, valor: g.valor, color: coloresGenero[i % coloresGenero.length] }))} fmt={num} />
            </div>
          </Seccion>
        </div>

        <Seccion titulo="Cohorte contra cohorte" nota="Cómo va cada año de ingreso y cuántos se gradúan cada año." tono="lavado">
          <div className="grid items-start gap-10 xl:grid-cols-2">
            <div>
              <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                Estado de cada cohorte
              </h3>
              <Grafico etiqueta="Estudiantes por cohorte y estado" alto={340} alClic={(c) => f.setAnios(alternar(f.anios, Number(c)))} opcion={opcionCohortes} />
            </div>
            <div>
              <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                Graduados por año de grado
              </h3>
              <Grafico etiqueta="Graduados por año de grado" alto={340} opcion={opcionGrad} />
            </div>
          </div>
        </Seccion>
      </ConFiltros>
    </>
  )
}
