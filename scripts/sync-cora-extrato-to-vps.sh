#!/usr/bin/env bash
# Substitui APENAS os lançamentos CORA (numero_banco=26) no MySQL da VPS pelos dados locais reparados.
#
# NÃO altera outros bancos/cartões nem outras tabelas do financeiro.
#
# Uso:
#   ./scripts/sync-cora-extrato-to-vps.sh --dry-run
#   ./scripts/sync-cora-extrato-to-vps.sh --yes
#
# Pré-requisitos:
#   - Container vilareal-db local com extrato CORA correto
#   - SSH root@161.97.175.73 (chave ~/.ssh/villareal_vps)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
LOCAL_CONTAINER="${LOCAL_CONTAINER:-vilareal-db}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
CORA_NUMERO_BANCO=26

DRY_RUN=0
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
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

STAMP="$(date +%Y%m%d_%H%M%S)"
WORKDIR="${TMPDIR:-/tmp}/villareal-cora-sync-$STAMP"
mkdir -p "$WORKDIR"

RAW_DUMP="$WORKDIR/cora-lancamentos-raw.sql"
REPLACE_SQL="$WORKDIR/cora-replace.sql"
VPS_BACKUP="/tmp/vilareal-backup-cora-$STAMP.sql"

if ! docker ps --format '{{.Names}}' | grep -qx "$LOCAL_CONTAINER"; then
  echo "Container $LOCAL_CONTAINER não está a correr." >&2
  exit 1
fi

echo "Origem:  MySQL local ($LOCAL_CONTAINER) — CORA numero_banco=$CORA_NUMERO_BANCO"
echo "Destino: VPS $VPS_HOST / $DB_NAME"
echo

LOCAL_STATS="$(docker exec "$LOCAL_CONTAINER" mysql -u "$DB_USER" -p"$DB_PASS" -N -B -e \
  "SELECT COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2)
   FROM $DB_NAME.financeiro_lancamento WHERE numero_banco=$CORA_NUMERO_BANCO AND status='ATIVO';" 2>/dev/null)"
LOCAL_COUNT="${LOCAL_STATS%%$'\t'*}"
LOCAL_SALDO="${LOCAL_STATS##*$'\t'}"

VPS_STATS="$(ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS -N -B -e \
  \"SELECT COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2)
   FROM $DB_NAME.financeiro_lancamento WHERE numero_banco=$CORA_NUMERO_BANCO AND status='ATIVO';\"" 2>/dev/null)"
VPS_COUNT="${VPS_STATS%%$'\t'*}"
VPS_SALDO="${VPS_STATS##*$'\t'}"

echo "Local: $LOCAL_COUNT ATIVO, saldo movimento $LOCAL_SALDO"
echo "VPS (antes): $VPS_COUNT ATIVO, saldo movimento $VPS_SALDO"
echo

echo "Gerando dump local (financeiro_lancamento WHERE numero_banco=$CORA_NUMERO_BANCO)..."
docker exec "$LOCAL_CONTAINER" mysqldump -u "$DB_USER" -p"$DB_PASS" \
  --no-create-info \
  --complete-insert \
  --skip-extended-insert \
  --skip-add-locks \
  --skip-disable-keys \
  "$DB_NAME" financeiro_lancamento \
  --where="numero_banco=$CORA_NUMERO_BANCO" >"$RAW_DUMP"

if [[ ! -s "$RAW_DUMP" ]]; then
  echo "Erro: dump local vazio." >&2
  exit 1
fi

LINES="$(grep -c '^INSERT INTO' "$RAW_DUMP" || true)"
echo "Dump: $RAW_DUMP ($LINES INSERTs)"

python3 - "$RAW_DUMP" "$REPLACE_SQL" "$CORA_NUMERO_BANCO" <<'PY'
import pathlib
import sys

raw_path, out_path, nb = sys.argv[1], sys.argv[2], int(sys.argv[3])
raw = pathlib.Path(raw_path).read_text(encoding="utf-8", errors="replace")
out = [
    f"-- Sync seletivo CORA (numero_banco={nb}) local → VPS",
    "SET NAMES utf8mb4;",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "",
    f"DELETE FROM financeiro_compensacao_par_descarte WHERE lancamento_id_menor IN (SELECT id FROM financeiro_lancamento WHERE numero_banco = {nb}) OR lancamento_id_maior IN (SELECT id FROM financeiro_lancamento WHERE numero_banco = {nb});",
    f"DELETE FROM financeiro_semelhante_escritorio_descarte WHERE lancamento_id IN (SELECT id FROM financeiro_lancamento WHERE numero_banco = {nb});",
    f"DELETE FROM financeiro_lancamento WHERE numero_banco = {nb};",
    "",
]
inserts = 0
for line in raw.split("\n"):
    s = line.strip()
    if not s.startswith("INSERT INTO `financeiro_lancamento`"):
        continue
    if not s.endswith(";"):
        continue
    out.append(s)
    inserts += 1
out.extend(["", "SET FOREIGN_KEY_CHECKS = 1;", ""])
pathlib.Path(out_path).write_text("\n".join(out), encoding="utf-8")
print(inserts, file=sys.stderr)
PY

echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Nada enviado à VPS."
  echo "Backup na VPS seria: $VPS_BACKUP"
  rm -rf "$WORKDIR"
  exit 0
fi

if [[ "$YES" -ne 1 ]]; then
  read -r -p "Substituir extrato CORA na VPS? [y/N] " resp
  case "$resp" in
    y|Y|yes|YES) ;;
    *) echo "Cancelado."; rm -rf "$WORKDIR"; exit 0 ;;
  esac
fi

echo "Backup na VPS (financeiro_lancamento CORA)..."
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysqldump -u $DB_USER -p$DB_PASS --no-create-info --complete-insert --skip-extended-insert $DB_NAME financeiro_lancamento --where=\"numero_banco=$CORA_NUMERO_BANCO\" > '$VPS_BACKUP' 2>/dev/null && echo 'Backup: $VPS_BACKUP'"

echo "Enviando e aplicando SQL na VPS..."
scp -q "${SSH_OPTS[@]}" "$REPLACE_SQL" "$VPS_HOST:/tmp/cora-replace.sql"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql --binary-mode -u $DB_USER -p$DB_PASS $DB_NAME < /tmp/cora-replace.sql && rm -f /tmp/cora-replace.sql"

VPS_AFTER="$(ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS -N -B -e \
  \"SELECT COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2)
   FROM $DB_NAME.financeiro_lancamento WHERE numero_banco=$CORA_NUMERO_BANCO AND status='ATIVO';\"" 2>/dev/null)"

echo "Sync concluído."
echo "VPS (depois): $VPS_AFTER"
echo "Backup na VPS: $VPS_BACKUP"
rm -rf "$WORKDIR"
