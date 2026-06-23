#!/usr/bin/env bash
# Dump seletivo de calculo_rodada na VPS — apenas pares em calculo_rodada_reimport_par.
#
# Pré-requisito: diagnóstico gravado (diagnosticar-calculos-txt-vs-db.mjs --gravar-vps)
#
# Uso:
#   ./scripts/vps-calculos-reimport-dump-seletivo.sh --dry-run
#   ./scripts/vps-calculos-reimport-dump-seletivo.sh --yes
#   ./scripts/vps-calculos-reimport-dump-seletivo.sh --yes --saida=~/Downloads/calculos-reimport-vps.sql
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
SAIDA="${SAIDA:-$HOME/Downloads/calculos-reimport-vps-$(date +%Y%m%d_%H%M%S).sql}"

DRY_RUN=0
YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    --saida=*) SAIDA="${1#*=}" ;;
    -h|--help)
      sed -n '2,12p' "$0"
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

COUNT="$(ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS -N -B -e \"SELECT COUNT(*) FROM $DB_NAME.calculo_rodada_reimport_par WHERE precisa_atualizacao=1;\"" 2>/dev/null | tail -1)"
RODADAS="$(ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS -N -B -e \"
SELECT COUNT(*)
FROM $DB_NAME.calculo_rodada cr
INNER JOIN $DB_NAME.calculo_rodada_reimport_par p
  ON TRIM(cr.codigo_cliente)=TRIM(p.codigo_cliente) AND cr.numero_processo=p.numero_processo
WHERE p.precisa_atualizacao=1;\"" 2>/dev/null | tail -1)"

echo "Pares pendentes: ${COUNT:-0}"
echo "Linhas calculo_rodada (todas as dimensões dos pares): ${RODADAS:-0}"
echo "Saída: $SAIDA"
echo

if [[ "${COUNT:-0}" -eq 0 ]]; then
  echo "Nada a exportar — rode o diagnóstico com --gravar-vps primeiro."
  exit 0
fi

WHERE_SQL="EXISTS (
  SELECT 1 FROM $DB_NAME.calculo_rodada_reimport_par p
  WHERE p.precisa_atualizacao=1
    AND TRIM(p.codigo_cliente)=TRIM(calculo_rodada.codigo_cliente)
    AND p.numero_processo=calculo_rodada.numero_processo
)"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] mysqldump calculo_rodada WHERE $WHERE_SQL"
  exit 0
fi

if [[ "$YES" -ne 1 ]]; then
  echo "Use --yes para gerar o dump."
  exit 2
fi

TMP="/tmp/calculos-reimport-dump-$$.sql"
ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mysqldump -u $DB_USER -p$DB_PASS \
  --no-create-info \
  --complete-insert \
  --skip-extended-insert \
  --single-transaction \
  $DB_NAME calculo_rodada \
  --where=\"$WHERE_SQL\"" > "$TMP" 2>/dev/null

if [[ ! -s "$TMP" ]]; then
  echo "Erro: dump vazio." >&2
  rm -f "$TMP"
  exit 1
fi

{
  echo "-- Dump seletivo calculo_rodada (pares em calculo_rodada_reimport_par)"
  echo "-- Gerado: $(date -Iseconds)"
  echo "-- Pares: $COUNT | Linhas: $RODADAS"
  echo "-- Tabelas de diagnóstico (opcional): calculo_rodada_reimport_diag, calculo_rodada_reimport_par"
  echo
  cat "$TMP"
} > "$SAIDA"
rm -f "$TMP"

echo "Dump gravado: $SAIDA ($(du -h "$SAIDA" | cut -f1))"
