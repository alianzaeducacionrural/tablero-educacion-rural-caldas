# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Tablero web (React 19 + Vite + Tailwind 4 + ECharts) de la inversión de la Gobernación de Caldas en educación rural, con el Comité de Cafeteros. Interfaz y datos en español. [README.md](README.md) tiene el flujo de datos y publicación; [DESIGN.md](DESIGN.md) y [PRODUCT.md](PRODUCT.md) el sistema visual y los usuarios.

## Comandos
```bash
npm install
python scripts/datos_local.py   # datos/sheet/*.csv -> public/datos.local.json (sin VITE_API_URL, `dev` lee ese JSON)
npm run dev
npm run build                   # tsc -b && vite build (el tipado es el único "test")
npm run lint                    # oxlint
```
No hay suite de pruebas. Con `VITE_API_URL` definida (URL `/exec` del Web App) la app lee del Google Sheet real; el deploy a Pages (push a `main`) exige esa variable de repositorio.

Datos: `python scripts/sembrar.py` (normaliza los `.xlsx` de `docs/origen-drive/`; los técnicos salen de la hoja 1 de `docs/Activos Técnicos-Tecnólogos 2020-2024 - Formulado.xlsx` → `datos/sheet/*.csv`, aborta si cambian filas/totales o se cuela un nombre de estudiante) y luego `python scripts/subir_a_sheet.py` (reemplaza hojas en el Sheet; usa el token fuerte de `.env`). `subir_a_sheet.py <hoja>` sube solo esa hoja (sin argumentos sube todas y pisa `alias`/`metas`; no tiene `--help`). `scripts/hojas.py` define la lista de hojas y sus columnas numéricas, compartida por los demás scripts. Apps Script: `cd apps-script && clasp push --force`; **`clasp push` no actualiza el despliegue**: hay que `clasp create-version` + `clasp redeploy <id> -V N` para conservar la misma URL.

## Arquitectura
Flujo: Google Sheet (privado) ← Apps Script Web App ([apps-script/Codigo.js](apps-script/Codigo.js)) → SPA estática en GitHub Pages (`HashRouter`, `base: './'`).

- **Datos en el cliente:** [src/lib/datos.tsx](src/lib/datos.tsx) pide todo el Sheet de una vez (`api.ts`, con caché en `localStorage`: pinta el caché y refresca por detrás) y expone dos vistas: `crudo` (tal cual el Sheet, lo usa Admin para detectar duplicados) y `datos` (pasado por `normalizar.ts`, aplicando alias/unificación de nombres; lo que se grafica). Las páginas usan `useTablero()` ([usarFiltrado.ts](src/lib/usarFiltrado.ts)), que garantiza `datos` no nulo (el `Layout` espera la carga).
- **Filtros globales** (años y municipios) en [filtros.tsx](src/lib/filtros.tsx), persistidos en `sessionStorage` y compartidos entre páginas; año por defecto 2026. Toda agregación debe pasar por `pasa(f, anio, municipio)` (`null` = la dimensión no aplica a ese conjunto). Las agregaciones viven en `agregar.ts`; las opciones de ECharts en `graficos.ts`.
- **Páginas** ([src/paginas/](src/paginas)): `Programa` sirve las dos láminas de programa (`mf` y `uc`) según prop; Resumen, Estudiantes, Cobertura, Saber11, Cumplimiento y Admin (`/#/admin`). Cada ruta tiene su propia paleta (`lib/colores.ts`, variables CSS fijadas en `Layout.tsx`); el color va por entidad, no por posición.
- **Escritura:** solo Admin escribe, con POST `text/plain` (a propósito: `application/json` dispara un preflight que Apps Script no responde). Hay dos claves, de las que el código solo guarda hashes SHA-256: la del panel (acciones de admin) y el token fuerte (único que puede reemplazar hojas enteras). Apps Script a veces devuelve una "respuesta cruzada" (a un POST le llega el JSON de otra petición), por eso `doPost` devuelve `accion` y el cliente la exige; `registrar` es idempotente con la clave `idem`.
- **Fecha "Datos al":** fija por pestaña, no sale de la carga (`CORTE_FIJO` / `CORTE_PREDETERMINADO` en `components/Layout.tsx`); Cumplimiento va sin fecha.
- **Secciones:** `Seccion` (`components/Lamina.tsx`) envuelve siempre su gráfico en un panel; los gráficos horizontales (`apiladasH`) y de columnas tienen media query para pantallas angostas.
- **Estudiantes / Saber 11 / técnicos:** se cargan con Excel desde el navegador ([src/lib/excel.ts](src/lib/excel.ts), `xlsx`) y se normalizan allí (p. ej. cédulas sin puntos).

## Reglas de datos que no son obvias
- Solo `Convenio = Gobernación`; estudiantes **sin nombres** y solo `Financiador = Gobernación`. Los `.xlsx` de `docs/` traen nombres de estudiantes: nunca al repo (`.gitignore`); no commitear `docs/` ni `.env`.
- El export de Power BI corrompe `Cantidad` (×1e8 en decimales, redondeos); `sembrar.py` lo repara.
- Duplicados de nombres: se unifican con la acción `alias_guardar` del Web App (renombra celdas y guarda el alias), no editando CSV.
- Solo tema claro; sin tarjetas KPI (ver DESIGN.md). El gráfico de burbujas/treemap fue descartado por el usuario.
- Evitar acciones que escriban datos reales o salgan a internet sin confirmar con el usuario.
