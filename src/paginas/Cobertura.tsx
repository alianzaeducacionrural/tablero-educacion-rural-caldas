import { useMemo, useState } from 'react'
import { ConFiltros, PanelFiltros, etiquetasDe, type GrupoFiltro } from '../components/Filtros'
import { Grafico } from '../components/Grafico'
import { Icono } from '../components/Icono'
import { BotonExcel, Cifra, MapaCaldas, Marca, PlacaCabecera, Seccion, TablaAnios } from '../components/Lamina'
import { RankingBarras } from '../components/Ranking'
import { alfa, sumar, unicos } from '../lib/agregar'
import { PLACAS } from '../lib/colores'
import { alternar, fraseAnios, fraseFiltros, fraseValores } from '../lib/filtros'
import { num } from '../lib/formato'
import { columnas } from '../lib/graficos'
import { pasa, useTablero } from '../lib/usarFiltrado'

const placa = PLACAS.cobertura

interface Fila {
  clave: string
  nombre: string
  nivel: 0 | 1 | 2
  total: number
  hijos: Fila[]
}

export function Cobertura() {
  const { datos, f } = useTablero()
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [institucionSel, setInstitucionSel] = useState<string[]>([])
  const conInst = (v: string) => institucionSel.length === 0 || institucionSel.includes(v)

  const filas = useMemo(() => datos.beneficiados.filter((b) => pasa(f, b.anio, b.municipio) && conInst(b.institucion)), [datos, f, institucionSel])
  const filasTodosAnios = useMemo(() => datos.beneficiados.filter((b) => pasa({ anios: [], municipios: f.municipios }, b.anio, b.municipio) && conInst(b.institucion)), [datos, f.municipios, institucionSel])
  const filasTodosMuni = useMemo(() => datos.beneficiados.filter((b) => pasa({ anios: f.anios, municipios: [] }, b.anio, b.municipio) && conInst(b.institucion)), [datos, f.anios, institucionSel])

  const arbolTabla = useMemo(() => {
    const munis = new Map<string, Map<string, Map<string, number>>>()
    filas.forEach((b) => {
      const im = munis.get(b.municipio) ?? new Map<string, Map<string, number>>()
      const sm = im.get(b.institucion) ?? new Map<string, number>()
      sm.set(b.sede, (sm.get(b.sede) ?? 0) + b.beneficiados)
      im.set(b.institucion, sm)
      munis.set(b.municipio, im)
    })
    const out: Fila[] = []
    ;[...munis.entries()].sort((a, b) => alfa(a[0], b[0])).forEach(([m, im]) => {
      const insts: Fila[] = [...im.entries()].sort((a, b) => alfa(a[0], b[0])).map(([i, sm]) => {
        const sedes: Fila[] = [...sm.entries()].sort((a, b) => alfa(a[0], b[0])).map(([s, n]) => ({ clave: `${m}|${i}|${s}`, nombre: s, nivel: 2, total: n, hijos: [] }))
        return { clave: `${m}|${i}`, nombre: i, nivel: 1, total: sumar(sedes, (x) => x.total), hijos: sedes }
      })
      out.push({ clave: m, nombre: m, nivel: 0, total: sumar(insts, (x) => x.total), hijos: insts })
    })
    return out
  }, [filas])

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    const coincide = (n: Fila): boolean => n.nombre.toLowerCase().includes(t) || n.hijos.some(coincide)
    const res: Fila[] = []
    // Con búsqueda se despliega solo lo que coincide; si coincide el padre, se muestran todos sus hijos.
    const recorrer = (n: Fila, padreCoincide: boolean) => {
      const yo = !!t && n.nombre.toLowerCase().includes(t)
      if (t && !padreCoincide && !coincide(n)) return
      res.push(n)
      if (abiertos.has(n.clave) || t) n.hijos.forEach((h) => recorrer(h, padreCoincide || yo))
    }
    arbolTabla.forEach((n) => recorrer(n, false))
    return res
  }, [arbolTabla, abiertos, q])

  const alternarFila = (clave: string) => setAbiertos((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n })
  const todoAbierto = () => setAbiertos(new Set(arbolTabla.flatMap((m) => [m.clave, ...m.hijos.map((i) => i.clave)])))

  const total = sumar(filas, (b) => b.beneficiados)

  // Rankings: beneficiados (barra y cifra completa) y número de sedes a la vista
  const ranking = (base: typeof filas, clave: (b: (typeof filas)[number]) => string) => {
    const m = new Map<string, { valor: number; sedes: Set<string> }>()
    base.forEach((b) => {
      const e = m.get(clave(b)) ?? { valor: 0, sedes: new Set<string>() }
      e.valor += b.beneficiados
      e.sedes.add(`${b.municipio}|${b.institucion}|${b.sede}`)
      m.set(clave(b), e)
    })
    return [...m.entries()].map(([nombre, e]) => ({ nombre, valor: e.valor, cantidad: e.sedes.size })).sort((a, b) => b.valor - a.valor || alfa(a.nombre, b.nombre))
  }
  const porMuni = useMemo(() => ranking(filasTodosMuni, (b) => b.municipio), [filasTodosMuni]) // eslint-disable-line react-hooks/exhaustive-deps
  const repetidos = useMemo(() => {
    const m = new Map<string, Set<string>>()
    filas.forEach((b) => m.set(b.institucion, (m.get(b.institucion) ?? new Set()).add(b.municipio)))
    return new Set([...m].filter(([, s]) => s.size > 1).map(([n]) => n))
  }, [filas])
  const porInst = useMemo(() => ranking(filas, (b) => (repetidos.has(b.institucion) ? `${b.institucion} (${b.municipio})` : b.institucion)), [filas, repetidos]) // eslint-disable-line react-hooks/exhaustive-deps
  const datosMapa = useMemo(() => porMuni.map((p) => ({ name: p.nombre, value: p.valor })), [porMuni])
  const extraMapa = useMemo(() => Object.fromEntries(porMuni.map((p) => [p.nombre, `Sedes: ${num(p.cantidad)}`])), [porMuni])

  const anios = useMemo(() => [...new Set(datos.beneficiados.map((b) => b.anio))].filter(Boolean).sort(), [datos])
  const porAnio = anios.map((a) => sumar(filasTodosAnios.filter((b) => b.anio === a), (b) => b.beneficiados))
  const opcionAnios = useMemo(() => columnas({ categorias: anios.map(String), series: [{ nombre: 'Beneficiados', color: placa.main, datos: porAnio }], fmt: num, seleccion: f.anios.map(String) }), [anios, porAnio, f.anios]) // eslint-disable-line react-hooks/exhaustive-deps

  const municipiosDisp = useMemo(() => [...new Set(datos.beneficiados.map((b) => b.municipio))].sort(alfa), [datos])
  const institucionesDisp = useMemo(() => [...new Set(datos.beneficiados.map((b) => b.institucion))].sort(alfa), [datos])
  const grupos: GrupoFiltro[] = [
    { clave: 'municipio', titulo: 'Municipio', opciones: municipiosDisp, valor: f.municipios, onChange: f.setMunicipios, abierto: true },
    { clave: 'institucion', titulo: 'Institución Educativa', opciones: institucionesDisp, valor: institucionSel, onChange: setInstitucionSel },
  ]
  const anioFiltro = { anios, valor: f.anios, onChange: f.setAnios }
  const etiquetas = etiquetasDe(anioFiltro, grupos)
  const tablaPares = (col: string, ps: { nombre: string; valor: number; cantidad: number }[], archivo: string) => ({ archivo, columnas: [{ clave: 'nombre', titulo: col }, { clave: 'valor', titulo: 'Beneficiados', tipo: 'numero' as const }, { clave: 'cantidad', titulo: 'Sedes', tipo: 'numero' as const }], filas: ps })
  const limpiar = () => {
    f.limpiar()
    setInstitucionSel([])
  }
  const contextoFiltros = fraseFiltros(fraseAnios(f.anios, anios), fraseValores(f.municipios, 'municipios'), fraseValores(institucionSel, 'instituciones'))

  const tablaAnioT = { archivo: 'beneficiados-por-anio', columnas: [{ clave: 'anio', titulo: 'Año' }, { clave: 'n', titulo: 'Beneficiados', tipo: 'numero' as const }], filas: anios.map((a, i) => ({ anio: String(a), n: porAnio[i] })) }
  const tablaMunicipioT = tablaPares('Municipio', porMuni, 'beneficiados-por-municipio')
  const tablaInstitucionT = tablaPares('Institución', porInst, 'beneficiados-por-institucion')
  const tablaCompletaT = {
    archivo: 'beneficiados-lista-completa',
    columnas: [{ clave: 'municipio', titulo: 'Municipio' }, { clave: 'institucion', titulo: 'Institución' }, { clave: 'sede', titulo: 'Sede' }, { clave: 'beneficiados', titulo: 'Beneficiados', tipo: 'numero' as const }],
    filas: arbolTabla.flatMap((m) => m.hijos.flatMap((i) => i.hijos.map((s) => ({ municipio: m.nombre, institucion: i.nombre, sede: s.nombre, beneficiados: s.total })))),
  }
  const hojasExcel = [
    { nombre: 'Año', tabla: tablaAnioT },
    { nombre: 'Municipio', tabla: tablaMunicipioT },
    { nombre: 'Institución', tabla: tablaInstitucionT },
    { nombre: 'Lista completa', tabla: tablaCompletaT },
  ]

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Hasta dónde llega" texto="Estudiantes beneficiados por Modelos Educativos Flexibles, municipio por municipio, hasta cada sede. Es la suma de los años elegidos: quien se atendió en varios años puede contarse más de una vez.">
        <BotonExcel archivo="cobertura-educacion-rural-caldas" hojas={hojasExcel} />
      </PlacaCabecera>

      <ConFiltros panel={<PanelFiltros anios={anioFiltro} grupos={grupos} etiquetas={etiquetas} onLimpiar={limpiar} />} etiquetas={etiquetas} onLimpiar={limpiar}>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <MapaCaldas datos={datosMapa} extra={extraMapa} placa={placa} fmt={num} seleccion={f.municipios} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} etiqueta="Estudiantes beneficiados por municipio" />
          <div className="space-y-6 rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
            <Cifra tam="lg" valor={num(total)} etiqueta="estudiantes beneficiados" />
            <p className="text-lg leading-relaxed text-ink2">
              En <Marca>{num(unicos(filas, (b) => b.municipio).size)} municipios</Marca>, <Marca>{num(unicos(filas, (b) => `${b.municipio}|${b.institucion}`).size)} instituciones</Marca> y <Marca>{num(unicos(filas, (b) => `${b.municipio}|${b.institucion}|${b.sede}`).size)} sedes</Marca>.
              {contextoFiltros && <> Datos de <Marca>{contextoFiltros}</Marca>.</>}
            </p>
          </div>
        </div>

        <Seccion titulo="Año por año" nota="Beneficiados de cada año y su cambio frente al anterior. Toca un año para filtrar." tono="lavado" tabla={tablaAnioT}>
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <Grafico etiqueta="Estudiantes beneficiados por año" alto={320} alClic={(n) => f.setAnios(alternar(f.anios, Number(n)))} opcion={opcionAnios} />
            <TablaAnios filas={anios.map((a, i) => ({ anio: a, valores: [porAnio[i]] }))} series={[{ nombre: 'Beneficiados', color: placa.main }]} fmt={num} nota="El año más reciente puede estar incompleto si su vigencia sigue en curso." />
          </div>
        </Seccion>

        <Seccion titulo="Municipios" nota="Beneficiados y sedes atendidas. Toca uno para filtrar." tabla={tablaMunicipioT}>
          <div className="max-h-[480px] overflow-y-auto rounded-3xl bg-white p-5 ring-1 ring-line">
            <RankingBarras items={porMuni} fmtValor={num} fmtCantidad={(n) => `${num(n)} sedes`} tituloValor="Beneficiados" tituloCantidad="Sedes" colorBase={placa.main} seleccion={f.municipios} onClic={(n) => f.setMunicipios(alternar(f.municipios, n))} limite={porMuni.length} />
          </div>
        </Seccion>

        <Seccion titulo="Instituciones" nota="Beneficiados y sedes de cada institución." tono="lavado" tabla={tablaInstitucionT}>
          <div className="max-h-[480px] overflow-y-auto rounded-3xl bg-white p-5 ring-1 ring-line">
            <RankingBarras items={porInst} fmtValor={num} fmtCantidad={(n) => `${num(n)} sedes`} tituloValor="Beneficiados" tituloCantidad="Sedes" colorBase={placa.main} limite={porInst.length} />
          </div>
        </Seccion>

        <Seccion
          titulo="La lista completa"
          nota="Despliega cada municipio para ver sus instituciones y sedes."
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Icono n="buscar" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar municipio, institución o sede" className="w-44 rounded-full bg-white py-2 pl-9 pr-3 text-sm outline-none ring-1 ring-line focus:ring-main" />
              </div>
              <button type="button" onClick={todoAbierto} className="rounded-full px-3 py-2 text-sm font-bold text-accentink hover:bg-wash">
                Desplegar todo
              </button>
              <button type="button" onClick={() => setAbiertos(new Set())} className="rounded-full px-3 py-2 text-sm font-bold text-accentink hover:bg-wash">
                Contraer
              </button>
            </div>
          }
        >
          <div className="max-h-[560px] overflow-auto rounded-2xl bg-white ring-1 ring-line">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th scope="col" className="border-b-2 border-main px-4 py-2.5 text-left font-bold">Lugar</th>
                  <th scope="col" className="border-b-2 border-main px-4 py-2.5 text-right font-bold">Beneficiados</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((n) => (
                  <tr key={n.clave} className="border-b border-line last:border-0 hover:bg-wash/60">
                    <td className="px-4 py-2" style={{ paddingLeft: 16 + n.nivel * 24 }}>
                      {n.hijos.length ? (
                        <button type="button" aria-expanded={abiertos.has(n.clave) || !!q} onClick={() => alternarFila(n.clave)} className={`flex items-center gap-2 text-left ${n.nivel === 0 ? 'font-extrabold' : 'font-bold'}`}>
                          <Icono n={abiertos.has(n.clave) || q ? 'chevron' : 'derecha'} size={14} className="text-muted" />
                          {n.nombre}
                        </button>
                      ) : (
                        <span className="pl-[22px] text-ink2">{n.nombre}</span>
                      )}
                    </td>
                    <td className="cota px-4 py-2 text-right">{num(n.total)}</td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-muted">
                      Sin datos con los filtros actuales
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Seccion>
      </ConFiltros>
    </>
  )
}
