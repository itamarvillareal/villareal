#!/usr/bin/env bash
# Copia tabelas financeiro_investimento_* do MySQL local (vilareal-db) para a VPS.
#
# Uso:
#   ./scripts/sync-investimentos-to-vps.sh --dry-run
#   ./scripts/sync-investimentos-to-vps.sh --yes
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
LOCAL_CONTAINER="${LOCAL_CONTAINER:-vilareal-db}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"

DRY_RUN=0
YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
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

TABLES=(
  financeiro_investimento_import
  financeiro_investimento_movimentacao
  financeiro_investimento_operacao
  financeiro_investimento_operacao_lancamento
)

if ! docker ps --format '{{.Names}}' | grep -qx "$LOCAL_CONTAINER"; then
  echo "Container $LOCAL_CONTAINER não está a correr." >&2
  exit 1
fi

echo "=== Investimentos BTG: local → VPS ==="
for t in "${TABLES[@]}"; do
  n="$(docker exec "$LOCAL_CONTAINER" mysql -u "$DB_USER" -p"$DB_PASS" -N -B -e \
    "SELECT COUNT(*) FROM $DB_NAME.$t;" 2>/dev/null)"
  echo "  local.$t: ${n:-0}"
done
echo

STAMP="$(date +%Y%m%d_%H%M%S)"
WORKDIR="${TMPDIR:-/tmp}/villareal-invest-sync-$STAMP"
mkdir -p "$WORKDIR"
REPLACE_SQL="$WORKDIR/investimentos-replace.sql"
VPS_BACKUP="/tmp/vilareal-backup-investimentos-$STAMP.sql"

echo "Gerando dump local..."
docker exec "$LOCAL_CONTAINER" mysqldump -u "$DB_USER" -p"$DB_PASS" \
  --no-create-info \
  --complete-insert \
  --skip-extended-insert \
  --skip-add-locks \
  --skip-disable-keys \
  "$DB_NAME" "${TABLES[@]}" >"$WORKDIR/data.sql"

if [[ ! -s "$WORKDIR/data.sql" ]]; then
  echo "Erro: dump vazio." >&2
  exit 1
fi

{
  echo "-- Sync investimentos BTG local → VPS ($STAMP)"
  echo "SET NAMES utf8mb4;"
  echo "SET FOREIGN_KEY_CHECKS = 0;"
  echo "DELETE FROM financeiro_investimento_operacao_lancamento;"
  echo "DELETE FROM financeiro_investimento_operacao;"
  echo "DELETE FROM financeiro_investimento_movimentacao;"
  echo "DELETE FROM financeiro_investimento_import;"
  echo
  grep '^INSERT INTO' "$WORKDIR/data.sql" || true
  echo
  echo "SET FOREIGN_KEY_CHECKS = 1;"
} >"$REPLACE_SQL"

LINES="$(grep -c '^INSERT INTO' "$REPLACE_SQL" || true)"
echo "SQL: $REPLACE_SQL ($LINES INSERTs)"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Nada enviado à VPS."
  exit 0
fi

if [[ "$YES" -ne 1 ]]; then
  echo "Use --yes para aplicar na VPS."
  exit 2
fi

echo "Backup VPS (só tabelas investimento)..."
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysqldump -u $DB_USER -p$DB_PASS $DB_NAME \
  financeiro_investimento_operacao financeiro_investimento_movimentacao financeiro_investimento_import \
  2>/dev/null" >"$WORKDIR/vps-backup-local-copy.sql" || true

ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysqldump -u $DB_USER -p$DB_PASS $DB_NAME \
  financeiro_investimento_operacao financeiro_investimento_movimentacao financeiro_investimento_import \
  > $VPS_BACKUP 2>/dev/null && echo Backup VPS: $VPS_BACKUP"

echo "Aplicando na VPS..."
scp "${SSH_OPTS[@]}" "$REPLACE_SQL" "$VPS_HOST:/tmp/investimentos-replace-$$.sql"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS $DB_NAME < /tmp/investimentos-replace-$$.sql && rm -f /tmp/investimentos-replace-$$.sql"

echo "Verificação VPS:"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS -N -B -e \"
SELECT 'mov', COUNT(*) FROM $DB_NAME.financeiro_investimento_movimentacao
UNION ALL SELECT 'ops', COUNT(*) FROM $DB_NAME.financeiro_investimento_operacao
UNION ALL SELECT 'fechadas_taxa', COUNT(*) FROM $DB_NAME.financeiro_investimento_operacao WHERE status='FECHADA' AND taxa_mensal_liquida IS NOT NULL;
\""

echo "Concluído."
