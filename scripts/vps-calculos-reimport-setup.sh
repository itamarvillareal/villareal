#!/usr/bin/env bash
# Cria tabelas de diagnóstico de reimport de cálculos na VPS (V141).
#
# Uso:
#   ./scripts/vps-calculos-reimport-setup.sh
#   ./scripts/vps-calculos-reimport-setup.sh --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
SQL_FILE="$ROOT/e-vilareal-java-backend/src/main/resources/db/migration/V141__calculo_rodada_reimport_diagnostico.sql"

DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

SSH_OPTS=()
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/villareal_vps}"
if [[ -f "$VPS_SSH_KEY" ]]; then
  SSH_OPTS=(-i "$VPS_SSH_KEY" -o IdentitiesOnly=yes)
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL não encontrado: $SQL_FILE" >&2
  exit 1
fi

echo "VPS: $VPS_HOST"
echo "SQL: $SQL_FILE"
echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] cat $SQL_FILE | ssh … mysql $DB_NAME"
  exit 0
fi

scp -q "${SSH_OPTS[@]}" "$SQL_FILE" "$VPS_HOST:/tmp/v141-calculo-reimport-diag.sql"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS $DB_NAME < /tmp/v141-calculo-reimport-diag.sql && rm -f /tmp/v141-calculo-reimport-diag.sql"

echo "Tabelas criadas/atualizadas:"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS -N -B -e \"SELECT table_name FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name LIKE 'calculo_rodada_reimport_%' ORDER BY 1;\"" 2>/dev/null | sed 's/^/  - /'
