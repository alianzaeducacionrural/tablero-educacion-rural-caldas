import type { ReactNode } from 'react'

/** Iconos dibujados con un solo trazo (1.9) y extremos redondeados. */
const D: Record<string, ReactNode> = {
  check: <path d="M4 12.5l5 5 11-11" />,
  arriba: <path d="M12 19V6M6 11l6-6 6 6" />,
  abajo: <path d="M12 5v13M6 13l6 6 6-6" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  derecha: <path d="M9 6l6 6-6 6" />,
  descargar: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  tabla: <path d="M4 6h16M4 12h16M4 18h16M9 6v12" />,
  grafico: <path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-7" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  buscar: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.2-4.2" /></>,
  refrescar: <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" />,
  vertice: <><path d="M12 4l8 15H4z" /><circle cx="12" cy="14.5" r="1.4" fill="currentColor" /></>,
  encurso: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  pareja: <path d="M5 12h14M12 5v14" />,
  filtro: <path d="M4 5h16l-6.2 7.4V19l-3.6 1.6v-8.2z" />,
}

export function Icono({ n, size = 16, className = '' }: { n: keyof typeof D; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {D[n]}
    </svg>
  )
}
