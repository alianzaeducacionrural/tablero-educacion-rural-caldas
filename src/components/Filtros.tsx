import { useMemo, useState, type ReactNode } from 'react'
import { alfa } from '../lib/agregar'
import { Icono } from './Icono'

/** Una lista de opciones que se puede elegir en varias a la vez. Vacía = todas. */
export interface GrupoFiltro {
  clave: string
  titulo: string
  opciones: string[]
  valor: string[]
  onChange: (v: string[]) => void
  /** Abierto al entrar a la página. */
  abierto?: boolean
}

export interface FiltroAnios {
  anios: number[]
  valor: number[]
  onChange: (v: number[]) => void
}

export interface Etiqueta {
  clave: string
  /** Nombre del filtro (p. ej. «Año») y su valor elegido. */
  grupo: string
  valor: string
  quitar: () => void
}

function Plegable({ titulo, cuenta, abierto = false, children }: { titulo: string; cuenta: number; abierto?: boolean; children: ReactNode }) {
  const [a, setA] = useState(abierto || cuenta > 0)
  return (
    <section className="border-b border-line py-3.5 last:border-0">
      <button type="button" aria-expanded={a} onClick={() => setA(!a)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="display text-xl" style={{ color: 'var(--ink)' }}>
          {titulo}
        </span>
        <span className="flex items-center gap-2">
          {cuenta > 0 && <span className="cota rounded-full bg-main px-2 py-0.5 text-xs font-semibold text-on">{cuenta}</span>}
          <Icono n="chevron" size={17} className={`text-muted transition-transform duration-300 ${a ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {a && <div className="mt-3">{children}</div>}
    </section>
  )
}

function ListaOpciones({ titulo, opciones, valor, onChange }: Pick<GrupoFiltro, 'titulo' | 'opciones' | 'valor' | 'onChange'>) {
  const [q, setQ] = useState('')
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return [...opciones].sort(alfa).filter((o) => !t || o.toLowerCase().includes(t))
  }, [opciones, q])
  return (
    <div>
      {opciones.length > 8 && (
        <div className="relative mb-2">
          <Icono n="buscar" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${titulo.toLowerCase()}…`} aria-label={`Buscar ${titulo}`} className="w-full rounded-xl bg-soft py-2 pl-9 pr-3 text-sm outline-none ring-1 ring-line focus:ring-main" />
        </div>
      )}
      <ul role="group" aria-label={titulo} className="max-h-56 space-y-0.5 overflow-auto pr-1">
        {lista.map((o) => {
          const on = valor.includes(o)
          return (
            <li key={o}>
              <button type="button" aria-pressed={on} onClick={() => onChange(on ? valor.filter((x) => x !== o) : [...valor, o])} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-wash">
                <span className={`grid size-5 shrink-0 place-items-center rounded-md ${on ? 'bg-main text-on' : 'ring-1 ring-muted'}`}>{on && <Icono n="check" size={13} />}</span>
                <span className={`min-w-0 truncate ${on ? 'font-bold' : ''}`}>{o}</span>
              </button>
            </li>
          )
        })}
        {lista.length === 0 && <li className="px-2 py-2 text-sm text-muted">Sin resultados</li>}
      </ul>
    </div>
  )
}

