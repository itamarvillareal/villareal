#!/usr/bin/env bash
# Verificação rápida da integração WhatsApp após deploy.
set -euo pipefail

BASE_URL="${WHATSAPP_VERIFY_BASE_URL:-https://portal.villarealadvocacia.adv.br}"

echo "=== Verificando WhatsApp Integration ==="
echo "Base URL: $BASE_URL"
echo ""

# 1. Testar webhook GET (rejeita token inválido)
echo -n "1. Webhook verification... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN_ERRADO&hub.challenge=test")
if [ "$RESPONSE" = "403" ]; then
  echo "OK (rejeita token inválido)"
else
  echo "FALHA (esperava 403, recebeu $RESPONSE)"
fi

# 2. Testar que REST API exige autenticação
echo -n "2. REST API auth... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/whatsapp/stats")
if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "403" ]; then
  echo "OK (exige autenticação)"
else
  echo "FALHA (esperava 401/403, recebeu $RESPONSE)"
fi

# 3. Testar que webhook POST aceita (retorna 200)
echo -n "3. Webhook POST... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[]}' \
  "$BASE_URL/api/webhook/whatsapp")
if [ "$RESPONSE" = "200" ]; then
  echo "OK (aceita POST)"
else
  echo "FALHA (esperava 200, recebeu $RESPONSE)"
fi

echo ""
echo "=== Verificação completa ==="
