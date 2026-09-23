export interface FilaRanking {
  nombre: string
  valor: number
  /** Segunda medida (p. ej. cantidad de actividades), siempre a la vista junto al valor. */
  cantidad?: number
  color?: string
}

interface Props {
  items: FilaRanking[]
  fmtValor: (n: number) => string
  fmtCantidad?: (n: number) => string
  colorBase: string
  tituloValor?: string
  tituloCantidad?: string
  seleccion?: string[]
  onClic?: (nombre: string) => void
  /** Cuántas filas se muestran; el resto está en la tabla. */
  limite?: number
}

/**
 * Ranking en barras con las dos cifras a la vista: el valor (la barra y su número completo) y la cantidad.
 * Es HTML, no un gráfico de canvas: cada fila es un botón que filtra y se lee con lector de pantalla.
 */
export function RankingBarras({ items, fmtValor, fmtCantidad, colorBase, tituloValor = 'Valor', tituloCantidad = 'Cantidad', seleccion, onClic, limite = 12 }: Props) {
  const max = Math.max(1, ...items.map((i) => i.valor))
  const hay = (seleccion?.length ?? 0) > 0
  const conCantidad = fmtCantidad !== undefined && items.some((i) => i.cantidad !== undefined)
  const cols = conCantidad ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_10.5rem_6.5rem]' : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_10.5rem]'
  return (
    <div>
      <div className={`mb-1 hidden gap-x-4 px-2 text-xs font-bold text-ink2 sm:grid ${cols}`} aria-hidden="true">
        <span />
        <span />
        <span className="text-right">{tituloValor}</span>
        {conCantidad && <span className="text-right">{tituloCantidad}</span>}
      </div>
      <ul>
        {items.slice(0, limite).map((it) => {
          const on = seleccion?.includes(it.nombre)
          return (
            <li key={it.nombre}>
              <button
                type="button"
                onClick={() => onClic?.(it.nombre)}
                aria-pressed={onClic ? !!on : undefined}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1.5 rounded-xl px-2 py-2 text-left transition-opacity hover:bg-white/70 ${cols} ${hay && !on ? 'opacity-45' : ''}`}
              >
                <span className="truncate font-bold" style={{ color: 'var(--ink)' }} title={it.nombre}>
                  {it.nombre}
                </span>
                <span className="order-last col-span-3 h-4 overflow-hidden rounded-full bg-black/5 sm:order-none sm:col-span-1" aria-hidden="true">
                  <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(1.5, (it.valor / max) * 100)}%`, background: it.color ?? colorBase }} />
                </span>
                <span className="cota text-right text-sm font-semibold sm:text-[0.95rem]">{fmtValor(it.valor)}</span>
                {conCantidad && <span className="cota text-right text-sm text-ink2 sm:text-[0.95rem]">{it.cantidad !== undefined ? fmtCantidad!(it.cantidad) : ''}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > limite && <p className="mt-2 px-2 text-xs text-ink2">Los {limite} mayores de {items.length}. La tabla muestra todos.</p>}
    </div>
  )
}
