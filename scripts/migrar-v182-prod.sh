#!/usr/bin/env bash
# Migração operacional V182 — canonização nono dígito (Opção B) em PRODUÇÃO.
#
# Flyway Maven CLI (./mvnw flyway:migrate) por padrão só olha db/migration/*.sql.
# O Spring Boot também carrega migrations Java em src/main/java/br/com/vilareal/db/migration/
# (V11, V24, V25, V27, V51, V85, V161_1, …). Sem -Dflyway.locations equivalente ao
# application.properties, o CLI acusa "missing migration" para versões só existentes em Java.
# Por isso FLYWAY_LOCATIONS abaixo inclui os dois classpath — não use ignore-migration-patterns.
#
# Uso (PRODUÇÃO — na VPS ou via túnel SSH):
#   export MYSQL_PWD='...'   # NUNCA commitar
#   # Recomendado ANTES: parar backend (ver instruções no final)
#   ./scripts/migrar-v182-prod.sh
#
# Uso (LOCAL — teste, sem mysql client no Mac):
#   export MYSQL_PWD=root MYSQL_DOCKER_CONTAINER=vilareal-db STAGING_MSG_MIN=1 STAGING_MSG_MAX=99999
#   export BACKUP_DIR=./tmp/v182-backups
#   echo MIGRAR | ./scripts/migrar-v182-prod.sh
#
# Variáveis opcionais:
#   MYSQL_HOST (default 127.0.0.1)
#   MYSQL_PORT (default 3306)
#   MYSQL_USER (default root)
#   MYSQL_DATABASE (default vilareal)
#   BACKUP_DIR (default /root/backups em prod, ./tmp/v182-backups local)
#   BACKUP_MIN_BYTES (default 1048576 = 1MB)
#   STAGING_MSG_MIN / STAGING_MSG_MAX (default 250 / 450)
#   FLYWAY_LOCATIONS (default classpath SQL + Java — ver comentário acima)
#   STOP_BACKEND=1 — pergunta se deve parar docker backend antes (VPS)
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${ROOT}/e-vilareal-java-backend"
MIGRATION_FILE="${BACKEND_DIR}/src/main/resources/db/migration/V182__canonizar_nono_digito_celular.sql"
FLYWAY_VERSION_EXPECTED="181"
FLYWAY_VERSION_TARGET="182"
FLYWAY_LOCATIONS="${FLYWAY_LOCATIONS:-classpath:db/migration,classpath:br/com/vilareal/db/migration}"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DATABASE="${MYSQL_DATABASE:-vilareal}"
# Se definido (ex.: vilareal-db), usa docker exec em vez do cliente mysql local.
MYSQL_DOCKER_CONTAINER="${MYSQL_DOCKER_CONTAINER:-}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
BACKUP_MIN_BYTES="${BACKUP_MIN_BYTES:-1048576}"
STAGING_MSG_MIN="${STAGING_MSG_MIN:-250}"
STAGING_MSG_MAX="${STAGING_MSG_MAX:-450}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_FILE:-${BACKUP_DIR}/migracao-v182-prod-${TIMESTAMP}.log}"

# Métricas capturadas na FASE 3 (usadas na FASE 6)
declare TOTAL_MSGS=0
declare FIXOS_12_DIST=0
declare FIXOS_12_MSGS=0
declare CONVERSAS_PARTIDAS=0
declare MSGS_LADO_12=0
declare CONVERSATION_READ_COLISOES=0
declare CLIENTE_WHATSAPP_COLISOES=0
declare MSGS_556282345000=0
declare MSGS_5562982345000=0

