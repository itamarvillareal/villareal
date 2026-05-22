#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."

IMPORT_PID="${1:-}"
LOG="${2:-tmp/sync-prazos-fatais-aplicar.log}"
REL="${3:-tmp/relatorio-prazos-fatais-aplicar.json}"
export VILAREAL_API_BASE="${VILAREAL_API_BASE:-http://localhost:8080}"

run_sync() {
  local fase="$1"
  echo "" | tee -a "$LOG"
  echo "=== Prazos fatais ($fase) $(date -u +%Y-%m-%dT%H:%M:%SZ) API=$VILAREAL_API_BASE ===" | tee -a "$LOG"
  ./scripts/sync-prazos-fatais-dropbox.sh --aplicar --relatorio="$REL" >>"$LOG" 2>&1 || true
}

if [[ -n "$IMPORT_PID" ]] && kill -0 "$IMPORT_PID" 2>/dev/null; then
  echo "Aguardando import-real PID $IMPORT_PID…" | tee -a "$LOG"
  while kill -0 "$IMPORT_PID" 2>/dev/null; do
    sleep 60
  done
  echo "import-real terminou." | tee -a "$LOG"
fi

run_sync "passagem-final"
