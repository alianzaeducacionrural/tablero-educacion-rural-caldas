import type { EChartsCoreOption } from 'echarts/core'
import { TINTA, textoSobre, type Placa } from './colores'

const FUENTE = "'Albert Sans Variable', system-ui, sans-serif"
const MONO = "'Spline Sans Mono Variable', ui-monospace, monospace"
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function comun() {
  return {
    textStyle: { color: TINTA.texto2, fontFamily: FUENTE, fontSize: 12 },
    aria: { enabled: true },
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    animationDurationUpdate: 600,
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: TINTA.linea,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: TINTA.texto, fontSize: 13, fontFamily: FUENTE },
      extraCssText: 'border-radius:12px;box-shadow:0 8px 24px rgba(29,26,74,.16);',
      confine: true,
    },
  }
}

/** Tamaño de letra para que `texto` quepa en un hueco de `hueco` px, sin pasar de `base`. */
const tam = (texto: string, hueco: number, base: number) => Math.max(11, Math.min(base, Math.floor(hueco / (texto.length * 0.58))))

/** Mezcla un color con blanco: t=0 el color, t=1 blanco. */
export function aclarar(hex: string, t: number): string {
  const c = hex.replace('#', '')
  const m = [0, 2, 4].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - t) + 255 * t))
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/* ------------------------------------------------------------------ mapa */

export const BANDAS = 7

/** Banda (0..6) de un valor: raíz cuadrada para que los municipios pequeños no se pierdan en el color más claro. */
export const bandaDe = (valor: number, max: number) => Math.min(BANDAS - 1, Math.floor(Math.sqrt(Math.max(0, valor) / (max || 1)) * BANDAS))
/** Valor donde empieza la banda i. */
export const inicioBanda = (i: number, max: number) => max * Math.pow(i / BANDAS, 2)

interface OpcionesMapa {
  datos: { name: string; value: number }[]
  placa: Placa
  fmt: (n: number) => string
  seleccion: string[]
  sinDatos?: string[]
  /** Solo se pintan los municipios de esta banda; el resto queda atenuado. */
  banda?: number | null
  max?: number
  /** Segunda línea del tooltip por municipio (p. ej. la cantidad). */
  extra?: Record<string, string>
}

export function mapa(o: OpcionesMapa): EChartsCoreOption {
  const c = comun()
  const max = o.max ?? Math.max(1, ...o.datos.map((d) => d.value))
  const item = (name: string, value: number | null, selected: boolean) => {
    const sin = value === null
    const b = sin ? -1 : bandaDe(value!, max)
    const atenuado = o.banda != null && !sin && b !== o.banda
    const color = sin ? TINTA.vacio : atenuado ? '#EDEAF6' : o.placa.escala[b]
    const realce = { areaColor: color, borderColor: TINTA.texto, borderWidth: 3 }
    return {
      name,
      value: value ?? undefined,
      selected,
      itemStyle: { areaColor: color, borderColor: '#ffffff', borderWidth: 1.6 },
      emphasis: { itemStyle: realce, label: { show: true, color: TINTA.texto, fontWeight: 700 } },
      select: { itemStyle: realce, label: { show: true, color: TINTA.texto, fontWeight: 700 } },
    }
  }
  return {
    ...c,
    tooltip: {
      ...c.tooltip,
      trigger: 'item',
      formatter: (p: { name: string; value?: number }) => `<b>${esc(p.name)}</b><br/>${typeof p.value === 'number' && !isNaN(p.value) ? o.fmt(p.value) : 'Sin datos en este tablero'}${o.extra?.[p.name] ? `<br/>${esc(o.extra[p.name])}` : ''}`,
    },
    series: [
      {
        type: 'map',
        map: 'caldas',
        nameProperty: 'nombre',
        aspectScale: 1,
        roam: false,
        selectedMode: 'multiple',
        left: 4,
        right: 4,
        top: 4,
        bottom: 4,
        animationDurationUpdate: 700,
        label: { show: true, fontSize: 10, fontFamily: FUENTE, color: TINTA.texto, textBorderColor: 'rgba(255,255,255,0.9)', textBorderWidth: 3 },
        labelLayout: { hideOverlap: true },
        data: [...o.datos.map((d) => item(d.name, d.value, o.seleccion.includes(d.name))), ...(o.sinDatos ?? []).map((n) => item(n, null, false))],
      },
    ],
  }
}

/* ------------------------------------------------------------------ barras */

