#!/usr/bin/env python3
"""Sube los CSV de datos/sheet al Google Sheet a través del Web App (acción `sembrar`) y verifica lo subido.

Necesita en .env:  API_URL=<URL /exec del Web App>   y   ADMIN_TOKEN=<clave de administración>
Reemplaza el contenido de cada pestaña. Sin argumentos sube todas; con nombres de pestaña (p. ej. `estudiantes`)
sube solo esas y deja intacto el resto, que puede tener registros hechos desde el panel de administración.
"""
import json
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from hojas import HOJAS, RAIZ, leer_hoja  # noqa: E402


def cargar_env():
    env = {}
    ruta = RAIZ / ".env"
    if ruta.exists():
        for linea in ruta.read_text(encoding="utf-8").splitlines():
            if "=" in linea and not linea.lstrip().startswith("#"):
                k, v = linea.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def llamar(url, cuerpo=None, intentos=4):
    """POST como text/plain (evita el preflight CORS de Apps Script) usando curl, que sigue bien el 302 hacia el resultado.

    Reintenta si Google devuelve HTML o un error transitorio. Solo se reintentan acciones idempotentes
    (sembrar reemplaza la hoja; el resto de pruebas de este script no escriben)."""
    ultimo = ""
    for i in range(intentos):
        cmd = ["curl", "-sL", "-m", "180"]
        if cuerpo is not None:
            cmd += ["-H", "Content-Type: text/plain;charset=utf-8", "--data-binary", "@-"]
        cmd.append(url)
        r = subprocess.run(cmd, input=None if cuerpo is None else json.dumps(cuerpo, ensure_ascii=False).encode("utf-8"), capture_output=True)
        ultimo = r.stdout.decode("utf-8", "replace")
        try:
            return json.loads(ultimo)
        except json.JSONDecodeError:
            time.sleep(3 * (i + 1))
    raise SystemExit("[ERROR] El Web App no devolvió JSON tras varios intentos (¿falta autorizar el script o el acceso no es público?).\n" + ultimo[:300])


def main():
    env = cargar_env()
    url, token = env.get("API_URL"), env.get("ADMIN_TOKEN")
    if not url or not token:
        raise SystemExit("[ERROR] Falta API_URL o ADMIN_TOKEN en .env")

    pedidas = sys.argv[1:]
    desconocidas = [h for h in pedidas if h not in HOJAS]
    if desconocidas:
        raise SystemExit(f"[ERROR] Pestañas desconocidas: {desconocidas}. Válidas: {list(HOJAS)}")
    hojas = [h for h in HOJAS if h in pedidas] if pedidas else list(HOJAS)

    print("Comprobando conexión…")
    if not llamar(url + "?action=ping").get("ok"):
        raise SystemExit("[ERROR] ping falló")

    for nombre in hojas:
        columnas, filas = leer_hoja(nombre)
        r = llamar(url, {"token": token, "action": "sembrar", "hoja": nombre, "columnas": columnas, "filas": filas, "quien": "siembra"})
        if not r.get("ok"):
            raise SystemExit(f"[ERROR] {nombre}: {r.get('error')}")
        print(f"  subida {nombre:<16}{r['filas']:>6} filas")

    print("\nVerificando lo que quedó en el Sheet…")
    leido = llamar(url + "?action=datos")["hojas"]
    fallos = 0
    for nombre in hojas:
        if nombre == "auditoria":
            continue
        columnas, filas = leer_hoja(nombre)
        remoto = leido[nombre]
        ok = remoto["columnas"] == columnas and len(remoto["filas"]) == len(filas)
        # Comparación celda a celda: detecta que Sheets no convirtiera texto en fecha o número.
        if ok:
            for a, b in zip(filas, remoto["filas"]):
                if [str(x) for x in a] != [str(x) for x in b]:
                    ok = False
                    print(f"    primera diferencia en {nombre}: {a} != {b}")
                    break
        print(f"  {'OK    ' if ok else 'FALLA '}{nombre}: {len(remoto['filas'])} filas")
        fallos += not ok
    if fallos:
        raise SystemExit(f"\n[ERROR] {fallos} hoja(s) no coinciden con los CSV.")
    print("\nTodo coincide con los CSV.")


if __name__ == "__main__":
    main()
