#!/usr/bin/env bash
# Reapontar lançamentos financeiros cliente 00000804 → 00000938 | proc 27 na VPS (produção).
#
# Uso:
#   ./scripts/reapontar-cliente-804-938-27-vps.sh --dry-run
#   ./scripts/reapontar-cliente-804-938-27-vps.sh --yes
#   ./scripts/reapontar-cliente-804-938-27-vps.sh --yes --db vilareal_portal1
#
# Pré-requisitos:
#   - SSH root@161.97.175.73 (chave ~/.ssh/villareal_vps)
#   - arquivo V224 no repositório local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
SQL_FILE="${ROOT}/e-vilareal-java-backend/src/main/resources/db/migration/V224__financeiro_reapontar_cliente_804_para_938_27.sql"

DRY_RUN=0
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    --db)
      DB_NAME="$2"
      shift
      ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ "$DRY_RUN" -eq 0 && "$YES" -eq 0 ]]; then
  echo "Use --dry-run ou --yes." >&2
  exit 2
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Arquivo não encontrado: $SQL_FILE" >&2
  exit 1
fi

SSH_OPTS=()
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/villareal_vps}"
if [[ -f "$VPS_SSH_KEY" ]]; then
  SSH_OPTS=(-i "$VPS_SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes)
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
REMOTE_SQL="/tmp/v224-reapontar-804-938-27-$STAMP.sql"
REMOTE_BACKUP="/opt/villareal/backups/financeiro-804-antes-v224-$STAMP.sql"

mysql_vps() {
  ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u$DB_USER -p$DB_PASS -N -B $DB_NAME -e $(printf '%q' "$1") 2>/dev/null"
}

echo "==> Destino: $VPS_HOST / $DB_NAME"
echo "==> SQL: $SQL_FILE"

echo "==> Pré-checagem"
PRE="$(mysql_vps "
SELECT CONCAT(
  'cli804=', (SELECT COUNT(*) FROM cliente WHERE TRIM(codigo_cliente) IN ('00000804','804')),
  ' cli938=', (SELECT COUNT(*) FROM cliente WHERE TRIM(codigo_cliente) IN ('00000938','938')),
  ' proc27=', (SELECT COUNT(*) FROM processo p JOIN cliente c ON c.id=p.cliente_id WHERE TRIM(c.codigo_cliente) IN ('00000938','938') AND p.numero_interno=27),
  ' fl804=', (SELECT COUNT(*) FROM financeiro_lancamento fl JOIN cliente c ON c.id=fl.cliente_id WHERE TRIM(c.codigo_cliente) IN ('00000804','804')),
  ' flc804=', (SELECT COUNT(*) FROM financeiro_lancamento_cartao flc JOIN cliente c ON c.id=flc.cliente_id WHERE TRIM(c.codigo_cliente) IN ('00000804','804'))
);
")"
echo "    $PRE"

if ! echo "$PRE" | grep -q 'cli938=[1-9]'; then
  echo "ABORT: cliente 938 não encontrado em $DB_NAME." >&2
  exit 1
fi
if ! echo "$PRE" | grep -q 'proc27=[1-9]'; then
  echo "ABORT: processo 27 do cliente 938 não encontrado em $DB_NAME." >&2
  exit 1
fi

FL804="$(echo "$PRE" | sed -n 's/.*fl804=\([0-9]*\).*/\1/p')"
if [[ "${FL804:-0}" -eq 0 ]]; then
  echo "Nada a fazer: nenhum lançamento do cliente 804 em $DB_NAME."
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY-RUN: $FL804 lançamento(s) seriam reapontados. Backup seria: $REMOTE_BACKUP"
  exit 0
fi

echo "==> Backup dos lançamentos 804 → $REMOTE_BACKUP"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" \
  "mysqldump -u$DB_USER -p$DB_PASS --no-create-info --complete-insert --skip-extended-insert $DB_NAME financeiro_lancamento financeiro_lancamento_cartao \
    --where=\"cliente_id IN (SELECT id FROM cliente WHERE TRIM(codigo_cliente) IN ('00000804','804'))\" \
    > '$REMOTE_BACKUP' 2>/dev/null && ls -la '$REMOTE_BACKUP'"

echo "==> Enviando SQL"
scp -q "${SSH_OPTS[@]}" "$SQL_FILE" "$VPS_HOST:$REMOTE_SQL"

echo "==> Aplicando UPDATE"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" \
  "mysql -u$DB_USER -p$DB_PASS $DB_NAME < '$REMOTE_SQL' && rm -f '$REMOTE_SQL'"

echo "==> Pós-checagem"
POST="$(mysql_vps "
SELECT CONCAT(
  'fl804=', (SELECT COUNT(*) FROM financeiro_lancamento fl JOIN cliente c ON c.id=fl.cliente_id WHERE TRIM(c.codigo_cliente) IN ('00000804','804')),
  ' fl938_27=', (SELECT COUNT(*) FROM financeiro_lancamento fl JOIN cliente c ON c.id=fl.cliente_id JOIN processo p ON p.id=fl.processo_id WHERE TRIM(c.codigo_cliente) IN ('00000938','938') AND p.numero_interno=27 AND fl.status='ATIVO')
);
")"
echo "    $POST"

if ! echo "$POST" | grep -q 'fl804=0'; then
  echo "ERRO: ainda restam lançamentos no cliente 804. Backup: $REMOTE_BACKUP" >&2
  exit 1
fi

echo "OK — reapontamento concluído em $DB_NAME."
echo "Backup: $REMOTE_BACKUP"
