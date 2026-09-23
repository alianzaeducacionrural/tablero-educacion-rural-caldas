import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import caldas from '../data/caldas.json'
import { TINTA, type Placa } from '../lib/colores'
import { inicioBanda, mapa } from '../lib/graficos'
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

export function MapaCaldas({ datos, placa, fmt, seleccion, alClic, sinDatos = ['Manizales'], etiqueta }: { datos: { name: string; value: number }[]; placa: Placa; fmt: (n: number) => string; seleccion: string[]; alClic: (nombre: string) => void; sinDatos?: string[]; etiqueta: string }) {
  const [banda, setBanda] = useState<number | null>(null)
  const max = Math.max(1, ...datos.map((d) => d.value))
  const opcion = useMemo(() => mapa({ datos, placa, fmt, seleccion, sinDatos, banda, max }), [datos, placa, fmt, seleccion, sinDatos, banda, max])
  return (
    <div>
      <div className="w-full" style={{ aspectRatio: '1.22' }}>
        <Grafico opcion={opcion} alto="100%" etiqueta={etiqueta} alClic={(n) => !sinDatos.includes(n) && alClic(n)} />
      </div>
      <LeyendaCotas placa={placa} max={max} fmt={fmt} banda={banda} onBanda={setBanda} />
      {sinDatos.length > 0 && <p className="mt-1 text-xs text-ink2">{sinDatos.join(', ')}: sin datos en este tablero (tiene convenio propio).</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ vértices geodésicos (un valor por año) */

export function Vertices({ items, seleccion, onToggle }: { items: { clave: string; etiqueta: string; valor: string; detalle?: string }[]; seleccion: string[]; onToggle: (clave: string) => void }) {
  const hay = seleccion.length > 0
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-5">
      {items.map((it) => {
        const on = seleccion.includes(it.clave)
        return (
          <button key={it.clave} type="button" aria-pressed={on} onClick={() => onToggle(it.clave)} className={`group flex items-center gap-3 text-left transition-opacity ${hay && !on ? 'opacity-45' : ''}`}>
            <span className={`grid size-14 place-items-center rounded-2xl transition-colors ${on ? 'bg-main text-on' : 'bg-white text-accentink ring-1 ring-line group-hover:ring-main'}`}>
              <Icono n="vertice" size={28} />
            </span>
            <span>
              <span className="cota block text-sm font-semibold text-ink2">{it.etiqueta}</span>
              <span className="display tabular block text-3xl" style={{ color: 'var(--ink)' }}>
                {it.valor}
              </span>
              {it.detalle && <span className="block text-xs font-medium text-ink2">{it.detalle}</span>}
            </span>
          </button>
        )
      })}
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

/* ------------------------------------------------------------------ cafetal: un punto por estudiante */

interface CafetalProps {
  cohortes: { cohorte: string; conteos: Record<string, number> }[]
  estados: string[]
  colorDe: (estado: string) => string
  seleccionEstado: string[]
  seleccionCohorte: string[]
  alClicEstado: (e: string) => void
  alClicCohorte: (c: string) => void
}

const COLS = 12
const PASO = 10

export function Cafetal({ cohortes, estados, colorDe, seleccionEstado, seleccionCohorte, alClicEstado, alClicCohorte }: CafetalProps) {
  const hayE = seleccionEstado.length > 0
  const hayC = seleccionCohorte.length > 0
  return (
    <div className="flex flex-wrap items-end gap-x-7 gap-y-8">
      {cohortes.map((co) => {
        const total = estados.reduce((s, e) => s + (co.conteos[e] ?? 0), 0)
        const filas = Math.ceil(total / COLS)
        const alto = Math.max(PASO, filas * PASO + 4)
        let i = 0
        const opCohorte = hayC && !seleccionCohorte.includes(co.cohorte) ? 0.22 : 1
        return (
          <div key={co.cohorte} className="transition-opacity duration-500" style={{ opacity: opCohorte }}>
            <svg width={COLS * PASO} height={alto} role="group" aria-label={`Cohorte ${co.cohorte}: ${total} estudiantes`} className="block">
              {estados.map((e) => {
                const n = co.conteos[e] ?? 0
                const idx0 = i
                i += n
                const opE = hayE && !seleccionEstado.includes(e) ? 0.18 : 1
                return (
                  <g key={e} role="button" tabIndex={0} aria-label={`${e}: ${n}`} onClick={() => alClicEstado(e)} onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && alClicEstado(e)} style={{ cursor: 'pointer', opacity: opE, transition: 'opacity .4s' }}>
                    <title>{`${co.cohorte} · ${e}: ${n}`}</title>
                    {Array.from({ length: n }, (_, k) => {
                      const j = idx0 + k
                      const cx = (j % COLS) * PASO + PASO / 2
                      const cy = alto - (Math.floor(j / COLS) * PASO + PASO / 2) - 2
                      return <circle key={k} cx={cx} cy={cy} r={3.7} fill={colorDe(e)} style={{ animation: `punto .5s cubic-bezier(.19,1,.22,1) ${Math.min(900, (j % 90) * 9 + Math.floor(j / COLS) * 6)}ms both`, transformOrigin: `${cx}px ${cy}px` }} />
                    })}
                  </g>
                )
              })}
            </svg>
            <button type="button" onClick={() => alClicCohorte(co.cohorte)} aria-pressed={seleccionCohorte.includes(co.cohorte)} className="mt-2 flex w-full items-baseline justify-between rounded-lg px-1 text-left hover:bg-wash">
              <span className="display text-2xl" style={{ color: 'var(--ink)' }}>
                {co.cohorte}
              </span>
              <span className="cota text-sm font-semibold text-ink2">{total.toLocaleString('es-CO')}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

