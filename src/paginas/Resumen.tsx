import { useMemo } from 'react'
import { Grafico } from '../components/Grafico'
import { Kpi, Kpis, Tarjeta } from '../components/Tarjetas'
import { agrupar, sumar, unicos } from '../lib/agregar'
import { colorAportante, colorPrograma, tinta } from '../lib/colores'
import { alternar } from '../lib/filtros'
import { cop, copM, ejeM, num, pct } from '../lib/formato'
import { apiladaH, columnas, sankey } from '../lib/graficos'
import { descripcionFiltros, pasa, useTablero } from '../lib/usarFiltrado'
import { useAngosto } from '../lib/angosto'
import { useTema } from '../lib/tema'
import { PROGRAMAS, type Programa } from '../lib/tipos'

export function Resumen() {
  const { datos, f } = useTablero()
  const { tema } = useTema()
  const angosto = useAngosto()

  const base = useMemo(() => datos.base.filter((x) => pasa(f, x.anio, x.municipio)), [datos, f])
  const baseTodosAnios = useMemo(() => datos.base.filter((x) => pasa({ anios: [], municipios: f.municipios }, x.anio, x.municipio)), [datos, f.municipios])
  const beneficiados = useMemo(() => datos.beneficiados.filter((b) => pasa(f, b.anio, b.municipio)), [datos, f])
  const estudiantes = useMemo(() => datos.estudiantes.filter((e) => /gobernaci/i.test(e.financiador) && pasa(f, null, e.municipio)), [datos, f])

  const total = sumar(base, (x) => x.valor)
  const porAportante = agrupar(base, (x) => x.aportante, (x) => x.valor)
  const valorDe = (re: RegExp) => porAportante.filter((a) => re.test(a.nombre)).reduce((s, a) => s + a.valor, 0)
  const depto = valorDe(/depto|departamento|gobernaci/i)
  const comite = valorDe(/comit/i)
  const graduados = estudiantes.filter((e) => /^graduado$/i.test(e.estado)).length
  const instituciones = unicos(base.filter((x) => x.tipo === 'Institución'), (x) => `${x.municipio}|${x.institucion}`).size
  const anios = [...new Set(datos.base.map((x) => x.anio))].sort()
  const rango = anios.length ? `${anios[0]}–${anios[anios.length - 1]}` : ''

  // Sankey: aportante → programa → proyecto/proceso
  const flujo = useMemo(() => {
    const k = tinta(tema)
    const enlaces = new Map<string, { source: string; target: string; value: number }>()
    const suma = (source: string, target: string, value: number) => {
      const id = source + '→' + target
      const e = enlaces.get(id) ?? { source, target, value: 0 }
      e.value += value
      enlaces.set(id, e)
    }
    const nodos = new Map<string, string>()
    base.forEach((x) => {
      if (x.valor <= 0) return
      const prog = PROGRAMAS[x.programa].nombre
      const aport = x.aportante || 'Sin aportante'
      nodos.set(aport, colorAportante(tema, aport))
      nodos.set(prog, colorPrograma(tema, x.programa))
      nodos.set(x.grupo, colorPrograma(tema, x.programa))
      suma(aport, prog, x.valor)
      suma(prog, x.grupo, x.valor)
    })
    return { nodos: [...nodos.entries()].map(([name, color]) => ({ name, color: color || k.gris })), enlaces: [...enlaces.values()] }
  }, [base, tema])

  const tablaFlujo = useMemo(() => {
    const m = new Map<string, { aportante: string; programa: string; grupo: string; valor: number }>()
    base.forEach((x) => {
      const id = `${x.aportante}|${x.programa}|${x.grupo}`
      const e = m.get(id) ?? { aportante: x.aportante || 'Sin aportante', programa: PROGRAMAS[x.programa].nombre, grupo: x.grupo, valor: 0 }
      e.valor += x.valor
      m.set(id, e)
    })
    return [...m.values()].sort((a, b) => b.valor - a.valor)
  }, [base])

  // Inversión por año y programa (con los años siempre visibles; el filtro de año resalta)
  const porAnio = useMemo(() => {
    const cats = [...new Set(baseTodosAnios.map((x) => x.anio))].sort()
    const serie = (p: Programa) => cats.map((a) => sumar(baseTodosAnios.filter((x) => x.programa === p && x.anio === a), (x) => x.valor))
    return { cats, mf: serie('mf'), uc: serie('uc') }
  }, [baseTodosAnios])

  const filasAporte = useMemo(() => {
    const parte = (p: Programa | null) => {
      const filas = p ? base.filter((x) => x.programa === p) : base
      return agrupar(filas, (x) => x.aportante || 'Sin aportante', (x) => x.valor).map((a) => ({ nombre: a.nombre, valor: a.valor, color: colorAportante(tema, a.nombre) }))
    }
    return [
      { nombre: 'Total', partes: parte(null) },
      { nombre: 'Modelos Flexibles', partes: parte('mf') },
      { nombre: 'Universidad en el Campo', partes: parte('uc') },
    ]
  }, [base, tema])

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink2">Mostrando: {descripcionFiltros(f)}</p>

      <Kpis>
        <Kpi heroe titulo={`Inversión total en educación rural${rango ? ` · ${rango}` : ''}`} valor={cop(total)} detalle={`${copM(total)} · Departamento de Caldas ${total ? pct(depto / total) : '—'} · Comité de Cafeteros ${total ? pct(comite / total) : '—'}`} />
        <Kpi titulo="Estudiantes beneficiados" valor={num(sumar(beneficiados, (b) => b.beneficiados))} detalle="Modelos Flexibles" />
        <Kpi titulo="Estudiantes técnicos (financiados)" valor={num(estudiantes.length)} detalle={estudiantes.length ? `${pct(graduados / estudiantes.length)} ya se graduó` : undefined} />
        <Kpi titulo="Municipios atendidos" valor={num(unicos(base, (x) => x.municipio).size)} />
        <Kpi titulo="Instituciones educativas" valor={num(instituciones)} />
        <Kpi titulo="Aporte del Departamento" valor={copM(depto)} detalle={total ? pct(depto / total) + ' del total' : undefined} />
        <Kpi titulo="Aporte del Comité de Cafeteros" valor={copM(comite)} detalle={total ? pct(comite / total) + ' del total' : undefined} />
      </Kpis>

      <Tarjeta
        titulo="¿De dónde viene y a dónde va el recurso?"
        nota="Aportante → programa → proyecto o proceso. El grosor de cada franja es el valor invertido."
        tabla={{
          archivo: 'distribucion-del-recurso',
          columnas: [
            { clave: 'aportante', titulo: 'Aportante' },
            { clave: 'programa', titulo: 'Programa' },
            { clave: 'grupo', titulo: 'Proyecto / proceso' },
            { clave: 'valor', titulo: 'Valor', tipo: 'moneda' },
          ],
          filas: tablaFlujo,
        }}
      >
        <Grafico etiqueta="Distribución del recurso por aportante, programa y proyecto" alto={angosto ? 520 : 440} opcion={sankey({ ...flujo, tema, fmt: copM, angosto })} />
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Tarjeta
          titulo="Inversión por año"
          nota="Toca una columna para filtrar por ese año."
          tabla={{
            archivo: 'inversion-por-anio',
            columnas: [
              { clave: 'anio', titulo: 'Año' },
              { clave: 'mf', titulo: 'Modelos Flexibles', tipo: 'moneda' },
              { clave: 'uc', titulo: 'Universidad en el Campo', tipo: 'moneda' },
              { clave: 'total', titulo: 'Total', tipo: 'moneda' },
            ],
            filas: porAnio.cats.map((a, i) => ({ anio: String(a), mf: porAnio.mf[i], uc: porAnio.uc[i], total: porAnio.mf[i] + porAnio.uc[i] })),
          }}
        >
          <Grafico
            etiqueta="Inversión por año y programa"
            alto={300}
            alClic={(n) => f.setAnios(alternar(f.anios, Number(n)))}
            opcion={columnas({
              categorias: porAnio.cats.map(String),
              series: [
                { nombre: 'Modelos Flexibles', color: colorPrograma(tema, 'mf'), datos: porAnio.mf },
                { nombre: 'Universidad en el Campo', color: colorPrograma(tema, 'uc'), datos: porAnio.uc },
              ],
              tema,
              fmt: copM,
              fmtEje: ejeM,
              totales: true,
              seleccion: f.anios.map(String),
            })}
          />
        </Tarjeta>

        <Tarjeta
          titulo="Quién aporta, por programa"
          nota="Participación de cada aportante en el valor invertido."
          tabla={{
            archivo: 'aporte-por-fuente',
            columnas: [
              { clave: 'programa', titulo: 'Programa' },
              { clave: 'aportante', titulo: 'Aportante' },
              { clave: 'valor', titulo: 'Valor', tipo: 'moneda' },
            ],
            filas: filasAporte.flatMap((r) => r.partes.map((p) => ({ programa: r.nombre, aportante: p.nombre, valor: p.valor }))),
          }}
        >
          <Grafico etiqueta="Participación de cada aportante por programa" alto={230} opcion={apiladaH({ filas: filasAporte, tema, fmt: copM })} />
        </Tarjeta>
      </div>
    </div>
  )
}
