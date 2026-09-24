import * as XLSX from 'xlsx'
import type { TablaDatos } from '../components/Tabla'

export interface HojaExcel {
  /** Nombre de la pestaña dentro del Excel. */
  nombre: string
  tabla: TablaDatos
}

/** Nombre de hoja válido para Excel: máx. 31 caracteres, sin : \ / ? * [ ], sin repetir. */
function nombreValido(s: string, usados: Set<string>): string {
  const base = (s.replace(/[:\\/?*[\]]/g, ' ').trim() || 'Hoja').slice(0, 31)
  let n = base
  let i = 2
  while (usados.has(n.toLowerCase())) {
    const sufijo = ` (${i++})`
    n = base.slice(0, 31 - sufijo.length) + sufijo
  }
  usados.add(n.toLowerCase())
  return n
}

/** Descarga un libro de Excel con una hoja por sección: valores nativos (número o texto), no texto ya formateado. */
export function descargarExcel(nombreArchivo: string, hojas: HojaExcel[]) {
  const wb = XLSX.utils.book_new()
  const usados = new Set<string>()

  hojas.forEach(({ nombre, tabla }) => {
    if (tabla.filas.length === 0) return
    const filas = tabla.filas.map((f) => {
      const o: Record<string, string | number> = {}
      tabla.columnas.forEach((c) => {
        o[c.titulo] = f[c.clave] ?? ''
      })
      return o
    })
    const ws = XLSX.utils.json_to_sheet(filas)

    tabla.columnas.forEach((c, idx) => {
      if (c.tipo !== 'moneda' && c.tipo !== 'pct') return
      const formato = c.tipo === 'moneda' ? '#,##0' : '0.0%'
      for (let r = 0; r < filas.length; r++) {
        const celda = ws[XLSX.utils.encode_cell({ r: r + 1, c: idx })]
        if (celda && typeof celda.v === 'number') celda.z = formato
      }
    })
    ws['!cols'] = tabla.columnas.map((c) => ({ wch: Math.max(c.titulo.length + 2, 14) }))

    XLSX.utils.book_append_sheet(wb, ws, nombreValido(nombre, usados))
  })

  if (wb.SheetNames.length === 0) return
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
}
