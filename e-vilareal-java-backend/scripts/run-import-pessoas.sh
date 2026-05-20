#!/usr/bin/env bash
# Importação / atualização do Cadastro de Pessoas (.xls) — job Spring Boot (sem servidor HTTP).
#
# Inclui:
#   - Pré-verificação: linhas preenchidas, bloqueios (nome/CPF), diff vs última importação
#   - Pós-verificação: confere se todas as linhas importáveis constam no relatório CSV
#   - Snapshot JSON para comparar a próxima execução
#
# Uso:
#   ./scripts/run-import-pessoas.sh --aplicar
#   ./scripts/run-import-pessoas.sh --somente-verificar
#   ./scripts/run-import-pessoas.sh --force --aplicar   # importa mesmo com bloqueios na planilha
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/scripts/import-pessoas.local.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

USE_DOCKER="${VILAREAL_IMPORT_PESSOAS_DOCKER:-false}"
DRY_RUN="${DRY_RUN:-${VILAREAL_IMPORT_PESSOAS_DRY_RUN:-false}}"
LIMIT="${LIMIT:-${VILAREAL_IMPORT_PESSOAS_LIMIT:-0}}"
UPDATE_EXISTING="${UPDATE_EXISTING:-${VILAREAL_IMPORT_PESSOAS_UPDATE_EXISTING:-true}}"
RECONCILE_CPF="${RECONCILE_CPF:-${VILAREAL_IMPORT_PESSOAS_RECONCILE_BY_CPF_WHEN_ID_MISSING:-true}}"
REPORT_PATH="${REPORT_PATH:-${VILAREAL_IMPORT_PESSOAS_REPORT_PATH:-import-pessoas-report.csv}}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-${VILAREAL_IMPORT_PESSOAS_SNAPSHOT_PATH:-$ROOT/scripts/import-pessoas-last-snapshot.json}}"
LAST_RUN_PATH="${LAST_RUN_PATH:-$ROOT/scripts/import-pessoas-last-run.json}"
VERIFY_SCRIPT="$ROOT/scripts/verificar-planilha-pessoas.py"

PLANILHA=""
SOMENTE_VERIFICAR=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker) USE_DOCKER=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --aplicar) DRY_RUN=false; shift ;;
    --somente-verificar) SOMENTE_VERIFICAR=true; shift ;;
    --force) FORCE=true; shift ;;
    -*) echo "Opção desconhecida: $1" >&2; exit 1 ;;
    *) PLANILHA="$1"; shift ;;
  esac
done

if [[ -z "$PLANILHA" ]]; then
  PLANILHA="${VILAREAL_IMPORT_PESSOAS_PATH:-}"
fi

if [[ -z "$PLANILHA" ]]; then
  DEFAULT_XLS="${VILAREAL_IMPORT_PESSOAS_DEFAULT:-$HOME/Dropbox/Sistema/Cadastro Pessoas - Itamar.xls}"
  if [[ -f "$DEFAULT_XLS" ]]; then
    PLANILHA="$DEFAULT_XLS"
  fi
fi

if [[ ! -f "$PLANILHA" ]]; then
  echo "Planilha não encontrada: ${PLANILHA:-<vazio>}" >&2
  exit 1
fi

PLANILHA_ABS="$(cd "$(dirname "$PLANILHA")" && pwd)/$(basename "$PLANILHA")"
PLANILHA_BASENAME="$(basename "$PLANILHA_ABS")"

