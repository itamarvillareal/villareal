#!/usr/bin/env bash
# Restaura financeiro_lancamento BTG (numero_banco=21) na VPS a partir de dump .sql.gz.
#
# Uso:
#   ./scripts/restore-btg21-from-backup-vps.sh --backup /root/backups/vilareal-pre-v182-20260704-141557.sql.gz --dry-run
#   ./scripts/restore-btg21-from-backup-vps.sh --backup /root/backups/...sql.gz --yes
#
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
BTG_NUMERO_BANCO=21
SCRATCH_DB="${SCRATCH_DB:-vilareal_btg_scratch}"

BACKUP_GZ=""
DRY_RUN=0
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) BACKUP_GZ="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$BACKUP_GZ" ]]; then
  echo "Informe --backup /caminho/arquivo.sql.gz" >&2
  exit 2
fi

SSH_OPTS=()
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/villareal_vps}"
if [[ -f "$VPS_SSH_KEY" ]]; then
  SSH_OPTS=(-i "$VPS_SSH_KEY" -o IdentitiesOnly=yes)
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
VPS_PRE_BACKUP="/tmp/vilareal-backup-btg21-pre-restore-$STAMP.sql"

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
BACKUP_GZ='$BACKUP_GZ'
DB_NAME='$DB_NAME'
DB_USER='$DB_USER'
DB_PASS='$DB_PASS'
BTG=$BTG_NUMERO_BANCO
SCRATCH='$SCRATCH_DB'
PRE_BACKUP='$VPS_PRE_BACKUP'
STAMP='$STAMP'
DRY_RUN=$DRY_RUN

if [[ ! -f "\$BACKUP_GZ" ]]; then
  echo "Backup não encontrado: \$BACKUP_GZ" >&2
  exit 1
fi

mysql_q() { mysql -u "\$DB_USER" -p"\$DB_PASS" -N -B -e "\$1" 2>/dev/null; }

echo "=== Antes (produção) ==="
mysql_q "SELECT COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2) FROM \$DB_NAME.financeiro_lancamento WHERE numero_banco=\$BTG AND status='ATIVO';"

echo "=== Backup fonte: \$BACKUP_GZ ==="
echo "Ocorrências 'BTG',21 no arquivo:" \$(zgrep -o "'BTG',21," "\$BACKUP_GZ" | wc -l)

if [[ "\$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Parando antes de restaurar scratch DB."
  exit 0
fi

echo "Backup BTG atual → \$PRE_BACKUP"
mysqldump -u "\$DB_USER" -p"\$DB_PASS" \\
  --no-create-info --complete-insert --skip-extended-insert \\
  "\$DB_NAME" financeiro_lancamento \\
  --where="numero_banco=\$BTG" > "\$PRE_BACKUP"

echo "Restaurando backup completo em scratch DB (\$SCRATCH)..."
mysql -u "\$DB_USER" -p"\$DB_PASS" -e "DROP DATABASE IF EXISTS \$SCRATCH; CREATE DATABASE \$SCRATCH CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
zcat "\$BACKUP_GZ" | mysql -u "\$DB_USER" -p"\$DB_PASS" "\$SCRATCH"

echo "=== BTG no backup (scratch) ==="
mysql_q "SELECT COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2), MIN(data_lancamento), MAX(data_lancamento) FROM \$SCRATCH.financeiro_lancamento WHERE numero_banco=\$BTG AND status='ATIVO';"

RAW="/tmp/btg21-from-backup-\$STAMP.sql"
mysqldump -u "\$DB_USER" -p"\$DB_PASS" \\
  --no-create-info --complete-insert --skip-extended-insert \\
  --skip-add-locks --skip-disable-keys \\
  "\$SCRATCH" financeiro_lancamento \\
  --where="numero_banco=\$BTG" > "\$RAW"

LINES=\$(grep -c '^INSERT INTO' "\$RAW" || true)
echo "Dump BTG extraído: \$RAW (\$LINES INSERTs)"

REPLACE="/tmp/btg21-replace-\$STAMP.sql"
python3 - "\$RAW" "\$REPLACE" "\$BTG" <<'PY'
import pathlib, sys
raw_path, out_path, nb = sys.argv[1], sys.argv[2], int(sys.argv[3])
raw = pathlib.Path(raw_path).read_text(encoding="utf-8", errors="replace")
out = [
    f"-- Restore BTG numero_banco={nb} from backup",
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
    if s.startswith("INSERT INTO \`financeiro_lancamento\`") and s.endswith(";"):
        out.append(s)
        inserts += 1
out.extend(["", "SET FOREIGN_KEY_CHECKS = 1;", ""])
pathlib.Path(out_path).write_text("\n".join(out), encoding="utf-8")
print(inserts)
PY

echo "Aplicando replace na produção..."
mysql --binary-mode -u "\$DB_USER" -p"\$DB_PASS" "\$DB_NAME" < "\$REPLACE"

echo "=== Depois (produção) ==="
mysql_q "SELECT COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2), MIN(data_lancamento), MAX(data_lancamento) FROM \$DB_NAME.financeiro_lancamento WHERE numero_banco=\$BTG AND status='ATIVO';"

mysql -u "\$DB_USER" -p"\$DB_PASS" -e "DROP DATABASE IF EXISTS \$SCRATCH;"
echo "Backup pré-restore: \$PRE_BACKUP"
echo "Concluído."
EOF
)

if [[ "$YES" -ne 1 && "$DRY_RUN" -ne 1 ]]; then
  echo "Use --yes para executar ou --dry-run para simular."
  exit 2
fi

ssh "${SSH_OPTS[@]}" "$VPS_HOST" "STAMP='$STAMP' DRY_RUN='$DRY_RUN'; $REMOTE_SCRIPT"
