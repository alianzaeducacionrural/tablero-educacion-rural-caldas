import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Tema } from './colores'

interface Ctx {
  tema: Tema
  alternar: () => void
}
const TemaCtx = createContext<Ctx | null>(null)

const guardado = (): Tema | null => {
  // Un enlace con ?tema=light o ?tema=dark manda sobre lo guardado.
  const q = new URLSearchParams(window.location.search).get('tema')
  if (q === 'light' || q === 'dark') return q
  try {
    const t = localStorage.getItem('tema')
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}
const delSistema = (): Tema => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function TemaProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<Tema | null>(guardado)
  const [sistema, setSistema] = useState<Tema>(delSistema)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const f = () => setSistema(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  useEffect(() => {
    if (pref) document.documentElement.setAttribute('data-theme', pref)
    else document.documentElement.removeAttribute('data-theme')
  }, [pref])

  const tema = pref ?? sistema
  const valor = useMemo<Ctx>(
    () => ({
      tema,
      alternar: () => {
        const nuevo: Tema = tema === 'dark' ? 'light' : 'dark'
        setPref(nuevo)
        try {
          localStorage.setItem('tema', nuevo)
        } catch {
          /* sin almacenamiento: el cambio dura la sesión */
        }
      },
    }),
    [tema],
  )
  return <TemaCtx.Provider value={valor}>{children}</TemaCtx.Provider>
}

export function useTema() {
  const c = useContext(TemaCtx)
  if (!c) throw new Error('useTema fuera de TemaProvider')
  return c
}
