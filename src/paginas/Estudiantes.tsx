import { useMemo, useState } from 'react'
import { Fila, MultiSelect } from '../components/controles'
import { Grafico } from '../components/Grafico'
import { Cafetal, Cifra, Contenido, MapaCaldas, Marca, PlacaCabecera, Posiciones, Seccion, Vertices } from '../components/Lamina'
import { agrupar, alfa, unicos } from '../lib/agregar'
import { PLACAS, colorEstadoEstudiante } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { num, pct } from '../lib/formato'
import { aclarar, sunburst, type Nodo } from '../lib/graficos'
import type { Estudiante } from '../lib/tipos'
import { useAngosto } from '../lib/angosto'
import { pasa, useTablero } from '../lib/usarFiltrado'

type Local = 'cohorte' | 'universidad' | 'programa' | 'estado' | 'institucion'
type Dim = Local | 'municipio'
const placa = PLACAS.estudiantes
const ORDEN_ESTADO = ['Graduado', 'Activo', 'Pendiente de grado', 'Desertor']
const ordenEstado = (e: string) => (ORDEN_ESTADO.indexOf(e) < 0 ? 99 : ORDEN_ESTADO.indexOf(e))
const VACIO: Record<Local, string[]> = { cohorte: [], universidad: [], programa: [], estado: [], institucion: [] }

