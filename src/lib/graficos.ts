import type { EChartsCoreOption } from 'echarts/core'
import { tinta, type Tema } from './colores'

export interface Item {
  nombre: string
  valor: number
  color?: string
}

const FUENTE = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function comun(t: Tema) {
  const k = tinta(t)
  return {
    textStyle: { color: k.texto2, fontFamily: FUENTE, fontSize: 12 },
    aria: { enabled: true },
    animationDuration: 250,
    tooltip: {
      backgroundColor: k.superficie,
      borderColor: k.rejilla,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: k.texto, fontSize: 12, fontFamily: FUENTE },
      extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.14);',
      confine: true,
    },
  }
}

/** Texto oscuro sobre fondos claros y blanco sobre oscuros (luminancia relativa WCAG). */
export function textoSobre(hex: string): string {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#0b0b0b' : '#ffffff'
}

/** Alto del contenedor de un gráfico de barras horizontales: incluye el eje, así no hay scroll interno. */
export const altoBarras = (n: number) => Math.max(140, n * 26 + 44)

interface OpcionesBarrasH {
  items: Item[]
  color: string
  tema: Tema
  fmt: (n: number) => string
  fmtEje?: (n: number) => string
  /** Nombres seleccionados: el resto se atenúa (énfasis), como el resaltado cruzado de Power BI. */
  seleccion?: string[]
  etiquetas?: boolean
  anchoEtiqueta?: number
}

export function barrasH(o: OpcionesBarrasH): EChartsCoreOption {
  const k = tinta(o.tema)
  const c = comun(o.tema)
  const items = [...o.items].reverse() // el eje de categorías se dibuja de abajo hacia arriba
  const hay = (o.seleccion?.length ?? 0) > 0
  return {
    ...c,
    grid: { left: 8, right: o.etiquetas ? 76 : 16, top: 6, bottom: 4, containLabel: true },
    tooltip: {
      ...c.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: k.rejilla, opacity: 0.35 } },
      formatter: (p: { name: string; value: number }[]) => `${esc(p[0].name)}<br/><b>${o.fmt(p[0].value)}</b>`,
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: k.suave, formatter: o.fmtEje ?? o.fmt, hideOverlap: true },
      splitLine: { lineStyle: { color: k.rejilla } },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: items.map((i) => i.nombre),
      axisLabel: { color: k.texto2, width: o.anchoEtiqueta ?? 170, overflow: 'truncate' },
      axisLine: { lineStyle: { color: k.eje } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 14,
        data: items.map((i) => ({
          value: i.valor,
          name: i.nombre,
          itemStyle: { color: hay && !o.seleccion!.includes(i.nombre) ? k.gris : (i.color ?? o.color), borderRadius: [0, 4, 4, 0] },
        })),
        label: o.etiquetas ? { show: true, position: 'right', color: k.texto2, fontSize: 11, formatter: (p: { value: number }) => o.fmt(p.value) } : { show: false },
      },
    ],
  }
}

interface SerieCol {
  nombre: string
  color: string
  datos: number[]
}
interface OpcionesColumnas {
  categorias: string[]
  series: SerieCol[]
  tema: Tema
  fmt: (n: number) => string
  fmtEje?: (n: number) => string
  /** Muestra el total encima de cada columna apilada. */
  totales?: boolean
  seleccion?: string[]
}

export function columnas(o: OpcionesColumnas): EChartsCoreOption {
  const k = tinta(o.tema)
  const c = comun(o.tema)
  const apilado = o.series.length > 1
  const totales = o.categorias.map((_, i) => o.series.reduce((s, x) => s + (x.datos[i] ?? 0), 0))
  const hay = (o.seleccion?.length ?? 0) > 0
  const series: Record<string, unknown>[] = o.series.map((s, idx) => ({
    type: 'bar',
    name: s.nombre,
    stack: apilado ? 't' : undefined,
    barMaxWidth: 36,
    itemStyle: { color: s.color },
    data: s.datos.map((v, i) => ({
      value: v,
      itemStyle: {
        color: hay && !o.seleccion!.includes(o.categorias[i]) ? k.gris : s.color,
        borderColor: k.superficie,
        borderWidth: apilado ? 2 : 0,
        borderRadius: !apilado || idx === o.series.length - 1 ? [4, 4, 0, 0] : 0,
      },
    })),
  }))
  if (o.totales && apilado) {
    series.push({
      type: 'bar',
      name: '',
      stack: 't',
      silent: true,
      tooltip: { show: false },
      data: o.categorias.map(() => 0),
      itemStyle: { color: 'transparent' },
      label: { show: true, position: 'top', color: k.texto2, fontSize: 11, formatter: (p: { dataIndex: number }) => o.fmt(totales[p.dataIndex]) },
    })
  } else if (!apilado) {
    ;(series[0] as { label?: unknown }).label = { show: o.categorias.length <= 12, position: 'top', color: k.texto2, fontSize: 11, formatter: (p: { value: number }) => o.fmt(p.value) }
  }
  return {
    ...c,
    grid: { left: 8, right: 12, top: apilado ? 34 : 24, bottom: 4, containLabel: true },
    legend: apilado
      ? { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 14, textStyle: { color: k.texto2, fontSize: 12 }, data: o.series.map((s) => s.nombre) }
      : { show: false },
    tooltip: {
      ...c.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: k.rejilla, opacity: 0.35 } },
      formatter: (p: { name: string; marker: string; seriesName: string; value: number }[]) => {
        const filas = p.filter((x) => x.seriesName)
        const total = filas.reduce((s, x) => s + x.value, 0)
        const cuerpo = filas.map((x) => `${x.marker} ${esc(x.seriesName)}: <b>${o.fmt(x.value)}</b>`).join('<br/>')
        return `${esc(String(p[0].name))}<br/>${cuerpo}${filas.length > 1 ? `<br/>Total: <b>${o.fmt(total)}</b>` : ''}`
      },
    },
    xAxis: {
      type: 'category',
      data: o.categorias,
      axisLabel: { color: k.texto2, interval: 0, width: 96, overflow: 'break' },
      axisLine: { lineStyle: { color: k.eje } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: k.suave, formatter: o.fmtEje ?? o.fmt },
      splitLine: { lineStyle: { color: k.rejilla } },
      axisLine: { show: false },
    },
    series,
  }
}

