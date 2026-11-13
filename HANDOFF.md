# HANDOFF · Gobernación

> Si eres un chat nuevo: lee este archivo completo y luego los demás .md del proyecto antes de seguir.

<!-- handoff:auto:start -->
## Estado (automático, 2026-11-13T00:07:29.807Z)

- Carpeta del proyecto: c:\Users\alejo\Documents\Comité de Cafeteros\2026\Plataformas\Tableros aliados\Gobernación
- Contexto de la sesión: 20% (203473 de 1000000 tokens)
- Costo de la sesión: $2.58
- Git (solo esta carpeta): 0 archivos sin commit · 0 commits por subir · 0 commits de otras carpetas
- Servidores locales: ninguno

## Plan por fases

### Fase 1 · Revisión técnica (100%)
Cómo: Compilar, pasar el linter y levantar el tablero en local.
- [x] Compilar y pasar el linter
- [x] Levantar el tablero en local

### Fase 2 · Revisión visual (100%)
Cómo: Abrir cada pestaña en computador y celular.
- [x] Revisar las 8 pestañas en escritorio
- [x] Revisar las pestañas en celular

### Fase 3 · Ajustes (100%)
Cómo: Corregir lo encontrado y volver a compilar.
- [x] Corregir problemas encontrados
- [x] Verificar y reportar


## Ideas para el programa

- **Ocultar el chip de fecha en la pestaña Administración** (propuesta): Hoy muestra 'Datos al 31/08/2026' aunque el panel no es una pestaña de datos.
- **Revisar en celular las pestañas de Estudiantes, Cobertura y Saber 11** (propuesta): En esta revisión solo se inspeccionó a detalle el Resumen en celular; las demás solo se comprobó que no se desborden.
- **Hacer el panel de cada sección un poco más marcado en pestañas de fondo muy claro (p. ej. Saber 11)** (propuesta): El fondo del panel se confunde con el de la página; el usuario puede querer más contraste.
- **Una orden para subir una sola hoja con confirmación y --help en subir_a_sheet.py** (propuesta): Hoy cualquier argumento se toma como nombre de hoja y sin argumentos pisa alias y metas.

## Tareas del usuario

- [ ] Probar el panel /admin en el sitio publicado
- [ ] Decidir si Saber 11 y Universidad en el Campo se actualizan y con qué archivos
- [ ] Confirmar metas con vigencia provisional y si 'beneficiados' suma personas distintas o persona-año

## Agentes

_Ninguno._

## Enlaces

- Repositorio: https://github.com/alianzaeducacionrural/tablero-educacion-rural-caldas
- GitHub Pages: https://alianzaeducacionrural.github.io/tablero-educacion-rural-caldas/
<!-- handoff:auto:end -->

## Resumen y decisiones

Sesión del 2026-11-12. Todo lo de abajo está publicado en `main` (último commit e61cecf) salvo lo indicado.

