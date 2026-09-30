import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption, ECharts } from 'echarts/core'
import { BarChart, MapChart, PieChart, SunburstChart } from 'echarts/charts'
import { AriaComponent, GraphicComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import caldas from '../data/caldas.json'
import { Icono } from './Icono'

echarts.use([BarChart, MapChart, PieChart, SunburstChart, AriaComponent, GraphicComponent, GridComponent, LegendComponent, TooltipComponent, LabelLayout, CanvasRenderer])
// Contornos de los 27 municipios de Caldas (DANE, vía geoBoundaries CC BY 4.0): ver scripts/mapa_caldas.py
echarts.registerMap('caldas', caldas as unknown as Parameters<typeof echarts.registerMap>[1])

/** Nombre de archivo a partir del texto accesible del gráfico. */
function archivoDe(etiqueta: string): string {
  const s = etiqueta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
  return (s || 'grafico') + '.png'
}

interface Props {
  opcion: EChartsCoreOption
  alto: number | string
  /** Texto para lectores de pantalla. */
  etiqueta: string
  alClic?: (nombre: string) => void
  /** El mapa ya tiene su propia silueta suelta: no lo encierra en un recuadro. */
  sinRecuadro?: boolean
}

export function Grafico({ opcion, alto, etiqueta, alClic, sinRecuadro }: Props) {
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

  const descargar = () => {
    const url = chart.current?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = archivoDe(etiqueta)
    a.click()
  }

  const grafico = (
    <div className="relative h-full w-full" style={{ height: alto }}>
      <div ref={ref} role="img" aria-label={etiqueta} style={{ height: alto, cursor: alClic ? 'pointer' : 'default' }} className="h-full w-full" />
      <button type="button" onClick={descargar} aria-label={`Descargar «${etiqueta}» como imagen`} title="Descargar como imagen" className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-ink2 shadow ring-1 ring-line transition-colors hover:bg-white hover:text-accentink">
        <Icono n="descargar" size={14} />
      </button>
    </div>
  )
  if (sinRecuadro) return grafico
  return <div className="w-full rounded-3xl bg-white p-4 ring-1 ring-line sm:p-5">{grafico}</div>
}
