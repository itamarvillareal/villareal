#!/usr/bin/env bash
# Importa partes do processo (90/95) — não importa 151.1.0 (cadastro Clientes).
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-/tmp/import-partes-clientes-1-10.log}"
: > "$LOG"
ok=0
fail=0
for c in 1 2 3 4 5 6 7 8 9 10; do
  echo "=== cliente $c ===" | tee -a "$LOG"
  if node scripts/import-processo-partes-txt.mjs --cliente="$c" --aplicar >>"$LOG" 2>&1; then
    ok=$((ok + 1))
    echo "[cliente $c] OK" | tee -a "$LOG"
  else
    fail=$((fail + 1))
    echo "[cliente $c] FALHA (ver $LOG)" | tee -a "$LOG"
  fi
done
echo "Concluído: ok=$ok falha=$fail — log: $LOG"
