#!/usr/bin/env bash
# Importa cabeçalho/fase/imóvel dos processos faltantes do cliente 728 (histórico já em massa).
set -euo pipefail
cd "$(dirname "$0")/.."
LIST="${1:-/tmp/faltam-728.txt}"
LOG="${2:-/tmp/import-real-728-faltantes.log}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
total=$(wc -l < "$LIST" | tr -d ' ')
n=0
ok=0
fail=0
: > "$LOG"
while read -r p; do
  [[ -z "$p" ]] && continue
  n=$((n + 1))
  if node scripts/import-real.mjs --cliente=728 --processo="$p" --aplicar --sem-historico >>"$LOG" 2>&1; then
    ok=$((ok + 1))
    echo "[$n/$total] proc $p OK"
  else
    fail=$((fail + 1))
    echo "[$n/$total] proc $p FALHA (ver $LOG)"
  fi
done < "$LIST"
echo "Concluído: ok=$ok falha=$fail total=$total — log: $LOG"
