#!/usr/bin/env bash
# Importa imóveis do export «Villa Real - Administração de Imóveis - Itamar.xls» (converte .xls se necessário).
set -euo pipefail
cd "$(dirname "$0")/.."
export VILAREAL_API_BASE_URL="${VILAREAL_API_BASE_URL:-${VILAREAL_API_BASE:-http://localhost:8080}}"
PLANILHA="${VILAREAL_IMPORT_IMOVEIS_PLANILHA_PATH:-$HOME/Dropbox/sistema/Villa Real - Administração de Imóveis - Itamar.xls}"
exec node scripts/import-imoveis-planilha.mjs "$PLANILHA" "$@"
