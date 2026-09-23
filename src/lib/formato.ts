const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0, useGrouping: 'always' })
const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1, useGrouping: 'always' })

/** Pesos completos: $5.812.501.195 */
export const cop = (v: number) => '$' + entero.format(Math.round(v))

/** Millones de pesos: $5.812 M (con un decimal por debajo de 10 M). */
export function copM(v: number): string {
  const m = v / 1e6
  const s = Math.abs(m) < 10 ? decimal.format(m) : entero.format(Math.round(m))
  return '$' + s + ' M'
}

/** Eje de valor: sin el símbolo $, en millones. */
export const ejeM = (v: number) => (v === 0 ? '0' : entero.format(v / 1e6) + ' M')

export const num = (v: number) => entero.format(Math.round(v))
export const num1 = (v: number) => decimal.format(v)

export const pct = (v: number, dec = 1) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v * 100) + ' %'

/** Cantidad con hasta 1 decimal solo si hace falta (hay prorrateos). */
export const cant = (v: number) => (Number.isInteger(v) ? num(v) : decimal.format(v))
