import type { Programa } from './tipos'

/**
 * Cada pestaña es una lámina del atlas con su propio estilo de color:
 *  main   color de campo (cabecera, botones, énfasis)
 *  ink    tinta oscura de la misma familia (texto sobre fondos claros)
 *  soft   fondo de la página, un lavado muy claro del color
 *  wash   lavado más intenso (fondos de sección, chips)
 *  on     texto sobre `main`
 *  escala tintas de valle a cumbre (claro → oscuro) para mapas, treemaps y sunburst
 */
export interface Placa {
  id: string
  nombre: string
  ruta: string
  frase: string
  main: string
  ink: string
  soft: string
  wash: string
  on: string
  escala: string[]
  /** Colores de apoyo de la misma familia, para series y piezas categóricas. */
  apoyo: string[]
}

export const PLACAS: Record<string, Placa> = {
  resumen: {
    id: 'resumen',
    nombre: 'Resumen',
    ruta: '/',
    frase: 'El recurso, sobre el mapa',
    main: '#6D2EE8',
    ink: '#26105E',
    soft: '#F4EEFF',
    wash: '#E3D5FF',
    on: '#FFFFFF',
    escala: ['#FFF0A8', '#FFCE4A', '#FF9A3C', '#FF5F6D', '#E2379F', '#9B30D9', '#4B2BB8'],
    apoyo: ['#6D2EE8', '#FF9A1F', '#E2379F', '#17A6B8', '#FF5F6D', '#2F6BFF'],
  },
  mf: {
    id: 'mf',
    nombre: 'Modelos Educativos Flexibles',
    ruta: '/modelos-flexibles',
    frase: 'Escuelas rurales que se acompañan de cerca',
    main: '#1F5FFF',
    ink: '#0B1F6B',
    soft: '#E8F1FF',
    wash: '#CFE2FF',
    on: '#FFFFFF',
    escala: ['#D6F8EE', '#7FE7D6', '#2CCBE3', '#2F9BFF', '#2F63F0', '#3B3FCF', '#1E1E86'],
    apoyo: ['#1F5FFF', '#17C3B2', '#7B5CFF', '#FF8A3D', '#F0439A', '#12A150'],
  },
  uc: {
    id: 'uc',
    nombre: 'Universidad en el Campo',
    ruta: '/universidad-en-el-campo',
    frase: 'Del colegio rural a la universidad',
    main: '#D91E8C',
    ink: '#5A0B3E',
    soft: '#FFEAF5',
    wash: '#FFCDE6',
    on: '#FFFFFF',
    escala: ['#FFE6F2', '#FFB8D9', '#FF7DBB', '#F0409A', '#C81E8A', '#8E1E92', '#52126B'],
    apoyo: ['#D91E8C', '#FF7A45', '#7B5CFF', '#17A6B8', '#FFB000', '#12A150'],
  },
  estudiantes: {
    id: 'estudiantes',
    nombre: 'Técnicos Profesionales',
    ruta: '/estudiantes',
    frase: 'Técnicos profesionales, cohorte a cohorte',
    main: '#0B8F58',
    ink: '#08381F',
    soft: '#E6F8DA',
    wash: '#C9EFA9',
    on: '#FFFFFF',
    escala: ['#F3FCC9', '#D3EF66', '#93DC4E', '#4DC96B', '#17A673', '#0E7C7B', '#0B4F63'],
    apoyo: ['#0B8F58', '#2F6BFF', '#FFB000', '#E5383B', '#7B5CFF', '#F0439A'],
  },
  cobertura: {
    id: 'cobertura',
    nombre: 'Cobertura',
    ruta: '/cobertura',
    frase: 'Hasta dónde llega el programa',
    main: '#F59A0B',
    ink: '#5B2A00',
    soft: '#FFF4D6',
    wash: '#FFE4A0',
    on: '#3A1B00',
    escala: ['#FFF6BF', '#FFE066', '#FFC233', '#FF9F1C', '#F26B21', '#C7431E', '#7C2A13'],
    apoyo: ['#F59A0B', '#E5383B', '#7B5CFF', '#17A6B8', '#12A150', '#2F6BFF'],
  },
  cumplimiento: {
    id: 'cumplimiento',
    nombre: 'Cumplimiento',
    ruta: '/cumplimiento',
    frase: 'Lo prometido frente a lo hecho',
    main: '#E5384B',
    ink: '#5A0F1D',
    soft: '#FFE8E8',
    wash: '#FFC9CB',
    on: '#FFFFFF',
    escala: ['#FFE1DA', '#FFB4A2', '#FF8577', '#F5525C', '#D62C55', '#A31650', '#5F0F40'],
    apoyo: ['#E5384B', '#12A150', '#2F6BFF', '#FFB000', '#7B5CFF', '#17A6B8'],
  },
  admin: {
    id: 'admin',
    nombre: 'Administración',
    ruta: '/admin',
    frase: 'Actualizar los datos',
    main: '#2B2A6B',
    ink: '#14133F',
    soft: '#ECEBFA',
    wash: '#D5D3F2',
    on: '#FFFFFF',
    escala: ['#E6E5FA', '#B8B5EE', '#8B86E0', '#5F59CC', '#3E3AA8', '#2B2A6B', '#14133F'],
    apoyo: ['#2B2A6B', '#F59A0B', '#D91E8C', '#17A6B8', '#12A150', '#E5383B'],
  },
}

export const ORDEN_PLACAS = ['resumen', 'mf', 'uc', 'estudiantes', 'cobertura', 'cumplimiento']

export function placaDeRuta(pathname: string): Placa {
  if (pathname.startsWith('/admin')) return PLACAS.admin
  const p = Object.values(PLACAS).find((x) => x.ruta !== '/' && pathname.startsWith(x.ruta))
  return p ?? PLACAS.resumen
}

/** Tinta de gráficos (siempre sobre fondo claro). */
export const TINTA = { texto: '#1D1A4A', texto2: '#4B476F', suave: '#7C78A0', linea: 'rgba(29,26,74,0.14)', blanco: '#FFFFFF', vacio: '#DCD8EC' }

/** El color sigue a la entidad, no a su posición: filtrar no repinta a las demás. */
export const colorPrograma = (p: Programa) => PLACAS[p].main
export function colorAportante(aportante: string): string {
  if (/depto|departamento|gobernaci/i.test(aportante)) return '#6D2EE8'
  if (/comit/i.test(aportante)) return '#FF9A1F'
  return TINTA.vacio
}
export function colorEstadoEstudiante(estado: string): string {
  if (/pendiente/i.test(estado)) return '#FFB000'
  if (/riesgo/i.test(estado)) return '#FF7A45'
  if (/gradu/i.test(estado)) return '#12A150'
  if (/desert/i.test(estado)) return '#E5383B'
  return '#2F6BFF'
}
export function colorEstadoActividad(estado: string, programa: Programa): string {
  if (/^convenio$/i.test(estado)) return colorPrograma(programa)
  if (/reinvers/i.test(estado)) return '#FFB000'
  return '#17A6B8'
}

/** Muestrea la escala de una placa: t en [0,1]. */
export function tinte(escala: string[], t: number): string {
  const i = Math.max(0, Math.min(escala.length - 1, Math.round(t * (escala.length - 1))))
  return escala[i]
}

/** Texto oscuro sobre fondos claros y blanco sobre oscuros (luminancia relativa WCAG). */
export function textoSobre(hex: string): string {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? '#1D1A4A' : '#FFFFFF'
}
