import { useState, type ReactNode } from 'react'
import { Segmentado } from './controles'
import { Tabla, type TablaDatos } from './Tabla'

interface KpiProps {
  titulo: string
  valor: string
  detalle?: ReactNode
  /** Cifra principal del tablero: tamaño de titular. */
  heroe?: boolean
}

export function Kpi({ titulo, valor, detalle, heroe }: KpiProps) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-4 ${heroe ? 'sm:col-span-2' : ''}`}>
      <div className="text-sm text-ink2">{titulo}</div>
      <div className={`mt-1 font-semibold leading-tight tracking-tight text-ink ${heroe ? 'text-5xl' : 'text-3xl'}`}>{valor}</div>
      {detalle && <div className="mt-1.5 text-sm text-ink2">{detalle}</div>}
    </div>
  )
}

const COLUMNAS = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

export function Kpis({ children, columnas = 4 }: { children: ReactNode; columnas?: 3 | 4 | 5 }) {
  return <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${COLUMNAS[columnas]}`}>{children}</div>
}

interface CardProps {
  titulo: string
  nota?: ReactNode
  tabla?: TablaDatos
  children: ReactNode
  className?: string
  acciones?: ReactNode
}

/** Tarjeta de gráfico. Todo gráfico tiene su tabla equivalente (lectores de pantalla, CSV, valores exactos). */
export function Tarjeta({ titulo, nota, tabla, children, className = '', acciones }: CardProps) {
  const [vista, setVista] = useState<'grafico' | 'tabla'>('grafico')
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">{titulo}</h2>
          {nota && <p className="mt-0.5 text-sm text-ink2">{nota}</p>}
        </div>
        <div className="flex items-center gap-2">
          {acciones}
          {tabla && (
            <Segmentado
              etiqueta={`Vista de ${titulo}`}
              valor={vista}
              onChange={setVista}
              opciones={[
                { id: 'grafico', texto: 'Gráfico' },
                { id: 'tabla', texto: 'Tabla' },
              ]}
            />
          )}
        </div>
      </header>
      {vista === 'tabla' && tabla ? <Tabla {...tabla} /> : children}
    </section>
  )
}

export function Cargando({ texto = 'Cargando datos…' }: { texto?: string }) {
  return (
    <div role="status" className="grid min-h-64 place-items-center text-ink2">
      <div className="flex items-center gap-3">
        <span className="size-4 animate-spin rounded-full border-2 border-axis border-t-accent" aria-hidden="true" />
        {texto}
      </div>
    </div>
  )
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'error'; children: ReactNode }) {
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${tipo === 'error' ? 'border-bad text-ink' : 'border-line bg-wash text-ink2'}`}>
      {children}
    </div>
  )
}
