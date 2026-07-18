#!/usr/bin/env bash
# Dispara backfill do PDF consolidado (pasta pai de Movimentações) nos últimos N processos
# da fila Movimentações Email (PROJUDI). Acompanha job_run até concluir.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${VILAREAL_API_URL:-http://localhost:8080}"
LIMITE="${1:-100}"
LOGIN="${VILAREAL_LOGIN:-itamar}"
SENHA="${VILAREAL_IMPORT_SENHA:-${VILAREAL_SENHA:-}}"

if [[ -z "$SENHA" ]]; then
  echo "Defina VILAREAL_IMPORT_SENHA ou VILAREAL_SENHA."
  exit 1
fi

echo "API: $BASE_URL | limite: $LIMITE"

TOKEN="$(
  curl -sf "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"login\":\"$LOGIN\",\"senha\":\"$SENHA\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin).get("accessToken",""))'
)"
if [[ -z "$TOKEN" ]]; then
  echo "Falha no login."
  exit 1
fi

RESP="$(
  curl -sf -X POST "$BASE_URL/api/projudi/admin/consolidado-drive-backfill?limite=$LIMITE" \
    -H "Authorization: Bearer $TOKEN"
)"
echo "$RESP" | python3 -m json.tool

RUN_ID="$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("runId",""))')"
if [[ -z "$RUN_ID" || "$RUN_ID" == "-1" ]]; then
  echo "Backfill não iniciou (runId inválido)."
  exit 1
fi

echo "Aguardando job_run id=$RUN_ID ..."
while true; do
  STATUS_JSON="$(
    curl -sf "$BASE_URL/api/jobs/runs/$RUN_ID" -H "Authorization: Bearer $TOKEN" 2>/dev/null || true
  )"
  if [[ -z "$STATUS_JSON" ]]; then
    sleep 5
    continue
  fi
  STATUS="$(echo "$STATUS_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')"
  echo "  status=$STATUS"
  if [[ "$STATUS" == "SUCCESS" || "$STATUS" == "ERROR" || "$STATUS" == "TIMEOUT" ]]; then
    echo "$STATUS_JSON" | python3 -m json.tool
    if [[ "$STATUS" != "SUCCESS" ]]; then
      exit 2
    fi
    break
  fi
  sleep 10
done

echo "Concluído."
