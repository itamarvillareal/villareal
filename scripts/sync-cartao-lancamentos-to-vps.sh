#!/usr/bin/env bash
# Sincroniza APENAS os lançamentos de extrato de UM cartão
# (tabela financeiro_lancamento_cartao) do MySQL local → VPS.
#
# Seguro por design:
#   - Escopo: um cartão por execução (--cartao ou CARTAO_NOME)
#   - Backup na VPS antes de alterar (lançamentos + vínculos pagamento-fatura)
#   - Pré-validação de FKs (cliente, processo, conta contábil) na VPS
#   - Exige migration V129 (etapa, grupo_compensacao) na VPS
#   - Transação SQL (ROLLBACK implícito se INSERT falhar)
#   - Não preserva ids locais (evita colisão); remapeia cartao_id para o id da VPS
#
# NÃO altera: outros cartões, financeiro_lancamento (banco), clientes, processos, etc.
#
# Cartões cadastrados (financeiro_cartao):
#   Mastercard | Visa | Mastercard Sicoob | Mastercard Black | BTG Cartão
#
# Uso:
#   export DB_PASS='root'
#   ./scripts/sync-cartao-lancamentos-to-vps.sh --cartao "Visa" --dry-run
#   ./scripts/sync-cartao-lancamentos-to-vps.sh --cartao "Mastercard Black" --yes
#   CARTAO_NOME='Mastercard Sicoob' ./scripts/sync-cartao-lancamentos-to-vps.sh --yes
#
# Atalho (Mastercard Black):
#   ./scripts/sync-mastercard-black-cartao-to-vps.sh --yes
#
# Pré-requisitos:
#   - Container vilareal-db local com extrato importado (DB_PASS=root no local)
#   - SSH para VPS (VPS_HOST); recomendado: ./scripts/vps-install-ssh-key.sh
#   - MySQL na VPS (container vilareal-db ou host); VPS_DB_PASS se ≠ root
#   - Flyway V129 já aplicado na VPS
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
LOCAL_CONTAINER="${LOCAL_CONTAINER:-vilareal-db}"
VPS_CONTAINER="${VPS_CONTAINER:-vilareal-db}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-root}"
MYSQL_CHARSET="${MYSQL_CHARSET:-utf8mb4}"
VPS_DB_USER="${VPS_DB_USER:-$DB_USER}"
VPS_DB_PASS="${VPS_DB_PASS:-$DB_PASS}"
CARTAO_NOME="${CARTAO_NOME:-}"

SSH_CONTROL_PATH="${TMPDIR:-/tmp}/villareal-ssh-%r@%h:%p"
SSH_OPTS=(-o ControlMaster=auto -o "ControlPath=$SSH_CONTROL_PATH" -o ControlPersist=300)
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/villareal_vps}"
if [[ -f "$VPS_SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$VPS_SSH_KEY" -o IdentitiesOnly=yes)
fi
VPS_MYSQL_MODE="" # docker | host

DRY_RUN=0
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cartao|--cartao-nome)
      CARTAO_NOME="$2"
      shift 2
      ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    -h|--help)
      sed -n '2,32p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$CARTAO_NOME" ]]; then
  echo "Informe o cartão: --cartao 'Visa'  ou  export CARTAO_NOME='Visa'" >&2
  echo "Cartões: Mastercard, Visa, Mastercard Sicoob, Mastercard Black, BTG Cartão" >&2
  exit 2
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
WORKDIR="${TMPDIR:-/tmp}/villareal-cartao-sync-$STAMP"
mkdir -p "$WORKDIR"

TSV_LOCAL="$WORKDIR/lancamentos-local.tsv"
APPLY_SQL="$WORKDIR/cartao-lancamentos-apply.sql"
VPS_BACKUP_LANC="/tmp/vilareal-backup-flc-$STAMP.sql"
VPS_BACKUP_VINC="/tmp/vilareal-backup-fpfv-cartao-$STAMP.sql"

