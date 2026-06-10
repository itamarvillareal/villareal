#!/usr/bin/env bash
# Sincroniza APENAS tópicos (tabelas `topico` e `topico_hierarquia`) do MySQL local → VPS.
#
# NÃO toca em dados de produção de outros módulos, por exemplo:
#   - Julia (julia_triagem*, usuario tipo julia, etc.)
#   - Publicações (publicacao*)
#   - Consultas periódicas (consulta_periodica*, agendamento_consulta*, processo_consulta_periodica*)
#   - Pessoas, processos, clientes, financeiro, etc.
#
# Uso:
#   ./scripts/sync-topicos-to-vps.sh --dry-run
#   ./scripts/sync-topicos-to-vps.sh --yes
#
# Pré-requisitos:
#   - Container vilareal-db local com tópicos completos (conteudo_html preenchido)
#   - SSH root@161.97.175.73
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
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

STAMP="$(date +%Y%m%d_%H%M%S)"
WORKDIR="${TMPDIR:-/tmp}/villareal-topicos-sync-$STAMP"
mkdir -p "$WORKDIR"

RAW_DUMP="$WORKDIR/topico-raw.sql"
UPSERT_SQL="$WORKDIR/topico-upsert.sql"
VPS_BACKUP="/tmp/vilareal-backup-topicos-$STAMP.sql"

if ! docker ps --format '{{.Names}}' | grep -qx "$LOCAL_CONTAINER"; then
  echo "Container $LOCAL_CONTAINER não está a correr." >&2
  echo "Suba: docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d db" >&2
  exit 1
fi

echo "Origem:  MySQL local ($LOCAL_CONTAINER / $DB_NAME)"
echo "Destino: VPS $VPS_HOST / $DB_NAME"
echo "Tabelas: topico, topico_hierarquia"
echo

LOCAL_ROWS="$(docker exec "$LOCAL_CONTAINER" mysql -u "$DB_USER" -p"$DB_PASS" -N -e \
  "SELECT COUNT(*) FROM $DB_NAME.topico WHERE conteudo_html IS NOT NULL AND TRIM(conteudo_html) <> '';")"
echo "Blocos locais com conteudo_html: $LOCAL_ROWS"
if [[ "$LOCAL_ROWS" -eq 0 ]]; then
  echo "Aviso: nenhum topico com conteudo_html no local. Rode a conversão/importação antes." >&2
fi

echo "Gerando dump local (somente topico + topico_hierarquia)..."
docker exec "$LOCAL_CONTAINER" mysqldump -u "$DB_USER" -p"$DB_PASS" \
  --no-create-info \
  --complete-insert \
  --skip-extended-insert \
  --skip-add-locks \
  --skip-disable-keys \
  "$DB_NAME" topico topico_hierarquia >"$RAW_DUMP"

if [[ ! -s "$RAW_DUMP" ]]; then
  echo "Erro: dump local vazio." >&2
  exit 1
fi

echo "Transformando INSERTs em UPSERT (ON DUPLICATE KEY UPDATE)..."
python3 - "$RAW_DUMP" "$UPSERT_SQL" <<'PY'
import pathlib
import sys

raw = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
out = [
    "-- Sync seletivo de tópicos (local → VPS). Não altera Julia, publicações nem consultas periódicas.",
    "SET NAMES utf8mb4;",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "",
]
topico_tail = (
    " ON DUPLICATE KEY UPDATE "
    "categoria=VALUES(categoria), subcategoria=VALUES(subcategoria), nome=VALUES(nome), "
    "conteudo_template=VALUES(conteudo_template), tipo_formatacao=VALUES(tipo_formatacao), "
    "conteudo_html=VALUES(conteudo_html), classe_html=VALUES(classe_html), "
    "ordem=VALUES(ordem), ativo=VALUES(ativo);"
)
hier_tail = " ON DUPLICATE KEY UPDATE raiz_json=VALUES(raiz_json);"
inserts = 0
# splitlines() quebra em \\v (tab vertical) presente no conteudo_template legado — usar só \\n.
for line in raw.split("\n"):
    s = line.strip()
    if not s.startswith("INSERT INTO"):
        continue
    if not s.endswith(";"):
        continue
    body = s[:-1]
    if body.startswith("INSERT INTO `topico`"):
        out.append(body + topico_tail)
        inserts += 1
    elif body.startswith("INSERT INTO `topico_hierarquia`"):
        out.append(body + hier_tail)
        inserts += 1
out.append("SET FOREIGN_KEY_CHECKS = 1;")
out.append("")
pathlib.Path(sys.argv[2]).write_text("\n".join(out), encoding="utf-8")
print(inserts, file=sys.stderr)
PY

LINES="$(grep -c '^INSERT INTO' "$UPSERT_SQL" || true)"
SIZE="$(du -h "$UPSERT_SQL" | cut -f1)"
echo "SQL gerado: $UPSERT_SQL ($SIZE, $LINES INSERTs)"
echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Nada enviado à VPS."
  echo "Backup na VPS seria: $VPS_BACKUP"
  exit 0
fi

if [[ "$YES" -ne 1 ]]; then
  read -r -p "Aplicar sync de tópicos na VPS? [y/N] " resp
  case "$resp" in
    y|Y|yes|YES) ;;
    *) echo "Cancelado."; exit 0 ;;
  esac
fi

echo "Backup na VPS (topico + topico_hierarquia)..."
ssh "$VPS_HOST" "mysqldump -u $DB_USER -p$DB_PASS --no-create-info --complete-insert --skip-extended-insert $DB_NAME topico topico_hierarquia > '$VPS_BACKUP' 2>/dev/null && echo 'Backup: $VPS_BACKUP'"

echo "Enviando e aplicando SQL na VPS..."
scp -q "$UPSERT_SQL" "$VPS_HOST:/tmp/topico-upsert.sql"
ssh "$VPS_HOST" "mysql --binary-mode -u $DB_USER -p$DB_PASS $DB_NAME < /tmp/topico-upsert.sql && rm -f /tmp/topico-upsert.sql"

VPS_ROWS="$(ssh "$VPS_HOST" "mysql -u $DB_USER -p$DB_PASS -N -e \"SELECT COUNT(*) FROM $DB_NAME.topico WHERE conteudo_html IS NOT NULL AND TRIM(conteudo_html) <> '';\"")"
echo "Sync concluído. VPS: $VPS_ROWS blocos com conteudo_html."
echo "Backup na VPS: $VPS_BACKUP"
rm -rf "$WORKDIR"