export interface Item {
  nombre: string
  valor: number
  color?: string
}

/** Alto del contenedor de barras horizontales: una fila por elemento. */
export const altoBarras = (n: number) => Math.max(150, n * 36 + 16)

interface OpcionesBarrasH {
  items: Item[]
  color: string
  fmt: (n: number) => string
  /** Nombres elegidos: el resto se atenúa (resaltado cruzado). */
  seleccion?: string[]
  /** Ancho reservado para el nombre a la izquierda. */
  ancho?: number
  /** Ancho reservado a la derecha para el valor completo. */
  derecha?: number
}

/** Barras horizontales con el valor completo al final de cada una. */
export function barrasH(o: OpcionesBarrasH): EChartsCoreOption {
  const c = comun()
  const items = [...o.items].reverse() // el eje de categorías se dibuja de abajo hacia arriba
  const hay = (o.seleccion?.length ?? 0) > 0
  return {
    ...c,
    grid: { left: 4, right: o.derecha ?? 128, top: 2, bottom: 2, containLabel: true },
    tooltip: {
      ...c.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(29,26,74,0.05)' } },
      formatter: (p: { name: string; value: number }[]) => `${esc(p[0].name)}<br/><b>${o.fmt(p[0].value)}</b>`,
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: items.map((i) => i.nombre),
      axisLabel: { color: TINTA.texto, fontWeight: 600, fontSize: 13, width: o.ancho ?? 170, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 18,
        showBackground: true,
        backgroundStyle: { color: 'rgba(29,26,74,0.06)', borderRadius: 9 },
        data: items.map((i) => ({
          value: i.valor,
          name: i.nombre,
          itemStyle: { color: hay && !o.seleccion!.includes(i.nombre) ? '#D9D5EA' : (i.color ?? o.color), borderRadius: 9 },
        })),
        label: { show: true, position: 'right', color: TINTA.texto, fontSize: 12, fontFamily: MONO, fontWeight: 600, formatter: (p: { value: number }) => o.fmt(p.value) },
      },
    ],
  }
}

interface SerieCol {
  nombre: string
  color: string
  datos: number[]
}

/** Columnas para comparar años (agrupadas o apiladas). El valor completo sale en el eje y en el tooltip. */
export function columnas(o: { categorias: string[]; series: SerieCol[]; fmt: (n: number) => string; apilada?: boolean; seleccion?: string[] }): EChartsCoreOption {
  const c = comun()
  const varias = o.series.length > 1
  const hay = (o.seleccion?.length ?? 0) > 0
  return {
    ...c,
    grid: { left: 4, right: 12, top: varias ? 40 : 14, bottom: 4, containLabel: true },
    legend: varias ? { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, itemGap: 18, textStyle: { color: TINTA.texto, fontSize: 13, fontWeight: 600 }, data: o.series.map((s) => s.nombre) } : { show: false },
    tooltip: {
      ...c.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(29,26,74,0.05)' } },
      formatter: (p: { name: string; marker: string; seriesName: string; value: number }[]) => {
        const total = p.reduce((s, x) => s + x.value, 0)
        return `<b>${esc(String(p[0].name))}</b><br/>${p.map((x) => `${x.marker} ${esc(x.seriesName)}: <b>${o.fmt(x.value)}</b>`).join('<br/>')}${p.length > 1 ? `<br/>Total: <b>${o.fmt(total)}</b>` : ''}`
      },
    },
    xAxis: { type: 'category', data: o.categorias, axisLabel: { color: TINTA.texto, fontWeight: 700, fontSize: 14 }, axisLine: { lineStyle: { color: TINTA.linea } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: TINTA.suave, fontFamily: MONO, fontSize: 11, formatter: o.fmt }, splitLine: { lineStyle: { color: TINTA.linea } }, axisLine: { show: false } },
    series: o.series.map((s, idx) => ({
      type: 'bar',
      name: s.nombre,
      stack: o.apilada ? 't' : undefined,
      barMaxWidth: o.apilada ? 60 : 44,
      barGap: '12%',
      itemStyle: { color: s.color },
      label: {
        show: true,
        position: o.apilada ? 'inside' : 'top',
        color: o.apilada ? textoSobre(s.color) : TINTA.texto,
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 700,
        formatter: (p: { value: number }) => (p.value > 0 ? o.fmt(p.value) : ''),
      },
      labelLayout: { hideOverlap: true },
      data: s.datos.map((v, i) => ({
        value: v,
        itemStyle: { color: hay && !o.seleccion!.includes(o.categorias[i]) ? '#D9D5EA' : s.color, borderRadius: o.apilada ? (idx === o.series.length - 1 ? [8, 8, 0, 0] : 0) : [8, 8, 0, 0], borderColor: '#ffffff', borderWidth: o.apilada ? 2 : 0 },
      })),
    })),
  }
}