mysql_local() {
  docker exec "$LOCAL_CONTAINER" mysql --default-character-set="$MYSQL_CHARSET" -u "$DB_USER" -p"$DB_PASS" -N "$@"
}

mysql_local_batch() {
  docker exec "$LOCAL_CONTAINER" mysql --default-character-set="$MYSQL_CHARSET" -u "$DB_USER" -p"$DB_PASS" -B "$@"
}

ssh_vps() {
  ssh "${SSH_OPTS[@]}" "$VPS_HOST" "$@"
}

scp_vps() {
  scp "${SSH_OPTS[@]}" "$@"
}

mysql_vps() {
  [[ "$1" == "-e" ]] || { echo "mysql_vps: use -e \"SQL\"" >&2; exit 1; }
  shift
  local sql="$1" sql_q out rc=0
  sql_q="$(printf '%q' "$sql")"
  if [[ "$VPS_MYSQL_MODE" == docker ]]; then
    out="$(ssh_vps "docker exec $VPS_CONTAINER mysql --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS -N -e $sql_q" 2>&1)" || rc=$?
  else
    out="$(ssh_vps "mysql --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS -N -e $sql_q" 2>&1)" || rc=$?
  fi
  out="$(printf '%s\n' "$out" | grep -v 'Using a password on the command line interface can be insecure.' || true)"
  out="${out//$'\n'/}"
  if [[ $rc -ne 0 ]] || [[ "$out" == *"Usage: mysql"* ]]; then
    echo "Erro MySQL na VPS ($VPS_MYSQL_MODE):" >&2
    printf '%s\n' "$out" >&2
    echo "Dica: export VPS_DB_PASS='…' se a senha root na VPS for diferente." >&2
    exit 1
  fi
  printf '%s' "$out"
}

mysql_vps_batch() {
  [[ "$1" == "-e" ]] || { echo "mysql_vps_batch: use -e \"SQL\"" >&2; exit 1; }
  shift
  local sql="$1" sql_q
  sql_q="$(printf '%q' "$sql")"
  if [[ "$VPS_MYSQL_MODE" == docker ]]; then
    ssh_vps "docker exec $VPS_CONTAINER mysql --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS -B -e $sql_q"
  else
    ssh_vps "mysql --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS -B -e $sql_q"
  fi
}

detect_vps_mysql_mode() {
  echo "Detectando MySQL na VPS..."
  if ssh_vps "docker ps --format '{{.Names}}' | grep -qx '$VPS_CONTAINER'" 2>/dev/null; then
    if ssh_vps "docker exec $VPS_CONTAINER mysql --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS -N -e 'SELECT 1' $DB_NAME" >/dev/null 2>&1; then
      VPS_MYSQL_MODE=docker
      echo "MySQL na VPS: docker exec $VPS_CONTAINER (user=$VPS_DB_USER)"
      return 0
    fi
  fi
  if ssh_vps "mysql --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS -N -e 'SELECT 1' $DB_NAME" >/dev/null 2>&1; then
    VPS_MYSQL_MODE=host
    echo "MySQL na VPS: cliente no host (user=$VPS_DB_USER)"
    return 0
  fi
  echo "Erro: não foi possível conectar ao MySQL na VPS." >&2
  echo "  - Local:  export DB_PASS=root   (container vilareal-db)" >&2
  echo "  - VPS:    export VPS_DB_PASS='…'  (ver .env.docker na VPS se não for root)" >&2
  echo "  - SSH:    ./scripts/vps-install-ssh-key.sh  (evita pedir senha várias vezes)" >&2
  exit 1
}

if ! docker ps --format '{{.Names}}' | grep -qx "$LOCAL_CONTAINER"; then
  echo "Container $LOCAL_CONTAINER não está a correr." >&2
  echo "Suba: docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d db" >&2
  exit 1
fi

