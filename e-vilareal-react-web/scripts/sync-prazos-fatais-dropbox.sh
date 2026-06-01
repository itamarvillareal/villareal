#!/usr/bin/env bash
# Sincroniza prazos fatais: Dropbox Gerais/{Milhar}/{Centena}/{Unidade} → API (MySQL).
# Não usa Gerais/145.1/aaaa/mm (histórico mensal).
#
# Pré-visualização (não grava):
#   ./scripts/sync-prazos-fatais-dropbox.sh
#
# Aplicar na base:
#   ./scripts/sync-prazos-fatais-dropbox.sh --aplicar
#
# Um cliente:
#   ./scripts/sync-prazos-fatais-dropbox.sh --aplicar --cliente=149
#
# Variáveis: VILAREAL_API_BASE (defeito http://localhost:8081), VILAREAL_IMPORT_SENHA
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_API="${VILAREAL_API_BASE:-http://localhost:8081}"
export VILAREAL_API_BASE="$BASE_API"

APLICAR=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --aplicar) APLICAR=1 ;;
    *) ARGS+=("$arg") ;;
  esac
done

if ! curl -sf "${BASE_API}/actuator/health" >/dev/null 2>&1; then
  echo "Erro: backend indisponível em ${BASE_API}" >&2
  echo "Suba o backend (ex.: docker compose … up -d backend) e tente de novo." >&2
  exit 1
fi

if [[ -z "${VILAREAL_IMPORT_SENHA:-}" ]] && [[ ! -f "${HOME}/.vilareal-import-env" ]] && [[ ! -f ".env.import.local" ]]; then
  if [[ "$APLICAR" -eq 1 ]]; then
    echo "Aviso: defina VILAREAL_IMPORT_SENHA ou crie ~/.vilareal-import-env antes de --aplicar." >&2
  fi
fi

mkdir -p tmp

CMD=(node scripts/sync-prazos-fatais-dropbox.mjs)
if ((${#ARGS[@]} > 0)); then
  CMD+=("${ARGS[@]}")
fi
if [[ "$APLICAR" -eq 1 ]]; then
  CMD+=(--aplicar)
  echo "→ Aplicando prazos fatais (Gerais Milhar/Centena/Unidade) na API (${BASE_API})…"
else
  echo "→ Pré-visualização (dry-run). Para gravar: $0 --aplicar $*"
fi

"${CMD[@]}"
