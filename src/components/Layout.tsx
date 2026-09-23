import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDatos } from '../lib/datos'
import { ORDEN_PLACAS, PLACAS, placaDeRuta } from '../lib/colores'
import logoSed from '../assets/logos/gobierno-caldas-sed.webp'
import logoComiteNegro from '../assets/logos/comite-negro.webp'
import { Icono } from './Icono'
import { Aviso, Cargando, SiluetaCaldas } from './Lamina'

const fechaCorta = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
}

export function Layout() {
  const { estado, datos, error, actualizando, refrescar } = useDatos()
  const { pathname } = useLocation()
  const placa = placaDeRuta(pathname)

  // Cada pestaña es una lámina con su propia familia de color: se aplica a toda la página, incluido el fondo.
  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--main', placa.main)
    r.setProperty('--ink', placa.ink)
    r.setProperty('--soft', placa.soft)
    r.setProperty('--wash', placa.wash)
    r.setProperty('--on', placa.on)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', placa.main)
    window.scrollTo({ top: 0 })
  }, [placa])

  return (
    <div className="lamina min-h-screen">
      <header className="bg-white">
        <div className="border-b border-line">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-5 py-3">
            <img src={logoSed} alt="Gobierno de Caldas, Secretaría de Educación" width={1100} height={129} className="h-9 w-auto sm:h-12" />
            <img src={logoComiteNegro} alt="Comité de Cafeteros de Caldas, Federación Nacional de Cafeteros de Colombia" width={700} height={196} className="h-10 w-auto sm:h-14" />
          </div>
        </div>
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3.5">
          <NavLink to="/" className="flex items-center gap-3" aria-label="Educación rural en Caldas, ir al resumen">
            <SiluetaCaldas className="h-9 w-auto" trazo={placa.main} style={{ strokeWidth: 5 }} />
            <span>
              <span className="display block text-2xl" style={{ color: 'var(--ink)' }}>
                Educación rural en Caldas
              </span>
              {datos && <span className="cota block text-xs text-ink2">Datos al {fechaCorta(datos.generado)}</span>}
            </span>
          </NavLink>
          <button type="button" onClick={() => void refrescar()} disabled={actualizando} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-accentink ring-1 ring-line hover:bg-wash disabled:opacity-60">
            <Icono n="refrescar" size={15} className={actualizando ? 'animate-spin' : ''} />
            {actualizando ? 'Actualizando' : 'Actualizar'}
          </button>
        </div>
        <nav aria-label="Láminas" className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto px-5 pb-3.5">
          {ORDEN_PLACAS.map((id) => {
            const p = PLACAS[id]
            return (
              <NavLink
                key={id}
                to={p.ruta}
                end={p.ruta === '/'}
                className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line transition-colors"
                style={({ isActive }) => (isActive ? { background: p.main, color: p.on } : { background: '#fff', color: p.ink })}
              >
                {({ isActive }) => (
                  <>
                    <span className="size-3 rounded-full" style={{ background: isActive ? p.on : p.main }} aria-hidden="true" />
                    {p.nombre}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </header>

      <main>
        {estado === 'cargando' && (
          <div className="mx-auto max-w-[1400px] px-5 py-10">
            <Cargando />
          </div>
        )}
        {estado === 'error' && (
          <div className="mx-auto max-w-[1400px] px-5 py-10">
            <Aviso tipo="error">
              <p className="font-bold">No se pudieron cargar los datos.</p>
              <p className="mt-1 text-ink2">{error}</p>
              <button type="button" onClick={() => void refrescar()} className="mt-3 rounded-full px-4 py-2 font-bold ring-1 ring-line hover:bg-wash">
                Reintentar
              </button>
            </Aviso>
          </div>
        )}
        {estado === 'listo' && (
          <>
            {error && (
              <div className="mx-auto max-w-[1400px] px-5 pt-4">
                <Aviso>No se pudo actualizar; se muestran los últimos datos guardados. ({error})</Aviso>
              </div>
            )}
            <Outlet />
          </>
        )}
      </main>

      <footer className="mt-10 bg-white" style={{ borderTop: '6px solid var(--main)' }}>
        <div className="mx-auto max-w-[1500px] px-5 py-8">
          <div className="flex items-center justify-between gap-6">
            <img src={logoSed} alt="Gobierno de Caldas, Secretaría de Educación" width={1100} height={129} className="h-9 w-auto sm:h-12" />
            <img src={logoComiteNegro} alt="Comité de Cafeteros de Caldas, Federación Nacional de Cafeteros de Colombia" width={700} height={196} className="h-10 w-auto sm:h-14" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-line pt-5 text-sm text-ink2">
            <span>Educación rural en Caldas. Valores en pesos colombianos. Contornos municipales: DANE, vía geoBoundaries (CC BY 4.0). Cada visual tiene su tabla y se descarga en CSV.</span>
            <NavLink to="/admin" className="font-bold text-accentink underline underline-offset-4">
              Administración
            </NavLink>
          </div>
        </div>
      </footer>
    </div>
  )
}
