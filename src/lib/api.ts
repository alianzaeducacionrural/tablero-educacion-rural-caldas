import type { RespuestaDatos } from './tipos'

const URL_API = import.meta.env.VITE_API_URL as string | undefined
const CLAVE_CACHE = 'tablero-datos-v1'

/** Sin VITE_API_URL (desarrollo) se lee el JSON local generado por scripts/datos_local.py. */
export const usaDatosLocales = !URL_API
export const hayApi = !!URL_API

export async function pedirDatos(): Promise<RespuestaDatos> {
  const url = URL_API ? `${URL_API}?action=datos` : `${import.meta.env.BASE_URL}datos.local.json`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`No se pudieron leer los datos (HTTP ${r.status})`)
  const j = (await r.json()) as RespuestaDatos
  if (!j.ok) throw new Error(j.error ?? 'Respuesta inválida del servidor de datos')
  if (!j.hojas) throw new Error('El servidor devolvió una respuesta que no son datos. Vuelve a intentarlo.')
  return j
}

export function leerCache(): RespuestaDatos | null {
  try {
    const t = localStorage.getItem(CLAVE_CACHE)
    return t ? (JSON.parse(t) as RespuestaDatos) : null
  } catch {
    return null
  }
}

export function guardarCache(r: RespuestaDatos) {
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(r))
  } catch {
    /* almacenamiento lleno o bloqueado: la app funciona igual */
  }
}

/**
 * Acciones de administración. Se envía como text/plain a propósito: con application/json el navegador
 * hace un preflight OPTIONS que Apps Script no responde y el guardado falla en silencio.
 */
export async function admin<T = Record<string, unknown>>(accion: string, cuerpo: Record<string, unknown>, token: string): Promise<T> {
  if (!URL_API) throw new Error('El panel necesita VITE_API_URL: no hay servidor de datos configurado.')
  const r = await fetch(URL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, action: accion, ...cuerpo }),
  })
  const j = (await r.json()) as { ok: boolean; error?: string; accion?: string } & T
  if (!j.ok) throw new Error(j.error ?? 'Error desconocido')
  // Una respuesta de otra petición (o la de lectura de datos) nunca debe pasar por éxito de esta.
  if (j.accion !== accion) throw new Error('El servidor devolvió una respuesta inesperada. Vuelve a intentarlo.')
  return j
}
