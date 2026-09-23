import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { guardarCache, leerCache, pedirDatos } from './api'
import { normalizar, parsear } from './normalizar'
import type { Datos, RespuestaDatos } from './tipos'

interface Ctx {
  estado: 'cargando' | 'listo' | 'error'
  /** Datos ya normalizados: lo que se grafica. */
  datos: Datos | null
  /** Datos tal como están en el Sheet: lo que usa el panel para detectar duplicados. */
  crudo: Datos | null
  error: string | null
  actualizando: boolean
  refrescar: () => Promise<void>
}

const DatosCtx = createContext<Ctx | null>(null)

export function DatosProvider({ children }: { children: ReactNode }) {
  const [resp, setResp] = useState<RespuestaDatos | null>(() => leerCache())
  const [error, setError] = useState<string | null>(null)
  const [actualizando, setActualizando] = useState(false)

  const refrescar = useCallback(async () => {
    setActualizando(true)
    try {
      const r = await pedirDatos()
      setResp(r)
      guardarCache(r)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActualizando(false)
    }
  }, [])

  // Se pinta de inmediato con el caché local (si hay) y se actualiza por detrás, sin saltos de diseño.
  useEffect(() => {
    void refrescar()
  }, [refrescar])

  const crudo = useMemo(() => (resp ? parsear(resp) : null), [resp])
  const datos = useMemo(() => (crudo ? normalizar(crudo) : null), [crudo])
  const estado = datos ? 'listo' : error ? 'error' : 'cargando'

  const valor = useMemo(() => ({ estado, datos, crudo, error, actualizando, refrescar }) as Ctx, [estado, datos, crudo, error, actualizando, refrescar])
  return <DatosCtx.Provider value={valor}>{children}</DatosCtx.Provider>
}

export function useDatos() {
  const c = useContext(DatosCtx)
  if (!c) throw new Error('useDatos fuera de DatosProvider')
  return c
}
