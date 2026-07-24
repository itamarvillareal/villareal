#!/usr/bin/env bash
# Bootstrap da instância portal1 na VPS (DB, volumes, env, compose, nginx, TLS, catálogo).
# Uso (na VPS, como root):
#   cd /opt/villareal/villareal && ./scripts/bootstrap-portal1-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_PORTAL="${ENV_PORTAL:-$ROOT/.env.docker}"
ENV_PORTAL1="${ENV_PORTAL1:-$ROOT/.env.portal1}"
DATA_ROOT="/home/vilareal/portal1"
DB_NAME="vilareal_portal1"
NGINX_SITE="portal1.villarealadvocacia.adv.br"

if [[ ! -f "$ENV_PORTAL" ]]; then
  echo "Env do portal não encontrado: $ENV_PORTAL" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_PORTAL"
set +a

MYSQL_USER="${VILLAREAL_COMPOSE_JDBC_USER:-root}"
MYSQL_PASSWORD="${VILLAREAL_COMPOSE_JDBC_PASSWORD:?VILLAREAL_COMPOSE_JDBC_PASSWORD ausente em $ENV_PORTAL}"

echo "==> Volumes em $DATA_ROOT"
mkdir -p "$DATA_ROOT"/{gmail-tokens,cora-certs,projudi-peticoes,projudi-sessions}
chmod 750 "$DATA_ROOT"

echo "==> Banco $DB_NAME"
mysql -h127.0.0.1 -uroot -p"$MYSQL_PASSWORD" -e \
  "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
  2> >(grep -v "Using a password" >&2 || true)

# root@% na VPS não tem DDL; o portal usa grant por subnet Docker (ex.: 172.18.0.%).
PORTAL1_SUBNET=$(docker network inspect portal1_default -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || true)
if [[ -z "$PORTAL1_SUBNET" ]]; then
  # rede ainda não existe — cria grant genérico após o primeiro up; pré-cria 172.19 como fallback comum
  HOST_PATTERN="172.19.0.%"
else
  HOST_PATTERN=$(echo "$PORTAL1_SUBNET" | awk -F[./] '{print $1"."$2".0.%"}')
fi
echo "==> MySQL grant root@${HOST_PATTERN} em ${DB_NAME}.*"
mysql -h127.0.0.1 -uroot -p"$MYSQL_PASSWORD" -e "
CREATE USER IF NOT EXISTS 'root'@'${HOST_PATTERN}' IDENTIFIED BY '${MYSQL_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO 'root'@'${HOST_PATTERN}';
FLUSH PRIVILEGES;
" 2> >(grep -v "Using a password" >&2 || true)

if [[ ! -f "$ENV_PORTAL1" ]]; then
  echo "==> Criando $ENV_PORTAL1"
  JWT=$(openssl rand -base64 48 | tr -d '\n')
  TOTP=$(openssl rand -base64 32 | tr -d '\n')
  ASSIN=$(openssl rand -base64 48 | tr -d '\n')
  cat > "$ENV_PORTAL1" <<EOF
COMPOSE_CONTAINER_PREFIX=portal1
HOST_BACKEND_PORT=8082
HOST_FRONTEND_PORT=5174
INSTANCE_DATA_ROOT=${DATA_ROOT}

SPRING_PROFILES_ACTIVE=prod

VILLAREAL_COMPOSE_JDBC_URL=jdbc:mysql://host.docker.internal:3306/${DB_NAME}?createDatabaseIfNotExist=false&useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=utf8&serverTimezone=UTC
VILLAREAL_COMPOSE_JDBC_USER=${MYSQL_USER}
VILLAREAL_COMPOSE_JDBC_PASSWORD=${MYSQL_PASSWORD}

