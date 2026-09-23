# Design

Sistema visual del tablero, registrado desde lo construido. Producto y usuarios: ver [PRODUCT.md](PRODUCT.md).

## Mundo: atlas hipsométrico de Caldas
Un pliego de atlas sobre papel claro. El mapa real de los 27 municipios (DANE, vía geoBoundaries, CC BY 4.0; `scripts/mapa_caldas.py` → `src/data/caldas.json`) es la interfaz: se colorea, se toca para filtrar y su contorno da textura a cada cabecera. El valor es "altitud": las tintas van de valle (claro) a cumbre (oscuro). **Solo tema claro.** Se rechaza el tablero de tarjetas KPI + barras.

## Estilo de color por pestaña
Cada pestaña es una lámina con su propia familia de color. Se aplica a toda la página (cabecera, fondo, botones, escala de tintas) al cambiar de ruta (`Layout.tsx` fija las variables CSS; `lib/colores.ts` las define).

| Lámina | Campo (`main`) | Fondo (`soft`) | Escala de tintas |
|---|---|---|---|
| Resumen | violeta `#6D2EE8` | `#F4EEFF` | atardecer: amarillo → naranja → rosa → violeta |
| Modelos Educativos Flexibles | azul `#1F5FFF` | `#E8F1FF` | océano: menta → cian → azul → índigo |
| Universidad en el Campo | magenta `#D91E8C` | `#FFEAF5` | baya: rosa pálido → magenta → ciruela |
| Estudiantes | verde `#0B8F58` | `#E6F8DA` | cafetal: lima → verde → verde azulado |
| Cobertura | ámbar `#F59A0B` | `#FFF4D6` | cosecha: amarillo → naranja → terracota |
| Cumplimiento | coral `#E5384B` | `#FFE8E8` | coral → vino |
| Administración | índigo `#2B2A6B` | `#ECEBFA` | índigo |

Tinta de texto siempre índigo profundo `#1D1A4A` (nunca negro puro). Texto sobre el campo: blanco, salvo ámbar (tinta oscura).

**Color por entidad, no por posición:** Modelos Educativos Flexibles = azul, Universidad en el Campo = magenta, Departamento de Caldas = violeta, Comité de Cafeteros = naranja. Estados de estudiante: graduado verde, activo azul, pendiente ámbar, desertor rojo. El color nunca es el único portador de significado (etiqueta o icono siempre).

## Tipografía
- **Bricolage Grotesque** (variable, eje de ancho 88 %, peso 800, tracking −0.025em): titulares y cifras. Máximo `5.5rem`.
- **Albert Sans** (variable): cuerpo y controles.
- **Spline Sans Mono** (variable): solo para cotas y cifras de datos (`.cota`), con `tabular-nums`.
Auto-alojadas con `@fontsource-variable/*`.

## Composición
Sin tarjetas KPI. Cifras grandes sueltas sobre el fondo, frases con las cifras resaltadas como marcador (`Marca`), secciones abiertas o sobre un lavado del color de la lámina (`tono="lavado"`, radio 28 px). Sin anidar contenedores.

## Mezcla de visuales
Predominan las **barras, los anillos y el pastel, las tablas, las barras de avance y las comparaciones entre años**, sobre el mapa real de Caldas. No se usan burbujas ni treemap (el usuario los descartó); el sunburst queda solo en el Resumen (aportante → programa → proyecto).
- `RankingBarras` (`components/Ranking.tsx`): ranking en HTML, una fila por elemento, con la barra, el **valor completo** y la **cantidad** a la vez. Cada fila filtra.
- `columnas` (ECharts): comparación entre años, agrupada o apilada; en las láminas de programa hay una para Valor y otra para Cantidad, lado a lado.
- `TablaAniosDual` / `TablaAnios`: los años en tabla con el cambio frente al año anterior (icono y color, nunca solo color).
- `Progreso`: barra de avance de lo ejecutado contra la meta, con icono y texto.
- `dona` / `pastel` / `apiladasH`: reparto por estado, aportante, universidad o género; cofinanciación por proceso.
- `MapaCaldas` + `LeyendaCotas`: mapa tintado en 7 bandas; tocar un tramo aísla esos municipios; el tooltip suma la segunda cifra; Manizales en gris.
- `Cafetal`: un punto por estudiante, por cohorte y estado.
- `PlacaCabecera`: campo de color con la silueta real de Caldas.
**Valor y Cantidad no se alternan: se muestran siempre juntos.**

## Filtros
Barra lateral fija a la izquierda en escritorio, con secciones plegables (Año, Municipio y los de cada lámina); en el celular se abre a pantalla completa con un botón «Filtros». Lo elegido aparece además como etiquetas con una x sobre los resultados. Los filtros globales (año, municipio) se conservan al cambiar de lámina.

## Logos institucionales
Membrete oficial: franja blanca superior con el escudo Gobierno de Caldas · Secretaría de Educación a la izquierda y el Comité de Cafeteros de Caldas a la derecha, y el mismo par cerrando la página. El Comité va **solo en negro** (o blanco si algún día va sobre un color oscuro); el vinotinto no se usa. La Gobernación va siempre sobre blanco (su texto es gris). Nunca se recolorean ni se deforman.

## Movimiento
Un solo gesto de entrada por lámina (fundido del fondo y del titular, `cubic-bezier(.19,1,.22,1)`), más la animación de los puntos del cafetal y el re-teñido del mapa al filtrar. `prefers-reduced-motion` lo reduce a cero.

## Responsivo
Cabeceras con la silueta atenuada en móvil, sunburst en modo compacto (sin etiquetas, centro reducido), filas de ranking en dos líneas (barra debajo del nombre), filtros en panel a pantalla completa.

## Antipatrones que se evitan
Kicker sobre el titular, tarjetas iguales con icono+título+texto, gradientes en texto, borde de color lateral, sombras duras, iconos con emoji o glifos Unicode.
