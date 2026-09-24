import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption, ECharts } from 'echarts/core'
import { BarChart, MapChart, PieChart, SunburstChart } from 'echarts/charts'
import { AriaComponent, GraphicComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import caldas from '../data/caldas.json'

echarts.use([BarChart, MapChart, PieChart, SunburstChart, AriaComponent, GraphicComponent, GridComponent, LegendComponent, TooltipComponent, LabelLayout, CanvasRenderer])
// Contornos de los 27 municipios de Caldas (DANE, vía geoBoundaries CC BY 4.0): ver scripts/mapa_caldas.py
echarts.registerMap('caldas', caldas as unknown as Parameters<typeof echarts.registerMap>[1])

interface Props {
  opcion: EChartsCoreOption
  alto: number | string
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

  return (
    <div className="w-full rounded-3xl bg-white p-4 ring-1 ring-line sm:p-5">
      <div ref={ref} role="img" aria-label={etiqueta} style={{ height: alto, cursor: alClic ? 'pointer' : 'default' }} className="w-full" />
    </div>
  )
}
