import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import caldas from '../data/caldas.json'
import { TINTA, type Placa } from '../lib/colores'
import { descargarExcel, type HojaExcel } from '../lib/excel'
import { inicioBanda, mapa } from '../lib/graficos'
import { pct } from '../lib/formato'
import { Grafico } from './Grafico'
import { Icono } from './Icono'
import { Tabla, type TablaDatos } from './Tabla'

/* ------------------------------------------------------------------ silueta real de Caldas */

type Anillos = number[][][][]
const proyeccion = (() => {
  const fs = (caldas as unknown as { features: { geometry: { coordinates: Anillos } }[] }).features
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  fs.forEach((f) => f.geometry.coordinates.forEach((p) => p.forEach((r) => r.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }))))
  const k = 1000 / (x1 - x0)
  const h = (y1 - y0) * k
  const ds = fs.map((f) => f.geometry.coordinates.map((p) => p.map((r) => 'M' + r.map(([x, y]) => `${((x - x0) * k).toFixed(1)},${((y1 - y) * k).toFixed(1)}`).join('L') + 'Z').join('')).join(''))
  return { ds, h }
})()

/** El contorno de los 27 municipios, como textura de cabecera: es geografía real, no adorno. */
export function SiluetaCaldas({ className = '', style, trazo = 'currentColor' }: { className?: string; style?: CSSProperties; trazo?: string }) {
  return (
    <svg viewBox={`0 0 1000 ${proyeccion.h.toFixed(0)}`} className={className} style={style} aria-hidden="true" fill="none" stroke={trazo} strokeWidth="2.2" strokeLinejoin="round">
      {proyeccion.ds.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------ estructura */

export function PlacaCabecera({ placa, titulo, texto, children }: { placa: Placa; titulo: string; texto: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden" style={{ background: placa.main, color: placa.on }}>
      <SiluetaCaldas className="pointer-events-none absolute -right-40 top-1/2 h-[170%] -translate-y-1/2 opacity-15 sm:-right-16 sm:h-[190%] sm:opacity-30" trazo={placa.on} />
      <div className="relative mx-auto grid max-w-[1400px] gap-6 px-5 pb-10 pt-9 sm:pb-12 sm:pt-11 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="entra">
          <h1 className="display text-5xl sm:text-6xl lg:text-7xl">{titulo}</h1>
          <p className="mt-4 max-w-2xl text-lg font-medium leading-snug sm:text-xl" style={{ opacity: 0.95 }}>
            {texto}
          </p>
        </div>
        {children && <div className="flex flex-col items-start gap-3 lg:items-end">{children}</div>}
      </div>
    </section>
  )
}

/** El icono verde de Excel: no es el logo oficial, pero se reconoce al instante. */
function IconoExcel({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#1D6F42" />
      <path d="M7.2 7.2l3.5 4.8-3.5 4.8h2.2l2.4-3.35 2.4 3.35h2.2l-3.5-4.8 3.5-4.8h-2.2l-2.4 3.35-2.4-3.35z" fill="#ffffff" />
    </svg>
  )
}

/** Botón bien visible para bajar toda la pestaña como un Excel, una hoja por sección. */
export function BotonExcel({ archivo, hojas }: { archivo: string; hojas: HojaExcel[] }) {
  return (
    <button
      type="button"
      onClick={() => descargarExcel(archivo, hojas)}
      className="inline-flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-3 pr-5 font-extrabold text-ink shadow-lg shadow-black/15 ring-1 ring-black/5 transition-transform hover:-translate-y-0.5"
    >
      <IconoExcel />
      Descargar Excel
    </button>
  )
}

export function Contenido({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1400px] space-y-14 px-5 py-9 sm:space-y-16 sm:py-12">{children}</div>
}

export function Seccion({ titulo, nota, tabla, acciones, tono = 'abierto', children, className = '' }: { titulo: string; nota?: ReactNode; tabla?: TablaDatos; acciones?: ReactNode; tono?: 'abierto' | 'lavado'; children: ReactNode; className?: string }) {
  const [vista, setVista] = useState<'visual' | 'tabla'>('visual')
  return (
    <section className={`${tono === 'lavado' ? 'rounded-[28px] bg-wash/70 p-5 sm:p-8' : ''} ${className}`}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-3xl sm:text-4xl" style={{ color: 'var(--ink)' }}>
            {titulo}
          </h2>
          {nota && <p className="mt-2 max-w-xl text-base text-ink2">{nota}</p>}
        </div>
        <div className="flex items-center gap-2">
          {acciones}
          {tabla && (
            <div role="group" aria-label={`Vista de ${titulo}`} className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
              {(['visual', 'tabla'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={vista === v} onClick={() => setVista(v)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${vista === v ? 'bg-main text-on' : 'text-ink2 hover:text-ink'}`}>
                  <Icono n={v === 'visual' ? 'grafico' : 'tabla'} size={14} />
                  {v === 'visual' ? 'Visual' : 'Tabla'}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {vista === 'tabla' && tabla ? <Tabla {...tabla} /> : children}
    </section>
  )
}

/** Cifra grande, suelta sobre el fondo: no va en tarjeta. */
export function Cifra({ valor, etiqueta, tam = 'md', color }: { valor: string; etiqueta?: ReactNode; tam?: 'sm' | 'md' | 'lg' | 'xl'; color?: string }) {
  const t = { sm: 'text-3xl', md: 'text-4xl sm:text-5xl', lg: 'text-5xl sm:text-6xl', xl: 'text-5xl sm:text-7xl lg:text-[5.5rem]' }[tam]
  return (
    <div>
      <div className={`display tabular ${t}`} style={{ color: color ?? 'var(--ink)' }}>
        {valor}
      </div>
      {etiqueta && <div className="mt-1.5 text-sm font-semibold text-ink2 sm:text-base">{etiqueta}</div>}
    </div>
  )
}

/** Cifra resaltada dentro de una frase, como con marcador fluorescente. */
export function Marca({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <mark className="rounded-lg px-1.5 py-0.5 font-extrabold" style={{ background: color ?? 'var(--wash)', color: 'var(--ink)' }}>
      {children}
    </mark>
  )
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'error'; children: ReactNode }) {
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-2xl p-4 text-sm ${tipo === 'error' ? 'bg-white text-ink ring-2 ring-bad' : 'bg-wash text-ink2'}`}>
      {children}
    </div>
  )
}

export function Cargando({ texto = 'Cargando datos…' }: { texto?: string }) {
  return (
    <div role="status" className="grid min-h-64 place-items-center text-ink2">
      <div className="flex items-center gap-3 font-semibold">
        <span className="size-5 animate-spin rounded-full border-[3px] border-wash border-t-main" aria-hidden="true" />
        {texto}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ mapa con su leyenda de cotas */

export function LeyendaCotas({ placa, max, fmt, banda, onBanda }: { placa: Placa; max: number; fmt: (n: number) => string; banda: number | null; onBanda: (b: number | null) => void }) {
  return (
    <div className="mt-3 w-full max-w-md">
      <div className="flex items-end gap-0.5">
        {placa.escala.map((c, i) => (
          <button
            key={c}
            type="button"
            aria-pressed={banda === i}
            onClick={() => onBanda(banda === i ? null : i)}
            aria-label={`Municipios entre ${fmt(inicioBanda(i, max))} y ${fmt(inicioBanda(i + 1, max))}`}
            className="flex-1 rounded-md transition-all duration-300"
            style={{ background: c, height: banda === i ? 26 : 14, boxShadow: banda === i ? `0 0 0 2px ${TINTA.texto}` : undefined }}
          />
        ))}
      </div>
      <div className="cota mt-1.5 flex justify-between text-xs font-medium text-ink2">
        <span>{fmt(0)}</span>
        <span>{fmt(max)}</span>
      </div>
      <p className="mt-1 text-xs text-ink2">{banda === null ? 'Toca un tramo de color para aislar esos municipios.' : `Mostrando de ${fmt(inicioBanda(banda, max))} a ${fmt(inicioBanda(banda + 1, max))}. Toca otra vez para volver.`}</p>
    </div>
  )
}

export function MapaCaldas({ datos, placa, fmt, seleccion, alClic, sinDatos = ['Manizales'], etiqueta, extra }: { datos: { name: string; value: number }[]; placa: Placa; fmt: (n: number) => string; seleccion: string[]; alClic: (nombre: string) => void; sinDatos?: string[]; etiqueta: string; extra?: Record<string, string> }) {
  const [banda, setBanda] = useState<number | null>(null)
  const max = Math.max(1, ...datos.map((d) => d.value))
  const opcion = useMemo(() => mapa({ datos, placa, fmt, seleccion, sinDatos, banda, max, extra }), [datos, placa, fmt, seleccion, sinDatos, banda, max, extra])
  return (
    <div>
      <div className="w-full" style={{ aspectRatio: '1.22' }}>
        <Grafico opcion={opcion} alto="100%" etiqueta={etiqueta} alClic={(n) => !sinDatos.includes(n) && alClic(n)} sinRecuadro />
      </div>
      <LeyendaCotas placa={placa} max={max} fmt={fmt} banda={banda} onBanda={setBanda} />
      {sinDatos.length > 0 && <p className="mt-1 text-xs text-ink2">{sinDatos.join(', ')}: sin datos en este tablero (tiene convenio propio).</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ avance y comparación entre años */

/** Barra de avance: lo ejecutado frente a la meta. Siempre con icono y texto, nunca solo color. */
export function Progreso({ etiqueta, valor, meta, fmt, color }: { etiqueta: string; valor: number; meta: number; fmt: (n: number) => string; color: string }) {
  const r = meta > 0 ? valor / meta : 0
  const icono = r > 1.0001 ? 'arriba' : r >= 0.9999 ? 'check' : 'encurso'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold" style={{ color: 'var(--ink)' }}>
          {etiqueta}
        </span>
        <span className="cota inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
          <Icono n={icono} size={14} />
          {pct(r, 1)}
        </span>
      </div>
      <div role="progressbar" aria-label={`Avance de ${etiqueta}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(r * 100))} className="mt-1.5 h-3.5 overflow-hidden rounded-full bg-white ring-1 ring-line">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, r * 100)}%`, background: color }} />
      </div>
      <p className="cota mt-1 text-xs text-ink2">
        {fmt(valor)} de {fmt(meta)}
      </p>
    </div>
  )
}

/** Comparación año a año con el cambio frente al año anterior. */
export function TablaAnios({ filas, series, fmt, nota }: { filas: { anio: number; valores: number[] }[]; series: { nombre: string; color: string }[]; fmt: (n: number) => string; nota?: string }) {
  const ordenadas = [...filas].sort((a, b) => a.anio - b.anio)
  const total = (f: { valores: number[] }) => f.valores.reduce((s, v) => s + v, 0)
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-left font-bold">
                Año
              </th>
              {series.map((s) => (
                <th key={s.nombre} scope="col" className="border-b-2 border-main px-3 py-2.5 text-right font-bold">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: s.color }} />
                    {s.nombre}
                  </span>
                </th>
              ))}
              {series.length > 1 && (
                <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-right font-bold">
                  Total
                </th>
              )}
              <th scope="col" className="border-b-2 border-main px-3 py-2.5 text-right font-bold">
                Cambio
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((f, i) => {
              const t = total(f)
              const antes = i > 0 ? total(ordenadas[i - 1]) : 0
              const delta = i > 0 && antes > 0 ? (t - antes) / antes : null
              return (
                <tr key={f.anio} className="border-b border-line last:border-0">
                  <td className="display px-3 py-2.5 text-xl" style={{ color: 'var(--ink)' }}>
                    {f.anio}
                  </td>
                  {f.valores.map((v, k) => (
                    <td key={k} className="cota px-3 py-2.5 text-right">
                      {fmt(v)}
                    </td>
                  ))}
                  {series.length > 1 && <td className="cota px-3 py-2.5 text-right font-bold">{fmt(t)}</td>}
                  <td className="px-3 py-2.5 text-right">
                    {delta === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={`cota inline-flex items-center gap-1 font-bold ${delta >= 0 ? 'text-good' : 'text-bad'}`}>
                        <Icono n={delta >= 0 ? 'arriba' : 'abajo'} size={13} />
                        {pct(Math.abs(delta), 1)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {nota && <p className="mt-2 text-xs text-ink2">{nota}</p>}
    </div>
  )
}

/** Comparación año a año con las dos cifras (valor y cantidad) y su cambio frente al año anterior. */
export function TablaAniosDual({ filas, fmtValor, fmtCantidad, tituloCantidad = 'Cantidad', nota }: { filas: { anio: number; valor: number; cantidad: number }[]; fmtValor: (n: number) => string; fmtCantidad: (n: number) => string; tituloCantidad?: string; nota?: string }) {
  const o = [...filas].sort((a, b) => a.anio - b.anio)
  const cambio = (actual: number, antes: number | undefined) => {
    if (antes === undefined || antes <= 0) return <span className="text-muted">—</span>
    const d = (actual - antes) / antes
    return (
      <span className={`cota inline-flex items-center gap-1 font-bold ${d >= 0 ? 'text-good' : 'text-bad'}`}>
        <Icono n={d >= 0 ? 'arriba' : 'abajo'} size={13} />
        {pct(Math.abs(d), 1)}
      </span>
    )
  }
  const th = 'border-b-2 border-main px-3 py-2.5 font-bold'
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={`${th} text-left`}>Año</th>
              <th scope="col" className={`${th} text-right`}>Valor</th>
              <th scope="col" className={`${th} text-right`}>Cambio</th>
              <th scope="col" className={`${th} text-right`}>{tituloCantidad}</th>
              <th scope="col" className={`${th} text-right`}>Cambio</th>
            </tr>
          </thead>
          <tbody>
            {o.map((f, i) => (
              <tr key={f.anio} className="border-b border-line last:border-0">
                <td className="display px-3 py-2.5 text-xl" style={{ color: 'var(--ink)' }}>{f.anio}</td>
                <td className="cota px-3 py-2.5 text-right font-semibold">{fmtValor(f.valor)}</td>
                <td className="px-3 py-2.5 text-right">{cambio(f.valor, o[i - 1]?.valor)}</td>
                <td className="cota px-3 py-2.5 text-right font-semibold">{fmtCantidad(f.cantidad)}</td>
                <td className="px-3 py-2.5 text-right">{cambio(f.cantidad, o[i - 1]?.cantidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota && <p className="mt-2 text-xs text-ink2">{nota}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ lista de posiciones (sin barras) */

export function Posiciones({ items, fmt, onClic, seleccion }: { items: { nombre: string; valor: number; color: string }[]; fmt: (n: number) => string; onClic?: (n: string) => void; seleccion?: string[] }) {
  const hay = (seleccion?.length ?? 0) > 0
  return (
    <ol className="divide-y divide-line">
      {items.map((it, i) => {
        const on = seleccion?.includes(it.nombre)
        return (
          <li key={it.nombre}>
            <button type="button" onClick={() => onClic?.(it.nombre)} className={`flex w-full items-center gap-3 py-2.5 text-left transition-opacity ${hay && !on ? 'opacity-45' : ''}`}>
              <span className="cota w-6 text-sm font-semibold text-ink2">{i + 1}</span>
              <span className="size-4 shrink-0 rounded-full" style={{ background: it.color }} />
              <span className="min-w-0 flex-1 truncate font-bold" style={{ color: 'var(--ink)' }}>
                {it.nombre}
              </span>
              <span className="cota font-semibold">{fmt(it.valor)}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}


