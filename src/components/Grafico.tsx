import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption, ECharts } from 'echarts/core'
import { BarChart, SankeyChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent, AriaComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, SankeyChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, CanvasRenderer])

interface Props {
  opcion: EChartsCoreOption
  alto: number
  /** Texto para lectores de pantalla. */
  etiqueta: string
  alClic?: (nombre: string) => void
}

export function Grafico({ opcion, alto, etiqueta, alClic }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<ECharts | null>(null)
  const clic = useRef(alClic)
  useEffect(() => {
    clic.current = alClic
  }, [alClic])

  useEffect(() => {
    if (!ref.current) return
    const c = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    chart.current = c
    c.on('click', (p) => {
      const nombre = (p as { name?: string }).name
      if (nombre && clic.current) clic.current(nombre)
    })
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      c.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(opcion, true)
  }, [opcion])

  return <div ref={ref} role="img" aria-label={etiqueta} style={{ height: alto, cursor: alClic ? 'pointer' : 'default' }} className="w-full" />
}
