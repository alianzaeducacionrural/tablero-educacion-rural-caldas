import { useMemo, useState } from 'react'
import { ConFiltros, PanelFiltros, etiquetasDe, type GrupoFiltro } from '../components/Filtros'
import { Segmentado } from '../components/controles'
import { Grafico } from '../components/Grafico'
import { BotonExcel, Cifra, MapaCaldas, Marca, PlacaCabecera, Seccion, TablaAniosDual } from '../components/Lamina'
import { RankingBarras } from '../components/Ranking'
import { agrupar, agruparDoble, alfa, sumar, unicos } from '../lib/agregar'
import { PLACAS, colorAportante, colorEstadoActividad, tinte } from '../lib/colores'
import { alternar, fraseAnios, fraseFiltros, fraseValores } from '../lib/filtros'
import { cant, cop, num } from '../lib/formato'
import { altoBarras, apiladasH, columnas, pastel } from '../lib/graficos'
import { PROGRAMAS, type FilaBase, type Programa as Prog } from '../lib/tipos'
import { pasa, useTablero } from '../lib/usarFiltrado'

type Local = 'grupo' | 'estado' | 'aportante' | 'institucion' | 'actividad'
type Dim = Local | 'municipio' | 'anio'
const VACIO: Record<Local, string[]> = { grupo: [], estado: [], aportante: [], institucion: [], actividad: [] }
/** El estado arranca filtrado a "Convenio": lo adicional/reinvertido queda a un clic. */
const INICIAL: Record<Local, string[]> = { ...VACIO, estado: ['Convenio'] }

