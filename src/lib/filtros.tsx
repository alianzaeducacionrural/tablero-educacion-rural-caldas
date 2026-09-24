import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** Filtros globales: se conservan al cambiar de página (y al recargar, durante la sesión). */
interface Ctx {
  anios: number[]
  municipios: string[]
  setAnios: (v: number[]) => void
  setMunicipios: (v: string[]) => void
  limpiar: () => void
  activos: number
}
const FiltrosCtx = createContext<Ctx | null>(null)
const CLAVE = 'tablero-filtros-v1'
/** Año activo por defecto en la primera visita de la sesión (la vigencia en curso). */
const ANIO_PREDETERMINADO = [2026]

function leer(): { anios: number[]; municipios: string[] } {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    if (!crudo) return { anios: ANIO_PREDETERMINADO, municipios: [] }
    const j = JSON.parse(crudo) as { anios?: number[]; municipios?: string[] }
    return { anios: Array.isArray(j.anios) ? j.anios : ANIO_PREDETERMINADO, municipios: Array.isArray(j.municipios) ? j.municipios : [] }
  } catch {
    return { anios: ANIO_PREDETERMINADO, municipios: [] }
  }
}

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const [inicial] = useState(leer)
  const [anios, setAnios] = useState<number[]>(inicial.anios)
  const [municipios, setMunicipios] = useState<string[]>(inicial.municipios)

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify({ anios, municipios }))
    } catch {
      /* sin almacenamiento */
    }
  }, [anios, municipios])

  const valor = useMemo<Ctx>(
    () => ({
      anios,
      municipios,
      setAnios,
      setMunicipios,
      limpiar: () => {
        setAnios([])
        setMunicipios([])
      },
      activos: (anios.length ? 1 : 0) + (municipios.length ? 1 : 0),
    }),
    [anios, municipios],
  )
  return <FiltrosCtx.Provider value={valor}>{children}</FiltrosCtx.Provider>
}

export function useFiltros() {
  const c = useContext(FiltrosCtx)
  if (!c) throw new Error('useFiltros fuera de FiltrosProvider')
  return c
}

/** Alterna un valor dentro de una selección múltiple. */
export function alternar<T>(lista: T[], v: T): T[] {
  return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]
}
