import { useEffect, type ReactNode } from 'react'
import { Icono } from './Icono'

/** Ventana modal centrada: Escape y el fondo la cierran. */
export function Modal({ titulo, subtitulo, onCerrar, children }: { titulo: string; subtitulo?: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', tecla)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = previo
    }
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-4" role="presentation" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="display text-3xl" style={{ color: 'var(--ink)' }}>
              {titulo}
            </h2>
            {subtitulo && <p className="mt-1 text-sm text-ink2">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 rounded-full p-2.5 text-ink2 ring-1 ring-line hover:bg-wash">
            <Icono n="cerrar" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
