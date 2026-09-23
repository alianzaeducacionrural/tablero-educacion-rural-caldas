import { useMemo, useState } from 'react'
import { alfa, descargarCsv } from '../lib/agregar'
import { cant, cop, num, pct } from '../lib/formato'
import { Icono } from './Icono'

export interface Col {
  clave: string
  titulo: string
  tipo?: 'texto' | 'moneda' | 'numero' | 'cantidad' | 'pct'
}
export type FilaTabla = Record<string, string | number>
export interface TablaDatos {
  columnas: Col[]
  filas: FilaTabla[]
  archivo?: string
}

const formatear = (v: string | number | undefined, tipo: Col['tipo']) => {
  if (v === undefined || v === '') return ''
  if (typeof v === 'string') return v
  if (tipo === 'moneda') return cop(v)
  if (tipo === 'pct') return pct(v)
  if (tipo === 'cantidad') return cant(v)
  return num(v)
}

/** Tabla ordenable: es el equivalente accesible de cada visual y permite descargar los datos. */
export function Tabla({ columnas, filas, archivo = 'datos' }: TablaDatos) {
  const [orden, setOrden] = useState<{ clave: string; asc: boolean } | null>(null)
  const ordenadas = useMemo(() => {
    if (!orden) return filas
    const { clave, asc } = orden
    return [...filas].sort((a, b) => {
      const x = a[clave]
      const y = b[clave]
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : alfa(String(x ?? ''), String(y ?? ''))
      return asc ? r : -r
    })
  }, [filas, orden])

  return (
    <div>
      <div className="max-h-96 overflow-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-white">
            <tr>
              {columnas.map((c) => {
                const activa = orden?.clave === c.clave
                return (
                  <th key={c.clave} scope="col" aria-sort={activa ? (orden!.asc ? 'ascending' : 'descending') : 'none'} className={`border-b-2 border-main px-3 py-2.5 font-bold text-ink ${c.tipo && c.tipo !== 'texto' ? 'text-right' : 'text-left'}`}>
                    <button type="button" onClick={() => setOrden({ clave: c.clave, asc: activa ? !orden!.asc : c.tipo === 'texto' || !c.tipo })} className="inline-flex items-center gap-1 hover:text-accentink">
                      {c.titulo}
                      {activa && <Icono n={orden!.asc ? 'arriba' : 'abajo'} size={12} />}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((f, i) => (
              <tr key={i} className="border-b border-line last:border-0 hover:bg-wash/60">
                {columnas.map((c) => (
                  <td key={c.clave} className={`px-3 py-1.5 ${c.tipo && c.tipo !== 'texto' ? 'cota text-right' : ''}`}>
                    {formatear(f[c.clave], c.tipo)}
                  </td>
                ))}
              </tr>
            ))}
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="px-3 py-6 text-center text-muted">
                  Sin datos con los filtros actuales
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-ink2">
        <span>{num(filas.length)} filas</span>
        <button type="button" onClick={() => descargarCsv(`${archivo}.csv`, columnas.map((c) => c.titulo), ordenadas.map((f) => columnas.map((c) => f[c.clave] ?? '')))} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-accentink hover:bg-wash">
          <Icono n="descargar" size={14} />
          Descargar CSV
        </button>
      </div>
    </div>
  )
}
