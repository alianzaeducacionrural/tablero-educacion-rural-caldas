# Design

Sistema visual del tablero, registrado desde lo construido. Producto y usuarios: ver [PRODUCT.md](PRODUCT.md).

## Mundo: atlas hipsométrico de Caldas
Un pliego de atlas sobre papel claro. El mapa real de los 27 municipios (DANE, vía geoBoundaries, CC BY 4.0; `scripts/mapa_caldas.py` → `src/data/caldas.json`) es la interfaz: se colorea, se toca para filtrar y su contorno da textura a cada cabecera. El valor es "altitud": las tintas van de valle (claro) a cumbre (oscuro). **Solo tema claro.** Se rechaza el tablero de tarjetas KPI + barras.

## Estilo de color por pestaña
Cada pestaña es una lámina con su propia familia de color. Se aplica a toda la página (cabecera, fondo, botones, escala de tintas) al cambiar de ruta (`Layout.tsx` fija las variables CSS; `lib/colores.ts` las define).

| Lámina | Campo (`main`) | Fondo (`soft`) | Escala de tintas |
|---|---|---|---|
| Resumen | violeta `#6D2EE8` | `#F4EEFF` | atardecer: amarillo → naranja → rosa → violeta |
| Modelos Flexibles | azul `#1F5FFF` | `#E8F1FF` | océano: menta → cian → azul → índigo |
| Universidad en el Campo | magenta `#D91E8C` | `#FFEAF5` | baya: rosa pálido → magenta → ciruela |
| Estudiantes | verde `#0B8F58` | `#E6F8DA` | cafetal: lima → verde → verde azulado |
| Cobertura | ámbar `#F59A0B` | `#FFF4D6` | cosecha: amarillo → naranja → terracota |
| Cumplimiento | coral `#E5384B` | `#FFE8E8` | coral → vino |
| Administración | índigo `#2B2A6B` | `#ECEBFA` | índigo |

Tinta de texto siempre índigo profundo `#1D1A4A` (nunca negro puro). Texto sobre el campo: blanco, salvo ámbar (tinta oscura).

**Color por entidad, no por posición:** Modelos Flexibles = azul, Universidad en el Campo = magenta, Departamento de Caldas = violeta, Comité de Cafeteros = naranja. Estados de estudiante: graduado verde, activo azul, pendiente ámbar, desertor rojo. El color nunca es el único portador de significado (etiqueta o icono siempre).

## Tipografía
- **Bricolage Grotesque** (variable, eje de ancho 88 %, peso 800, tracking −0.025em): titulares y cifras. Máximo `5.5rem`.
- **Albert Sans** (variable): cuerpo y controles.
- **Spline Sans Mono** (variable): solo para cotas y cifras de datos (`.cota`), con `tabular-nums`.
Auto-alojadas con `@fontsource-variable/*`.

## Composición
Sin tarjetas KPI. Cifras grandes sueltas sobre el fondo, frases con las cifras resaltadas como marcador (`Marca`), secciones abiertas o sobre un lavado del color de la lámina (`tono="lavado"`, radio 28 px). Sin anidar contenedores.

## Piezas propias (`components/Lamina.tsx`)
- `PlacaCabecera`: campo de color a todo el ancho con la silueta real de Caldas.
- `MapaCaldas` + `LeyendaCotas`: mapa tintado en 7 bandas (escala de raíz cuadrada); tocar un tramo de la leyenda aísla esos municipios; Manizales en gris (convenio propio, sin datos).
- `Cafetal`: un punto por estudiante, agrupado por cohorte, pintado por estado; animación de entrada escalonada.
- `Vertices`: un valor por año con símbolo de vértice geodésico.
- `Posiciones`: ranking como lista con punto de color, sin barras.
Visuales ECharts (`lib/graficos.ts`): mapa, treemap con descenso, sunburst (niveles según la profundidad real), dona, burbujas de fuerza arrastrables. Cada visual tiene su tabla equivalente y descarga en CSV.

## Logos institucionales
Barra superior (fondo blanco): escudo Gobierno de Caldas · Secretaría de Educación y Comité de Cafeteros en vinotinto. Pie (banda del color de la lámina): el logo de la Gobernación sobre un recuadro blanco (su texto es gris y no se lee sobre color) y el del Comité en blanco, o en negro sobre el ámbar de Cobertura, donde el blanco no contrasta. Nunca se recolorean ni se deforman.

## Controles
Píldoras: interruptor segmentado, chips de año, listas desplegables con búsqueda. Estado activo = campo de la lámina. Foco visible de 3 px en tinta. Iconos dibujados con un solo trazo (`Icono.tsx`), sin glifos ni emoji.

## Movimiento
Un solo gesto de entrada por lámina (fundido del fondo y del titular, `cubic-bezier(.19,1,.22,1)`), más la animación de los puntos del cafetal y el re-teñido del mapa al filtrar. `prefers-reduced-motion` lo reduce a cero.

## Responsivo
Cabeceras con la silueta atenuada en móvil, sunburst en modo compacto (sin etiquetas, centro reducido), cohortes del cafetal que se reparten en filas.

## Antipatrones que se evitan
Kicker sobre el titular, tarjetas iguales con icono+título+texto, gradientes en texto, borde de color lateral, sombras duras, iconos con emoji o glifos Unicode.