export function Estudiantes() {
  const { datos, f } = useTablero()
  const angosto = useAngosto()
  const [sel, setSel] = useState<Record<Local, string[]>>(VACIO)

  // Solo los financiados por la Gobernación. Sin nombres: el tablero es público.
  const filas = useMemo(() => datos.estudiantes.filter((e) => /gobernaci/i.test(e.financiador)), [datos])

  const vistas = useMemo(() => {
    const valorDe: Record<Local, (e: Estudiante) => string> = { cohorte: (e) => String(e.anioIngreso), universidad: (e) => e.universidad, programa: (e) => e.programa, estado: (e) => e.estado, institucion: (e) => e.institucion }
    const ok = (e: Estudiante, omitir?: Dim) => (omitir === 'municipio' || pasa(f, null, e.municipio)) && (Object.keys(valorDe) as Local[]).every((d) => d === omitir || !sel[d].length || sel[d].includes(valorDe[d](e)))
    const de = (omitir?: Dim) => filas.filter((e) => ok(e, omitir))
    return { todas: de(), cohorte: de('cohorte'), universidad: de('universidad'), municipio: de('municipio') }
  }, [filas, f, sel])

  const opciones = useMemo(() => {
    const u = (c: (e: Estudiante) => string) => [...unicos(filas, c)]
    return { cohorte: u((e) => String(e.anioIngreso)), universidad: u((e) => e.universidad), programa: u((e) => e.programa), estado: u((e) => e.estado), institucion: u((e) => e.institucion), municipio: u((e) => e.municipio) }
  }, [filas])

  const alt = (d: Local) => (n: string) => setSel((s) => ({ ...s, [d]: alternar(s[d], n) }))
  const set = (d: Local) => (l: string[]) => setSel((s) => ({ ...s, [d]: l }))
  const hayLocales = Object.values(sel).some((l) => l.length) || f.municipios.length > 0

  const t = vistas.todas
  const cuenta = (re: RegExp) => t.filter((e) => re.test(e.estado)).length
  const graduados = t.filter((e) => /^graduado$/i.test(e.estado)).length
  const desertores = cuenta(/desert/i)

  const estados = useMemo(() => [...new Set(filas.map((e) => e.estado))].sort((a, b) => ordenEstado(a) - ordenEstado(b)), [filas])
  const cohortes = useMemo(() => [...new Set(filas.map((e) => String(e.anioIngreso)))].sort(), [filas])
  const conteoCohortes = useMemo(
    () =>
      cohortes.map((c) => ({
        cohorte: c,
        conteos: Object.fromEntries(estados.map((e) => [e, vistas.cohorte.filter((x) => String(x.anioIngreso) === c && x.estado === e).length])),
      })),
    [cohortes, estados, vistas.cohorte],
  )
  const pEstado = agrupar(t, (e) => e.estado, () => 1).sort((a, b) => ordenEstado(a.nombre) - ordenEstado(b.nombre))

  const datosMapa = useMemo(() => agrupar(vistas.municipio, (e) => e.municipio, () => 1).map((p) => ({ name: p.nombre, value: p.valor })), [vistas.municipio])

  const arbol = useMemo<Nodo[]>(() => {
    const m = new Map<string, Map<string, number>>()
    vistas.universidad.forEach((e) => {
      const pm = m.get(e.universidad) ?? new Map<string, number>()
      pm.set(e.programa, (pm.get(e.programa) ?? 0) + 1)
      m.set(e.universidad, pm)
    })
    return [...m.entries()]
      .sort((a, b) => [...b[1].values()].reduce((s, n) => s + n, 0) - [...a[1].values()].reduce((s, n) => s + n, 0))
      .map(([u, pm], i) => {
        const color = placa.apoyo[i % placa.apoyo.length]
        return { name: u, color, children: [...pm.entries()].sort((a, b) => b[1] - a[1]).map(([p, n], j) => ({ name: p, value: n, color: aclarar(color, Math.min(0.55, 0.1 + j * 0.08)) })) }
      })
  }, [vistas.universidad])
  const opcionSol = useMemo(() => sunburst({ arbol, fmt: (n) => `${num(n)} estudiantes`, centro: num(vistas.universidad.length), sub: 'estudiantes', compacto: angosto }), [arbol, vistas.universidad.length, angosto])

  const genero = agrupar(t, (e) => e.genero || 'Sin dato', () => 1)
  const aniosGrad = [...new Set(t.map((e) => e.anioGraduacion).filter((a): a is number => a !== null))].sort()

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Cada punto, un estudiante" texto="Estudiantes técnicos y tecnólogos de Universidad en el Campo cuya formación financia la Gobernación de Caldas. No se muestran nombres." />

      <Contenido>
        <Fila>
          <MultiSelect etiqueta="Cohorte" opciones={opciones.cohorte} valor={sel.cohorte} onChange={set('cohorte')} ancho="w-48" />
          <MultiSelect etiqueta="Universidad" opciones={opciones.universidad} valor={sel.universidad} onChange={set('universidad')} />
          <MultiSelect etiqueta="Programa" opciones={opciones.programa} valor={sel.programa} onChange={set('programa')} ancho="w-96" />
          <MultiSelect etiqueta="Estado" opciones={opciones.estado} valor={sel.estado} onChange={set('estado')} />
          <MultiSelect etiqueta="Institución" opciones={opciones.institucion} valor={sel.institucion} onChange={set('institucion')} ancho="w-80" />
          <MultiSelect etiqueta="Municipio" opciones={opciones.municipio.sort(alfa)} valor={f.municipios} onChange={f.setMunicipios} />
          {hayLocales && (
            <button type="button" onClick={() => { setSel(VACIO); f.setMunicipios([]) }} className="rounded-full px-3 py-2 text-sm font-bold text-accentink underline decoration-2 underline-offset-4 hover:bg-wash">
              Quitar estos filtros
            </button>
          )}
        </Fila>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-14">
          <div>
            <Cafetal cohortes={conteoCohortes} estados={estados} colorDe={colorEstadoEstudiante} seleccionEstado={sel.estado} seleccionCohorte={sel.cohorte} alClicEstado={alt('estado')} alClicCohorte={alt('cohorte')} />
            <p className="mt-5 max-w-xl text-sm text-ink2">Cada punto es un estudiante, agrupado por el año en que ingresó y pintado por su estado hoy. Toca un color o un año para filtrar.</p>
          </div>
          <div className="space-y-7">
            <Cifra tam="xl" valor={num(t.length)} etiqueta="estudiantes financiados por la Gobernación" />
            <p className="text-xl leading-relaxed text-ink2">
              <Marca color="#BFEBCF">{t.length ? pct(graduados / t.length) : '—'}</Marca> ya se graduó y <Marca color="#FFC9CB">{t.length ? pct(desertores / t.length) : '—'}</Marca> desertó.
            </p>
            <Posiciones items={pEstado.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorEstadoEstudiante(p.nombre) }))} fmt={num} onClic={alt('estado')} seleccion={sel.estado} />
          </div>
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Seccion titulo="¿De dónde son?" nota="Estudiantes por municipio. Toca uno para filtrar." tabla={{ archivo: 'estudiantes-por-municipio', columnas: [{ clave: 'nombre', titulo: 'Municipio' }, { clave: 'valor', titulo: 'Estudiantes', tipo: 'numero' }], filas: datosMapa.map((d) => ({ nombre: d.name, valor: d.value })) }}>
            <MapaCaldas datos={datosMapa} placa={placa} fmt={num} seleccion={f.municipios} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} etiqueta="Estudiantes técnicos por municipio" />
          </Seccion>

          <Seccion titulo="¿Dónde estudian?" nota="Universidad y programa. Pasa el cursor para ver cuántos." tono="lavado" tabla={{ archivo: 'estudiantes-universidad-programa', columnas: [{ clave: 'u', titulo: 'Universidad' }, { clave: 'p', titulo: 'Programa' }, { clave: 'n', titulo: 'Estudiantes', tipo: 'numero' }], filas: arbol.flatMap((u) => (u.children ?? []).map((p) => ({ u: u.name, p: p.name, n: p.value ?? 0 }))) }}>
            <Grafico etiqueta="Estudiantes por universidad y programa" alto={angosto ? 380 : 560} opcion={opcionSol} />
          </Seccion>
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Seccion titulo="Género">
            <div role="img" aria-label={genero.map((g) => `${g.nombre} ${num(g.valor)}`).join(', ')} className="flex h-6 overflow-hidden rounded-full ring-2 ring-white">
              {genero.map((g, i) => (
                <div key={g.nombre} style={{ width: `${(g.valor / Math.max(1, t.length)) * 100}%`, background: placa.apoyo[i % placa.apoyo.length] }} />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {genero.map((g, i) => (
                <span key={g.nombre} className="flex items-center gap-2.5">
                  <span className="size-3.5 rounded-full" style={{ background: placa.apoyo[i % placa.apoyo.length] }} />
                  <span className="font-bold" style={{ color: 'var(--ink)' }}>
                    {g.nombre}
                  </span>
                  <span className="cota">
                    {num(g.valor)} · {pct(g.valor / Math.max(1, t.length))}
                  </span>
                </span>
              ))}
            </div>
          </Seccion>

          <Seccion titulo="Graduados por año de grado" nota="Cuántos estudiantes recibieron su título cada año.">
            <Vertices items={aniosGrad.map((a) => ({ clave: String(a), etiqueta: `Grado ${a}`, valor: num(t.filter((e) => e.anioGraduacion === a).length), detalle: 'graduados' }))} seleccion={[]} onToggle={() => undefined} />
          </Seccion>
        </div>
      </Contenido>
    </>
  )
}
