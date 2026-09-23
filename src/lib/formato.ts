const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0, useGrouping: 'always' })
const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1, useGrouping: 'always' })

/** Pesos completos: $5.812.501.195 */
export const cop = (v: number) => '$' + entero.format(Math.round(v))

export const num = (v: number) => entero.format(Math.round(v))
export const num1 = (v: number) => decimal.format(v)

export const pct = (v: number, dec = 1) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v * 100) + ' %'

const dosDecimales = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, useGrouping: 'always' })
/** Cantidad completa: con hasta 2 decimales solo si hace falta (hay prorrateos). */
export const cant = (v: number) => (Number.isInteger(v) ? num(v) : dosDecimales.format(v))
