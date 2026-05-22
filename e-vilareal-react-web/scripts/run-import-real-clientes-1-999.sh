#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."

LIST="${1:-tmp/import-real-clientes-1-999.txt}"
LOG="${2:-tmp/import-real-clientes-1-999.log}"
RESUMO="${3:-tmp/import-real-clientes-1-999-summary.jsonl}"

total=$(grep -cve '^\s*$' "$LIST" || true)
n=0
ok=0
fail=0
: >"$LOG"
: >"$RESUMO"

echo "Início $(date -u +%Y-%m-%dT%H:%M:%SZ) — $total clientes — --sem-zerar (base sem cliente pré-existente)" | tee -a "$LOG"

while read -r c; do
  [[ -z "$c" ]] && continue
  n=$((n + 1))
  t0=$(date +%s)
  echo "########## [$n/$total] Cliente $c ##########" | tee -a "$LOG"
  rel="tmp/import-real-cliente-${c}.json"
  if node scripts/import-real.mjs --cliente="$c" --aplicar --sem-zerar --relatorio="$rel" >>"$LOG" 2>&1; then
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
  dur=$(($(date +%s) - t0))
  printf '%s\n' "{\"cliente\":$c,\"status\":\"$st\",\"code\":$code,\"duracaoS\":$dur,\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >>"$RESUMO"
done <"$LIST"

echo "Concluído $(date -u +%Y-%m-%dT%H:%M:%SZ): ok=$ok falha=$fail total=$total" | tee -a "$LOG"
echo "Log: $LOG"
echo "Resumo: $RESUMO"
