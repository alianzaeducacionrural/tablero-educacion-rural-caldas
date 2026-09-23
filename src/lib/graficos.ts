import type { EChartsCoreOption } from 'echarts/core'
import { TINTA, textoSobre, type Placa } from './colores'

const FUENTE = "'Albert Sans Variable', system-ui, sans-serif"
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
      formatter: (p: { name: string; value?: number }) => `<b>${esc(p.name)}</b><br/>${typeof p.value === 'number' && !isNaN(p.value) ? o.fmt(p.value) : 'Sin datos en este tablero'}`,
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

/* ------------------------------------------------------------------ jerarquías */

export interface Nodo {
  name: string
  value?: number
  color?: string
  children?: Nodo[]
}

function pintar(n: Nodo): Record<string, unknown> {
  const color = n.color ?? '#999999'
  return {
    name: n.name,
    value: n.value,
    itemStyle: { color },
    label: { color: textoSobre(color) },
    upperLabel: { color: textoSobre(color) },
    children: n.children?.map(pintar),
  }
}

export function treemap(o: { arbol: Nodo[]; fmt: (n: number) => string }): EChartsCoreOption {
  const c = comun()
  return {
    ...c,
    tooltip: { ...c.tooltip, trigger: 'item', formatter: (p: { name: string; value: number; treePathInfo?: { name: string }[] }) => `${esc((p.treePathInfo ?? []).slice(1).map((x) => x.name).join(' › ') || p.name)}<br/><b>${o.fmt(p.value)}</b>` },
    series: [
      {
        type: 'treemap',
        data: o.arbol.map(pintar),
        left: 0,
        right: 0,
        top: 0,
        bottom: 34,
        roam: false,
        name: 'Todo',
        nodeClick: 'zoomToNode',
        drillDownIcon: '',
        leafDepth: 1,
        squareRatio: 1.1,
        breadcrumb: { show: true, bottom: 0, height: 26, itemStyle: { color: '#ffffff', borderColor: TINTA.linea, textStyle: { color: TINTA.texto, fontFamily: FUENTE, fontSize: 12 } }, emphasis: { itemStyle: { color: '#f0eefb' } } },
        upperLabel: { show: true, height: 28, fontFamily: FUENTE, fontWeight: 700, fontSize: 13, formatter: (p: { name: string; value: number }) => `${p.name} · ${o.fmt(p.value)}` },
        label: { show: true, position: 'insideTopLeft', fontFamily: FUENTE, fontSize: 12, fontWeight: 600, padding: [8, 10], formatter: (p: { name: string; value: number }) => `{n|${p.name}}\n{v|${o.fmt(p.value)}}`, rich: { n: { fontSize: 13, fontWeight: 700, lineHeight: 18 }, v: { fontSize: 12, fontWeight: 500, lineHeight: 16 } }, overflow: 'truncate' },
        itemStyle: { borderColor: '#ffffff', borderWidth: 3, gapWidth: 3, borderRadius: 8 },
        levels: [{ itemStyle: { borderWidth: 0, gapWidth: 4 }, upperLabel: { show: false } }, { itemStyle: { borderWidth: 0, gapWidth: 3 } }],
      },
    ],
  }
}

const profundidad = (ns: Nodo[]): number => (ns.length ? 1 + Math.max(...ns.map((n) => profundidad(n.children ?? []))) : 0)

export function sunburst(o: { arbol: Nodo[]; fmt: (n: number) => string; centro: string; sub?: string; radio?: [string, string]; compacto?: boolean; sinEtiquetas?: boolean }): EChartsCoreOption {
  const c = comun()
  const d = profundidad(o.arbol)
  const oculto = { show: false }
  // Los radios dependen de cuántos niveles hay de verdad: si no, el anillo exterior queda vacío.
  const niveles =
    d <= 2
      ? [{}, { r0: '24%', r: '58%', label: o.sinEtiquetas ? oculto : o.compacto ? { rotate: 0, fontSize: 11, minAngle: 24 } : { rotate: 0, fontWeight: 700, fontSize: 13, minAngle: 16 } }, { r0: '58%', r: '98%', label: oculto }]
      : [{}, { r0: '24%', r: '47%', label: o.compacto ? { rotate: 0, fontSize: 10, minAngle: 40 } : { rotate: 0, fontWeight: 700, fontSize: 13, minAngle: 22 } }, { r0: '47%', r: '72%', label: o.compacto ? oculto : { rotate: 'tangential', minAngle: 50 } }, { r0: '72%', r: '98%', label: o.compacto ? oculto : { rotate: 'radial', minAngle: 24 } }]
  return {
    ...c,
    tooltip: { ...c.tooltip, trigger: 'item', formatter: (p: { name: string; value: number; treePathInfo?: { name: string }[] }) => `${esc((p.treePathInfo ?? []).map((x) => x.name).join(' › ') || p.name)}<br/><b>${o.fmt(p.value)}</b>` },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: { text: `{a|${o.centro}}${o.sub ? `
{b|${o.sub}}` : ''}`, textAlign: 'center', rich: { a: { fontSize: tam(o.centro, o.compacto ? 92 : 150, o.compacto ? 17 : 24), fontWeight: 800, fill: TINTA.texto, fontFamily: "'Bricolage Grotesque Variable', " + FUENTE, lineHeight: o.compacto ? 20 : 28 }, b: { fontSize: o.compacto ? 10 : 12, fill: TINTA.texto2, lineHeight: 16 } } },
      },
    ],
    series: [
      {
        type: 'sunburst',
        data: o.arbol.map(pintar),
        radius: o.radio ?? ['24%', '98%'],
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

/* ------------------------------------------------------------------ dona */

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
        style: { text: `{a|${o.centro}}${o.sub ? `\n{b|${o.sub}}` : ''}`, textAlign: 'center', rich: { a: { fontSize: tam(o.centro, 118, 20), fontWeight: 800, fill: TINTA.texto, fontFamily: "'Bricolage Grotesque Variable', " + FUENTE, lineHeight: 22 }, b: { fontSize: 12, fill: TINTA.texto2, lineHeight: 16 } } },
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

/* ------------------------------------------------------------------ burbujas (fuerza) */

export function burbujas(o: { items: { nombre: string; valor: number; color: string }[]; fmt: (n: number) => string; seleccion?: string[] }): EChartsCoreOption {
  const c = comun()
  const max = Math.max(1, ...o.items.map((i) => i.valor))
  const hay = (o.seleccion?.length ?? 0) > 0
  return {
    ...c,
    tooltip: { ...c.tooltip, trigger: 'item', formatter: (p: { name: string; value: number }) => `${esc(p.name)}<br/><b>${o.fmt(p.value)}</b>` },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: false,
        draggable: true,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        force: { repulsion: [60, 200], gravity: 0.15, friction: 0.2, edgeLength: 55, layoutAnimation: true },
        emphasis: { focus: 'self', scale: 1.12 },
        label: { show: true, position: 'inside', fontFamily: FUENTE, fontWeight: 700, fontSize: 10 },
        data: o.items.map((i) => {
          const r = 15 + Math.sqrt(i.valor / max) * 36
          const color = hay && !o.seleccion!.includes(i.nombre) ? '#E4E0F1' : i.color
          return {
            name: i.nombre,
            value: i.valor,
            symbolSize: r * 2,
            itemStyle: { color, borderColor: '#ffffff', borderWidth: 3 },
            label: { show: r > 26, color: textoSobre(color), formatter: () => (i.nombre.length > 14 ? i.nombre.slice(0, 13) + '…' : i.nombre), width: r * 1.7, overflow: 'truncate' },
          }
        }),
      },
    ],
  }
}
