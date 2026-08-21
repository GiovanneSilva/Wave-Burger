#!/usr/bin/env python3
"""Lê coverage/coverage-summary.json (gerado pelo reporter json-summary do
Jest) e imprime uma tabela Markdown, para anexar ao $GITHUB_STEP_SUMMARY.
Script separado do workflow YAML para evitar aninhar aspas/crases de JS
dentro de um bloco `run:` — mais fácil de testar isoladamente também.
"""
import json
import sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else "coverage/coverage-summary.json")

if not path.exists():
    sys.exit(0)

data = json.loads(path.read_text())
total = data["total"]

rows = [
    ("Linhas", total["lines"]),
    ("Funções", total["functions"]),
    ("Branches", total["branches"]),
    ("Statements", total["statements"]),
]

print("## Cobertura de testes — backend\n")
print("| Métrica | % | Cobertos |")
print("|---|---|---|")
for label, metric in rows:
    print(f"| {label} | {metric['pct']}% | {metric['covered']}/{metric['total']} |")
