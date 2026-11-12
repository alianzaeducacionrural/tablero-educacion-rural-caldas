import { PlacaCabecera } from '../components/Lamina'
import { PLACAS } from '../lib/colores'

// Página en blanco mientras llegan las metas y lo ejecutado de 2026. La versión anterior (metas vs ejecutado,
// avance por proyecto y tabla por actividad) está en el historial de git: `git log -- src/paginas/Cumplimiento.tsx`.
export function Cumplimiento() {
  return <PlacaCabecera placa={PLACAS.cumplimiento} titulo="Lo prometido frente a lo hecho" texto="Esta lámina se está actualizando con la información de 2026." />
}