log() {
  # shellcheck disable=SC2129
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

die() {
  log "ERRO FATAL: $*"
  exit 1
}

require_mysql_pwd() {
  if [[ -z "${MYSQL_PWD:-}" ]]; then
    echo "ABORT: defina MYSQL_PWD (senha MySQL). Ex.: export MYSQL_PWD='...'" >&2
    exit 1
  fi
}

mysql_exec() {
  if [[ -n "$MYSQL_DOCKER_CONTAINER" ]]; then
    docker exec "$MYSQL_DOCKER_CONTAINER" mysql -u "$MYSQL_USER" -p"$MYSQL_PWD" "$MYSQL_DATABASE" "$@"
  else
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" "$@"
  fi
}

mysql_query() {
  mysql_exec -N -B -e "$1"
}

mysql_batch() {
  local sql
  sql="$(cat)"
  if [[ -n "$MYSQL_DOCKER_CONTAINER" ]]; then
    echo "$sql" | docker exec -i "$MYSQL_DOCKER_CONTAINER" mysql -u "$MYSQL_USER" -p"$MYSQL_PWD" "$MYSQL_DATABASE"
  else
    echo "$sql" | mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE"
  fi
}

mysqldump_full() {
  if [[ -n "$MYSQL_DOCKER_CONTAINER" ]]; then
    docker exec "$MYSQL_DOCKER_CONTAINER" mysqldump -u "$MYSQL_USER" -p"$MYSQL_PWD" \
      --single-transaction \
      --routines \
      --triggers \
      --set-gtid-purged=OFF \
      --default-character-set=utf8mb4 \
      "$MYSQL_DATABASE"
  else
    mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" \
      --single-transaction \
      --routines \
      --triggers \
      --set-gtid-purged=OFF \
      --default-character-set=utf8mb4 \
      "$MYSQL_DATABASE"
  fi
}

flyway_current_version() {
  mysql_query "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;"
}

print_preflight_instructions() {
  cat <<'EOF'

=== ORDEM RECOMENDADA (PRODUÇÃO) ===
1. Escolher janela de baixo movimento (ex.: domingo ~06h BRT).
2. Na VPS: parar o backend ANTES de rodar este script:
     cd /opt/villareal/villareal
     docker compose --env-file .env.docker stop backend
3. Rodar: export MYSQL_PWD='...' && ./scripts/migrar-v182-prod.sh
4. Se FASE 6 = GO: subir backend e validar no navegador.
5. Manter staging *_phone_backup por 7–30 dias.

Este script NÃO para/sobe o backend automaticamente (salvo STOP_BACKEND=1 com confirmação).

EOF
}

optional_stop_backend() {
  if [[ "${STOP_BACKEND:-0}" != "1" ]]; then
    return 0
  fi
  local compose_dir="${VPS_REPO_DIR:-/opt/villareal/villareal}"
  if [[ ! -f "${compose_dir}/docker-compose.yml" ]]; then
    log "STOP_BACKEND=1 mas ${compose_dir}/docker-compose.yml não encontrado — pulando."
    return 0
  fi
  read -r -p "Parar backend via docker compose em ${compose_dir}? [y/N] " ans
  if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
    log "Parada do backend cancelada pelo operador."
    return 0
  fi
  (cd "$compose_dir" && docker compose --env-file .env.docker stop backend)
  log "Backend parado."
}

# ---------------------------------------------------------------------------
# FASE 0 — Pré-checagens
# ---------------------------------------------------------------------------
phase0_prechecks() {
  log "=== FASE 0 — Pré-checagens ==="
  require_mysql_pwd
  mkdir -p "$BACKUP_DIR"

  if [[ ! -f "$MIGRATION_FILE" ]]; then
    die "Arquivo V182 não encontrado: ${MIGRATION_FILE}"
  fi
  log "Migration V182 encontrada no repositório."

  if [[ -n "$MYSQL_DOCKER_CONTAINER" ]]; then
    if ! docker ps --format '{{.Names}}' | grep -qx "$MYSQL_DOCKER_CONTAINER"; then
      die "Container Docker '${MYSQL_DOCKER_CONTAINER}' não está a correr."
    fi
  elif ! command -v mysql >/dev/null 2>&1; then
    die "Cliente mysql não encontrado. Defina MYSQL_DOCKER_CONTAINER=vilareal-db ou instale mysql."
  fi

  if ! mysql_query "SELECT 1;" >/dev/null 2>&1; then
    die "Não foi possível conectar ao MySQL em ${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"
  fi
  log "Conexão MySQL OK."

  local current
  current="$(flyway_current_version)"
  log "Flyway atual: ${current:-<vazio>}"

  if [[ "$current" == "$FLYWAY_VERSION_TARGET" ]]; then
    log "AVISO: Flyway já está em V${FLYWAY_VERSION_TARGET} — migração já aplicada. Saindo sem alterar dados."
    exit 0
  fi

  if [[ "$current" != "$FLYWAY_VERSION_EXPECTED" ]]; then
    die "Flyway esperado V${FLYWAY_VERSION_EXPECTED}, encontrado '${current}'. Investigue antes de continuar."
  fi

  if [[ ! -x "${BACKEND_DIR}/mvnw" ]]; then
    die "mvnw não encontrado/executável em ${BACKEND_DIR}. Flyway manual indisponível."
  fi

  print_preflight_instructions
  optional_stop_backend
}

# ---------------------------------------------------------------------------
# FASE 1 — Backup completo
# ---------------------------------------------------------------------------
phase1_backup() {
  log "=== FASE 1 — Backup completo ==="
  BACKUP_SQL="${BACKUP_DIR}/vilareal-pre-v182-${TIMESTAMP}.sql"
  BACKUP_GZ="${BACKUP_SQL}.gz"

  log "Gerando dump → ${BACKUP_GZ}"
  mysqldump_full | gzip > "$BACKUP_GZ"

  if [[ ! -f "$BACKUP_GZ" ]]; then
    die "Backup não foi criado: ${BACKUP_GZ}"
  fi

  local size
  size="$(stat -f%z "$BACKUP_GZ" 2>/dev/null || stat -c%s "$BACKUP_GZ")"
  if [[ "$size" -lt "$BACKUP_MIN_BYTES" ]]; then
    die "Backup muito pequeno (${size} bytes < ${BACKUP_MIN_BYTES}). ABORT — backup inválido."
  fi

  if ! gzip -t "$BACKUP_GZ"; then
    die "gzip -t falhou — backup corrompido. ABORT."
  fi

  log "Backup OK: ${BACKUP_GZ} ($(du -h "$BACKUP_GZ" | cut -f1))"
  log "Amostra final do dump:"
  gzip -dc "$BACKUP_GZ" 2>/dev/null | tail -3 | tee -a "$LOG_FILE" || true
}

# ---------------------------------------------------------------------------
# FASE 2 — Staging granular
# ---------------------------------------------------------------------------
phase2_staging() {
  log "=== FASE 2 — Staging (backup granular) ==="

  mysql_batch <<'SQL'
DROP TABLE IF EXISTS whatsapp_messages_phone_backup;
DROP TABLE IF EXISTS whatsapp_conversation_read_phone_backup;
DROP TABLE IF EXISTS whatsapp_cobrancas_phone_backup;
DROP TABLE IF EXISTS scheduled_whatsapp_messages_phone_backup;
DROP TABLE IF EXISTS whatsapp_aniversarios_phone_backup;
DROP TABLE IF EXISTS cliente_whatsapp_numero_backup;

CREATE TABLE whatsapp_messages_phone_backup AS
SELECT id, phone_number, created_at
FROM whatsapp_messages
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6','7','8','9');

CREATE TABLE whatsapp_conversation_read_phone_backup AS
SELECT phone_number, last_read_at, updated_at
FROM whatsapp_conversation_read
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6','7','8','9');

CREATE TABLE whatsapp_cobrancas_phone_backup AS
SELECT id, phone_number, created_at
FROM whatsapp_cobrancas
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6','7','8','9');

CREATE TABLE scheduled_whatsapp_messages_phone_backup AS
SELECT id, phone_number, status, scheduled_at, created_at
FROM scheduled_whatsapp_messages
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6','7','8','9');

CREATE TABLE whatsapp_aniversarios_phone_backup AS
SELECT id, phone_number, pessoa_id, ano_envio
FROM whatsapp_aniversarios
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6','7','8','9');

CREATE TABLE cliente_whatsapp_numero_backup AS
SELECT id, cliente_id, numero, principal, created_at
FROM cliente_whatsapp
WHERE LENGTH(numero) = 12
  AND SUBSTRING(numero, 5, 1) IN ('6','7','8','9');
SQL

  log "Contagens staging:"
  mysql_exec -e "
SELECT 'whatsapp_messages' AS t, COUNT(*) AS n FROM whatsapp_messages_phone_backup
UNION ALL SELECT 'conversation_read', COUNT(*) FROM whatsapp_conversation_read_phone_backup
UNION ALL SELECT 'cobrancas', COUNT(*) FROM whatsapp_cobrancas_phone_backup
UNION ALL SELECT 'scheduled', COUNT(*) FROM scheduled_whatsapp_messages_phone_backup
UNION ALL SELECT 'aniversarios', COUNT(*) FROM whatsapp_aniversarios_phone_backup
UNION ALL SELECT 'cliente_whatsapp', COUNT(*) FROM cliente_whatsapp_numero_backup;
" | tee -a "$LOG_FILE"

  STAGING_MSG_COUNT="$(mysql_query 'SELECT COUNT(*) FROM whatsapp_messages_phone_backup;')"
  log "whatsapp_messages staging: ${STAGING_MSG_COUNT} (faixa esperada ${STAGING_MSG_MIN}–${STAGING_MSG_MAX})"

  if [[ "$STAGING_MSG_COUNT" -lt "$STAGING_MSG_MIN" || "$STAGING_MSG_COUNT" -gt "$STAGING_MSG_MAX" ]]; then
    die "Contagem staging fora da faixa (${STAGING_MSG_COUNT}). ABORT — revisão humana necessária."
  fi
}

# ---------------------------------------------------------------------------
# FASE 3 — Re-medição
# ---------------------------------------------------------------------------
phase3_remediacao() {
  log "=== FASE 3 — Re-medição ==="

  TOTAL_MSGS="$(mysql_query 'SELECT COUNT(*) FROM whatsapp_messages;')"
  FIXOS_12_DIST="$(mysql_query "SELECT COUNT(DISTINCT phone_number) FROM whatsapp_messages WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) NOT IN ('6','7','8','9');")"
  FIXOS_12_MSGS="$(mysql_query "SELECT COUNT(*) FROM whatsapp_messages WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) NOT IN ('6','7','8','9');")"

  read -r CONVERSAS_PARTIDAS MSGS_LADO_12 _ <<< "$(mysql_query "
