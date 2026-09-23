import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { alfa } from '../lib/agregar'

/** Interruptor segmentado: p. ej. Valor ⇄ Cantidad. */
export function Segmentado<T extends string>({ opciones, valor, onChange, etiqueta }: { opciones: { id: T; texto: string }[]; valor: T; onChange: (v: T) => void; etiqueta: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex rounded-lg border border-line bg-wash p-0.5">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${valor === o.id ? 'bg-surface text-ink shadow-sm' : 'text-ink2 hover:text-ink'}`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/** Lista desplegable con selección múltiple y búsqueda. Vacía = todos. */
export function MultiSelect({ etiqueta, opciones, valor, onChange, ancho = 'w-64' }: { etiqueta: string; opciones: string[]; valor: string[]; onChange: (v: string[]) => void; ancho?: string }) {
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

  const resumen = valor.length === 0 ? 'Todos' : valor.length === 1 ? valor[0] : `${valor.length} seleccionados`

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${valor.length ? 'border-accent bg-wash text-ink' : 'border-line bg-surface text-ink2'} hover:text-ink`}
      >
        <span className="text-muted">{etiqueta}</span>
        <span className="max-w-40 truncate font-medium text-ink">{resumen}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-muted">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierto && (
        <div className={`absolute left-0 z-30 mt-1 ${ancho} rounded-xl border border-line bg-surface p-2 shadow-lg`}>
          {opciones.length > 8 && (
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar ${etiqueta.toLowerCase()}…`}
              aria-label={`Buscar ${etiqueta}`}
              className="mb-2 w-full rounded-md border border-line bg-page px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          )}
          <ul id={id} role="listbox" aria-multiselectable="true" aria-label={etiqueta} className="max-h-64 overflow-auto">
            {lista.map((o) => {
              const marcado = valor.includes(o)
              return (
                <li key={o} role="option" aria-selected={marcado}>
                  <button type="button" onClick={() => onChange(marcado ? valor.filter((x) => x !== o) : [...valor, o])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-wash">
                    <span className={`grid size-4 shrink-0 place-items-center rounded border ${marcado ? 'border-accent bg-accent text-white' : 'border-axis'}`}>
                      {marcado && (
                        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                          <path d="M1.5 5.2l2.4 2.4 4.6-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{o}</span>
                  </button>
                </li>
              )
            })}
            {lista.length === 0 && <li className="px-2 py-2 text-sm text-muted">Sin resultados</li>}
          </ul>
          {valor.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-accentink hover:bg-wash">
              Quitar selección
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Botones de año: selección múltiple, vacía = todos. */
export function Anios({ anios, valor, onChange }: { anios: number[]; valor: number[]; onChange: (v: number[]) => void }) {
  return (
    <div role="group" aria-label="Año" className="flex items-center gap-1.5">
      <span className="text-sm text-muted">Año</span>
      {anios.map((a) => {
        const on = valor.includes(a)
        return (
          <button
            key={a}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? valor.filter((x) => x !== a) : [...valor, a])}
            className={`tabular rounded-lg border px-3 py-1.5 text-sm font-medium ${on ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink2 hover:text-ink'}`}
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
