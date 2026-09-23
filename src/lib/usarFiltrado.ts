import { useDatos } from './datos'
import { useFiltros } from './filtros'

interface F {
  anios: number[]
  municipios: string[]
}

/** ¿Pasa el año/municipio? `null` = esa dimensión no aplica a este conjunto de datos. */
export function pasa(f: F, anio: number | null, municipio: string | null) {
  return (anio === null || f.anios.length === 0 || f.anios.includes(anio)) && (municipio === null || f.municipios.length === 0 || f.municipios.includes(municipio))
}

/** Datos (garantizados por el Layout) y filtros globales. */
export function useTablero() {
  const { datos } = useDatos()
  const f = useFiltros()
  return { datos: datos!, f }
}

export const descripcionFiltros = (f: F) => {
  const p: string[] = []
  if (f.anios.length) p.push(f.anios.join(', '))
  if (f.municipios.length) p.push(f.municipios.length === 1 ? f.municipios[0] : `${f.municipios.length} municipios`)
  return p.length ? p.join(' · ') : 'Todos los años y municipios'
}
