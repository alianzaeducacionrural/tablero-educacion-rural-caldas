import { useEffect, useState } from 'react'

/** ¿La pantalla es estrecha (móvil)? Se actualiza al girar o cambiar el tamaño. */
export function useAngosto(px = 640) {
  const [a, setA] = useState(() => window.matchMedia(`(max-width:${px}px)`).matches)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${px}px)`)
    const f = () => setA(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [px])
  return a
}