SELECT COUNT(*), COALESCE(SUM(msgs_no_12),0), COALESCE(SUM(msgs_no_13),0)
FROM (
  SELECT m12.phone_number,
         (SELECT COUNT(*) FROM whatsapp_messages a WHERE a.phone_number = m12.phone_number) AS msgs_no_12,
         (SELECT COUNT(*) FROM whatsapp_messages b WHERE b.phone_number = CONCAT(LEFT(m12.phone_number,4),'9',SUBSTRING(m12.phone_number,5))) AS msgs_no_13
  FROM (SELECT DISTINCT phone_number FROM whatsapp_messages
        WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) IN ('6','7','8','9')) m12
  HAVING msgs_no_13 > 0
) t;")"

  CONVERSATION_READ_COLISOES="$(mysql_query "
SELECT COUNT(*) FROM whatsapp_conversation_read r12
WHERE LENGTH(r12.phone_number)=12 AND SUBSTRING(r12.phone_number,5,1) IN ('6','7','8','9')
  AND EXISTS (
    SELECT 1 FROM whatsapp_conversation_read r13
    WHERE r13.phone_number = CONCAT(LEFT(r12.phone_number,4),'9',SUBSTRING(r12.phone_number,5))
  );")"

  CLIENTE_WHATSAPP_COLISOES="$(mysql_query "
