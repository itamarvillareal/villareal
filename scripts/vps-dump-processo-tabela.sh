#!/usr/bin/env bash
# Dump completo da tabela processo na VPS (MySQL).
#
# Uso:
#   ./scripts/vps-dump-processo-tabela.sh --dry-run
#   ./scripts/vps-dump-processo-tabela.sh --yes --saida=tmp/processo.sql
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
SAIDA="${SAIDA:-$HOME/Downloads/processo-vps-$(date +%Y%m%d_%H%M%S).sql}"

DRY_RUN=0
YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    --saida=*) SAIDA="${1#*=}" ;;
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

COUNT="$(ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS -N -B -e \"SELECT COUNT(*) FROM $DB_NAME.processo;\"" 2>/dev/null | tail -1)"
echo "Linhas em processo: ${COUNT:-?}"
echo "Saída: $SAIDA"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] mysqldump $DB_NAME processo"
  exit 0
fi

if [[ "$YES" -ne 1 ]]; then
  echo "Use --yes para gerar o dump."
  exit 2
fi

mkdir -p "$(dirname "$SAIDA")"
TMP="/tmp/processo-dump-$$.sql"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysqldump -u $DB_USER -p$DB_PASS \
  --default-character-set=utf8mb4 \
  --no-create-info \
  --complete-insert \
  --skip-extended-insert \
  --single-transaction \
  $DB_NAME processo" > "$TMP" 2>/dev/null

if [[ ! -s "$TMP" ]]; then
  echo "Erro: dump vazio." >&2
  rm -f "$TMP"
  exit 1
fi

{
  echo "-- Dump tabela processo (VPS)"
  echo "-- Gerado: $(date -Iseconds)"
  echo "-- Linhas: ${COUNT:-?}"
  echo
  cat "$TMP"
} > "$SAIDA"
rm -f "$TMP"

echo "Dump gravado: $SAIDA ($(du -h "$SAIDA" | cut -f1))"