interface OpcionesApilada100 {
  filas: { nombre: string; partes: { nombre: string; valor: number; color: string }[] }[]
  tema: Tema
  fmt: (n: number) => string
}

/** Barras horizontales apiladas al 100 %: composición de una fila (p. ej. aporte por fuente). */
export function apiladaH(o: OpcionesApilada100): EChartsCoreOption {
  const k = tinta(o.tema)
  const c = comun(o.tema)
  const nombres = [...new Set(o.filas.flatMap((f) => f.partes.map((p) => p.nombre)))]
  const totales = o.filas.map((f) => f.partes.reduce((s, p) => s + p.valor, 0) || 1)
  const filas = [...o.filas].reverse()
  const tot = [...totales].reverse()
  return {
    ...c,
    grid: { left: 8, right: 12, top: 30, bottom: 4, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 14, textStyle: { color: k.texto2, fontSize: 12 } },
    tooltip: {
      ...c.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: k.rejilla, opacity: 0.35 } },
      formatter: (p: { name: string; marker: string; seriesName: string; data: { real: number } }[]) =>
        `${esc(p[0].name)}<br/>${p.map((x) => `${x.marker} ${esc(x.seriesName)}: <b>${o.fmt(x.data.real)}</b>`).join('<br/>')}`,
    },
    xAxis: { type: 'value', max: 1, show: false },
    yAxis: { type: 'category', data: filas.map((f) => f.nombre), axisLabel: { color: k.texto2, fontWeight: 500 }, axisLine: { show: false }, axisTick: { show: false } },
    series: nombres.map((n) => ({
      type: 'bar',
      name: n,
      stack: 'p',
      barWidth: 22,
      itemStyle: { color: o.filas.flatMap((f) => f.partes).find((p) => p.nombre === n)?.color ?? k.gris },
      data: filas.map((f, i) => {
        const parte = f.partes.find((p) => p.nombre === n)
        return { value: (parte?.valor ?? 0) / tot[i], real: parte?.valor ?? 0, itemStyle: { color: parte?.color ?? k.gris, borderColor: k.superficie, borderWidth: 2, borderRadius: 4 } }
      }),
      label: {
        show: true,
        fontSize: 11,
        fontWeight: 600,
        color: textoSobre(o.filas.flatMap((f) => f.partes).find((p) => p.nombre === n)?.color ?? '#888888'),
        formatter: (p: { value: number }) => (p.value >= 0.1 ? `${(p.value * 100).toFixed(1).replace('.', ',')} %` : ''),
      },
    })),
  }
}

interface OpcionesSankey {
  nodos: { name: string; color: string }[]
  enlaces: { source: string; target: string; value: number }[]
  tema: Tema
  fmt: (n: number) => string
  angosto?: boolean
}

export function sankey(o: OpcionesSankey): EChartsCoreOption {
  const k = tinta(o.tema)
  const c = comun(o.tema)
  return {
    ...c,
    tooltip: {
      ...c.tooltip,
      trigger: 'item',
      formatter: (p: { dataType: string; name: string; value: number; data: { source?: string; target?: string } }) =>
        p.dataType === 'edge' ? `${esc(p.data.source ?? '')} → ${esc(p.data.target ?? '')}<br/><b>${o.fmt(p.value)}</b>` : `${esc(p.name)}<br/><b>${o.fmt(p.value)}</b>`,
    },
    series: [
      {
        type: 'sankey',
        left: 8,
        right: o.angosto ? 118 : 210,
        top: 8,
        bottom: 8,
        nodeWidth: 14,
        nodeGap: 10,
        draggable: false,
        emphasis: { focus: 'adjacency' },
        data: o.nodos.map((n) => ({ name: n.name, itemStyle: { color: n.color, borderWidth: 0 } })),
        links: o.enlaces,
        lineStyle: { color: 'source', opacity: 0.32, curveness: 0.5 },
        label: { color: k.texto, fontSize: o.angosto ? 11 : 12, fontFamily: FUENTE, width: o.angosto ? 112 : 200, overflow: 'truncate' },
      },
    ],
  }
}
