#!/usr/bin/env bash
# Rollback operacional V182 — canonização nono dígito.
#
# Usar SOMENTE se a FASE 6 de migrar-v182-prod.sh falhar ou houver problema confirmado
# pós-migração. Requer tabelas *_phone_backup criadas na FASE 2 da migração.
#
# Desastre total (banco inconsistente / backup staging incompleto):
#   zcat /root/backups/vilareal-pre-v182-TIMESTAMP.sql.gz | mysql -u root vilareal
#
# Uso:
#   export MYSQL_PWD='...'
#   ./scripts/rollback-v182-prod.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DATABASE="${MYSQL_DATABASE:-vilareal}"
MYSQL_DOCKER_CONTAINER="${MYSQL_DOCKER_CONTAINER:-}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_FILE:-${BACKUP_DIR}/rollback-v182-prod-${TIMESTAMP}.log}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

die() {
  log "ERRO FATAL: $*"
  exit 1
}

require_mysql_pwd() {
  if [[ -z "${MYSQL_PWD:-}" ]]; then
    echo "ABORT: defina MYSQL_PWD" >&2
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

table_exists() {
  local t="$1"
  mysql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${MYSQL_DATABASE}' AND table_name='${t}';" | grep -q '^1$'
}

main() {
  log "=== Rollback V182 ==="
  require_mysql_pwd
  mkdir -p "$BACKUP_DIR"

  local flyway_ver
  flyway_ver="$(mysql_query "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;")"
  log "Flyway atual: ${flyway_ver}"

  if [[ "$flyway_ver" != "182" ]]; then
    die "Flyway não está em V182 (atual: ${flyway_ver}). Rollback abortado."
  fi

  for t in whatsapp_messages_phone_backup whatsapp_conversation_read_phone_backup \
           whatsapp_cobrancas_phone_backup scheduled_whatsapp_messages_phone_backup \
           whatsapp_aniversarios_phone_backup cliente_whatsapp_numero_backup; do
    if ! table_exists "$t"; then
      die "Tabela staging ausente: ${t}. Use restore do dump completo."
    fi
  done

  local total_before cel12_before staging_count
  total_before="$(mysql_query 'SELECT COUNT(*) FROM whatsapp_messages;')"
  cel12_before="$(mysql_query "SELECT COUNT(DISTINCT phone_number) FROM whatsapp_messages WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) IN ('6','7','8','9');")"
  staging_count="$(mysql_query 'SELECT COUNT(*) FROM whatsapp_messages_phone_backup;')"

  log "Antes rollback: total_msgs=${total_before} celulares_12=${cel12_before} staging=${staging_count}"

  confirm=""
  if IFS= read -r -p "Digite ROLLBACK para reverter V182 (qualquer outra coisa aborta): " confirm </dev/tty 2>/dev/null; then
    :
  else
    IFS= read -r -p "Digite ROLLBACK para reverter V182 (qualquer outra coisa aborta): " confirm || confirm=""
  fi
  if [[ "$confirm" != "ROLLBACK" ]]; then
    log "Abortado pelo operador ('${confirm}')."
    exit 1
  fi

  log "Aplicando rollback granular..."
  local sql
  sql="$(cat <<'SQL'
START TRANSACTION;

UPDATE whatsapp_aniversarios a
JOIN whatsapp_aniversarios_phone_backup b ON b.id = a.id
SET a.phone_number = b.phone_number;

UPDATE scheduled_whatsapp_messages s
JOIN scheduled_whatsapp_messages_phone_backup b ON b.id = s.id
SET s.phone_number = b.phone_number;

UPDATE whatsapp_cobrancas c
JOIN whatsapp_cobrancas_phone_backup b ON b.id = c.id
SET c.phone_number = b.phone_number;

UPDATE whatsapp_messages m
JOIN whatsapp_messages_phone_backup b ON b.id = m.id
SET m.phone_number = b.phone_number;

INSERT INTO cliente_whatsapp (id, cliente_id, numero, principal, created_at, updated_at)
SELECT b.id, b.cliente_id, b.numero, b.principal, b.created_at, NOW(3)
FROM cliente_whatsapp_numero_backup b
LEFT JOIN cliente_whatsapp cw ON cw.id = b.id
WHERE cw.id IS NULL;

UPDATE cliente_whatsapp cw
JOIN cliente_whatsapp_numero_backup b ON b.id = cw.id
SET cw.numero = b.numero;

INSERT INTO whatsapp_conversation_read (phone_number, last_read_at, updated_at)
SELECT b.phone_number, b.last_read_at, b.updated_at
FROM whatsapp_conversation_read_phone_backup b
LEFT JOIN whatsapp_conversation_read r ON r.phone_number = b.phone_number
WHERE r.phone_number IS NULL;

UPDATE whatsapp_conversation_read r
JOIN whatsapp_conversation_read_phone_backup b ON b.phone_number = r.phone_number
SET r.last_read_at = b.last_read_at, r.updated_at = b.updated_at;

DELETE FROM flyway_schema_history WHERE version = '182';

COMMIT;
SQL
)"
  echo "$sql" | mysql_batch

  local total_after cel12_after flyway_after
  total_after="$(mysql_query 'SELECT COUNT(*) FROM whatsapp_messages;')"
  cel12_after="$(mysql_query "SELECT COUNT(DISTINCT phone_number) FROM whatsapp_messages WHERE LENGTH(phone_number)=12 AND SUBSTRING(phone_number,5,1) IN ('6','7','8','9');")"
  flyway_after="$(mysql_query "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;")"

  log "Após rollback: total_msgs=${total_after} celulares_12=${cel12_after} flyway=${flyway_after}"

  local fails=0
  if [[ "$total_after" != "$total_before" ]]; then
    log "FAIL total_msgs: ${total_after} != ${total_before}"
    fails=$((fails + 1))
  else
    log "OK total_msgs inalterado"
  fi

  if [[ "$cel12_after" -lt 1 ]]; then
    log "FAIL celulares_12 após rollback parece vazio (${cel12_after})"
    fails=$((fails + 1))
  else
    log "OK celulares_12 restaurados (${cel12_after})"
  fi

  if [[ "$flyway_after" != "181" ]]; then
    log "FAIL flyway esperado 181, got ${flyway_after}"
    fails=$((fails + 1))
  else
    log "OK flyway V181"
  fi

  if [[ "$fails" -gt 0 ]]; then
    die "Rollback incompleto — ${fails} falha(s). Considere restore do dump."
  fi

  log "Rollback concluído. Revisar inbox antes de subir backend."
}

main "$@"