echo "Origem:  MySQL local ($LOCAL_CONTAINER / $DB_NAME)"
echo "Destino: VPS $VPS_HOST / $DB_NAME"
echo "Cartão:  $CARTAO_NOME"
echo "Tabela:  financeiro_lancamento_cartao (somente este cartão)"
echo

LOCAL_CARTAO_ID="$(mysql_local -e "SELECT id FROM $DB_NAME.financeiro_cartao WHERE nome = '$(echo "$CARTAO_NOME" | sed "s/'/''/g")' LIMIT 1;")"
if [[ -z "$LOCAL_CARTAO_ID" || "$LOCAL_CARTAO_ID" == "NULL" ]]; then
  echo "Erro: cartão '$CARTAO_NOME' não encontrado no banco local." >&2
  exit 1
fi

LOCAL_COUNT="$(mysql_local -e "SELECT COUNT(*) FROM $DB_NAME.financeiro_lancamento_cartao WHERE cartao_id = $LOCAL_CARTAO_ID;")"
echo "Lançamentos locais (cartao_id=$LOCAL_CARTAO_ID): $LOCAL_COUNT"
if [[ "$LOCAL_COUNT" -eq 0 ]]; then
  echo "Nada a sincronizar. Importe o extrato localmente antes." >&2
  exit 1
fi

LOCAL_HAS_ETAPA="$(mysql_local -e "
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = '$DB_NAME' AND TABLE_NAME = 'financeiro_lancamento_cartao' AND COLUMN_NAME = 'etapa';
")"
if [[ "$LOCAL_HAS_ETAPA" -eq 0 ]]; then
  echo "Erro: coluna etapa ausente no local (migration V129). Atualize o backend/migrations." >&2
  exit 1
fi

# Colunas a exportar (exceto id e timestamps automáticos)
EXPORT_COLS="$(mysql_local -e "
  SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION SEPARATOR ',')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = '$DB_NAME'
    AND TABLE_NAME = 'financeiro_lancamento_cartao'
    AND COLUMN_NAME NOT IN ('id', 'created_at', 'updated_at');
")"

echo "Exportando TSV local..."
mysql_local_batch -e "
  SELECT $EXPORT_COLS
  FROM $DB_NAME.financeiro_lancamento_cartao
  WHERE cartao_id = $LOCAL_CARTAO_ID
  ORDER BY data_lancamento, id;
" >"$TSV_LOCAL"

if [[ ! -s "$TSV_LOCAL" ]]; then
  echo "Erro: export TSV vazio." >&2
  exit 1
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] TSV local: $TSV_LOCAL ($(wc -l <"$TSV_LOCAL" | tr -d ' ') linhas incl. cabeçalho)"
  echo "[dry-run] Próximo passo na VPS: validar cartão, FKs, V129, backup, aplicar SQL."
  echo "[dry-run] Backups na VPS seriam:"
  echo "  $VPS_BACKUP_LANC"
  echo "  $VPS_BACKUP_VINC"
  exit 0
fi

detect_vps_mysql_mode
echo "Validando VPS..."
VPS_CARTAO_ID="$(mysql_vps -e "SELECT id FROM $DB_NAME.financeiro_cartao WHERE nome = '$(echo "$CARTAO_NOME" | sed "s/'/''/g")' LIMIT 1;")"
if [[ -z "$VPS_CARTAO_ID" ]]; then
  echo "Erro: cartão '$CARTAO_NOME' não encontrado na VPS." >&2
  exit 1
fi
echo "cartao_id VPS: $VPS_CARTAO_ID"

VPS_HAS_ETAPA="$(mysql_vps -e "
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = '$DB_NAME' AND TABLE_NAME = 'financeiro_lancamento_cartao' AND COLUMN_NAME = 'etapa';
")"
if [[ "$VPS_HAS_ETAPA" -eq 0 ]]; then
  echo "Erro: migration V129 não aplicada na VPS (coluna etapa ausente)." >&2
  echo "Faça deploy do backend na VPS e rode Flyway antes deste sync." >&2
  exit 1
fi

