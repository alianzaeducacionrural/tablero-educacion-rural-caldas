export type Programa = 'mf' | 'uc'

export const PROGRAMAS: Record<Programa, { nombre: string; grupo: string; grupos: string; ruta: string }> = {
  mf: { nombre: 'Modelos Flexibles', grupo: 'Proyecto', grupos: 'Proyectos', ruta: '/modelos-flexibles' },
  uc: { nombre: 'Universidad en el Campo', grupo: 'Proceso', grupos: 'Procesos', ruta: '/universidad-en-el-campo' },
}

/** Una fila de mf_base o uc_base, con `grupo` = proyecto (MF) o proceso (UC). */
export interface FilaBase {
  programa: Programa
  anio: number
  municipio: string
  institucion: string
  tipo: string
  estado: string
  grupo: string
  actividad: string
  asistio: boolean
  cantidad: number
  valor: number
  aportante: string
}

export interface Beneficiado {
  anio: number
  municipio: string
  institucion: string
  sede: string
  beneficiados: number
}

export interface Estudiante {
  anioIngreso: number
  municipio: string
  institucion: string
  universidad: string
  programa: string
  genero: string
  estado: string
  financiador: string
  anioGraduacion: number | null
}

export interface Meta {
  programa: Programa
  vigencia: number
  grupo: string
  actividad: string
  valorUnitario: number
  meta: number
  valorMeta: number
  ejecutado: number
  valorEjecutado: number
  faltante: number
  valorFaltante: number
  adicional: number
  reinversion: number
  departamento: number
  comite: number
}

export interface Alias {
  tipo: string
  ambito: string
  crudo: string
  normalizado: string
  filas: number
}

export interface Datos {
  generado: string
  base: FilaBase[]
  beneficiados: Beneficiado[]
  estudiantes: Estudiante[]
  metas: Meta[]
  alias: Alias[]
}

/** Lo que devuelve el Web App de Apps Script. */
export interface HojaCruda {
  columnas: string[]
  filas: unknown[][]
}
export interface RespuestaDatos {
  ok: boolean
  generado: string
  hojas: Record<string, HojaCruda>
  error?: string
}
