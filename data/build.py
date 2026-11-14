#!/usr/bin/env python3
"""Regenerate exhibits.js from exhibits.json (run after editing the JSON)."""
import json, pathlib
here = pathlib.Path(__file__).parent
data = json.load(open(here / "exhibits.json", encoding="utf-8"))
(here / "exhibits.js").write_text(
    "// generated from exhibits.json by data/build.py — do not edit by hand\nwindow.EXHIBITS_DATA = "
    + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
print("exhibits.js updated:", len(data["exhibits"]), "exhibits")
