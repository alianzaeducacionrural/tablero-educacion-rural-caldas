export interface Par {
  nombre: string
  valor: number
}

export const sumar = <T,>(filas: T[], v: (f: T) => number) => filas.reduce((s, f) => s + v(f), 0)
export const unicos = <T,>(filas: T[], c: (f: T) => string) => new Set(filas.map(c))
export const alfa = (a: string, b: string) => a.localeCompare(b, 'es')

/** Suma `valor` por `clave` y ordena de mayor a menor. */
export function agrupar<T>(filas: T[], clave: (f: T) => string, valor: (f: T) => number): Par[] {
  const m = new Map<string, number>()
  filas.forEach((f) => m.set(clave(f), (m.get(clave(f)) ?? 0) + valor(f)))
  return [...m.entries()].map(([nombre, v]) => ({ nombre, valor: v })).sort((a, b) => b.valor - a.valor || alfa(a.nombre, b.nombre))
}

export const top = (pares: Par[], n: number) => pares.slice(0, n)

/** Descarga un CSV (con BOM para que Excel respete las tildes). */
export function descargarCsv(nombre: string, columnas: string[], filas: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const texto = [columnas, ...filas].map((r) => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