/** Barras horizontales apiladas: reparto de cada fila entre varias partes (p. ej. aportante por proceso). */
export function apiladasH(o: { filas: { nombre: string; partes: { nombre: string; valor: number; color: string }[] }[]; fmt: (n: number) => string; ancho?: number; derecha?: number; mostrarTotal?: boolean }): EChartsCoreOption {
  const c = comun()
  const nombres = [...new Set(o.filas.flatMap((f) => f.partes.map((p) => p.nombre)))]
  const filas = [...o.filas].reverse()
  const total = (f: { partes: { valor: number }[] }) => f.partes.reduce((s, p) => s + p.valor, 0)
  return {
    ...c,
    grid: { left: 4, right: o.mostrarTotal ? (o.derecha ?? 116) : 12, top: 34, bottom: 4, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, itemGap: 18, textStyle: { color: TINTA.texto, fontSize: 13, fontWeight: 600 } },
    tooltip: {
      ...c.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(29,26,74,0.05)' } },
      formatter: (p: { name: string; marker: string; seriesName: string; value: number }[]) => `<b>${esc(p[0].name)}</b><br/>${p.map((x) => `${x.marker} ${esc(x.seriesName)}: <b>${o.fmt(x.value)}</b>`).join('<br/>')}${p.length > 1 ? `<br/>Total: <b>${o.fmt(p.reduce((s, x) => s + x.value, 0))}</b>` : ''}`,
    },
    xAxis: { type: 'value', axisLabel: { color: TINTA.suave, fontFamily: MONO, fontSize: 11, formatter: o.fmt }, splitLine: { lineStyle: { color: TINTA.linea } }, axisLine: { show: false } },
    yAxis: { type: 'category', data: filas.map((f) => f.nombre), axisLabel: { color: TINTA.texto, fontWeight: 600, fontSize: 13, width: o.ancho ?? 190, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false } },
    series: nombres.map((n, i) => {
      const esUltima = i === nombres.length - 1
      return {
        type: 'bar',
        name: n,
        stack: 'p',
        barWidth: 22,
        itemStyle: { color: o.filas.flatMap((f) => f.partes).find((p) => p.nombre === n)?.color ?? TINTA.vacio },
        label:
          esUltima && o.mostrarTotal
            ? { show: true, position: 'right', color: TINTA.texto, fontSize: 12, fontFamily: MONO, fontWeight: 600, formatter: (p: { dataIndex: number }) => o.fmt(total(filas[p.dataIndex])) }
            : undefined,
        data: filas.map((f) => {
          const parte = f.partes.find((p) => p.nombre === n)
          return { value: parte?.valor ?? 0, itemStyle: { color: parte?.color ?? TINTA.vacio, borderColor: '#ffffff', borderWidth: 2, borderRadius: esUltima ? [0, 8, 8, 0] : 0 } }
        }),
      }
    }),
  }
}

/* ------------------------------------------------------------------ anillo y pastel */

export function dona(o: { partes: { nombre: string; valor: number; color: string }[]; centro: string; sub?: string; fmt: (n: number) => string; seleccion?: string[] }): EChartsCoreOption {
  const c = comun()
  const hay = (o.seleccion?.length ?? 0) > 0
  return {
    ...c,
    tooltip: { ...c.tooltip, trigger: 'item', formatter: (p: { name: string; value: number; percent: number }) => `${esc(p.name)}<br/><b>${o.fmt(p.value)}</b> · ${p.percent.toFixed(1).replace('.', ',')} %` },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: { text: `{a|${o.centro}}${o.sub ? `\n{b|${o.sub}}` : ''}`, textAlign: 'center', rich: { a: { fontSize: tam(o.centro, 118, 22), fontWeight: 800, fill: TINTA.texto, fontFamily: "'Bricolage Grotesque Variable', " + FUENTE, lineHeight: 24 }, b: { fontSize: 12, fill: TINTA.texto2, lineHeight: 16 } } },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['58%', '92%'],
        center: ['50%', '50%'],
        padAngle: 2,
        startAngle: 100,
        itemStyle: { borderRadius: 10, borderColor: '#ffffff', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scaleSize: 6 },
        data: o.partes.map((p) => ({ name: p.nombre, value: p.valor, itemStyle: { color: hay && !o.seleccion!.includes(p.nombre) ? TINTA.vacio : p.color } })),
      },
    ],
  }
}

