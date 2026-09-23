# Educación rural en Caldas

Tablero web de la inversión de la Gobernación de Caldas (Secretaría de Educación) en educación rural, con el Comité de Cafeteros.
Reemplaza los dos informes de Power BI (Modelos Flexibles y Universidad en el Campo) por un solo enlace.

```
Google Sheet (privado)  ←→  Apps Script Web App (clasp)  ──►  GitHub Pages (React + Vite)
                                     ▲                              /#/admin
                                     └── POST con clave de administración
```

## Páginas
Resumen · Modelos Flexibles · Universidad en el Campo · Estudiantes · Cobertura · Cumplimiento · Administración (`/#/admin`).

## Desarrollo
```bash
npm install
python scripts/datos_local.py   # genera public/datos.local.json a partir de datos/sheet
npm run dev                     # sin VITE_API_URL lee ese JSON local
npm run build
```
`?tema=light` o `?tema=dark` en el enlace fuerza el tema.

## Datos
Los archivos fuente (`docs/`) traen nombres de estudiantes y **no se suben al repositorio** (`.gitignore`).

1. Exportar desde Power BI y dejar los dos `.xlsx` en `docs/origen-drive/`.
2. `python scripts/sembrar.py` normaliza, repara y verifica (filas, totales, privacidad) y escribe `datos/sheet/*.csv`.
3. `python scripts/subir_a_sheet.py` los sube al Google Sheet y comprueba celda por celda.

`sembrar.py` **falla** si la normalización cambia filas o totales, o si algún nombre de estudiante llega a la salida.
El export de Power BI daña algunas cantidades decimales (multiplica por 1e8 o redondea); el script repara las primeras.

## Apps Script (clasp)
```bash
cd apps-script
clasp push --force
clasp create-deployment --description "vN"     # nueva versión
clasp update-deployment <deploymentId> ...      # para conservar la misma URL
```
El Web App corre como su dueño, así el Sheet puede seguir privado. La clave de administración **no está en el código**: solo su hash SHA-256 (`TOKEN_SHA256` en `Codigo.js`); la clave real vive en `.env` (ignorado por git).
El `POST` se envía como `text/plain` a propósito: con `application/json` el navegador hace un preflight que Apps Script no responde.

## Publicación
GitHub Actions (`.github/workflows/deploy.yml`) compila y publica en Pages en cada push a `main`.
Requiere la variable de repositorio `VITE_API_URL` (URL `/exec` del Web App) y Pages con origen «GitHub Actions».