- **Fecha "Datos al …" fija por pestaña** (chip en la cabecera, tabla `CORTE_FIJO` en `src/components/Layout.tsx`): 31/10/2026 para Resumen, Modelos Educativos Flexibles, Cobertura y Saber 11; 31/08/2026 para Universidad en el Campo, Técnicos Profesionales y Administración (`CORTE_PREDETERMINADO`); Cumplimiento sin fecha. **Por qué:** el usuario quiere congelar el corte por pestaña y ya no usar la fecha de la última carga (`datos.generado` dejó de mostrarse). Al cambiar un corte hay que editar esa tabla a mano.
- **Datos de Modelos Flexibles actualizados** con `docs/Informe Modelos Flexibles.xlsx` (3.891 → 4.102 filas, $3.266 M → $3.428 M). Se corrió `python scripts/sembrar.py` y se subió **solo `mf_base`** con `python scripts/subir_a_sheet.py mf_base` (verificado celda por celda). No se subieron `alias`, `metas` ni las demás hojas para no pisar lo editado en el panel. Cobertura se alimenta de esos mismos datos. Saber 11 se regeneró en local pero no se subió.
- **Fix en `scripts/sembrar.py`** (~línea 395): la cantidad llegaba como entero y la reparación ×1e8 fallaba; ahora se convierte a `float` antes.
- **Instituciones unificadas** con la acción `alias_guardar` del Web App (renombra celdas y registra el alias): "Gómez Arrubla" → "Eduardo Gómez Arrubla" (Chinchiná, 2 celdas) y "Gregorio Gutierrez" → "Gregorio Gutiérrez González" (Manzanares, 1 celda; se conservó el nombre largo con tilde porque ya estaba en 78 filas).
- **Revisión visual** de las 8 pestañas (escritorio y celular): sin errores de consola ni desborde horizontal. Arreglos: gráficos de barras horizontales (`apiladasH`) en celular (leyenda sobre la primera barra, cotas del eje pisadas) con media query `maxWidth: 520`; "1 sede" en singular en Cobertura; contraste del botón inactivo del selector sobre el encabezado de color.
- **Todas las secciones van en panel** (`Seccion` en `src/components/Lamina.tsx`: fondo `wash/70`, borde, sombra suave y barrita de color sobre el título). Se eliminó el parámetro `tono`. **Por qué:** el usuario quería cada gráfico con su título y texto "envuelto"; esto contradice el "sin anidar contenedores" de DESIGN.md, que quedó desactualizado en ese punto.
- `CLAUDE.md` creado con `/init`.
- **Resumen con filtro de Estado** (`Resumen.tsx`): "Convenio" queda activado siempre al cargar la página. Beneficiados/estudiantes no se filtran por estado.
- **Cumplimiento en blanco**: la pestaña solo muestra la cabecera y "Esta lámina se está actualizando con la información de 2026." **Por qué:** el usuario pasará la información de 2026. La versión anterior está en git (commit previo a 068f18d). Hasta entonces no hay fecha "Datos al" ahí.
- **"Reinversión" → "Convenio"**: se renombró en el Sheet con `alias_guardar` (tipo estado, 19 celdas de Universidad en el Campo). El campo de metas `reinversion` en `/admin`, `colores.ts` y `sembrar.py` **no se tocó**; si el usuario lo pide, falta cambiarlo ahí.
- **Footer**: se quitó "Contornos municipales: DANE, vía geoBoundaries (CC BY 4.0)". El crédito sigue en README y DESIGN.md; el sitio ya no lo muestra (la licencia CC BY pide atribución: avisado al usuario).
- No se verificó que el despliegue en GitHub Pages terminara tras los últimos push.

**Trampas encontradas**
- `subir_a_sheet.py` **no tiene `--help`**: cualquier argumento se toma como nombre de hoja. Sin argumentos sube todas las hojas (sobrescribe `alias`, `metas`, etc.).
- `sembrar.py` lee `Informe Modelos Flexibles.xlsx` y `Informe U Campo.xlsx` de `docs/` (`--mf-raiz`, `--uc-raiz`) además de `docs/origen-drive/`.
- `datos/sheet/` y `docs/` están en `.gitignore`: los CSV regenerados no se versionan.
- En local sin `VITE_API_URL` el panel `/admin` solo muestra datos de ejemplo.
- Los avisos de `oxlint` (`exhaustive-deps` en Resumen/Cobertura) son falsos positivos conocidos; no se tocaron.
- Un `Stop-Process` por puerto en PowerShell da "Acceso denegado" (proceso Idle); para cerrar el servidor de pruebas basta cerrar su terminal.

## Cómo continuar

1. `git pull`, `npm install`, `python scripts/datos_local.py` y `npm run dev` para ver el tablero en local.
2. Pendientes del usuario: probar `/admin` en el sitio publicado (registrar actividad, metas, alias); decidir si Saber 11 y Universidad en el Campo también se actualizan y con qué archivos; confirmar las pendientes de la memoria del proyecto (metas con vigencia provisional, si "beneficiados" suma personas distintas o persona-año, mover el Sheet a la carpeta de Drive).
3. Si se actualizan más datos: `sembrar.py` → revisar `datos/sheet/reporte_siembra.txt` (invariantes en OK) → subir **solo las hojas que cambiaron** → actualizar `CORTE_FIJO` en `Layout.tsx` si cambia el corte.
4. **Esperando del usuario:** la información de Cumplimiento 2026 para reconstruir esa pestaña (y definir su fecha en `CORTE_FIJO`).
5. Ideas abiertas: ocultar el chip de fecha en Administración; revisar a fondo en celular Estudiantes, Cobertura y Saber 11 (solo se inspeccionó el Resumen).
6. Cualquier acción que escriba datos reales en el Sheet o salga a internet: confirmar antes con el usuario.
