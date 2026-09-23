import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Segmentado } from '../components/controles'
import { Aviso } from '../components/Lamina'
import { admin, hayApi } from '../lib/api'
import { alfa } from '../lib/agregar'
import { useDatos } from '../lib/datos'
import { cant } from '../lib/formato'
import { detectarDuplicados, type GrupoDuplicado } from '../lib/normalizar'
import { PROGRAMAS, type Meta, type Programa } from '../lib/tipos'

const CLAVE_TOKEN = 'tablero-token'
const CLAVE_QUIEN = 'tablero-quien'
const leer = (k: string) => {
  try {
    return sessionStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
const guardar = (k: string, v: string) => {
  try {
    if (v) sessionStorage.setItem(k, v)
    else sessionStorage.removeItem(k)
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure esta pestaña abierta */
  }
}

type Pestana = 'registrar' | 'metas' | 'duplicados'

export function Admin() {
  const [token, setToken] = useState(() => leer(CLAVE_TOKEN))
  const [quien, setQuien] = useState(() => leer(CLAVE_QUIEN))
  const [pestana, setPestana] = useState<Pestana>('registrar')

  if (!hayApi) {
    return (
      <Aviso>
        <p className="font-medium text-ink">El panel necesita conexión con el Google Sheet.</p>
        <p className="mt-1">
          Esta copia no tiene configurada la variable <code>VITE_API_URL</code> (la dirección del Web App de Apps Script), por eso solo muestra datos de ejemplo. En la versión publicada el panel funciona.
        </p>
      </Aviso>
    )
  }
  if (!token) return <Ingreso alEntrar={(t, q) => { guardar(CLAVE_TOKEN, t); guardar(CLAVE_QUIEN, q); setToken(t); setQuien(q) }} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Administración</h2>
          <p className="mt-1 text-sm text-ink2">Los cambios se guardan en el Google Sheet y quedan registrados en la hoja «auditoria». Sesión de {quien}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmentado
            etiqueta="Sección del panel"
            valor={pestana}
            onChange={setPestana}
            opciones={[
              { id: 'registrar', texto: 'Registrar actividad' },
              { id: 'metas', texto: 'Editar metas' },
              { id: 'duplicados', texto: 'Corregir duplicados' },
            ]}
          />
          <button type="button" onClick={() => { guardar(CLAVE_TOKEN, ''); setToken('') }} className="rounded-lg px-2.5 py-1.5 text-sm text-accentink hover:bg-wash">
            Salir
          </button>
        </div>
      </div>
      {pestana === 'registrar' && <Registrar token={token} quien={quien} />}
      {pestana === 'metas' && <Metas token={token} quien={quien} />}
      {pestana === 'duplicados' && <Duplicados token={token} quien={quien} />}
    </div>
  )
}

function Ingreso({ alEntrar }: { alEntrar: (token: string, quien: string) => void }) {
  const [token, setToken] = useState('')
  const [quien, setQuien] = useState(leer(CLAVE_QUIEN))
  const [error, setError] = useState('')
  const [validando, setValidando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setValidando(true)
    setError('')
    try {
      await admin('verificar', {}, token.trim())
      alEntrar(token.trim(), quien.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setValidando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mx-auto max-w-md space-y-4 rounded-xl border border-line bg-surface p-6">
      <h2 className="text-xl font-semibold tracking-tight">Administración</h2>
      <p className="text-sm text-ink2">Para registrar actividades, editar metas o corregir duplicados hace falta la clave de administración.</p>
      <Campo etiqueta="Tu nombre (queda en el registro de cambios)">
        <input required value={quien} onChange={(e) => setQuien(e.target.value)} autoComplete="name" className={entrada} />
      </Campo>
      <Campo etiqueta="Clave de administración">
        <input required type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" className={entrada} />
      </Campo>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <button disabled={validando} className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-60">
        {validando ? 'Verificando…' : 'Entrar'}
      </button>
    </form>
  )
}

const entrada = 'w-full rounded-lg border border-line bg-page px-3 py-2 text-sm outline-none focus:border-accent'

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink2">{etiqueta}</span>
      {children}
    </label>
  )
}

interface Props {
  token: string
  quien: string
}

/* ------------------------------------------------------------------ registrar */

function Registrar({ token, quien }: Props) {
  const { datos, refrescar } = useDatos()
  const [programa, setPrograma] = useState<Programa>('mf')
  const cfg = PROGRAMAS[programa]
  const filas = useMemo(() => datos!.base.filter((x) => x.programa === programa), [datos, programa])
  const cat = useMemo(() => {
    const u = (c: (x: (typeof filas)[number]) => string) => [...new Set(filas.map(c))].filter(Boolean).sort(alfa)
    return { municipio: u((x) => x.municipio), estado: u((x) => x.estado), grupo: u((x) => x.grupo), aportante: u((x) => x.aportante), actividad: u((x) => x.actividad) }
  }, [filas])
  const anioReciente = Math.max(...filas.map((x) => x.anio), new Date().getFullYear())

  const [f, setF] = useState({ anio: String(anioReciente), municipio: '', institucion: '', estado: 'Convenio', grupo: '', actividad: '', aportante: '', cantidad: '', valor: '', asistio: true })
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const idem = useRef(crypto.randomUUID())
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((s) => ({ ...s, [k]: v }))

  const instituciones = useMemo(() => [...new Set(filas.filter((x) => !f.municipio || x.municipio === f.municipio).map((x) => x.institucion))].sort(alfa), [filas, f.municipio])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setEstado(null)
    try {
      const fila = { anio: Number(f.anio), municipio: f.municipio, institucion: f.institucion, estado: f.estado, [cfg.grupo.toLowerCase()]: f.grupo, actividad: f.actividad, aportante: f.aportante, cantidad: f.cantidad, valor: f.valor, asistio: f.asistio }
      const r = await admin<{ fila: number; hoja: string; repetido?: boolean }>('registrar', { programa, fila, quien, idem: idem.current }, token)
      idem.current = crypto.randomUUID()
      setEstado({ tipo: 'ok', texto: r.repetido ? `Ya estaba registrado (fila ${r.fila} de ${r.hoja}); no se duplicó.` : `Registrado en la fila ${r.fila} de ${r.hoja}.` })
      setF((s) => ({ ...s, institucion: '', actividad: '', cantidad: '', valor: '', asistio: true }))
      await refrescar()
    } catch (err) {
      setEstado({ tipo: 'error', texto: err instanceof Error ? err.message : String(err) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <Segmentado etiqueta="Programa" valor={programa} onChange={(p) => { setPrograma(p); setF((s) => ({ ...s, grupo: '', actividad: '' })) }} opciones={[{ id: 'mf', texto: 'Modelos Flexibles' }, { id: 'uc', texto: 'Universidad en el Campo' }]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo etiqueta="Año"><input required type="number" min={2020} max={2100} value={f.anio} onChange={(e) => set('anio')(e.target.value)} className={entrada} /></Campo>
        <Campo etiqueta="Municipio">
          <select required value={f.municipio} onChange={(e) => set('municipio')(e.target.value)} className={entrada}>
            <option value="">Elegir…</option>
            {cat.municipio.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Institución (escribe o elige)">
          <input required list="lista-inst" value={f.institucion} onChange={(e) => set('institucion')(e.target.value)} className={entrada} />
          <datalist id="lista-inst">{instituciones.map((i) => <option key={i} value={i} />)}</datalist>
        </Campo>
        <Campo etiqueta={cfg.grupo}>
          <select required value={f.grupo} onChange={(e) => set('grupo')(e.target.value)} className={entrada}>
            <option value="">Elegir…</option>
            {cat.grupo.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Actividad (escribe o elige)">
          <input required list="lista-act" value={f.actividad} onChange={(e) => set('actividad')(e.target.value)} className={entrada} />
          <datalist id="lista-act">{cat.actividad.map((a) => <option key={a} value={a} />)}</datalist>
        </Campo>
        <Campo etiqueta="Estado">
          <select required value={f.estado} onChange={(e) => set('estado')(e.target.value)} className={entrada}>
            {cat.estado.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Aportante">
          <select required value={f.aportante} onChange={(e) => set('aportante')(e.target.value)} className={entrada}>
            <option value="">Elegir…</option>
            {cat.aportante.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Cantidad"><input required type="number" min={0} step="any" value={f.cantidad} onChange={(e) => set('cantidad')(e.target.value)} className={entrada} /></Campo>
        <Campo etiqueta="Valor (pesos)"><input required type="number" min={0} step="any" value={f.valor} onChange={(e) => set('valor')(e.target.value)} className={entrada} /></Campo>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.asistio} onChange={(e) => set('asistio')(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        Asistieron. Desmárcalo si se convocó y se invirtió, pero no hubo asistencia.
      </label>
      {estado && <p role={estado.tipo === 'error' ? 'alert' : 'status'} className={`text-sm ${estado.tipo === 'error' ? 'text-bad' : 'text-good'}`}>{estado.texto}</p>}
      <button disabled={enviando} className="rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:opacity-60">{enviando ? 'Guardando…' : 'Registrar actividad'}</button>
    </form>
  )
}

/* ------------------------------------------------------------------ metas */

type CampoMeta = 'valorUnitario' | 'meta' | 'ejecutado' | 'adicional' | 'reinversion' | 'departamento' | 'comite'
const CAMPOS: { k: CampoMeta; servidor: string; t: string; solo?: Programa }[] = [
  { k: 'valorUnitario', servidor: 'valor_unitario', t: 'Valor unitario' },
  { k: 'meta', servidor: 'meta', t: 'Meta' },
  { k: 'ejecutado', servidor: 'ejecutado', t: 'Ejecutado' },
  { k: 'adicional', servidor: 'adicional', t: 'Adicional' },
  { k: 'reinversion', servidor: 'reinversion', t: 'Reinversión', solo: 'uc' },
  { k: 'departamento', servidor: 'departamento', t: 'Departamento', solo: 'uc' },
  { k: 'comite', servidor: 'comite', t: 'Comité', solo: 'uc' },
]
const claveMeta = (m: Meta) => `${m.grupo}|${m.actividad}`

function Metas({ token, quien }: Props) {
  const { datos, refrescar } = useDatos()
  const [programa, setPrograma] = useState<Programa>('mf')
  const cfg = PROGRAMAS[programa]
  const deProg = useMemo(() => datos!.metas.filter((m) => m.programa === programa), [datos, programa])
  const vigencias = useMemo(() => [...new Set(deProg.map((m) => m.vigencia))].sort(), [deProg])
  const [vigSel, setVigSel] = useState<number | null>(null)
  const vigencia = vigSel !== null && vigencias.includes(vigSel) ? vigSel : vigencias[vigencias.length - 1]
  const filas = useMemo(() => deProg.filter((m) => m.vigencia === vigencia), [deProg, vigencia])
  const campos = CAMPOS.filter((c) => !c.solo || c.solo === programa)

  const [cambios, setCambios] = useState<Record<string, Partial<Record<CampoMeta, string>>>>({})
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [nueva, setNueva] = useState('')

  const pendientes = filas.filter((m) => cambios[claveMeta(m)] && Object.keys(cambios[claveMeta(m)]).length)
  const carga = (m: Meta, extra: Record<string, unknown> = {}) => ({ vigencia: m.vigencia, [cfg.grupo.toLowerCase()]: m.grupo, actividad: m.actividad, ...extra })

  const guardar = async () => {
    setGuardando(true)
    setEstado(null)
    try {
      const payload = pendientes.map((m) => {
        const c = cambios[claveMeta(m)]
        const extra: Record<string, unknown> = {}
        campos.forEach((cp) => { if (c[cp.k] !== undefined && c[cp.k] !== '') extra[cp.servidor] = c[cp.k] })
        return carga(m, extra)
      })
      const r = await admin<{ actualizadas: number }>('metas_guardar', { programa, filas: payload, quien }, token)
      setEstado({ tipo: 'ok', texto: `Guardado: ${r.actualizadas} metas actualizadas.` })
      setCambios({})
      await refrescar()
    } catch (err) {
      setEstado({ tipo: 'error', texto: err instanceof Error ? err.message : String(err) })
    } finally {
      setGuardando(false)
    }
  }

  const crearVigencia = async () => {
    const n = Number(nueva)
    if (!Number.isInteger(n) || n < 2020 || n > 2100 || vigencias.includes(n)) {
      setEstado({ tipo: 'error', texto: 'Escribe un año que todavía no tenga metas (por ejemplo 2026).' })
      return
    }
    setGuardando(true)
    setEstado(null)
    try {
      // Copia las metas de la vigencia elegida; lo ejecutado arranca en cero.
      const payload = filas.map((m) => carga({ ...m, vigencia: n }, { valor_unitario: m.valorUnitario, meta: m.meta, ejecutado: 0, adicional: 0 }))
      const r = await admin<{ nuevas: number }>('metas_guardar', { programa, filas: payload, quien }, token)
      setEstado({ tipo: 'ok', texto: `Vigencia ${n} creada con ${r.nuevas} metas copiadas de ${vigencia}. Ajústalas y guarda.` })
      setNueva('')
      await refrescar()
      setVigSel(n)
    } catch (err) {
      setEstado({ tipo: 'error', texto: err instanceof Error ? err.message : String(err) })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmentado etiqueta="Programa" valor={programa} onChange={(p) => { setPrograma(p); setVigSel(null); setCambios({}) }} opciones={[{ id: 'mf', texto: 'Modelos Flexibles' }, { id: 'uc', texto: 'Universidad en el Campo' }]} />
        {vigencias.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Vigencia
            <select value={vigencia} onChange={(e) => { setVigSel(Number(e.target.value)); setCambios({}) }} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink">
              {vigencias.map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva vigencia" inputMode="numeric" aria-label="Año de la nueva vigencia" className="w-36 rounded-lg border border-line bg-page px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
          <button type="button" onClick={() => void crearVigencia()} disabled={guardando || !filas.length} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-wash disabled:opacity-60">Crear copiando esta</button>
        </div>
      </div>

      <div className="max-h-[560px] overflow-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-ink2">
              <th scope="col" className="border-b border-line px-3 py-2 text-left font-medium">{cfg.grupo} · actividad</th>
              {campos.map((c) => <th key={c.k} scope="col" className="border-b border-line px-3 py-2 text-right font-medium">{c.t}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => {
              const k = claveMeta(m)
              return (
                <tr key={k} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5"><span className="block text-xs text-muted">{m.grupo}</span>{m.actividad}</td>
                  {campos.map((c) => (
                    <td key={c.k} className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={`${c.t} de ${m.actividad}`}
                        value={cambios[k]?.[c.k] ?? String(m[c.k] ?? 0)}
                        onChange={(e) => setCambios((s) => ({ ...s, [k]: { ...s[k], [c.k]: e.target.value } }))}
                        className={`tabular w-28 rounded-md border bg-page px-2 py-1 text-right outline-none focus:border-accent ${cambios[k]?.[c.k] !== undefined ? 'border-accent' : 'border-line'}`}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Al guardar se recalculan valor meta, valor ejecutado y faltante a partir de valor unitario, meta y ejecutado.</p>
      {estado && <p role={estado.tipo === 'error' ? 'alert' : 'status'} className={`text-sm ${estado.tipo === 'error' ? 'text-bad' : 'text-good'}`}>{estado.texto}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void guardar()} disabled={guardando || pendientes.length === 0} className="rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:opacity-50">
          {guardando ? 'Guardando…' : `Guardar ${pendientes.length ? cant(pendientes.length) + ' cambios' : 'cambios'}`}
        </button>
        {pendientes.length > 0 && <button type="button" onClick={() => setCambios({})} className="rounded-lg px-3 py-2 text-sm text-accentink hover:bg-wash">Descartar</button>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ duplicados */

function Duplicados({ token, quien }: Props) {
  const { crudo, refrescar } = useDatos()
  const grupos = useMemo(() => (crudo ? detectarDuplicados(crudo) : []), [crudo])
  const [elegido, setElegido] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState<Record<string, { tipo: 'ok' | 'error'; texto: string }>>({})
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const id = (g: GrupoDuplicado) => `${g.tipo}|${g.ambito}|${g.sugerido}`

  const unificar = async (g: GrupoDuplicado) => {
    const destino = elegido[id(g)] ?? g.sugerido
    setTrabajando(id(g))
    try {
      let celdas = 0
      for (const v of g.variantes.filter((x) => x.valor !== destino)) {
        const r = await admin<{ celdas: number }>('alias_guardar', { tipo: g.tipo, ambito: g.ambito, crudo: v.valor, normalizado: destino, quien }, token)
        celdas += r.celdas
      }
      setEstado((s) => ({ ...s, [id(g)]: { tipo: 'ok', texto: `Unificado en «${destino}» (${celdas} celdas corregidas).` } }))
      await refrescar()
    } catch (err) {
      setEstado((s) => ({ ...s, [id(g)]: { tipo: 'error', texto: err instanceof Error ? err.message : String(err) } }))
    } finally {
      setTrabajando(null)
    }
  }

  return (
    <div className="space-y-3">
      <Aviso>
        Aquí aparecen nombres que son lo mismo pero están escritos distinto (mayúsculas, tildes o espacios) y que parten los totales en el Sheet. Elige cuál es el correcto y se corrige en todas las hojas. Las actividades «… - Convocado - No Asistió» no se fusionan: se registran con la casilla «Asistieron».
      </Aviso>
      {grupos.length === 0 && <Aviso>No hay duplicados: todos los nombres están unificados.</Aviso>}
      {grupos.map((g) => {
        const k = id(g)
        const destino = elegido[k] ?? g.sugerido
        return (
          <fieldset key={k} className="rounded-xl border border-line bg-surface p-4">
            <legend className="px-1 text-sm text-ink2">
              <span className="rounded-md bg-wash px-1.5 py-0.5 font-medium text-ink">{g.tipo}</span>
              {g.ambito && <span> · en {g.ambito}</span>}
            </legend>
            <div className="space-y-1.5">
              {g.variantes.map((v) => (
                <label key={v.valor} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={k} checked={destino === v.valor} onChange={() => setElegido((s) => ({ ...s, [k]: v.valor }))} className="accent-[var(--accent)]" />
                  <span className="font-medium">{v.valor}</span>
                  <span className="text-muted">· {cant(v.filas)} filas</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={() => void unificar(g)} disabled={trabajando !== null} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
                {trabajando === k ? 'Unificando…' : 'Unificar en el seleccionado'}
              </button>
              {estado[k] && <span role={estado[k].tipo === 'error' ? 'alert' : 'status'} className={`text-sm ${estado[k].tipo === 'error' ? 'text-bad' : 'text-good'}`}>{estado[k].texto}</span>}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