/** Pastel completo, con el nombre y el porcentaje (o el valor completo) de cada porción. */
export function pastel(o: { partes: { nombre: string; valor: number; color: string }[]; fmt: (n: number) => string; seleccion?: string[]; mostrarValor?: boolean }): EChartsCoreOption {
  const c = comun()
  const hay = (o.seleccion?.length ?? 0) > 0
  return {
    ...c,
    tooltip: { ...c.tooltip, trigger: 'item', formatter: (p: { name: string; value: number; percent: number }) => `${esc(p.name)}<br/><b>${o.fmt(p.value)}</b> · ${p.percent.toFixed(1).replace('.', ',')} %` },
    series: [
      {
        type: 'pie',
        radius: ['0%', '68%'],
        center: ['50%', '52%'],
        padAngle: 1.5,
        startAngle: 80,
        itemStyle: { borderRadius: 8, borderColor: '#ffffff', borderWidth: 2 },
        label: { show: true, color: TINTA.texto, fontFamily: FUENTE, fontSize: 12, fontWeight: 600, formatter: (p: { name: string; value: number; percent: number }) => `${p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name}\n${o.mostrarValor ? o.fmt(p.value) : `${p.percent.toFixed(1).replace('.', ',')} %`}`, lineHeight: 16 },
        labelLine: { length: 12, length2: 10, lineStyle: { color: TINTA.suave } },
        emphasis: { scaleSize: 6 },
        data: o.partes.map((p) => ({ name: p.nombre, value: p.valor, itemStyle: { color: hay && !o.seleccion!.includes(p.nombre) ? TINTA.vacio : p.color } })),
      },
    ],
  }
}

/* ------------------------------------------------------------------ sunburst (solo en el Resumen) */

export interface Nodo {
  name: string
  value?: number
  color?: string
  children?: Nodo[]
}

function pintar(n: Nodo): Record<string, unknown> {
  const color = n.color ?? '#999999'
  return { name: n.name, value: n.value, itemStyle: { color }, label: { color: textoSobre(color) }, children: n.children?.map(pintar) }
}

export function sunburst(o: { arbol: Nodo[]; fmt: (n: number) => string; centro: string; sub?: string; compacto?: boolean }): EChartsCoreOption {
  const c = comun()
  const oculto = { show: false }
  const niveles = [{}, { r0: '22%', r: '54%', label: o.compacto ? { rotate: 'tangential', fontSize: 10, minAngle: 40 } : { rotate: 'tangential', fontWeight: 700, fontSize: 13, minAngle: 30 } }, { r0: '54%', r: '98%', label: o.compacto ? oculto : { rotate: 'radial', minAngle: 24 } }]
  return {
    ...c,
    tooltip: { ...c.tooltip, trigger: 'item', formatter: (p: { name: string; value: number; treePathInfo?: { name: string }[] }) => `${esc((p.treePathInfo ?? []).map((x) => x.name).join(' › ') || p.name)}<br/><b>${o.fmt(p.value)}</b>` },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: { text: `{a|${o.centro}}${o.sub ? `\n{b|${o.sub}}` : ''}`, textAlign: 'center', rich: { a: { fontSize: tam(o.centro, o.compacto ? 92 : 150, o.compacto ? 17 : 24), fontWeight: 800, fill: TINTA.texto, fontFamily: "'Bricolage Grotesque Variable', " + FUENTE, lineHeight: o.compacto ? 20 : 28 }, b: { fontSize: o.compacto ? 10 : 12, fill: TINTA.texto2, lineHeight: 16 } } },
      },
    ],
    series: [
      {
        type: 'sunburst',
        data: o.arbol.map(pintar),
        radius: ['22%', '98%'],
        center: ['50%', '50%'],
        nodeClick: false,
        startAngle: 90,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2.5, borderRadius: 6 },
        label: { fontFamily: FUENTE, fontSize: 12, fontWeight: 600, overflow: 'truncate', rotate: 'radial' },
        emphasis: { focus: 'ancestor' },
        levels: niveles,
      },
    ],
  }
}
