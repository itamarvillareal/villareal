#!/usr/bin/env bash
# Importação Cadastro Pessoas (.xls) — evita falhas de parsing com vírgulas/espaços no path.
# Uso:
#   cp scripts/import-pessoas.local.env.example scripts/import-pessoas.local.env  # uma vez
#   ./scripts/run-import-pessoas.sh                                              # usa PLANILHA do .local.env
#   ./scripts/run-import-pessoas.sh "/caminho/planilha.xls"                        # ou passa o ficheiro
#   DRY_RUN=false LIMIT=0 ./scripts/run-import-pessoas.sh
set -euo pipefail
USER_CWD="$(pwd)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_ENV="$ROOT/scripts/import-pessoas.local.env"

if [[ -f "$LOCAL_ENV" ]]; then
  # shellcheck disable=SC1090
  set +u
  source "$LOCAL_ENV"
  set -u
fi

if [[ $# -ge 1 ]]; then
  PLANILHA="$1"
elif [[ -n "${PLANILHA:-}" ]]; then
  :
elif [[ -n "${VILAREAL_IMPORT_PESSOAS_PATH:-}" ]]; then
  PLANILHA="$VILAREAL_IMPORT_PESSOAS_PATH"
else
  echo "Uso: $0 [caminho-planilha.xls]" >&2
  echo "Ou crie scripts/import-pessoas.local.env com export PLANILHA=\"/caminho/absoluto.xls\" (veja import-pessoas.local.env.example)." >&2
  echo "Opcional na linha de comando: DRY_RUN=true|false, LIMIT=n (0=todas). Valores também podem estar no .local.env." >&2
  exit 1
fi
if [[ "$PLANILHA" != /* ]]; then
  PLANILHA="$USER_CWD/$PLANILHA"
fi
if [[ ! -f "$PLANILHA" ]]; then
  echo "Arquivo não encontrado: $PLANILHA" >&2
  exit 1
fi

PLANILHA_ABS="$(cd "$(dirname "$PLANILHA")" && pwd)/$(basename "$PLANILHA")"
cd "$ROOT"

export VILAREAL_IMPORT_PESSOAS_ENABLED=true
export VILAREAL_IMPORT_PESSOAS_PATH="$PLANILHA_ABS"
# DRY_RUN / LIMIT: shell primeiro; senão valores já exportados pelo import-pessoas.local.env; senão padrões seguros
export VILAREAL_IMPORT_PESSOAS_DRY_RUN="${DRY_RUN:-${VILAREAL_IMPORT_PESSOAS_DRY_RUN:-true}}"
export VILAREAL_IMPORT_PESSOAS_LIMIT="${LIMIT:-${VILAREAL_IMPORT_PESSOAS_LIMIT:-50}}"

exec ./mvnw -q spring-boot:run -Dspring-boot.run.profiles=import-pessoas,dev
