#!/usr/bin/env bash
# =============================================================================
# vps-extrair-competencia-orgao.sh  —  ETAPA 1 (SOMENTE LEITURA)
# -----------------------------------------------------------------------------
# Roda contra a PRODUÇÃO (VPS/MySQL) os SELECTs read-only e gera os relatórios:
#   1) competencia-orgao-extracao-<data>.csv   (1 linha por processo + varas candidatas)
#   2) competencia-orgao-catalogo-varas-<data>.csv (catálogo de varas por comarca)
#   3) competencia-orgao-stats-<data>.txt       (resumo estatístico)
#
# GARANTIA READ-ONLY: cada .sql começa com `SET SESSION transaction_read_only=1`,
# então qualquer INSERT/UPDATE/DELETE acidental falharia. O script NÃO faz dump,
# NÃO escreve no banco e NÃO toca em credenciais/token.
#
# Os arquivos são gravados na VPS em $REMOTE_DIR (default /root/relatorios) E
# baixados para $LOCAL_DIR (default tmp/relatorios) para download.
#
# Uso:
#   ./scripts/vps-extrair-competencia-orgao.sh --dry-run     # só conta, não grava
#   ./scripts/vps-extrair-competencia-orgao.sh               # gera os relatórios
#   ./scripts/vps-extrair-competencia-orgao.sh --excel       # CSV com BOM (Excel PT-BR)
#   ./scripts/vps-extrair-competencia-orgao.sh --local-only  # não copia p/ a VPS
#
# Variáveis (override): VPS_HOST, DB_NAME, DB_USER, DB_PASS, VPS_SSH_KEY,
#                       REMOTE_DIR, LOCAL_DIR
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
REMOTE_DIR="${REMOTE_DIR:-/root/relatorios}"
LOCAL_DIR="${LOCAL_DIR:-$SCRIPT_DIR/../tmp/relatorios}"

DATA="$(date +%Y-%m-%d)"
STAMP="$(date +%Y%m%d_%H%M%S)"

DRY_RUN=0
BOM=0
COPY_VPS=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)    DRY_RUN=1 ;;
    --excel)      BOM=1 ;;
    --local-only) COPY_VPS=0 ;;
    -h|--help)    sed -n '2,33p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

SSH_OPTS=(-o ConnectTimeout=15)
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/villareal_vps}"
if [[ -f "$VPS_SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$VPS_SSH_KEY" -o IdentitiesOnly=yes)
fi

# mysql remoto, lendo SQL do stdin. --raw evita que o cliente "escape" o CSV;
# os .sql já normalizam quebras de linha/tab dentro dos campos.
run_sql_raw() { # $1 = arquivo .sql local
  ssh "${SSH_OPTS[@]}" "$VPS_HOST" \
    "mysql --default-character-set=utf8mb4 -u$DB_USER -p$DB_PASS -N -B --raw $DB_NAME" < "$1"
}
run_sql_table() { # $1 = arquivo .sql local (saída formatada, com cabeçalhos)
  ssh "${SSH_OPTS[@]}" "$VPS_HOST" \
    "mysql --default-character-set=utf8mb4 -u$DB_USER -p$DB_PASS --table $DB_NAME" < "$1"
}

echo ">> Alvo: $VPS_HOST  db=$DB_NAME  (SOMENTE LEITURA)"

# Sanidade: conta processos com competência preenchida.
COUNT="$(ssh "${SSH_OPTS[@]}" "$VPS_HOST" \
  "mysql -u$DB_USER -p$DB_PASS -N -B $DB_NAME -e \"SELECT COUNT(*) FROM processo WHERE competencia IS NOT NULL AND TRIM(competencia) <> '';\"" 2>/dev/null | tail -1 || true)"
echo ">> Processos com competência preenchida: ${COUNT:-?}"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Nenhum arquivo gerado. Removida a flag --dry-run para extrair."
  exit 0
fi

mkdir -p "$LOCAL_DIR"

EXTRACAO_LOCAL="$LOCAL_DIR/competencia-orgao-extracao-$DATA.csv"
CATALOGO_LOCAL="$LOCAL_DIR/competencia-orgao-catalogo-varas-$DATA.csv"
STATS_LOCAL="$LOCAL_DIR/competencia-orgao-stats-$DATA.txt"

HEADER_EXTRACAO='"processo_id","numero_cnj","numero_interno","cliente_id","competencia","ativo","fase","tramitacao","uf","cidade","municipio_id","cidade_legado","orgao_julgador_id","eff_municipio_id","eff_municipio_nome","eff_municipio_uf","comarca_origem","qtd_varas_candidatas","varas_candidatas"'
HEADER_CATALOGO='"municipio_id","municipio_nome","uf","orgao_julgador_id","grau","tipo","codigo_cnj","nome","nome_normalizado"'

emitir_csv() { # $1=sql  $2=arquivo_local  $3=cabecalho
  local sql="$1" out="$2" header="$3"
  : > "$out"
  if [[ "$BOM" -eq 1 ]]; then printf '\xEF\xBB\xBF' >> "$out"; fi
  printf '%s\n' "$header" >> "$out"
  run_sql_raw "$sql" >> "$out"
  local linhas; linhas=$(($(wc -l < "$out") - 1))
  echo ">> Gerado: $out  (${linhas} linhas de dados)"
}

echo ">> [1/3] Extração processos + varas candidatas..."
emitir_csv "$SCRIPT_DIR/competencia-orgao-extracao.sql" "$EXTRACAO_LOCAL" "$HEADER_EXTRACAO"

echo ">> [2/3] Catálogo de varas por comarca..."
emitir_csv "$SCRIPT_DIR/competencia-orgao-catalogo-varas.sql" "$CATALOGO_LOCAL" "$HEADER_CATALOGO"

echo ">> [3/3] Resumo estatístico..."
{
  echo "# Resumo estatístico — competencia -> orgao_julgador"
  echo "# Gerado: $(date -Iseconds)  |  Alvo: $VPS_HOST/$DB_NAME  |  SOMENTE LEITURA"
  echo
  run_sql_table "$SCRIPT_DIR/competencia-orgao-stats.sql"
} > "$STATS_LOCAL"
echo ">> Gerado: $STATS_LOCAL"

if [[ "$COPY_VPS" -eq 1 ]]; then
  echo ">> Copiando relatórios para $VPS_HOST:$REMOTE_DIR ..."
  ssh "${SSH_OPTS[@]}" "$VPS_HOST" "mkdir -p '$REMOTE_DIR'"
  for f in "$EXTRACAO_LOCAL" "$CATALOGO_LOCAL" "$STATS_LOCAL"; do
    base="$(basename "$f")"
    ssh "${SSH_OPTS[@]}" "$VPS_HOST" "cat > '$REMOTE_DIR/$base'" < "$f"
    echo "   -> $VPS_HOST:$REMOTE_DIR/$base"
  done
fi

echo
echo ">> Concluído (read-only). Arquivos locais em: $LOCAL_DIR"
