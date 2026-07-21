#!/usr/bin/env bash
# Merge seletivo BTG 21 na VPS:
#   1) Reinserir lançamentos de 2023 do backup pré-restore
#   2) Excluir jun/jul/2026 corrompidos (>= 2026-06-01)
#   3) Manter 2024–mai/2026 do backup 04/07 (já em produção)
#
# Uso:
#   ./scripts/merge-btg21-seletivo-vps.sh \
#     --pre-restore /tmp/vilareal-backup-btg21-pre-restore-20260721_124334.sql \
#     --dry-run
#   ./scripts/merge-btg21-seletivo-vps.sh --pre-restore /tmp/... --yes
#
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
BTG=21
CORTE_EXCLUSAO="2026-06-01"

PRE_RESTORE=""
DRY_RUN=0
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pre-restore) PRE_RESTORE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$PRE_RESTORE" ]]; then
  echo "Informe --pre-restore /caminho/backup-btg21.sql" >&2
  exit 2
fi

SSH_OPTS=()
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/villareal_vps}"
if [[ -f "$VPS_SSH_KEY" ]]; then
  SSH_OPTS=(-i "$VPS_SSH_KEY" -o IdentitiesOnly=yes)
fi

STAMP="$(date +%Y%m%d_%H%M%S)"

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
PRE='$PRE_RESTORE'
DB='$DB_NAME'
DBU='$DB_USER'
DBP='$DB_PASS'
BTG=$BTG
CORTE='$CORTE_EXCLUSAO'
STAMP='$STAMP'
DRY=$DRY_RUN

mysql_q() { mysql -u "\$DBU" -p"\$DBP" -N -B -e "\$1" 2>/dev/null; }

if [[ ! -f "\$PRE" ]]; then
  echo "Backup pré-restore não encontrado: \$PRE" >&2
  exit 1
fi

echo "=== Antes ==="
mysql_q "SELECT COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2), MIN(data_lancamento), MAX(data_lancamento) FROM \$DB.financeiro_lancamento WHERE numero_banco=\$BTG AND status='ATIVO';"
mysql_q "SELECT '2023', COUNT(*) FROM \$DB.financeiro_lancamento WHERE numero_banco=\$BTG AND data_lancamento<'2024-01-01';"
mysql_q "SELECT '>=corte', COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2) FROM \$DB.financeiro_lancamento WHERE numero_banco=\$BTG AND data_lancamento>='\$CORTE';"

INSERT_2023="/tmp/btg21-insert-2023-\$STAMP.sql"
INSERT_COUNT=\$(python3 - "\$PRE" "\$INSERT_2023" <<'PY'
import pathlib, re, sys
src, out = sys.argv[1], sys.argv[2]
lines = [
    "-- Insert BTG 2023 from pre-restore",
    "SET NAMES utf8mb4;",
    "SET FOREIGN_KEY_CHECKS = 0;",
]
n = 0
for line in pathlib.Path(src).read_text(encoding='utf-8', errors='replace').splitlines():
    s = line.strip()
    if not s.startswith("INSERT INTO \`financeiro_lancamento\`"):
        continue
    m = re.search(r"'(\d{4}-\d{2}-\d{2})','(\d{4}-\d{2}-\d{2})'", s)
    if not m or not m.group(1).startswith('2023'):
        continue
    lines.append(s)
    n += 1
lines.extend(["SET FOREIGN_KEY_CHECKS = 1;", ""])
pathlib.Path(out).write_text("\n".join(lines), encoding='utf-8')
print(n)
PY
)
echo "INSERTs 2023 extraídos: \$INSERT_COUNT → \$INSERT_2023"

DEL_COUNT=\$(mysql_q "SELECT COUNT(*) FROM \$DB.financeiro_lancamento WHERE numero_banco=\$BTG AND data_lancamento>='\$CORTE';")
echo "A excluir (>= \$CORTE): \$DEL_COUNT"

if [[ "\$DRY" -eq 1 ]]; then
  echo "[dry-run] Parando antes de aplicar."
  exit 0
fi

PRE_BACKUP="/tmp/vilareal-backup-btg21-pre-merge-\$STAMP.sql"
echo "Backup BTG atual → \$PRE_BACKUP"
mysqldump -u "\$DBU" -p"\$DBP" \\
  --no-create-info --complete-insert --skip-extended-insert \\
  "\$DB" financeiro_lancamento \\
  --where="numero_banco=\$BTG" > "\$PRE_BACKUP"

echo "Aplicando INSERTs 2023..."
mysql --binary-mode -u "\$DBU" -p"\$DBP" "\$DB" < "\$INSERT_2023"

echo "Excluindo jun/jul/2026..."
mysql -u "\$DBU" -p"\$DBP" "\$DB" <<SQL
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM financeiro_compensacao_par_descarte
WHERE lancamento_id_menor IN (SELECT id FROM financeiro_lancamento WHERE numero_banco = \$BTG AND data_lancamento >= '\$CORTE')
   OR lancamento_id_maior IN (SELECT id FROM financeiro_lancamento WHERE numero_banco = \$BTG AND data_lancamento >= '\$CORTE');
DELETE FROM financeiro_semelhante_escritorio_descarte
WHERE lancamento_id IN (SELECT id FROM financeiro_lancamento WHERE numero_banco = \$BTG AND data_lancamento >= '\$CORTE');
DELETE FROM financeiro_lancamento WHERE numero_banco = \$BTG AND data_lancamento >= '\$CORTE';
SET FOREIGN_KEY_CHECKS = 1;
SQL

echo "=== Depois (antes reimport PDF 39) ==="
mysql_q "SELECT COUNT(*), ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2), MIN(data_lancamento), MAX(data_lancamento) FROM \$DB.financeiro_lancamento WHERE numero_banco=\$BTG AND status='ATIVO';"
mysql_q "SELECT '2023', COUNT(*) FROM \$DB.financeiro_lancamento WHERE numero_banco=\$BTG AND data_lancamento<'2024-01-01';"
for d in 2024-05-31 2024-12-31 2025-05-31 2025-12-31 2026-05-31; do
  s=\$(mysql_q "SELECT ROUND(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),2) FROM \$DB.financeiro_lancamento WHERE numero_banco=\$BTG AND data_lancamento<='\$d';")
  echo "saldo \$d: \$s"
done
echo "Backup pré-merge: \$PRE_BACKUP"
echo "Concluído merge VPS."
EOF
)

if [[ "$YES" -ne 1 && "$DRY_RUN" -ne 1 ]]; then
  echo "Use --yes para executar ou --dry-run para simular."
  exit 2
fi

ssh "${SSH_OPTS[@]}" "$VPS_HOST" "STAMP='$STAMP' DRY_RUN='$DRY_RUN'; $REMOTE_SCRIPT"
