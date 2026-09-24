import caldas from '../data/caldas.json'

/** Los 27 municipios de Caldas, tal como están en el mapa (fuente: DANE). */
export const MUNICIPIOS_CALDAS = new Set((caldas as unknown as { features: { properties: { nombre: string } }[] }).features.map((f) => f.properties.nombre))

/** Los 26 municipios rurales: sin Manizales, que tiene su propio convenio. */
export const MUNICIPIOS_RURALES = new Set([...MUNICIPIOS_CALDAS].filter((m) => m !== 'Manizales'))
