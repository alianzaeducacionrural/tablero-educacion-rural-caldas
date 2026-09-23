import type { Programa } from './tipos'

export type Tema = 'light' | 'dark'

/** Paleta validada con validate_palette.js (ver dataviz/references/palette.md). */
const SERIE: Record<Tema, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

const TINTA = {
  light: { superficie: '#fcfcfb', texto: '#0b0b0b', texto2: '#52514e', suave: '#898781', rejilla: '#e1e0d9', eje: '#c3c2b7', gris: '#c3c2b7' },
  dark: { superficie: '#1a1a19', texto: '#ffffff', texto2: '#c3c2b7', suave: '#898781', rejilla: '#2c2c2a', eje: '#383835', gris: '#4d4d49' },
}

export const tinta = (t: Tema) => TINTA[t]
export const serie = (t: Tema, i: number) => SERIE[t][i % SERIE[t].length]

/** El color sigue a la entidad, no a su posición: filtrar no repinta a las demás. */
export const colorPrograma = (t: Tema, p: Programa) => serie(t, p === 'mf' ? 0 : 1)

export function colorAportante(t: Tema, aportante: string): string {
  if (/depto|departamento|gobernaci/i.test(aportante)) return serie(t, 6) // violeta
  if (/comit/i.test(aportante)) return serie(t, 2) // aqua
  return TINTA[t].gris
}

/** Estados de un estudiante: estado real, con etiqueta visible siempre (nunca solo color). */
export function colorEstadoEstudiante(t: Tema, estado: string): string {
  if (/gradu/i.test(estado) && !/pendiente/i.test(estado)) return '#0ca30c'
  if (/pendiente/i.test(estado)) return '#fab219'
  if (/desert/i.test(estado)) return '#d03b3b'
  return serie(t, 0)
}

export function colorEstadoActividad(t: Tema, estado: string, programa: Programa): string {
  if (/^convenio$/i.test(estado)) return colorPrograma(t, programa)
  if (/reinvers/i.test(estado)) return TINTA[t].gris
  return TINTA[t].suave
}
