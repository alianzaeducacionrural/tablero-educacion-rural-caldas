import { useMemo, useState } from 'react'
import { BarraFiltros } from '../components/BarraFiltros'
import { Fila, MultiSelect, Segmentado } from '../components/controles'
import { Grafico } from '../components/Grafico'
import { Cifra, Contenido, MapaCaldas, Marca, PlacaCabecera, Posiciones, Seccion } from '../components/Lamina'
import { agrupar, sumar, top, unicos, type Par } from '../lib/agregar'
import { PLACAS, colorAportante, colorEstadoActividad } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { cant, cop, num, pct } from '../lib/formato'
import { aclarar, burbujas, dona, treemap, type Nodo } from '../lib/graficos'
import { PROGRAMAS, type FilaBase, type Programa as Prog } from '../lib/tipos'
import { pasa, useTablero } from '../lib/usarFiltrado'

type Local = 'grupo' | 'estado' | 'aportante' | 'institucion' | 'actividad'
type Dim = Local | 'municipio' | 'anio'
const VACIO: Record<Local, string[]> = { grupo: [], estado: [], aportante: [], institucion: [], actividad: [] }

export function Programa({ programa }: { programa: Prog }) {
  const { datos, f } = useTablero()
  const cfg = PROGRAMAS[programa]
  const placa = PLACAS[programa]
  const [medida, setMedida] = useState<'valor' | 'cantidad'>('valor')
  const [sel, setSel] = useState<Record<Local, string[]>>(VACIO)

  const filas = useMemo(() => datos.base.filter((x) => x.programa === programa), [datos, programa])

  // "Pío XII" existe en 3 municipios: solo se añade el municipio cuando el nombre se repite.
  const repetidos = useMemo(() => {
    const m = new Map<string, Set<string>>()
    filas.forEach((x) => m.set(x.institucion, (m.get(x.institucion) ?? new Set()).add(x.municipio)))
    return new Set([...m].filter(([, s]) => s.size > 1).map(([n]) => n))
  }, [filas])
  const etiquetaInst = (x: FilaBase) => (repetidos.has(x.institucion) ? `${x.institucion} (${x.municipio})` : x.institucion)

  // Cada visual se calcula con todos los filtros MENOS el suyo: sus hermanos siguen visibles y el elegido queda resaltado.
  const vistas = useMemo(() => {
    const ok = (x: FilaBase, omitir?: Dim) =>
      (omitir === 'anio' || pasa(f, x.anio, null)) &&
      (omitir === 'municipio' || pasa(f, null, x.municipio)) &&
      (omitir === 'grupo' || !sel.grupo.length || sel.grupo.includes(x.grupo)) &&
      (omitir === 'estado' || !sel.estado.length || sel.estado.includes(x.estado)) &&
      (omitir === 'aportante' || !sel.aportante.length || sel.aportante.includes(x.aportante)) &&
      (omitir === 'institucion' || !sel.institucion.length || sel.institucion.includes(etiquetaInst(x))) &&
      (omitir === 'actividad' || !sel.actividad.length || sel.actividad.includes(x.actividad))
    const de = (omitir?: Dim) => filas.filter((x) => ok(x, omitir))
    return { todas: de(), estado: de('estado'), institucion: de('institucion'), municipio: de('municipio'), anio: de('anio') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, f, sel, repetidos])

  const v = (x: FilaBase) => (medida === 'valor' ? x.valor : x.cantidad)
  const fmt = medida === 'valor' ? cop : cant
  const titulo = medida === 'valor' ? 'Valor' : 'Cantidad'

  const opciones = useMemo(() => {
    const u = (c: (x: FilaBase) => string) => [...unicos(filas, c)]
    return { grupo: u((x) => x.grupo), estado: u((x) => x.estado), aportante: u((x) => x.aportante), institucion: u(etiquetaInst), actividad: u((x) => x.actividad) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, repetidos])

  const alt = (d: Local) => (n: string) => setSel((s) => ({ ...s, [d]: alternar(s[d], n) }))
  const set = (d: Local) => (l: string[]) => setSel((s) => ({ ...s, [d]: l }))
  const hayLocales = Object.values(sel).some((l) => l.length)

  const t = vistas.todas
  const total = sumar(t, (x) => x.valor)
  const depto = sumar(t.filter((x) => /depto|departamento|gobernaci/i.test(x.aportante)), (x) => x.valor)
  const noAsistio = t.filter((x) => !x.asistio)
  const extra = sumar(t.filter((x) => !/^convenio$/i.test(x.estado)), (x) => x.valor)

  // Mapa: valor por municipio con todos los filtros salvo el de municipio
  const datosMapa = useMemo(() => agrupar(vistas.municipio, (x) => x.municipio, v).map((p) => ({ name: p.nombre, value: p.valor })), [vistas.municipio, medida]) // eslint-disable-line react-hooks/exhaustive-deps

  // Treemap: proyecto/proceso → actividad
  const arbol = useMemo<Nodo[]>(() => {
    const m = new Map<string, Map<string, number>>()
    t.forEach((x) => {
      const val = v(x)
      if (val <= 0) return
      const am = m.get(x.grupo) ?? new Map<string, number>()
      am.set(x.actividad, (am.get(x.actividad) ?? 0) + val)
      m.set(x.grupo, am)
    })
    return [...m.entries()]
      .map(([g, am]) => ({ g, am, suma: [...am.values()].reduce((s, n) => s + n, 0) }))
      .sort((a, b) => b.suma - a.suma)
      .map(({ g, am }, i) => {
        const color = placa.apoyo[i % placa.apoyo.length]
        return { name: g, color, children: [...am.entries()].sort((a, b) => b[1] - a[1]).map(([a, val], j) => ({ name: a, value: val, color: aclarar(color, Math.min(0.5, j * 0.07)) })) }
      })
  }, [t, medida]) // eslint-disable-line react-hooks/exhaustive-deps
  const opcionArbol = useMemo(() => treemap({ arbol, fmt }), [arbol, fmt])
  const tablaArbol = arbol.flatMap((g) => (g.children ?? []).map((a) => ({ grupo: g.name, actividad: a.name, valor: a.value ?? 0 })))

  // Burbujas de instituciones
  const pInst = agrupar(vistas.institucion, etiquetaInst, v)
  const maxInst = pInst[0]?.valor || 1
  const opcionBurbujas = useMemo(
    () => burbujas({ items: top(pInst, 38).map((p, i, todos) => ({ nombre: p.nombre, valor: p.valor, color: placa.escala[6 - Math.min(4, Math.floor((i / todos.length) * 5))] })), fmt, seleccion: sel.institucion }),
    [pInst, maxInst, fmt, sel.institucion, placa.escala], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const anios = [...new Set(filas.map((x) => x.anio))].sort()
  const aportantes = [...new Set(filas.map((x) => x.aportante))].sort()
  const pEstado: Par[] = agrupar(vistas.estado, (x) => x.estado, v)
  const totalEstado = sumar(pEstado, (p) => p.valor)
  const opcionEstado = useMemo(() => dona({ partes: pEstado.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorEstadoActividad(p.nombre, programa) })), centro: fmt(totalEstado), sub: 'total', fmt, seleccion: sel.estado }), [pEstado, totalEstado, fmt, sel.estado, programa]) // eslint-disable-line react-hooks/exhaustive-deps

  const tablaPares = (col: string, pares: Par[], archivo: string) => ({ archivo, columnas: [{ clave: 'nombre', titulo: col }, { clave: 'valor', titulo, tipo: (medida === 'valor' ? 'moneda' : 'cantidad') as 'moneda' | 'cantidad' }], filas: pares.map((p) => ({ nombre: p.nombre, valor: p.valor })) })

  return (
    <>
      <PlacaCabecera placa={placa} titulo={cfg.nombre} texto={`${placa.frase}. Toca el mapa, un cuadro o una burbuja para filtrar; vuelve a tocarlo para quitarlo.`}>
        <Segmentado sobreCampo etiqueta="Medida" valor={medida} onChange={setMedida} opciones={[{ id: 'valor', texto: 'Valor' }, { id: 'cantidad', texto: 'Cantidad' }]} />
      </PlacaCabecera>

      <Contenido>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          <MapaCaldas datos={datosMapa} placa={placa} fmt={fmt} seleccion={f.municipios} alClic={(n) => f.setMunicipios(alternar(f.municipios, n))} etiqueta={`${titulo} de ${cfg.nombre} por municipio`} />

          <div className="space-y-7">
            <Cifra tam="lg" valor={cop(total)} etiqueta="invertidos con los filtros actuales" />
            <div className="grid grid-cols-2 gap-6">
              <Cifra tam="md" valor={cant(sumar(t, (x) => x.cantidad))} etiqueta={`actividades · ${num(unicos(t, (x) => x.actividad).size)} tipos`} />
              <Cifra tam="md" valor={total ? pct(depto / total, 0) : '—'} etiqueta="lo puso el Departamento" />
            </div>
            <p className="text-lg leading-relaxed text-ink2">
              En <Marca>{num(unicos(t, (x) => x.municipio).size)} municipios</Marca> y <Marca>{num(unicos(t.filter((x) => x.tipo === 'Institución'), (x) => `${x.municipio}|${x.institucion}`).size)} instituciones</Marca>.
              {programa === 'mf' && noAsistio.length > 0 ? (
                <>
                  {' '}
                  Hubo <Marca color="#FFD9A8">{num(sumar(noAsistio, (x) => x.cantidad))} convocatorias sin asistencia</Marca> ({cop(sumar(noAsistio, (x) => x.valor))} invertidos).
                </>
              ) : (
                <>
                  {' '}
                  Lo adicional al convenio y la reinversión suman <Marca>{cop(extra)}</Marca>.
                </>
              )}
            </p>
            <div className="space-y-3">
              <BarraFiltros />
              <Fila>
                <MultiSelect etiqueta={cfg.grupo} opciones={opciones.grupo} valor={sel.grupo} onChange={set('grupo')} />
                <MultiSelect etiqueta="Estado" opciones={opciones.estado} valor={sel.estado} onChange={set('estado')} />
                <MultiSelect etiqueta="Aportante" opciones={opciones.aportante} valor={sel.aportante} onChange={set('aportante')} />
                <MultiSelect etiqueta="Institución" opciones={opciones.institucion} valor={sel.institucion} onChange={set('institucion')} ancho="w-80" />
                <MultiSelect etiqueta="Actividad" opciones={opciones.actividad} valor={sel.actividad} onChange={set('actividad')} ancho="w-96" />
                {hayLocales && (
                  <button type="button" onClick={() => setSel(VACIO)} className="rounded-full px-3 py-2 text-sm font-bold text-accentink underline decoration-2 underline-offset-4 hover:bg-wash">
                    Quitar estos filtros
                  </button>
                )}
              </Fila>
            </div>
          </div>
        </div>

        <Seccion titulo={`${cfg.grupos} y actividades`} nota={`El tamaño de cada cuadro es su ${titulo.toLowerCase()}. Toca un ${cfg.grupo.toLowerCase()} para entrar a sus actividades.`} tono="lavado" tabla={{ archivo: `${programa}-arbol`, columnas: [{ clave: 'grupo', titulo: cfg.grupo }, { clave: 'actividad', titulo: 'Actividad' }, { clave: 'valor', titulo, tipo: medida === 'valor' ? 'moneda' : 'cantidad' }], filas: tablaArbol }}>
          <Grafico etiqueta={`${titulo} por ${cfg.grupo.toLowerCase()} y actividad`} alto={520} opcion={opcionArbol} />
        </Seccion>

        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Seccion titulo="Instituciones" nota={`Cada burbuja es una institución; su tamaño es su ${titulo.toLowerCase()}. Arrástralas y toca una para filtrar.`} tabla={tablaPares('Institución', pInst, `${programa}-instituciones`)}>
            <Grafico etiqueta={`${titulo} por institución`} alto={520} alClic={alt('institucion')} opcion={opcionBurbujas} />
          </Seccion>

          <Seccion titulo="Estado de la actividad" nota="Lo que está dentro del convenio frente a lo que se hizo además." tabla={tablaPares('Estado', pEstado, `${programa}-estados`)}>
            <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Grafico
                etiqueta="Distribución por estado"
                alto={280}
                alClic={alt('estado')}
                opcion={opcionEstado}
              />
              <Posiciones items={pEstado.map((p) => ({ nombre: p.nombre, valor: p.valor, color: colorEstadoActividad(p.nombre, programa) }))} fmt={fmt} onClic={alt('estado')} seleccion={sel.estado} />
            </div>
          </Seccion>
        </div>

        <Seccion
          titulo="Año por año"
          nota="Quién aportó cada año. Toca un año para filtrar."
          tabla={{ archivo: `${programa}-por-anio`, columnas: [{ clave: 'anio', titulo: 'Año' }, ...aportantes.map((a) => ({ clave: a, titulo: a, tipo: (medida === 'valor' ? 'moneda' : 'cantidad') as 'moneda' | 'cantidad' }))], filas: anios.map((a) => ({ anio: String(a), ...Object.fromEntries(aportantes.map((p) => [p, sumar(vistas.anio.filter((x) => x.anio === a && x.aportante === p), v)])) })) }}
          acciones={
            <div className="hidden items-center gap-4 text-sm font-semibold sm:flex">
              {aportantes.map((a) => (
                <span key={a} className="flex items-center gap-2">
                  <span className="size-3.5 rounded-full" style={{ background: colorAportante(a) }} />
                  {a}
                </span>
              ))}
            </div>
          }
        >
          <div className="grid gap-6 sm:grid-cols-3">
            {anios.map((a) => {
              const partes = aportantes.map((p) => ({ nombre: p, valor: sumar(vistas.anio.filter((x) => x.anio === a && x.aportante === p), v), color: colorAportante(p) }))
              const tot = sumar(partes, (p) => p.valor)
              const on = f.anios.includes(a)
              return (
                <button key={a} type="button" aria-pressed={on} onClick={() => f.setAnios(alternar(f.anios, a))} className={`rounded-3xl bg-white p-4 text-left transition-all ${on ? 'ring-4 ring-main' : 'ring-1 ring-line hover:ring-main'} ${f.anios.length && !on ? 'opacity-50' : ''}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="display text-4xl" style={{ color: 'var(--ink)' }}>
                      {a}
                    </span>
                    <span className="cota text-sm font-semibold text-ink2">{fmt(tot)}</span>
                  </div>
                  <Grafico etiqueta={`${titulo} ${a} por aportante`} alto={210} opcion={dona({ partes, centro: fmt(tot), sub: String(a), fmt })} />
                </button>
              )
            })}
          </div>
        </Seccion>
      </Contenido>
    </>
  )
}
