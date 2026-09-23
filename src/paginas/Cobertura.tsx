import { useMemo, useState } from 'react'
import { Grafico } from '../components/Grafico'
import { Kpi, Kpis, Tarjeta } from '../components/Tarjetas'
import type { TablaDatos } from '../components/Tabla'
import { agrupar, alfa, sumar, top, unicos, type Par } from '../lib/agregar'
import { colorPrograma } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { num } from '../lib/formato'
import { altoBarras, barrasH, columnas } from '../lib/graficos'
import { useTema } from '../lib/tema'
import { descripcionFiltros, pasa, useTablero } from '../lib/usarFiltrado'

const TOP = 12

interface Nodo {
  clave: string
  nombre: string
  nivel: 0 | 1 | 2
  total: number
  hijos: Nodo[]
}

export function Cobertura() {
  const { datos, f } = useTablero()
  const { tema } = useTema()
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  const filas = useMemo(() => datos.beneficiados.filter((b) => pasa(f, b.anio, b.municipio)), [datos, f])
  const filasTodosAnios = useMemo(() => datos.beneficiados.filter((b) => pasa({ anios: [], municipios: f.municipios }, b.anio, b.municipio)), [datos, f.municipios])
  const filasTodosMuni = useMemo(() => datos.beneficiados.filter((b) => pasa({ anios: f.anios, municipios: [] }, b.anio, b.municipio)), [datos, f.anios])

  const arbol = useMemo(() => {
    const munis = new Map<string, Map<string, Map<string, number>>>()
    filas.forEach((b) => {
      const im = munis.get(b.municipio) ?? new Map<string, Map<string, number>>()
      const sm = im.get(b.institucion) ?? new Map<string, number>()
      sm.set(b.sede, (sm.get(b.sede) ?? 0) + b.beneficiados)
      im.set(b.institucion, sm)
      munis.set(b.municipio, im)
    })
    const out: Nodo[] = []
    ;[...munis.entries()].sort((a, b) => alfa(a[0], b[0])).forEach(([m, im]) => {
      const insts: Nodo[] = [...im.entries()].sort((a, b) => alfa(a[0], b[0])).map(([i, sm]) => {
        const sedes: Nodo[] = [...sm.entries()].sort((a, b) => alfa(a[0], b[0])).map(([s, n]) => ({ clave: `${m}|${i}|${s}`, nombre: s, nivel: 2, total: n, hijos: [] }))
        return { clave: `${m}|${i}`, nombre: i, nivel: 1, total: sumar(sedes, (x) => x.total), hijos: sedes }
      })
      out.push({ clave: m, nombre: m, nivel: 0, total: sumar(insts, (x) => x.total), hijos: insts })
    })
    return out
  }, [filas])

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    const coincide = (n: Nodo): boolean => n.nombre.toLowerCase().includes(t) || n.hijos.some(coincide)
    const filas: Nodo[] = []
    // Con búsqueda se despliega solo lo que coincide; si coincide el padre, se muestran todos sus hijos.
    const recorrer = (n: Nodo, padreCoincide: boolean) => {
      const yo = !!t && n.nombre.toLowerCase().includes(t)
      if (t && !padreCoincide && !coincide(n)) return
      filas.push(n)
      if (abiertos.has(n.clave) || t) n.hijos.forEach((h) => recorrer(h, padreCoincide || yo))
    }
    arbol.forEach((n) => recorrer(n, false))
    return filas
  }, [arbol, abiertos, q])

  const alt = (clave: string) => setAbiertos((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n })
  const todoAbierto = () => setAbiertos(new Set(arbol.flatMap((m) => [m.clave, ...m.hijos.map((i) => i.clave)])))

  const total = sumar(filas, (b) => b.beneficiados)
  const pMuni: Par[] = agrupar(filasTodosMuni, (b) => b.municipio, (b) => b.beneficiados)
  const repetidos = useMemo(() => {
    const m = new Map<string, Set<string>>()
    filas.forEach((b) => m.set(b.institucion, (m.get(b.institucion) ?? new Set()).add(b.municipio)))
    return new Set([...m].filter(([, s]) => s.size > 1).map(([n]) => n))
  }, [filas])
  const pInst: Par[] = agrupar(filas, (b) => (repetidos.has(b.institucion) ? `${b.institucion} (${b.municipio})` : b.institucion), (b) => b.beneficiados)
  const anios = [...new Set(filasTodosAnios.map((b) => b.anio))].sort()
  const porAnio = anios.map((a) => sumar(filasTodosAnios.filter((b) => b.anio === a), (b) => b.beneficiados))
  const color = colorPrograma(tema, 'mf')

  const tabla = (col: string, p: Par[], archivo: string): TablaDatos => ({
    archivo,
    columnas: [{ clave: 'nombre', titulo: col }, { clave: 'valor', titulo: 'Beneficiados', tipo: 'numero' }],
    filas: p.map((x) => ({ nombre: x.nombre, valor: x.valor })),
  })
  const nota = (todos: number) => (todos > TOP ? `Los ${TOP} mayores de ${num(todos)}. La tabla muestra todos.` : undefined)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Cobertura</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink2">
          Estudiantes beneficiados por Modelos Flexibles. Mostrando: {descripcionFiltros(f)}. Es la suma de los años seleccionados: un estudiante atendido en varios años puede contarse más de una vez.
        </p>
      </div>

      <Kpis>
        <Kpi heroe titulo="Estudiantes beneficiados" valor={num(total)} detalle="Suma de los años seleccionados" />
        <Kpi titulo="Municipios" valor={num(unicos(filas, (b) => b.municipio).size)} />
        <Kpi titulo="Instituciones" valor={num(unicos(filas, (b) => `${b.municipio}|${b.institucion}`).size)} detalle={`${num(unicos(filas, (b) => `${b.municipio}|${b.institucion}|${b.sede}`).size)} sedes`} />
      </Kpis>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Tarjeta
          titulo="Beneficiados por año"
          nota="Toca una columna para filtrar por año."
          tabla={{ archivo: 'beneficiados-por-anio', columnas: [{ clave: 'anio', titulo: 'Año' }, { clave: 'n', titulo: 'Beneficiados', tipo: 'numero' }], filas: anios.map((a, i) => ({ anio: String(a), n: porAnio[i] })) }}
        >
          <Grafico
            etiqueta="Estudiantes beneficiados por año"
            alto={280}
            alClic={(n) => f.setAnios(alternar(f.anios, Number(n)))}
            opcion={columnas({ categorias: anios.map(String), series: [{ nombre: 'Beneficiados', color, datos: porAnio }], tema, fmt: num, seleccion: f.anios.map(String) })}
          />
        </Tarjeta>

        <Tarjeta titulo="Beneficiados por municipio" nota={nota(pMuni.length)} tabla={tabla('Municipio', pMuni, 'beneficiados-por-municipio')}>
          <Grafico
            etiqueta="Estudiantes beneficiados por municipio"
            alto={altoBarras(Math.min(TOP, pMuni.length))}
            alClic={(n) => f.setMunicipios(alternar(f.municipios, n))}
            opcion={barrasH({ items: top(pMuni, TOP), color, tema, fmt: num, seleccion: f.municipios, etiquetas: true })}
          />
        </Tarjeta>

        <Tarjeta titulo="Beneficiados por institución" nota={nota(pInst.length)} tabla={tabla('Institución', pInst, 'beneficiados-por-institucion')} className="lg:col-span-2">
          <Grafico etiqueta="Estudiantes beneficiados por institución" alto={altoBarras(Math.min(TOP, pInst.length))} opcion={barrasH({ items: top(pInst, TOP), color, tema, fmt: num, etiquetas: true, anchoEtiqueta: 260 })} />
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Municipio → institución → sede"
        nota="Despliega cada municipio para ver sus instituciones y sedes."
        acciones={
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar municipio, institución o sede" className="w-40 rounded-lg border border-line bg-page px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
            <button type="button" onClick={todoAbierto} className="rounded-lg px-2 py-1.5 text-sm text-accentink hover:bg-wash">Desplegar todo</button>
            <button type="button" onClick={() => setAbiertos(new Set())} className="rounded-lg px-2 py-1.5 text-sm text-accentink hover:bg-wash">Contraer</button>
          </div>
        }
      >
        <div className="max-h-[520px] overflow-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th scope="col" className="border-b border-line px-3 py-2 text-left font-medium text-ink2">Lugar</th>
                <th scope="col" className="border-b border-line px-3 py-2 text-right font-medium text-ink2">Beneficiados</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((n) => (
                <tr key={n.clave} className="border-b border-line last:border-0 hover:bg-wash">
                  <td className="px-3 py-1.5" style={{ paddingLeft: 12 + n.nivel * 22 }}>
                    {n.hijos.length ? (
                      <button type="button" aria-expanded={abiertos.has(n.clave) || !!q} onClick={() => alt(n.clave)} className={`flex items-center gap-1.5 text-left ${n.nivel === 0 ? 'font-semibold' : 'font-medium'}`}>
                        <span aria-hidden="true" className="inline-block w-3 text-muted">{abiertos.has(n.clave) || q ? '▾' : '▸'}</span>
                        {n.nombre}
                      </button>
                    ) : (
                      <span className="pl-[18px] text-ink2">{n.nombre}</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-1.5 text-right">{num(n.total)}</td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-muted">Sin datos con los filtros actuales</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
