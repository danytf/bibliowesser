#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Comprueba, para cada ONG de index.html, que las cifras citadas en
speech.discurso / speech.cierre / captacion.resumen30 coinciden con
alguna cifra ya presente en cifras[] o programas[].dato/desc de esa
misma ficha.

No verifica los datos contra la realidad (eso lo hace el flujo de
PROCESAR_RECURSO.md) — solo detecta desincronizaciones INTERNAS: una
cifra que se actualizo en un sitio de la ficha pero no se propago al
discurso o al resumen de 30 segundos, que citan las mismas cifras en
otras palabras.

Uso:
    python scripts/check_consistency.py

Salida: 0 si no hay hallazgos, 1 si hay alguno que revisar a mano.
"""
import re
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
INDEX_HTML = PROJECT_DIR / "index.html"

NGO_IDS = ["aecc", "aldeas", "cruzroja", "fec", "fjc", "fpm", "wwf"]

# Numero con formato español: miles con punto, decimales con coma,
# opcionalmente seguido de % o precedido de +/~/más de.
NUM_RE = re.compile(
    r"(?<![\w.,])"
    r"\d{1,3}(?:\.\d{3})+(?:,\d+)?%?"   # con separador de miles: 1.285.834 / 132.000
    r"|\d+,\d+%"                         # decimal con %: 25,7%  / 1,5°C
    r"|\d{2,3}%"                         # porcentaje simple >=2 digitos: 73%, 22%
    r"(?![\w.,])"
)

# Años sueltos (2013-2030) y numeros triviales cortos no son
# interesantes para esta comprobacion — se filtran aparte.
YEAR_RE = re.compile(r"^(19|20)\d{2}$")


def normalize(num_str):
    """Quita separador de miles, dejando coma decimal y sufijo %."""
    return num_str.replace(".", "")


def extract_numbers(text):
    if not text:
        return set()
    found = set()
    for m in NUM_RE.finditer(text):
        raw = m.group(0)
        if YEAR_RE.match(raw):
            continue
        found.add(normalize(raw))
    return found


def load_ngo_json(html, ngo_id):
    pattern = r'<script type="application/json" id="data-%s">(.*?)</script>' % re.escape(ngo_id)
    m = re.search(pattern, html, re.S)
    if not m:
        raise SystemExit("No se encontro el bloque data-%s en index.html" % ngo_id)
    import json
    return json.loads(m.group(1))


def canonical_numbers(data):
    """Numeros 'fuente de verdad': cifras[] y programas[].dato/desc."""
    nums = set()
    for c in data.get("cifras", []):
        nums |= extract_numbers(c.get("num", ""))
        nums |= extract_numbers(c.get("label", ""))
    for p in data.get("programas", []):
        nums |= extract_numbers(p.get("dato", ""))
        nums |= extract_numbers(p.get("desc", ""))
    nums |= extract_numbers(data.get("claim", ""))
    nums |= extract_numbers(data.get("problema", ""))
    for ms in data.get("motivosSocio", []):
        nums |= extract_numbers(ms)
    return nums


def cited_numbers(data):
    """Numeros citados en las piezas de discurso/resumen de 30s."""
    nums = {}
    speech = data.get("speech", {})
    for field in ("discurso", "cierre", "parada"):
        for n in extract_numbers(speech.get(field, "")):
            nums.setdefault(n, set()).add("speech.%s" % field)

    resumen = data.get("captacion", {}).get("resumen30", {})
    for c in resumen.get("cifras", []):
        for n in extract_numbers(c):
            nums.setdefault(n, set()).add("captacion.resumen30.cifras")
    for lbl in resumen.get("labels", []):
        for n in extract_numbers(lbl):
            nums.setdefault(n, set()).add("captacion.resumen30.labels")
    cierre = resumen.get("cierre", "")
    for n in extract_numbers(cierre):
        nums.setdefault(n, set()).add("captacion.resumen30.cierre")
    return nums


def main():
    html = INDEX_HTML.read_text(encoding="utf-8")
    total_findings = 0

    for ngo_id in NGO_IDS:
        data = load_ngo_json(html, ngo_id)
        canon = canonical_numbers(data)
        cited = cited_numbers(data)

        missing = {n: srcs for n, srcs in cited.items() if n not in canon}

        if missing:
            print("=== %s: %d cifra(s) citada(s) sin respaldo claro en cifras[]/programas ===" % (
                data.get("full", ngo_id), len(missing)))
            for n, srcs in sorted(missing.items()):
                print("  - %-12s  citado en: %s" % (n, ", ".join(sorted(srcs))))
            total_findings += len(missing)
        else:
            print("OK  %s: todas las cifras de discurso/resumen30 tienen respaldo en la ficha" % data.get("full", ngo_id))

    print()
    if total_findings:
        print("%d posible(s) desincronizacion(es) a revisar a mano (falsos positivos posibles: cifras genericas tipo '100%%' o numeros que aparecen con otro formato)." % total_findings)
        return 1
    print("Sin hallazgos. Todo consistente.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