export function PanelFiltros({ anios, tituloAnios = 'Año', grupos, etiquetas, onLimpiar }: { anios?: FiltroAnios; tituloAnios?: string; grupos: GrupoFiltro[]; etiquetas: Etiqueta[]; onLimpiar: () => void }) {
  return (
    <div>
      <h2 className="display flex items-center gap-2 pb-3 text-2xl" style={{ color: 'var(--ink)' }}>
        <Icono n="filtro" size={20} />
        Filtros
      </h2>

      {/* Lo aplicado se ve aquí, en la barra: no mueve nada del contenido. */}
      <section aria-label="Filtros aplicados" className="mb-2 rounded-2xl bg-wash/70 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-extrabold" style={{ color: 'var(--ink)' }}>
            Aplicados
            {etiquetas.length > 0 && <span className="cota rounded-full bg-main px-2 py-0.5 text-xs font-semibold text-on">{etiquetas.length}</span>}
          </h3>
          {etiquetas.length > 0 && (
            <button type="button" onClick={onLimpiar} className="rounded-full px-2.5 py-1 text-xs font-bold text-accentink underline decoration-2 underline-offset-4 hover:bg-white/70">
              Quitar todos
            </button>
          )}
        </div>
        {etiquetas.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink2">Ninguno: estás viendo todo.</p>
        ) : (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {etiquetas.map((e) => (
              <li key={e.clave} className="max-w-full">
                <button type="button" onClick={e.quitar} title={`Quitar ${e.grupo}: ${e.valor}`} aria-label={`Quitar filtro ${e.grupo}: ${e.valor}`} className="group flex max-w-full items-center gap-1.5 rounded-full bg-main py-1 pl-3 pr-2 text-left text-xs text-on">
                  <span className="min-w-0 truncate">
                    <span className="opacity-80">{e.grupo} </span>
                    <span className="font-bold">{e.valor}</span>
                  </span>
                  <Icono n="cerrar" size={12} className="shrink-0 opacity-80 group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {anios && (
        <Plegable titulo={tituloAnios} cuenta={anios.valor.length} abierto>
          <div role="group" aria-label={tituloAnios} className="flex flex-wrap gap-2">
            {anios.anios.map((a) => {
              const on = anios.valor.includes(a)
              return (
                <button key={a} type="button" aria-pressed={on} onClick={() => anios.onChange(on ? anios.valor.filter((x) => x !== a) : [...anios.valor, a])} className={`cota rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? 'bg-main text-on' : 'bg-soft ring-1 ring-line hover:ring-main'}`}>
                  {a}
                </button>
              )
            })}
          </div>
        </Plegable>
      )}
      {grupos.map((g) => (
        <Plegable key={g.clave} titulo={g.titulo} cuenta={g.valor.length} abierto={g.abierto}>
          <ListaOpciones titulo={g.titulo} opciones={g.opciones} valor={g.valor} onChange={g.onChange} />
        </Plegable>
      ))}
    </div>
  )
}

/** Barra lateral fija en escritorio; en el celular se abre como panel a pantalla completa. */
export function ConFiltros({ panel, etiquetas, children }: { panel: ReactNode; etiquetas: Etiqueta[]; onLimpiar?: () => void; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="mx-auto max-w-[1500px] px-5 py-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-10">
      <button type="button" onClick={() => setAbierto(true)} className="mb-6 inline-flex items-center gap-2 rounded-full bg-main px-5 py-2.5 font-bold text-on lg:hidden">
        <Icono n="filtro" size={16} />
        Filtros{etiquetas.length > 0 ? ` (${etiquetas.length})` : ''}
      </button>

      <aside
        aria-label="Filtros"
        className={`${abierto ? 'fixed inset-0 z-40 overflow-auto bg-white p-5' : 'hidden'} lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-auto lg:rounded-3xl lg:p-5 lg:ring-1 lg:ring-line`}
        style={{ background: '#fff' }}
      >
        <div className="mb-3 flex justify-end lg:hidden">
          <button type="button" onClick={() => setAbierto(false)} className="inline-flex items-center gap-2 rounded-full bg-main px-4 py-2 font-bold text-on">
            <Icono n="cerrar" size={15} />
            Ver resultados
          </button>
        </div>
        {panel}
      </aside>

      <div className="mt-2 min-w-0 space-y-14 lg:mt-0 sm:space-y-16">{children}</div>
    </div>
  )
}

/** Etiquetas de los filtros activos (año y cada opción elegida), cada una con su forma de quitarse. */
export function etiquetasDe(anios: FiltroAnios | undefined, grupos: GrupoFiltro[], tituloAnios = 'Año'): Etiqueta[] {
  const out: Etiqueta[] = []
  anios?.valor.forEach((a) => out.push({ clave: `anio-${a}`, grupo: tituloAnios, valor: String(a), quitar: () => anios.onChange(anios.valor.filter((x) => x !== a)) }))
  grupos.forEach((g) => g.valor.forEach((v) => out.push({ clave: `${g.clave}-${v}`, grupo: g.titulo, valor: v, quitar: () => g.onChange(g.valor.filter((x) => x !== v)) })))
  return out
}
