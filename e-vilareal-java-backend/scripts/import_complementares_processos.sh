#!/usr/bin/env bash
# Chama POST /api/import/complementares-processos (multipart) com JWT.
# Planilha: A=código cliente, B=proc., C–L complementares; linha 1 = cabeçalho.
#
# Uso:
#   ./e-vilareal-java-backend/scripts/import_complementares_processos.sh
#   ./e-vilareal-java-backend/scripts/import_complementares_processos.sh "/caminho/arquivo.xlsx"
#
# Token (por ordem): variável VILAREAL_IMPORT_TOKEN, ou ficheiro ao lado deste script:
#   scripts/.vilareal-import-token  (uma linha, só o accessToken; ver .vilareal-import-token.example)
#
# Opcional: VILAREAL_API_BASE (default http://localhost:8080)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="${SCRIPT_DIR}/.vilareal-import-token"

BASE="${VILAREAL_API_BASE:-http://localhost:8080}"
BASE="${BASE%/}"
XLSX="${1:-${HOME}/Dropbox/COMUM/Dados Complentares Processos.xlsx}"

if [[ -z "${VILAREAL_IMPORT_TOKEN:-}" ]] && [[ -f "$TOKEN_FILE" ]]; then
  VILAREAL_IMPORT_TOKEN="$(head -n 1 "$TOKEN_FILE" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
fi

if [[ -z "${VILAREAL_IMPORT_TOKEN:-}" ]]; then
  echo "Erro: defina VILAREAL_IMPORT_TOKEN ou crie ${TOKEN_FILE} (uma linha com o accessToken)." >&2
  exit 1
fi
if [[ ! -f "$XLSX" ]]; then
  echo "Erro: ficheiro não encontrado: $XLSX" >&2
  exit 1
fi

curl -sS -X POST "${BASE}/api/import/complementares-processos" \
  -H "Authorization: Bearer ${VILAREAL_IMPORT_TOKEN}" \
  -H "Accept: application/json" \
  -F "file=@${XLSX}" | python3 -m json.tool
