import { useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { alfa } from '../lib/agregar'
import { useDatos } from '../lib/datos'
import { useFiltros } from '../lib/filtros'
import { useTema } from '../lib/tema'
import { Anios, Fila, MultiSelect } from './controles'
import { Aviso, Cargando } from './Tarjetas'

const NAV = [
  { a: '/', t: 'Resumen', fin: true },
  { a: '/modelos-flexibles', t: 'Modelos Flexibles' },
  { a: '/universidad-en-el-campo', t: 'Universidad en el Campo' },
  { a: '/estudiantes', t: 'Estudiantes' },
  { a: '/cobertura', t: 'Cobertura' },
  { a: '/cumplimiento', t: 'Cumplimiento' },
]

function FiltrosGlobales() {
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
    <Fila className="py-2.5">
      <Anios anios={anios} valor={f.anios} onChange={f.setAnios} />
      <MultiSelect etiqueta="Municipio" opciones={municipios} valor={f.municipios} onChange={f.setMunicipios} />
      {f.activos > 0 && (
        <button type="button" onClick={f.limpiar} className="rounded-lg px-2.5 py-1.5 text-sm text-accentink hover:bg-wash">
          Limpiar filtros
        </button>
      )}
    </Fila>
  )
}

const fechaCorta = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
}

export function Layout() {
  const { estado, datos, error, actualizando, refrescar } = useDatos()
  const { tema, alternar } = useTema()
  const { pathname } = useLocation()
  const sinFiltros = pathname.startsWith('/admin') || pathname.startsWith('/cumplimiento')

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-accentink">Gobernación de Caldas · Secretaría de Educación</p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">Educación rural en Caldas</h1>
              <p className="mt-1 max-w-2xl text-sm text-ink2">Inversión y cobertura de Modelos Flexibles y Universidad en el Campo, en alianza con el Comité de Cafeteros.</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {datos && <span className="hidden text-muted sm:inline">Datos al {fechaCorta(datos.generado)}</span>}
              <button type="button" onClick={() => void refrescar()} disabled={actualizando} className="rounded-lg border border-line px-3 py-1.5 text-ink2 hover:text-ink disabled:opacity-60">
                {actualizando ? 'Actualizando…' : 'Actualizar'}
              </button>
              <button type="button" onClick={alternar} aria-label={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`} className="grid size-9 place-items-center rounded-lg border border-line text-ink2 hover:text-ink">
                {tema === 'dark' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                )}
              </button>
            </div>
          </div>
          <nav aria-label="Secciones" className="-mb-px mt-4 flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.a}
                to={n.a}
                end={n.fin}
                className={({ isActive }) => `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${isActive ? 'border-accent text-ink' : 'border-transparent text-ink2 hover:text-ink'}`}
              >
                {n.t}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {!sinFiltros && estado === 'listo' && (
        <div className="border-b border-line bg-page">
          <div className="mx-auto max-w-7xl px-4">
            <FiltrosGlobales />
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-5">
        {estado === 'cargando' && <Cargando />}
        {estado === 'error' && (
          <Aviso tipo="error">
            <p className="font-medium">No se pudieron cargar los datos.</p>
            <p className="mt-1 text-ink2">{error}</p>
            <button type="button" onClick={() => void refrescar()} className="mt-3 rounded-lg border border-line px-3 py-1.5 hover:bg-wash">
              Reintentar
            </button>
          </Aviso>
        )}
        {estado === 'listo' && (
          <>
            {error && <div className="mb-4"><Aviso>No se pudo actualizar; se muestran los últimos datos guardados. ({error})</Aviso></div>}
            <Outlet />
          </>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-sm text-muted">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <span>Valores en pesos colombianos. Cada gráfico tiene su tabla y se puede descargar en CSV.</span>
          <NavLink to="/admin" className="hover:text-ink">
            Administración
          </NavLink>
        </div>
      </footer>
    </div>
  )
}