SELECT COUNT(*) FROM cliente_whatsapp cw12
WHERE LENGTH(cw12.numero)=12 AND SUBSTRING(cw12.numero,5,1) IN ('6','7','8','9')
  AND EXISTS (
    SELECT 1 FROM cliente_whatsapp cw13
    WHERE cw13.cliente_id = cw12.cliente_id
      AND cw13.numero = CONCAT(LEFT(cw12.numero,4),'9',SUBSTRING(cw12.numero,5))
  );")"

  MSGS_556282345000="$(mysql_query "SELECT COUNT(*) FROM whatsapp_messages WHERE phone_number='556282345000';")"
  MSGS_5562982345000="$(mysql_query "SELECT COUNT(*) FROM whatsapp_messages WHERE phone_number='5562982345000';")"

  {
    echo "REMEDIACAO_TIMESTAMP=${TIMESTAMP}"
    echo "TOTAL_MSGS=${TOTAL_MSGS}"
    echo "FIXOS_12_DIST=${FIXOS_12_DIST}"
    echo "FIXOS_12_MSGS=${FIXOS_12_MSGS}"
    echo "CONVERSAS_PARTIDAS=${CONVERSAS_PARTIDAS}"
    echo "MSGS_LADO_12=${MSGS_LADO_12}"
    echo "CONVERSATION_READ_COLISOES=${CONVERSATION_READ_COLISOES}"
    echo "CLIENTE_WHATSAPP_COLISOES=${CLIENTE_WHATSAPP_COLISOES}"
    echo "MSGS_556282345000=${MSGS_556282345000}"
    echo "MSGS_5562982345000=${MSGS_5562982345000}"
    echo "STAGING_MSG_COUNT=${STAGING_MSG_COUNT}"
  } | tee -a "$LOG_FILE"
}