JWT_SECRET=${JWT}
TOTP_ENCRYPTION_KEY=${TOTP}
ASSINADOR_API_SECRET=${ASSIN}
ASSINADOR_REQUIRE_HTTPS=true

ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
DATAJUD_API_KEY=${DATAJUD_API_KEY:-}
DATAJUD_BASE_URL=${DATAJUD_BASE_URL:-https://api-publica.datajud.cnj.jus.br}

# Mesmo Shared Drive do portal; raiz isolada na pasta "Sistema".
GOOGLE_DRIVE_SHARED_DRIVE_ID=${GOOGLE_DRIVE_SHARED_DRIVE_ID:-0ANU_zUd2tFQ7Uk9PVA}
GOOGLE_DRIVE_ROOT_FOLDER_ID=${GOOGLE_DRIVE_ROOT_FOLDER_ID:-1L-Toddl68HqBnb7-eF3TD3-hobzBokwV}
GOOGLE_DRIVE_IMPERSONATE_USER=
PROJUDI_CRED_KEY=
PROJUDI_ORQUESTRADOR_CREDENCIAL_ID=1
VILAREAL_EMAIL_PROJUDI_PIPELINE_ENABLED=false

WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_WABA_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VALIDATE_SIGNATURE=false

CORA_ENABLED=false

PJE_BROWSER_ENABLED=false
PJE_BROWSER_HEADLESS=true
PJE_BROWSER_PROXY=
PJE_EMAIL_TRIGGER_ENABLED=false
PJE_COPIA_INTEGRAL_DOWNLOAD_TIMEOUT_MS=900000
EOF
  chmod 600 "$ENV_PORTAL1"
else
  echo "==> Mantendo $ENV_PORTAL1 existente"
fi

DRIVE_CREDS='e-vilareal-java-backend/src/main/resources/google-drive-credentials.json'
if [[ ! -f "$DRIVE_CREDS" ]]; then
  echo "AVISO: $DRIVE_CREDS ausente — build do backend pode falhar ou Drive fica off." >&2
fi

echo "==> Build/up portal1"
docker compose -p portal1 --env-file "$ENV_PORTAL1" build backend frontend
docker compose -p portal1 --env-file "$ENV_PORTAL1" up -d backend frontend

echo "==> Aguardando health do backend portal1 (:8082)"
for i in $(seq 1 60); do
  code=$(curl -s -o /tmp/portal1-health.json -w "%{http_code}" http://127.0.0.1:8082/actuator/health || true)
  if [[ "$code" == "200" ]]; then
    cat /tmp/portal1-health.json; echo
    break
  fi
  if [[ "$i" == "60" ]]; then
    echo "Backend portal1 não respondeu health a tempo (último HTTP $code)." >&2
    docker compose -p portal1 --env-file "$ENV_PORTAL1" logs --tail=80 backend >&2 || true
    exit 1
  fi
  sleep 5
done

echo "==> Sync de catálogo"
"$ROOT/scripts/sync-catalogo-instancia.sh" \
  --source vilareal \
  --target "$DB_NAME" \
  --user "$MYSQL_USER" \
  --password "$MYSQL_PASSWORD" \
  --host 127.0.0.1 \
  --port 3306

echo "==> Nginx $NGINX_SITE"
SITE_AVAIL="/etc/nginx/sites-available/${NGINX_SITE}"
SITE_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"
if [[ ! -f "$SITE_AVAIL" ]]; then
  cp "$ROOT/deploy/nginx-portal1.conf.example" "$SITE_AVAIL"
fi
ln -sfn "$SITE_AVAIL" "$SITE_ENABLED"
nginx -t
systemctl reload nginx

if [[ ! -d "/etc/letsencrypt/live/${NGINX_SITE}" ]]; then
  echo "==> Certbot TLS para ${NGINX_SITE}"
  certbot --nginx -d "$NGINX_SITE" --non-interactive --agree-tos --redirect \
    --register-unsafely-without-email || \
  certbot --nginx -d "$NGINX_SITE" --non-interactive --agree-tos --redirect \
    -m villareal@villarealadvocacia.adv.br
else
  echo "==> Certificado TLS já existe para ${NGINX_SITE}"
fi

echo
echo "Portal1 pronto:"
echo "  URL: https://${NGINX_SITE}"
echo "  Health: curl -s https://${NGINX_SITE}/actuator/health"
echo "  Login inicial (seed Flyway): itamar / 123456  — troque a senha após o primeiro acesso."
