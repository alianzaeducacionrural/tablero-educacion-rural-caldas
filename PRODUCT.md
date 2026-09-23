# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Funcionarios de la Secretaría de Educación de la Gobernación de Caldas y el equipo del Comité de Cafeteros (técnicos y directivos). Lo abren en computador de escritorio para explorar con filtros, y lo proyectan en reuniones y rendiciones de cuentas, donde debe leerse a distancia. Su trabajo: entender cuánto se invirtió, de dónde vino el recurso, a qué municipios e instituciones llegó y si se cumplieron las metas del convenio.

## Product Purpose
Reemplaza dos informes de Power BI (Modelos Flexibles y Universidad en el Campo) por un solo enlace web, más interactivo y completo, sobre la inversión de la Gobernación de Caldas en educación rural entre 2024 y 2026 ($5.812.501.195 en total; Departamento de Caldas 87,7 %, Comité de Cafeteros 12,3 %). Éxito: que en una reunión se pueda responder en segundos "¿en qué se invirtió, dónde, y con qué resultados?" sin abrir archivos aparte.

## Positioning
Es el único tablero que junta en una vista los dos programas del convenio, muestra la distribución del recurso entre aportantes, programas y proyectos, y añade lo que el Power BI no mostraba: cumplimiento de metas, graduación y deserción de los estudiantes técnicos, y los convocados que no asistieron.

## Operating Context
Los datos viven en un Google Sheet (base de datos) servido por un Web App de Apps Script; el sitio está en GitHub Pages. Se actualizan por el Sheet directamente, por un panel de administración protegido con clave (`/#/admin`) o volviendo a sembrar desde los Excel exportados de Power BI. Solo se muestra el convenio Gobernación.

## Capabilities and Constraints
- Páginas: Resumen, Modelos Flexibles, Universidad en el Campo, Estudiantes, Cobertura, Cumplimiento, Administración.
- Filtros globales (año, municipio) persistentes entre páginas; interruptor Valor ⇄ Cantidad; filtrado cruzado al tocar una barra; cada gráfico tiene su tabla equivalente y descarga en CSV.
- Público y sin clave; nunca se muestran nombres de estudiantes (solo `Financiador = Gobernación`, datos agregados).
- Valores en pesos colombianos. Tema claro únicamente (decisión del usuario).
- Restricciones técnicas: React + Vite + TypeScript + ECharts, HashRouter, hosting estático en GitHub Pages, sin servidor propio.
- Terminología: "vigencia" = año del convenio; "Proyecto" (Modelos Flexibles) y "Proceso" (Universidad en el Campo); "aportante" = Departamento de Caldas o Comité de Cafeteros.
- Sin decidir: si "beneficiados" suma personas distintas o persona-año; a qué vigencia pertenecen las metas cargadas (provisional 2024).

## Brand Commitments
Logos institucionales entregados por el usuario (carpeta `logo/`, sin versionar; optimizados en `src/assets/logos/`): Gobierno de Caldas · Secretaría de Educación (a color, solo sobre fondo claro) y Comité de Cafeteros de Caldas / Federación Nacional de Cafeteros en tres versiones (vinotinto, negro y blanco). Deben aparecer siempre, sin deformarse ni recolorearse. Paleta propia y libre; sin manual de marca. Nombre visible: "Educación rural en Caldas", con Gobernación de Caldas · Secretaría de Educación y Comité de Cafeteros como instituciones. El usuario pidió explícitamente: muchísimo color, algo novedoso y dinámico, no depender de gráficas de barras, y siempre tema claro.

## Evidence on Hand
Datos reales cargados y verificados (mf_base 3.594 filas, uc_base 740, beneficiados 697, estudiantes 1.684, metas). Hay logos institucionales (ver Brand Commitments); no hay fotografías del programa; no inventar testimonios, cifras ni imágenes de terceros.

## Product Principles
1. La cifra manda: el total invertido y su distribución se entienden antes que cualquier detalle.
2. Se explora tocando: cada elemento visual es también un filtro.
3. Nada se afirma sin poder verificarlo: cada visual tiene su tabla exacta y los datos son trazables al Sheet.
4. Legible desde la última fila de una sala: jerarquía y contraste pensados para proyector.

## Accessibility & Inclusion
Texto e indicadores con contraste suficiente; el color nunca es el único portador de significado (etiquetas o iconos siempre); tabla equivalente por gráfico; respeta `prefers-reduced-motion`.