export function Programa({ programa }: { programa: Prog }) {
  const { datos, f } = useTablero()
  const cfg = PROGRAMAS[programa]
  const placa = PLACAS[programa]
  const [sel, setSel] = useState<Record<Local, string[]>>(INICIAL)

  const filas = useMemo(() => datos.base.filter((x) => x.programa === programa), [datos, programa])

  // "Pío XII" existe en 3 municipios: solo se añade el municipio cuando el nombre se repite.
  const repetidos = useMemo(() => {
    const m = new Map<string, Set<string>>()
    filas.forEach((x) => m.set(x.institucion, (m.get(x.institucion) ?? new Set()).add(x.municipio)))
    return new Set([...m].filter(([, s]) => s.size > 1).map(([n]) => n))
  }, [filas])
  const etiquetaInst = (x: FilaBase) => (repetidos.has(x.institucion) ? `${x.institucion} (${x.municipio})` : x.institucion)
  // "Adicional al convenio" se acorta para que el nombre quepa completo en el ranking.
  const etiquetaEstado = (e: string) => (/^adicional\s+al\s+convenio$/i.test(e) ? 'Adicional' : e)

  // Cada visual se calcula con todos los filtros MENOS el suyo: sus hermanos siguen visibles y el elegido queda resaltado.
  const vistas = useMemo(() => {
    const ok = (x: FilaBase, omitir?: Dim) =>
      (omitir === 'anio' || pasa(f, x.anio, null)) &&
      (omitir === 'municipio' || pasa(f, null, x.municipio)) &&
      (omitir === 'grupo' || !sel.grupo.length || sel.grupo.includes(x.grupo)) &&
      (omitir === 'estado' || !sel.estado.length || sel.estado.includes(etiquetaEstado(x.estado))) &&
      (omitir === 'aportante' || !sel.aportante.length || sel.aportante.includes(x.aportante)) &&
      (omitir === 'institucion' || !sel.institucion.length || sel.institucion.includes(etiquetaInst(x))) &&
      (omitir === 'actividad' || !sel.actividad.length || sel.actividad.includes(x.actividad))
    const de = (omitir?: Dim) => filas.filter((x) => ok(x, omitir))
    return { todas: de(), grupo: de('grupo'), estado: de('estado'), institucion: de('institucion'), actividad: de('actividad'), municipio: de('municipio'), anio: de('anio') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, f, sel, repetidos])

  const t = vistas.todas
  const total = sumar(t, (x) => x.valor)
  // Beneficiados/estudiantes no tienen "estado", "aportante" ni "actividad" (son de personas, no de actividades):
  // no se les puede aplicar esos filtros directamente. Pero si la combinación de filtros no deja ninguna
  // actividad (p. ej. Estado "Adicional al convenio" sin ninguna fila ese año), tampoco tiene sentido mostrar
  // estudiantes/municipios/instituciones: quedan en 0, igual que "Invertidos".
  const sinCoincidencias = t.length === 0
  const conInstitucion = (institucion: string, municipio: string) => sel.institucion.length === 0 || sel.institucion.includes(repetidos.has(institucion) ? `${institucion} (${municipio})` : institucion)
  const estudiantesAtendidos = useMemo(
    () =>
      sinCoincidencias
        ? 0
        : programa === 'mf'
          ? sumar(datos.beneficiados.filter((b) => pasa(f, b.anio, b.municipio) && conInstitucion(b.institucion, b.municipio)), (b) => b.beneficiados)
          : datos.estudiantes.filter((e) => /gobernaci/i.test(e.financiador) && pasa(f, e.anioIngreso, e.municipio) && conInstitucion(e.institucion, e.municipio)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos, f, programa, sel.institucion, repetidos, sinCoincidencias],
  )
  // Mismo alcance que estudiantesAtendidos (año, municipio, institución, y en 0 si el filtro no deja nada):
  // así la frase de abajo nunca contradice la cifra de estudiantes.
  const alcance = useMemo(
    () => (sinCoincidencias ? [] : filas.filter((x) => pasa(f, x.anio, x.municipio) && conInstitucion(x.institucion, x.municipio))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filas, f, sel.institucion, repetidos, sinCoincidencias],
  )

  // Mapa: valor por municipio (con la cantidad en el tooltip)
  const porMuni = useMemo(() => agruparDoble(vistas.municipio, (x) => x.municipio, (x) => x.valor, (x) => x.cantidad), [vistas.municipio])
  const datosMapa = useMemo(() => porMuni.map((p) => ({ name: p.nombre, value: p.valor })), [porMuni])
  const extraMapa = useMemo(() => Object.fromEntries(porMuni.map((p) => [p.nombre, `Cantidad: ${cant(p.cantidad)}`])), [porMuni])

  const dobles = {
    grupo: agruparDoble(vistas.grupo, (x) => x.grupo, (x) => x.valor, (x) => x.cantidad),
    actividad: agruparDoble(vistas.actividad, (x) => x.actividad, (x) => x.valor, (x) => x.cantidad),
    institucion: agruparDoble(vistas.institucion, etiquetaInst, (x) => x.valor, (x) => x.cantidad),
    estado: agruparDoble(vistas.estado, (x) => etiquetaEstado(x.estado), (x) => x.valor, (x) => x.cantidad),
  }
  const aportantes = useMemo(() => [...new Set(filas.map((x) => x.aportante))].sort(alfa), [filas])
  const pAportante = agrupar(t, (x) => x.aportante, (x) => x.valor)
  const opcionAportante = useMemo(() => pastel({ partes: pAportante.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorAportante(p.nombre) })), fmt: cop, seleccion: sel.aportante, mostrarValor: true }), [pAportante, sel.aportante]) // eslint-disable-line react-hooks/exhaustive-deps

  // Comparación entre años: las dos medidas a la vez
  const anios = useMemo(() => [...new Set(filas.map((x) => x.anio))].sort(), [filas])
  const opcionAniosValor = useMemo(
    () => columnas({ categorias: anios.map(String), series: aportantes.map((p) => ({ nombre: p, color: colorAportante(p), datos: anios.map((a) => sumar(vistas.anio.filter((x) => x.anio === a && x.aportante === p), (x) => x.valor)) })), fmt: cop, seleccion: f.anios.map(String) }),
    [anios, aportantes, vistas.anio, f.anios],
  )
  const opcionAniosCantidad = useMemo(
    () => columnas({ categorias: anios.map(String), series: aportantes.map((p) => ({ nombre: p, color: colorAportante(p), datos: anios.map((a) => sumar(vistas.anio.filter((x) => x.anio === a && x.aportante === p), (x) => x.cantidad)) })), fmt: num, seleccion: f.anios.map(String) }),
    [anios, aportantes, vistas.anio, f.anios],
  )
  const filasAnio = anios.map((a) => ({ anio: a, valor: sumar(vistas.anio.filter((x) => x.anio === a), (x) => x.valor), cantidad: sumar(vistas.anio.filter((x) => x.anio === a), (x) => x.cantidad) }))

  // Municipios, divididos por año (mismo criterio que porMuni: ignora el filtro de municipio, y aquí también el de año).
  const coloresAnio = useMemo(() => anios.map((_, i) => tinte(placa.escala, anios.length > 1 ? 0.15 + (i / (anios.length - 1)) * 0.75 : 0.5)), [anios, placa.escala]) // eslint-disable-line react-hooks/exhaustive-deps
  const [vistaMuni, setVistaMuni] = useState<'total' | 'anio'>('total')
  const porMunicipioAnio = useMemo(() => {
    const base = filas.filter((x) => (sel.institucion.length === 0 || sel.institucion.includes(etiquetaInst(x))) && (sel.grupo.length === 0 || sel.grupo.includes(x.grupo)) && (sel.estado.length === 0 || sel.estado.includes(etiquetaEstado(x.estado))) && (sel.aportante.length === 0 || sel.aportante.includes(x.aportante)) && (sel.actividad.length === 0 || sel.actividad.includes(x.actividad)))
    const m = new Map<string, Map<number, number>>()
    base.forEach((x) => {
      const e = m.get(x.municipio) ?? new Map<number, number>()
      e.set(x.anio, (e.get(x.anio) ?? 0) + x.valor)
      m.set(x.municipio, e)
    })
    const total = (porAnio: number[]) => porAnio.reduce((s, v) => s + v, 0)
    return [...m.entries()]
      .map(([nombre, e]) => ({ nombre, partes: anios.map((a, i) => ({ nombre: String(a), valor: e.get(a) ?? 0, color: coloresAnio[i] })) }))
      .sort((a, b) => total(b.partes.map((p) => p.valor)) - total(a.partes.map((p) => p.valor)) || alfa(a.nombre, b.nombre))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, sel, anios, coloresAnio])
  const opcionMunicipiosAnio = useMemo(() => apiladasH({ filas: porMunicipioAnio, fmt: cop, agrupadas: true, mostrarValores: true }), [porMunicipioAnio])

  // Filtros de la barra lateral
  const u = (c: (x: FilaBase) => string) => [...unicos(filas, c)]
  const set = (d: Local) => (l: string[]) => setSel((s) => ({ ...s, [d]: l }))
  const municipiosDisp = useMemo(() => [...new Set(filas.map((x) => x.municipio))].sort(alfa), [filas])
  const grupos: GrupoFiltro[] = [
    { clave: 'municipio', titulo: 'Municipio', opciones: municipiosDisp, valor: f.municipios, onChange: f.setMunicipios },
    { clave: 'grupo', titulo: cfg.grupo, opciones: u((x) => x.grupo), valor: sel.grupo, onChange: set('grupo') },
    { clave: 'estado', titulo: 'Estado', opciones: u((x) => x.estado), valor: sel.estado, onChange: set('estado') },
    { clave: 'aportante', titulo: 'Aportante', opciones: u((x) => x.aportante), valor: sel.aportante, onChange: set('aportante') },
    { clave: 'institucion', titulo: 'Institución Educativa', opciones: u(etiquetaInst), valor: sel.institucion, onChange: set('institucion') },
    { clave: 'actividad', titulo: 'Actividad', opciones: u((x) => x.actividad), valor: sel.actividad, onChange: set('actividad') },
  ]
  const anioFiltro = { anios, valor: f.anios, onChange: f.setAnios }
  const etiquetas = etiquetasDe(anioFiltro, grupos)
  const limpiar = () => {
    f.limpiar()
    setSel(VACIO)
  }
  const alt = (d: Local) => (n: string) => setSel((s) => ({ ...s, [d]: alternar(s[d], n) }))
  const contextoFiltros = fraseFiltros(fraseAnios(f.anios, anios), fraseValores(f.municipios, 'municipios'), fraseValores(sel.institucion, 'instituciones'))

  const tablaDoble = (col: string, ds: { nombre: string; valor: number; cantidad: number }[], archivo: string) => ({ archivo, columnas: [{ clave: 'nombre', titulo: col }, { clave: 'valor', titulo: 'Valor', tipo: 'moneda' as const }, { clave: 'cantidad', titulo: 'Actividades', tipo: 'cantidad' as const }], filas: ds })
  const coloresGrupo = Object.fromEntries(dobles.grupo.map((g, i) => [g.nombre, placa.apoyo[i % placa.apoyo.length]]))

  const tablaGrupoT = tablaDoble(cfg.grupo, dobles.grupo, `${programa}-${cfg.grupo.toLowerCase()}`)
  const tablaActividadT = tablaDoble('Actividad', dobles.actividad, `${programa}-actividades`)
  const tablaMunicipioAnioT = {
    archivo: `${programa}-municipios-por-anio`,
    columnas: [{ clave: 'nombre', titulo: 'Municipio' }, ...anios.map((a) => ({ clave: String(a), titulo: String(a), tipo: 'moneda' as const })), { clave: 'total', titulo: 'Total', tipo: 'moneda' as const }],
    filas: porMunicipioAnio.map((m) => ({ nombre: m.nombre, total: sumar(m.partes, (p) => p.valor), ...Object.fromEntries(m.partes.map((p) => [p.nombre, p.valor])) })),
  }
  const tablaMunicipioT = vistaMuni === 'anio' ? tablaMunicipioAnioT : tablaDoble('Municipio', porMuni, `${programa}-municipios`)
  const tablaInstitucionT = tablaDoble('Institución', dobles.institucion, `${programa}-instituciones`)
  const tablaEstadoT = tablaDoble('Estado', dobles.estado, `${programa}-estados`)
  const tablaAportanteT = tablaDoble('Aportante', pAportante.map((p) => ({ ...p, cantidad: sumar(t.filter((x) => x.aportante === p.nombre), (x) => x.cantidad) })), `${programa}-aportantes`)
  const tablaAnioT = { archivo: `${programa}-por-anio`, columnas: [{ clave: 'anio', titulo: 'Año' }, { clave: 'valor', titulo: 'Valor', tipo: 'moneda' as const }, { clave: 'cantidad', titulo: 'Actividades', tipo: 'cantidad' as const }], filas: filasAnio.map((a) => ({ anio: String(a.anio), valor: a.valor, cantidad: a.cantidad })) }
  const tablaBaseT = {
    archivo: `${programa}-base-de-datos`,
    columnas: [
      { clave: 'anio', titulo: 'Año', tipo: 'numero' as const },
      { clave: 'municipio', titulo: 'Municipio' },
      { clave: 'institucion', titulo: 'Institución' },
      { clave: 'grupo', titulo: cfg.grupo },
      { clave: 'actividad', titulo: 'Actividad' },
      { clave: 'estado', titulo: 'Estado' },
      { clave: 'aportante', titulo: 'Aportante' },
      { clave: 'asistio', titulo: 'Asistió' },
      { clave: 'cantidad', titulo: 'Cantidad', tipo: 'cantidad' as const },
      { clave: 'valor', titulo: 'Valor', tipo: 'moneda' as const },
    ],
    // Agrupada por institución: todas las filas de una misma IE quedan juntas, de corrido.
    filas: [...t]
      .sort((a, b) => alfa(a.municipio, b.municipio) || alfa(etiquetaInst(a), etiquetaInst(b)) || a.anio - b.anio)
      .map((x) => ({ anio: x.anio, municipio: x.municipio, institucion: etiquetaInst(x), grupo: x.grupo, actividad: x.actividad, estado: etiquetaEstado(x.estado), aportante: x.aportante, asistio: x.asistio ? 'Sí' : 'No', cantidad: x.cantidad, valor: x.valor })),
  }
  const hojasExcel = [
    { nombre: 'Base de datos', tabla: tablaBaseT },
    { nombre: cfg.grupo, tabla: tablaGrupoT },
    { nombre: 'Actividad', tabla: tablaActividadT },
    { nombre: 'Municipio', tabla: tablaMunicipioT },
    { nombre: 'Institución', tabla: tablaInstitucionT },
    { nombre: 'Estado', tabla: tablaEstadoT },
    { nombre: 'Aportante', tabla: tablaAportanteT },
    { nombre: 'Año', tabla: tablaAnioT },
  ]

  return (
    <>
      <PlacaCabecera placa={placa} titulo={cfg.nombre} texto={`${placa.frase}. En cada visual verás el valor invertido y la cantidad de actividades, juntos. Toca el mapa o una barra para filtrar.`}>
        <BotonExcel archivo={`${programa}-educacion-rural-caldas`} hojas={hojasExcel} />
      </PlacaCabecera>

      <ConFiltros panel={<PanelFiltros anios={anioFiltro} grupos={grupos} etiquetas={etiquetas} onLimpiar={limpiar} />} etiquetas={etiquetas} onLimpiar={limpiar}>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <MapaCaldas datos={datosMapa} extra={extraMapa} placa={placa} fmt={cop} seleccion={f.municipios} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} etiqueta={`Valor de ${cfg.nombre} por municipio`} />
          <div className="space-y-6 rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-1">
              <Cifra tam="md" valor={cop(total)} etiqueta="Invertidos" />
              <Cifra
                tam="md"
                valor={num(estudiantesAtendidos)}
                etiqueta={programa === 'mf' ? `Estudiantes beneficiados${f.anios.length ? `, ${[...f.anios].sort().join(', ')}` : ''}` : `Estudiantes técnicos financiados${f.anios.length ? `, ingreso ${[...f.anios].sort().join(', ')}` : ''}`}
              />
            </div>
            <p className="text-lg leading-relaxed text-ink2">
              En <Marca>{num(unicos(alcance, (x) => x.municipio).size)} municipios</Marca> y <Marca>{num(unicos(alcance.filter((x) => x.tipo === 'Institución'), (x) => `${x.municipio}|${x.institucion}`).size)} instituciones</Marca>.
              {contextoFiltros && <> Datos de <Marca>{contextoFiltros}</Marca>.</>}
            </p>
          </div>
        </div>

        <Seccion titulo="Municipios" acciones={<Segmentado etiqueta="Dividir por" valor={vistaMuni} onChange={setVistaMuni} opciones={[{ id: 'total', texto: 'Total' }, { id: 'anio', texto: 'Por año' }]} />} tabla={tablaMunicipioT}>
          <div className="max-h-[480px] overflow-y-auto rounded-3xl bg-white p-5 ring-1 ring-line">
            {vistaMuni === 'total' ? (
              <RankingBarras items={porMuni} fmtValor={cop} fmtCantidad={cant} tituloCantidad="Actividades" colorBase={placa.main} seleccion={f.municipios} onClic={(n) => f.setMunicipios(alternar(f.municipios, n))} limite={porMuni.length} />
            ) : (
              <Grafico etiqueta="Valor por municipio, dividido por año" alto={altoBarras(porMunicipioAnio.length, 1.7)} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} opcion={opcionMunicipiosAnio} sinRecuadro />
            )}
          </div>
        </Seccion>

        <Seccion titulo="Instituciones" tono="lavado" tabla={tablaInstitucionT}>
          <div className="max-h-[480px] overflow-y-auto rounded-3xl bg-white p-5 ring-1 ring-line">
            <RankingBarras items={dobles.institucion} fmtValor={cop} fmtCantidad={cant} tituloCantidad="Actividades" colorBase={placa.main} seleccion={sel.institucion} onClic={alt('institucion')} limite={dobles.institucion.length} />
          </div>
        </Seccion>

        <Seccion titulo={`${cfg.grupos} y actividades`} nota="Cada barra es el valor invertido; a la derecha, el valor completo y la cantidad de actividades. Toca una para filtrar." tabla={tablaActividadT}>
          <div className="space-y-10">
            <div>
              <h3 className="display mb-3 text-2xl" style={{ color: 'var(--ink)' }}>
                Por {cfg.grupo.toLowerCase()}
              </h3>
              <RankingBarras items={dobles.grupo.map((g) => ({ ...g, color: coloresGrupo[g.nombre] }))} fmtValor={cop} fmtCantidad={cant} tituloCantidad="Actividades" colorBase={placa.main} seleccion={sel.grupo} onClic={alt('grupo')} />
            </div>
            <div>
              <h3 className="display mb-3 text-2xl" style={{ color: 'var(--ink)' }}>
                Por actividad
              </h3>
              <RankingBarras items={dobles.actividad} fmtValor={cop} fmtCantidad={cant} tituloCantidad="Actividades" colorBase={placa.main} seleccion={sel.actividad} onClic={alt('actividad')} />
            </div>
          </div>
        </Seccion>

        <div className="grid items-start gap-12 2xl:grid-cols-2">
          <Seccion titulo="Estado de la actividad" nota="Lo que está dentro del convenio frente a lo que se hizo además." tabla={tablaEstadoT}>
            <RankingBarras items={dobles.estado.map((e) => ({ ...e, color: colorEstadoActividad(e.nombre, programa) }))} fmtValor={cop} fmtCantidad={cant} tituloCantidad="Actividades" colorBase={placa.main} seleccion={sel.estado} onClic={alt('estado')} />
          </Seccion>
          <Seccion titulo="Quién aportó" nota="Distribución del valor entre aportantes." tabla={tablaAportanteT}>
            <Grafico etiqueta="Distribución del valor por aportante" alto={300} alClic={alt('aportante')} opcion={opcionAportante} />
          </Seccion>
        </div>

        <Seccion titulo="Año por año" nota="Valor y actividades, año contra año, por aportante. Toca un año para filtrar." tono="lavado" tabla={tablaAnioT}>
          <div className="space-y-8">
            <div className="grid items-start gap-8 xl:grid-cols-2">
              <div>
                <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                  Valor
                </h3>
                <Grafico etiqueta="Valor por año y aportante" alto={320} alClic={(n) => f.setAnios(alternar(f.anios, Number(n)))} opcion={opcionAniosValor} />
              </div>
              <div>
                <h3 className="display mb-1 text-2xl" style={{ color: 'var(--ink)' }}>
                  Actividades
                </h3>
                <Grafico etiqueta="Actividades por año y aportante" alto={320} alClic={(n) => f.setAnios(alternar(f.anios, Number(n)))} opcion={opcionAniosCantidad} />
              </div>
            </div>
            <TablaAniosDual filas={filasAnio} fmtValor={cop} fmtCantidad={cant} tituloCantidad="Actividades" nota="El año más reciente puede estar incompleto si su vigencia sigue en curso." />
          </div>
        </Seccion>
      </ConFiltros>
    </>
  )
}
