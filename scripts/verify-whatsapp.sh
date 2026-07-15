#!/bin/bash
# Verificação da integração WhatsApp após deploy
BASE_URL="${WHATSAPP_VERIFY_BASE_URL:-https://portal.villarealadvocacia.adv.br}"

echo "=== Verificando WhatsApp Integration ==="
echo "URL: $BASE_URL"
echo ""

# 1. Webhook rejeita token inválido
echo -n "1. Webhook rejeita token inválido... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=INVALIDO&hub.challenge=test")
[ "$HTTP" = "403" ] && echo "OK" || echo "FALHA (esperava 403, recebeu $HTTP)"

# 2. REST API exige autenticação
echo -n "2. REST API exige autenticação... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/whatsapp/stats")
[ "$HTTP" = "401" ] || [ "$HTTP" = "403" ] && echo "OK" || echo "FALHA (esperava 401/403, recebeu $HTTP)"

# 3. Webhook aceita POST
echo -n "3. Webhook aceita POST... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"object":"whatsapp_business_account","entry":[]}' "$BASE_URL/api/webhook/whatsapp")
[ "$HTTP" = "200" ] && echo "OK" || echo "FALHA (esperava 200, recebeu $HTTP)"

# 4. Página de privacidade acessível
echo -n "4. Página de privacidade... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/privacidade")
[ "$HTTP" = "200" ] && echo "OK" || echo "FALHA (esperava 200, recebeu $HTTP)"

# 5. Lembrete: status da integração exige JWT
echo -n "5. Endpoint de stats (protegido)... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/whatsapp/stats")
[ "$HTTP" = "401" ] || [ "$HTTP" = "403" ] && echo "OK (exige login)" || echo "AVISO (esperava 401/403, recebeu $HTTP)"

echo ""
echo "=== Verificação completa ==="
echo ""
echo "Para confirmar integrationConfigured=true, faça login no portal e abra"
echo "WhatsApp > Dashboard — o indicador deve ficar verde («Integração ativa»)."
echo ""
echo "Dados de produção:"
echo "  Phone Number ID: 1144756872051746"
echo "  WABA ID:         1272311911765478"
echo "  Número:          +55 62 9404-5077"
echo "  App ID:          845762438095329"
echo "  API Version:     v25.0"
