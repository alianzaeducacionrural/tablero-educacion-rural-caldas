import { useMemo, useState } from 'react'
import { BarraFiltros } from '../components/BarraFiltros'
import { Grafico } from '../components/Grafico'
import { Icono } from '../components/Icono'
import { Cifra, Contenido, MapaCaldas, Marca, PlacaCabecera, Seccion, Vertices } from '../components/Lamina'
import { agrupar, alfa, sumar, unicos } from '../lib/agregar'
import { PLACAS } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { num } from '../lib/formato'
import { aclarar, treemap, type Nodo } from '../lib/graficos'
import { descripcionFiltros, pasa, useTablero } from '../lib/usarFiltrado'

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

  const filas = useMemo(() => datos.beneficiados.filter((b) => pasa(f, b.anio, b.municipio)), [datos, f])
  const filasTodosAnios = useMemo(() => datos.beneficiados.filter((b) => pasa({ anios: [], municipios: f.municipios }, b.anio, b.municipio)), [datos, f.municipios])
  const filasTodosMuni = useMemo(() => datos.beneficiados.filter((b) => pasa({ anios: f.anios, municipios: [] }, b.anio, b.municipio)), [datos, f.anios])

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
  const datosMapa = useMemo(() => agrupar(filasTodosMuni, (b) => b.municipio, (b) => b.beneficiados).map((p) => ({ name: p.nombre, value: p.valor })), [filasTodosMuni])
  const anios = [...new Set(filasTodosAnios.map((b) => b.anio))].sort()
  const porAnio = anios.map((a) => sumar(filasTodosAnios.filter((b) => b.anio === a), (b) => b.beneficiados))

  // Treemap: municipio → institución → sede
  const arbol = useMemo<Nodo[]>(
    () =>
      arbolTabla
        .slice()
        .sort((a, b) => b.total - a.total)
        .map((m, _i, todos) => {
          const color = placa.escala[Math.min(6, Math.floor(Math.sqrt(m.total / (todos[0].total || 1)) * 7))]
          return {
            name: m.nombre,
            color,
            children: m.hijos.slice().sort((a, b) => b.total - a.total).map((ins, j) => ({
              name: ins.nombre,
              color: aclarar(color, Math.min(0.5, 0.08 + j * 0.05)),
              children: ins.hijos.map((s, k) => ({ name: s.nombre, value: s.total, color: aclarar(color, Math.min(0.7, 0.28 + k * 0.05)) })),
            })),
          }
        }),
    [arbolTabla],
  )
  const opcionArbol = useMemo(() => treemap({ arbol, fmt: num }), [arbol])

  return (
    <>
      <PlacaCabecera placa={placa} titulo="Hasta dónde llega" texto="Estudiantes beneficiados por Modelos Flexibles, municipio por municipio, hasta cada sede. Es la suma de los años elegidos: quien se atendió en varios años puede contarse más de una vez." />

      <Contenido>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          <MapaCaldas datos={datosMapa} placa={placa} fmt={num} seleccion={f.municipios} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} etiqueta="Estudiantes beneficiados por municipio" />
          <div className="space-y-7">
            <Cifra tam="xl" valor={num(total)} etiqueta="estudiantes beneficiados" />
            <p className="text-xl leading-relaxed text-ink2">
              En <Marca>{num(unicos(filas, (b) => b.municipio).size)} municipios</Marca>, <Marca>{num(unicos(filas, (b) => `${b.municipio}|${b.institucion}`).size)} instituciones</Marca> y <Marca>{num(unicos(filas, (b) => `${b.municipio}|${b.institucion}|${b.sede}`).size)} sedes</Marca>.
            </p>
            <div>
              <p className="mb-3 text-sm font-semibold text-ink2">Por año. Toca uno para filtrar.</p>
              <Vertices items={anios.map((a, i) => ({ clave: String(a), etiqueta: String(a), valor: num(porAnio[i]) }))} seleccion={f.anios.map(String)} onToggle={(c) => f.setAnios(alternar(f.anios, Number(c)))} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink2">Mostrando: {descripcionFiltros(f)}</p>
              <BarraFiltros />
            </div>
          </div>
        </div>

        <Seccion titulo="Municipio, institución y sede" nota="El tamaño de cada cuadro son sus estudiantes. Toca un municipio para entrar a sus instituciones, y una institución para ver sus sedes." tono="lavado">
          <Grafico etiqueta="Estudiantes beneficiados por municipio, institución y sede" alto={560} opcion={opcionArbol} />
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
      </Contenido>
    </>
  )
}
