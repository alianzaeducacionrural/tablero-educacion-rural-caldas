#!/usr/bin/env python3
"""Genera public/datos.local.json con la misma forma que devuelve el Web App, para desarrollar sin el Sheet.

Sin VITE_API_URL, la app lee este archivo. No se sube al repo (.gitignore) ni se usa en producción.
"""
import json
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from hojas import HOJAS, RAIZ, leer_hoja  # noqa: E402

salida = RAIZ / "public" / "datos.local.json"
hojas = {}
for nombre in HOJAS:
    if nombre == "auditoria":
        continue
    columnas, filas = leer_hoja(nombre)
    hojas[nombre] = {"columnas": columnas, "filas": filas}
    print(f"  {nombre:<16}{len(filas):>6} filas")

salida.write_text(
    json.dumps({"ok": True, "generado": datetime.now(timezone.utc).isoformat(), "hojas": hojas}, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
print(f"\nEscrito {salida} ({salida.stat().st_size / 1024:,.0f} KB)")
