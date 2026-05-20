#!/usr/bin/env bash
# Import-real em lote a partir de lista (um código por linha).
set -euo pipefail
cd "$(dirname "$0")/.."

LIST="${1:-tmp/import-real-clientes-lista.txt}"
LOG="${2:-tmp/import-real-clientes-lote.log}"
RESUMO="${3:-tmp/import-real-clientes-lote-summary.jsonl}"

if [[ ! -f "$LIST" ]]; then
  echo "Lista não encontrada: $LIST" >&2
  exit 1
fi

total=$(grep -cve '^\s*$' "$LIST" || true)
n=0
ok=0
fail=0
: > "$LOG"
: > "$RESUMO"

while read -r c; do
  [[ -z "$c" ]] && continue
  n=$((n + 1))
  t0=$(date +%s)
  echo "########## [$n/$total] Cliente $c ##########" | tee -a "$LOG"
  rel="tmp/import-real-cliente-${c}.json"
  if node scripts/import-real.mjs --cliente="$c" --aplicar --relatorio="$rel" >>"$LOG" 2>&1; then
    ok=$((ok + 1))
    st=ok
    code=0
    echo "[$n/$total] cliente $c OK" | tee -a "$LOG"
  else
    fail=$((fail + 1))
    st=fail
    code=$?
    echo "[$n/$total] cliente $c FALHA (code=$code)" | tee -a "$LOG"
  fi
  dur=$(( $(date +%s) - t0 ))
  printf '%s\n' "{\"cliente\":$c,\"status\":\"$st\",\"code\":$code,\"duracaoS\":$dur,\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >>"$RESUMO"
done < "$LIST"

echo "Concluído: ok=$ok falha=$fail total=$total"
echo "Log: $LOG"
echo "Resumo: $RESUMO"
[[ "$fail" -eq 0 ]]