if [[ "$REPORT_PATH" != /* ]]; then
  REPORT_PATH="$ROOT/$REPORT_PATH"
fi
if [[ "$SNAPSHOT_PATH" != /* ]]; then
  SNAPSHOT_PATH="$ROOT/$SNAPSHOT_PATH"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 é necessário para verificar-planilha-pessoas.py" >&2
  exit 1
fi
if ! python3 -c "import xlrd" 2>/dev/null; then
  echo "Instale xlrd: pip install xlrd" >&2
  exit 1
fi
chmod +x "$VERIFY_SCRIPT" 2>/dev/null || true

PREFLIGHT_JSON="$(mktemp "${TMPDIR:-/tmp}/import-pessoas-preflight.XXXXXX.json")"
trap 'rm -f "$PREFLIGHT_JSON"' EXIT

echo "Planilha: $PLANILHA_ABS"
echo "dry_run=$DRY_RUN limit=$LIMIT update_existing=$UPDATE_EXISTING reconcile_cpf=$RECONCILE_CPF"
echo "Relatório: $REPORT_PATH"
echo "Snapshot: $SNAPSHOT_PATH"
echo ""

COMPARE_WITH=()
if [[ -f "$SNAPSHOT_PATH" ]]; then
  COMPARE_WITH=(--compare-with "$SNAPSHOT_PATH")
fi

set +e
if ((${#COMPARE_WITH[@]})); then
  python3 "$VERIFY_SCRIPT" --preflight "$PLANILHA_ABS" \
    --snapshot-out "$PREFLIGHT_JSON" \
    "${COMPARE_WITH[@]}"
else
  python3 "$VERIFY_SCRIPT" --preflight "$PLANILHA_ABS" \
    --snapshot-out "$PREFLIGHT_JSON"
fi
PREFLIGHT_RC=$?
set -e

IMPORTAVEIS="$(python3 -c "import json; d=json.load(open('$PREFLIGHT_JSON')); print(d.get('linhas_importaveis',0))")"
BLOQUEIOS="$(python3 -c "import json; d=json.load(open('$PREFLIGHT_JSON')); print(len(d.get('bloqueios') or []))")"
HOUVE_ALT="$(python3 -c "
import json
d=json.load(open('$PREFLIGHT_JSON'))
diff=d.get('diff_ultima_importacao') or {}
print('true' if diff.get('houve_alteracoes') or diff.get('primeira_execucao') else 'false')
")"

if [[ "$PREFLIGHT_RC" -ne 0 && "$BLOQUEIOS" -gt 0 ]]; then
  echo ""
  if [[ "$FORCE" != true ]]; then
    echo "Abortado: $BLOQUEIOS linha(s) preenchida(s) com ID mas não importáveis (corrija nome/CPF na planilha)."
    echo "Use --force para importar mesmo assim (só entram as $IMPORTAVEIS linhas válidas)."
    exit 1
  fi
  echo "Aviso: --force ativo — importando $IMPORTAVEIS linhas válidas e ignorando $BLOQUEIOS bloqueio(s)."
fi

if [[ "$HOUVE_ALT" == "false" && "$DRY_RUN" == "false" && "$SOMENTE_VERIFICAR" != true && "$FORCE" != true ]]; then
  echo ""
  echo "Nenhuma alteração em relação à última importação (mesmo SHA-256 e fingerprints)."
  echo "Nada a aplicar. Use --force para reimportar na mesma versão da planilha."
  exit 0
fi

if [[ "$SOMENTE_VERIFICAR" == true ]]; then
  echo ""
  echo "Modo --somente-verificar: import não executado."
  exit "$PREFLIGHT_RC"
fi

run_docker() {
  local compose_dir="$REPO_ROOT"
  local mount_planilha="/planilha/$PLANILHA_BASENAME"
  local mount_out="/out"
  echo "Executando via Docker (MySQL vilareal-db)..."
  cd "$compose_dir"
  VILLAREAL_COMPOSE_JDBC_PASSWORD="${VILLAREAL_COMPOSE_JDBC_PASSWORD:-root}" \
  docker compose -f docker-compose.yml -f docker-compose.local-db.yml run --rm --no-deps \
    -e SPRING_MAIN_WEB_APPLICATION_TYPE=none \
    -e VILAREAL_IMPORT_PESSOAS_ENABLED=true \
    -e "VILAREAL_IMPORT_PESSOAS_PATH=$mount_planilha" \
    -e "VILAREAL_IMPORT_PESSOAS_DRY_RUN=$DRY_RUN" \
    -e "VILAREAL_IMPORT_PESSOAS_UPDATE_EXISTING=$UPDATE_EXISTING" \
    -e "VILAREAL_IMPORT_PESSOAS_RECONCILE_BY_CPF_WHEN_ID_MISSING=$RECONCILE_CPF" \
    -e "VILAREAL_IMPORT_PESSOAS_LIMIT=$LIMIT" \
    -e "VILAREAL_IMPORT_PESSOAS_REPORT_PATH=${mount_out}/import-pessoas-report.csv" \
    -v "$PLANILHA_ABS:$mount_planilha:ro" \
    -v "$ROOT:$mount_out" \
    backend
  if [[ -f "$ROOT/import-pessoas-report.csv" ]]; then
    cp -f "$ROOT/import-pessoas-report.csv" "$REPORT_PATH" 2>/dev/null || true
  fi
}

run_local_mvn() {
  if [[ -d /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ]]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  elif command -v /usr/libexec/java_home >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  fi
  if [[ -z "${JAVA_HOME:-}" ]] || ! "$JAVA_HOME/bin/java" -version 2>&1 | grep -q 'version "21'; then
    echo "Java 21 não encontrado; use --docker" >&2
    exit 1
  fi
  export PATH="$JAVA_HOME/bin:$PATH"
  export VILAREAL_IMPORT_PESSOAS_ENABLED=true
  export VILAREAL_IMPORT_PESSOAS_PATH="$PLANILHA_ABS"
  export VILAREAL_IMPORT_PESSOAS_DRY_RUN="$DRY_RUN"
  export VILAREAL_IMPORT_PESSOAS_UPDATE_EXISTING="$UPDATE_EXISTING"
  export VILAREAL_IMPORT_PESSOAS_RECONCILE_BY_CPF_WHEN_ID_MISSING="$RECONCILE_CPF"
  export VILAREAL_IMPORT_PESSOAS_LIMIT="$LIMIT"
  export VILAREAL_IMPORT_PESSOAS_REPORT_PATH="$REPORT_PATH"
  ./mvnw -q spring-boot:run -Dspring-boot.run.profiles=dev \
    -Dspring-boot.run.jvmArguments="-Dspring.main.web-application-type=none"
}

echo ""
if [[ "$USE_DOCKER" == true ]]; then
  run_docker
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'vilareal-db'; then
  run_docker
else
  run_local_mvn
fi

if [[ ! -f "$REPORT_PATH" ]]; then
  echo "Relatório não encontrado após import: $REPORT_PATH" >&2
  exit 1
fi

echo ""
set +e
python3 "$VERIFY_SCRIPT" --postflight "$PLANILHA_ABS" \
  --snapshot-in "$PREFLIGHT_JSON" \
  --report "$REPORT_PATH"
POST_RC=$?
set -e

if [[ "$POST_RC" -ne 0 ]]; then
  echo "Pós-verificação falhou: nem todas as linhas importáveis constam no relatório." >&2
  exit 1
fi

# Persistir snapshot e metadados da execução bem-sucedida
mkdir -p "$(dirname "$SNAPSHOT_PATH")"
cp -f "$PREFLIGHT_JSON" "$SNAPSHOT_PATH"

SUCESSO="$(awk -F, 'NR>1 && ($3=="UPDATE" || $3=="INSERT" || $3=="RECONCILE_BY_CPF")' "$REPORT_PATH" | wc -l | tr -d ' ')"
python3 -c "
import json, datetime, timezone
from pathlib import Path
snap = json.loads(Path('$PREFLIGHT_JSON').read_text(encoding='utf-8'))
meta = {
  'concluido_em': datetime.datetime.now(timezone.utc).isoformat(),
  'planilha': snap.get('planilha'),
  'planilha_sha256': snap.get('planilha_sha256'),
  'linhas_importaveis': snap.get('linhas_importaveis'),
  'linhas_com_sucesso': int('$SUCESSO'),
  'dry_run': '$DRY_RUN' == 'true',
  'relatorio': '$REPORT_PATH',
  'diff': snap.get('diff_ultima_importacao'),
}
Path('$LAST_RUN_PATH').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
"

echo ""
echo "Concluído com sucesso."
echo "  Linhas importáveis: $IMPORTAVEIS"
echo "  Sucesso no relatório: $SUCESSO"
echo "  Relatório: $REPORT_PATH"
echo "  Snapshot: $SNAPSHOT_PATH"
echo "  Última execução: $LAST_RUN_PATH"
