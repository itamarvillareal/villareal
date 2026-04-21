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
  set -a
  source "$LOCAL_ENV"
  set +a
  set -u
fi

# VPS: credenciais e overrides (SPRING_DATASOURCE_*, etc.) — mesmo ficheiro do systemd.
# systemd exporta cada linha; com `source` no bash é preciso set -a para exportar ao java/mvnw.
if [[ -r /etc/vilareal/backend.env ]]; then
  # shellcheck disable=SC1090
  set +u
  set -a
  source /etc/vilareal/backend.env
  set +a
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

# Não forçar sempre "dev": em produção use SPRING_PROFILES_ACTIVE=prod (credenciais vêm do backend.env).
IMPORT_RUN_PROFILE="${SPRING_PROFILES_ACTIVE:-dev}"

# Em VPS (prod), spring-boot:run via Maven pode não aplicar SPRING_DATASOURCE_* ao contexto; o JAR replica o systemd.
DEFAULT_API_JAR="/opt/vilareal/api/api.jar"
API_JAR="${VILAREAL_IMPORT_PESSOAS_API_JAR:-}"
if [[ -z "${API_JAR}" ]] && [[ -f "${DEFAULT_API_JAR}" ]]; then
  API_JAR="${DEFAULT_API_JAR}"
fi
if [[ -n "${API_JAR}" ]] && [[ -f "${API_JAR}" ]] && [[ "${IMPORT_RUN_PROFILE}" == "prod" ]]; then
  # shellcheck disable=SC2086
  exec java ${JAVA_OPTS-} -Dspring.main.web-application-type=none -jar "${API_JAR}"
fi

exec ./mvnw -q spring-boot:run -Dspring-boot.run.profiles="${IMPORT_RUN_PROFILE}" \
  -Dspring-boot.run.jvmArguments="-Dspring.main.web-application-type=none"