# ---------------------------------------------------------------------------
# FASE 4 — Confirmação humana
# ---------------------------------------------------------------------------
phase4_confirmacao() {
  log "=== FASE 4 — Confirmação humana ==="
  cat <<EOF | tee -a "$LOG_FILE"

Resumo antes da migração:
  Backup:     ${BACKUP_GZ}
  Log:        ${LOG_FILE}
  Flyway:     ${FLYWAY_VERSION_EXPECTED} → ${FLYWAY_VERSION_TARGET}
  Staging msgs: ${STAGING_MSG_COUNT}
  Total msgs:   ${TOTAL_MSGS}
  Partidas:     ${CONVERSAS_PARTIDAS} (msgs lado 12: ${MSGS_LADO_12})
  Fixos 12:     ${FIXOS_12_DIST} distintos / ${FIXOS_12_MSGS} msgs
  Colisões read: ${CONVERSATION_READ_COLISOES}
  Colisões cliente_whatsapp: ${CLIENTE_WHATSAPP_COLISOES}
  Caso 556282345000: ${MSGS_556282345000} msgs | 5562982345000: ${MSGS_5562982345000} msgs

EOF

  confirm=""
  if IFS= read -r -p "Digite MIGRAR para prosseguir (qualquer outra coisa aborta): " confirm </dev/tty 2>/dev/null; then
    :
  else
    IFS= read -r -p "Digite MIGRAR para prosseguir (qualquer outra coisa aborta): " confirm || confirm=""
  fi
  if [[ "$confirm" != "MIGRAR" ]]; then
    log "Confirmação não recebida ('${confirm}'). ABORT sem alterar dados."
    exit 1
  fi
  log "Confirmação MIGRAR recebida."
}

# ---------------------------------------------------------------------------
# FASE 5 — Migração Flyway
# ---------------------------------------------------------------------------
phase5_migracao() {
  log "=== FASE 5 — Migração Flyway V182 ==="

  local jdbc_url
  if [[ -n "$MYSQL_DOCKER_CONTAINER" ]]; then
    jdbc_url="jdbc:mysql://127.0.0.1:3307/${MYSQL_DATABASE}?useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=UTF-8&serverTimezone=UTC"
  else
    jdbc_url="jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}?useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=UTF-8&serverTimezone=UTC"
  fi
  local flyway_args=(
    -Dflyway.url="$jdbc_url"
    -Dflyway.user="$MYSQL_USER"
    -Dflyway.password="$MYSQL_PWD"
    -Dflyway.outOfOrder=false
    -Dflyway.locations="$FLYWAY_LOCATIONS"
  )

  log "Compilando backend (migrations Java no classpath Flyway)…"
  (cd "$BACKEND_DIR" && ./mvnw -q compile) || die "mvn compile falhou antes do Flyway."

  set +e
  local flyway_out
  flyway_out="$(cd "$BACKEND_DIR" && ./mvnw -q flyway:migrate "${flyway_args[@]}" 2>&1)"
  local flyway_rc=$?
  set -e

  echo "$flyway_out" | tee -a "$LOG_FILE"

  if [[ "$flyway_rc" -ne 0 ]]; then
    die "Flyway migrate falhou (rc=${flyway_rc}). Transação revertida. Investigue o log e use rollback-v182-prod.sh ou restore do dump."
  fi

  if ! echo "$flyway_out" | grep -qE 'Successfully applied|Schema .* is up to date'; then
    log "AVISO: saída Flyway inesperada — verifique manualmente."
  fi

  local after
  after="$(flyway_current_version)"
  if [[ "$after" != "$FLYWAY_VERSION_TARGET" ]]; then
    die "Flyway após migrate = '${after}', esperado V${FLYWAY_VERSION_TARGET}."
  fi
  log "Flyway V${FLYWAY_VERSION_TARGET} aplicado com sucesso."
}

# ---------------------------------------------------------------------------
# FASE 6 — Verificação pós (GO/NO-GO)
# ---------------------------------------------------------------------------
phase6_verificacao() {
  log "=== FASE 6 — Verificação pós-migração ==="

  local fails=0
  local cel12 partidas total_after fixos_dist_after fixos_msgs_after
  local flyway_after staging_nao_migradas wa_dup msgs_12_case msgs_13_case

  cel12="$(mysql_query "SELECT COUNT(DISTINCT phone_number) FROM whatsapp_messages WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) IN ('6','7','8','9');")"
  partidas="$(mysql_query "
