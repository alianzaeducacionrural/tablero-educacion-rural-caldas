import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { alfa } from '../lib/agregar'
import { Icono } from './Icono'

/** Interruptor segmentado: p. ej. Valor ⇄ Cantidad. Toma el color de campo de la lámina. */
export function Segmentado<T extends string>({ opciones, valor, onChange, etiqueta, sobreCampo = false }: { opciones: { id: T; texto: string }[]; valor: T; onChange: (v: T) => void; etiqueta: string; sobreCampo?: boolean }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={`inline-flex rounded-full p-1 ${sobreCampo ? 'bg-white/20' : 'bg-wash'}`}>
      {opciones.map((o) => {
        const on = valor === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${on ? (sobreCampo ? 'bg-white text-ink' : 'bg-main text-on shadow-sm') : sobreCampo ? 'text-on/85 hover:text-on' : 'text-ink2 hover:text-ink'}`}
          >
            {o.texto}
          </button>
        )
      })}
    </div>
  )
}

/** Lista desplegable con selección múltiple y búsqueda. Vacía = todos. */
export function MultiSelect({ etiqueta, opciones, valor, onChange, ancho = 'w-72' }: { etiqueta: string; opciones: string[]; valor: string[]; onChange: (v: string[]) => void; ancho?: string }) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const raiz = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return [...opciones].sort(alfa).filter((o) => !t || o.toLowerCase().includes(t))
  }, [opciones, q])

  const resumen = valor.length === 0 ? 'Todos' : valor.length === 1 ? valor[0] : `${valor.length} elegidos`

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${valor.length ? 'bg-main text-on' : 'bg-white text-ink ring-1 ring-line hover:ring-main'}`}
      >
        <span className={valor.length ? 'opacity-80' : 'text-muted'}>{etiqueta}</span>
        <span className="max-w-40 truncate">{resumen}</span>
        <Icono n="chevron" size={14} />
      </button>
      {abierto && (
        <div className={`absolute left-0 z-30 mt-2 ${ancho} rounded-2xl bg-white p-2 shadow-[0_12px_32px_rgba(29,26,74,0.2)] ring-1 ring-line`}>
          {opciones.length > 8 && (
            <div className="relative mb-2">
              <Icono n="buscar" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${etiqueta.toLowerCase()}…`} aria-label={`Buscar ${etiqueta}`} className="w-full rounded-xl bg-soft py-2 pl-9 pr-3 text-sm outline-none ring-1 ring-line focus:ring-main" />
            </div>
          )}
          <ul id={id} role="listbox" aria-multiselectable="true" aria-label={etiqueta} className="max-h-64 overflow-auto">
            {lista.map((o) => {
              const marcado = valor.includes(o)
              return (
                <li key={o} role="option" aria-selected={marcado}>
                  <button type="button" onClick={() => onChange(marcado ? valor.filter((x) => x !== o) : [...valor, o])} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-wash">
                    <span className={`grid size-5 shrink-0 place-items-center rounded-md ${marcado ? 'bg-main text-on' : 'ring-1 ring-muted'}`}>{marcado && <Icono n="check" size={13} />}</span>
                    <span className="truncate">{o}</span>
                  </button>
                </li>
              )
            })}
            {lista.length === 0 && <li className="px-2 py-2 text-sm text-muted">Sin resultados</li>}
          </ul>
          {valor.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-bold text-accentink hover:bg-wash">
              Quitar selección
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Años como botones grandes: selección múltiple, vacía = todos. */
export function Anios({ anios, valor, onChange }: { anios: number[]; valor: number[]; onChange: (v: number[]) => void }) {
  return (
    <div role="group" aria-label="Año" className="flex items-center gap-2">
      {anios.map((a) => {
        const on = valor.includes(a)
        return (
          <button
            key={a}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? valor.filter((x) => x !== a) : [...valor, a])}
            className={`cota rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? 'bg-main text-on' : 'bg-white text-ink ring-1 ring-line hover:ring-main'}`}
          >
            {a}
          </button>
        )
      })}
    </div>
  )
}

export function Fila({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
}
