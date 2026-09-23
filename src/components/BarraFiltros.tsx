import { useMemo } from 'react'
import { alfa } from '../lib/agregar'
import { useDatos } from '../lib/datos'
import { useFiltros } from '../lib/filtros'
import { Anios, Fila, MultiSelect } from './controles'

/** Filtros globales (año y municipio): se conservan al cambiar de lámina. */
export function BarraFiltros({ soloAnio = false }: { soloAnio?: boolean }) {
  const { datos } = useDatos()
  const f = useFiltros()
  const { anios, municipios } = useMemo(() => {
    const a = new Set<number>()
    const m = new Set<string>()
    datos?.base.forEach((x) => (a.add(x.anio), m.add(x.municipio)))
    datos?.beneficiados.forEach((x) => (a.add(x.anio), m.add(x.municipio)))
    return { anios: [...a].filter(Boolean).sort(), municipios: [...m].sort(alfa) }
  }, [datos])

  return (
    <Fila className="gap-3">
      <Anios anios={anios} valor={f.anios} onChange={f.setAnios} />
      {!soloAnio && <MultiSelect etiqueta="Municipio" opciones={municipios} valor={f.municipios} onChange={f.setMunicipios} />}
      {f.activos > 0 && (
        <button type="button" onClick={f.limpiar} className="rounded-full px-3 py-2 text-sm font-bold text-accentink underline decoration-2 underline-offset-4 hover:bg-wash">
          Limpiar filtros
        </button>
      )}
    </Fila>
  )
}