SELECT COUNT(*) FROM (
  SELECT m12.phone_number FROM (
    SELECT DISTINCT phone_number FROM whatsapp_messages
    WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) IN ('6','7','8','9')
  ) m12
  HAVING (SELECT COUNT(*) FROM whatsapp_messages b WHERE b.phone_number=CONCAT(LEFT(m12.phone_number,4),'9',SUBSTRING(m12.phone_number,5)))>0
) t;")"
  total_after="$(mysql_query 'SELECT COUNT(*) FROM whatsapp_messages;')"
  fixos_dist_after="$(mysql_query "SELECT COUNT(DISTINCT phone_number) FROM whatsapp_messages WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) NOT IN ('6','7','8','9');")"
  fixos_msgs_after="$(mysql_query "SELECT COUNT(*) FROM whatsapp_messages WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) NOT IN ('6','7','8','9');")"
  flyway_after="$(flyway_current_version)"
  staging_nao_migradas="$(mysql_query "
SELECT COUNT(*) FROM whatsapp_messages_phone_backup b
JOIN whatsapp_messages m ON m.id = b.id
WHERE m.phone_number = b.phone_number;")"
  wa_dup="$(mysql_query "
SELECT COUNT(*) FROM (
  SELECT wa_message_id FROM whatsapp_messages WHERE wa_message_id IS NOT NULL
  GROUP BY wa_message_id HAVING COUNT(*)>1
) d;")"
  msgs_12_case="$(mysql_query "SELECT COUNT(*) FROM whatsapp_messages WHERE phone_number='556282345000';")"
  msgs_13_case="$(mysql_query "SELECT COUNT(*) FROM whatsapp_messages WHERE phone_number='5562982345000';")"

  check() {
    local name="$1" got="$2" expected="$3"
    if [[ "$got" == "$expected" ]]; then
      log "  OK  ${name}: ${got}"
    else
      log "  FAIL ${name}: got=${got} expected=${expected}"
      fails=$((fails + 1))
    fi
  }

  check "celulares_12_restantes" "$cel12" "0"
  check "conversas_partidas" "$partidas" "0"
  check "total_msgs" "$total_after" "$TOTAL_MSGS"
  check "fixos_12_distintos" "$fixos_dist_after" "$FIXOS_12_DIST"
  check "fixos_12_msgs" "$fixos_msgs_after" "$FIXOS_12_MSGS"
  check "flyway_version" "$flyway_after" "$FLYWAY_VERSION_TARGET"
  check "staging_msgs_nao_migradas" "$staging_nao_migradas" "0"
  check "wa_message_id_duplicados" "$wa_dup" "0"
  check "msgs_556282345000" "$msgs_12_case" "0"

  # Caso grande: msgs unificadas em 13 (soma pré-migração dos dois lados, se havia partido)
  local expected_13_case=$((MSGS_556282345000 + MSGS_5562982345000))
  if [[ "$expected_13_case" -gt 0 ]]; then
    check "msgs_5562982345000_unificadas" "$msgs_13_case" "$expected_13_case"
  else
    log "  SKIP msgs_5562982345000 (caso grande ausente neste banco)"
  fi

  if [[ "$fails" -gt 0 ]]; then
    log ""
    log "╔══════════════════════════════════════════════════════════════╗"
    log "║  NO-GO — ${fails} verificação(ões) falharam                         ║"
    log "║  NÃO subir backend. Use: ./scripts/rollback-v182-prod.sh      ║"
    log "║  Ou restore: zcat ${BACKUP_GZ} | mysql ...           ║"
    log "╚══════════════════════════════════════════════════════════════╝"
    exit 2
  fi

  log ""
  log "╔══════════════════════════════════════════════════════════════╗"
  log "║  MIGRAÇÃO OK — subir backend e validar no navegador          ║"
  log "╚══════════════════════════════════════════════════════════════╝"
  log "Próximo passo (VPS):"
  log "  cd /opt/villareal/villareal && docker compose --env-file .env.docker up -d backend"
}

main() {
  log "Início migrar-v182-prod.sh (host=${MYSQL_HOST}:${MYSQL_PORT} db=${MYSQL_DATABASE})"
  phase0_prechecks
  phase1_backup
  phase2_staging
  phase3_remediacao
  phase4_confirmacao
  phase5_migracao
  phase6_verificacao
  log "Concluído com sucesso."
}

main "$@"