VPS_COUNT="$(mysql_vps -e "SELECT COUNT(*) FROM $DB_NAME.financeiro_lancamento_cartao WHERE cartao_id = $VPS_CARTAO_ID;")"
VPS_VINCULOS="$(mysql_vps -e "
  SELECT COUNT(*) FROM $DB_NAME.financeiro_pagamento_fatura_vinculo fpfv
  INNER JOIN $DB_NAME.financeiro_lancamento_cartao flc ON flc.id = fpfv.lancamento_cartao_id
  WHERE flc.cartao_id = $VPS_CARTAO_ID;
")"
echo "Lançamentos atuais na VPS: $VPS_COUNT (vínculos pagamento-fatura: $VPS_VINCULOS)"

# --- Pré-validação FKs: ids usados localmente devem existir na VPS ---
check_fk() {
  local col="$1"
  local table="$2"
  local ids
  ids="$(mysql_local -e "
    SELECT GROUP_CONCAT(DISTINCT $col)
    FROM $DB_NAME.financeiro_lancamento_cartao
    WHERE cartao_id = $LOCAL_CARTAO_ID AND $col IS NOT NULL;
  ")"
  if [[ -z "$ids" || "$ids" == "NULL" ]]; then
    return 0
  fi
  local bad=()
  IFS=',' read -ra ARR <<<"$ids"
  for fid in "${ARR[@]}"; do
    fid="$(echo "$fid" | tr -d ' ')"
    [[ -z "$fid" || "$fid" == "NULL" ]] && continue
    local ok
    ok="$(mysql_vps -e "SELECT COUNT(*) FROM ${DB_NAME}.${table} WHERE id = $fid;")"
    if [[ "$ok" -eq 0 ]]; then
      bad+=("$fid")
    fi
  done
  if [[ ${#bad[@]} -gt 0 ]]; then
    local missing
    missing="$(IFS=,; echo "${bad[*]}")"
    echo "Erro: $col ausente na VPS ($table): $missing" >&2
    echo "Abortado — corrija dados ou sincronize clientes/processos/contas antes." >&2
    exit 1
  fi
}

echo "Verificando FKs na VPS..."
check_fk "conta_contabil_id" "financeiro_conta_contabil"
check_fk "cliente_id" "cliente"
check_fk "processo_id" "processo"
check_fk "pessoa_ref_id" "pessoa"

echo "Gerando SQL de aplicação..."
python3 "$ROOT/scripts/lib/sync-cartao-lancamentos-sql.py" \
  "$VPS_CARTAO_ID" \
  "$CARTAO_NOME" \
  "$APPLY_SQL" \
  <"$TSV_LOCAL"

INSERT_COUNT="$(grep -c '^INSERT INTO' "$APPLY_SQL" || true)"
SIZE="$(du -h "$APPLY_SQL" | cut -f1)"
echo "SQL gerado: $APPLY_SQL ($SIZE, $INSERT_COUNT INSERTs)"

if [[ "$YES" -ne 1 ]]; then
  echo
  echo "Será REMOVIDO na VPS:"
  echo "  - $VPS_COUNT lançamentos do cartão '$CARTAO_NOME'"
  echo "  - $VPS_VINCULOS vínculo(s) pagamento-fatura desse cartão"
  echo "Será INSERIDO: $INSERT_COUNT lançamentos (novos ids, cartao_id=$VPS_CARTAO_ID)"
  read -r -p "Aplicar sync na VPS? [y/N] " resp
  case "$resp" in
    y|Y|yes|YES) ;;
    *) echo "Cancelado."; exit 0 ;;
  esac
fi

echo "Backup na VPS (lançamentos do cartão)..."
if [[ "$VPS_MYSQL_MODE" == docker ]]; then
  ssh_vps "docker exec $VPS_CONTAINER mysqldump --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS --no-create-info --complete-insert --skip-extended-insert \
    --where='cartao_id=$VPS_CARTAO_ID' $DB_NAME financeiro_lancamento_cartao > '$VPS_BACKUP_LANC' 2>/dev/null && echo 'Backup lançamentos: $VPS_BACKUP_LANC'"
else
  ssh_vps "mysqldump --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS --no-create-info --complete-insert --skip-extended-insert \
    --where='cartao_id=$VPS_CARTAO_ID' $DB_NAME financeiro_lancamento_cartao > '$VPS_BACKUP_LANC' 2>/dev/null && echo 'Backup lançamentos: $VPS_BACKUP_LANC'"
fi

echo "Backup na VPS (vínculos pagamento-fatura do cartão)..."
VPS_VINC_COUNT="$(mysql_vps -e "
  SELECT COUNT(*) FROM $DB_NAME.financeiro_pagamento_fatura_vinculo fpfv
  INNER JOIN $DB_NAME.financeiro_lancamento_cartao flc ON flc.id = fpfv.lancamento_cartao_id
  WHERE flc.cartao_id = $VPS_CARTAO_ID;
")"
if [[ "$VPS_VINC_COUNT" -gt 0 ]]; then
  VINC_WHERE="lancamento_cartao_id IN (SELECT id FROM financeiro_lancamento_cartao WHERE cartao_id = $VPS_CARTAO_ID)"
  if [[ "$VPS_MYSQL_MODE" == docker ]]; then
    ssh_vps "docker exec $VPS_CONTAINER mysqldump --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS --no-create-info --complete-insert --skip-extended-insert \
      --where='$VINC_WHERE' $DB_NAME financeiro_pagamento_fatura_vinculo \
      > '$VPS_BACKUP_VINC' 2>/dev/null && echo 'Backup vínculos: $VPS_BACKUP_VINC'"
  else
    ssh_vps "mysqldump --default-character-set=$MYSQL_CHARSET -u $VPS_DB_USER -p$VPS_DB_PASS --no-create-info --complete-insert --skip-extended-insert \
      --where='$VINC_WHERE' $DB_NAME financeiro_pagamento_fatura_vinculo \
      > '$VPS_BACKUP_VINC' 2>/dev/null && echo 'Backup vínculos: $VPS_BACKUP_VINC'"
  fi
else
  ssh_vps "touch '$VPS_BACKUP_VINC' && echo 'Backup vínculos: (vazio)'"
fi

echo "Enviando e aplicando SQL na VPS..."
scp_vps -q "$APPLY_SQL" "$VPS_HOST:/tmp/cartao-lancamentos-apply.sql"
if [[ "$VPS_MYSQL_MODE" == docker ]]; then
  ssh_vps "docker exec -i $VPS_CONTAINER mysql --default-character-set=$MYSQL_CHARSET --binary-mode -u $VPS_DB_USER -p$VPS_DB_PASS $DB_NAME < /tmp/cartao-lancamentos-apply.sql && rm -f /tmp/cartao-lancamentos-apply.sql"
else
  ssh_vps "mysql --default-character-set=$MYSQL_CHARSET --binary-mode -u $VPS_DB_USER -p$VPS_DB_PASS $DB_NAME < /tmp/cartao-lancamentos-apply.sql && rm -f /tmp/cartao-lancamentos-apply.sql"
fi

VPS_AFTER="$(mysql_vps -e "SELECT COUNT(*) FROM $DB_NAME.financeiro_lancamento_cartao WHERE cartao_id = $VPS_CARTAO_ID;")"
echo
echo "Sync concluído."
echo "  VPS: $VPS_AFTER lançamentos para '$CARTAO_NOME' (esperado: $INSERT_COUNT)"
echo "  Backup lançamentos: $VPS_BACKUP_LANC"
echo "  Backup vínculos:    $VPS_BACKUP_VINC"

if [[ "$VPS_AFTER" -ne "$INSERT_COUNT" ]]; then
  echo "Aviso: contagem na VPS difere do esperado. Verifique logs MySQL." >&2
  exit 1
fi

rm -rf "$WORKDIR"
