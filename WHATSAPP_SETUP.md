# Configuração WhatsApp Business Cloud API

## Dados de produção (Villa Real Advocacia)

| Campo | Valor |
|-------|-------|
| **Phone Number ID** | `1144756872051746` |
| **WABA ID** | `1272311911765478` |
| **Número** | +55 62 9404-5077 |
| **Nome de exibição** | Villa Real Advocacia |
| **App ID** | `845762438095329` |
| **Graph API** | v25.0 |
| **Webhook URL** | `https://portal.villarealadvocacia.adv.br/api/webhook/whatsapp` |
| **Página de privacidade** | `https://portal.villarealadvocacia.adv.br/privacidade` |

> Tokens, App Secret e Verify Token **não** devem ser versionados — apenas em `.env.docker` na VPS.

## Pré-requisitos

1. Conta Meta Business Manager verificada
2. App criado em [developers.facebook.com](https://developers.facebook.com) com produto WhatsApp (App ID `845762438095329`)
3. Número de telefone verificado e registrado no WhatsApp Business (+55 62 9404-5077)
4. Templates de mensagem aprovados

## Variáveis de ambiente

Defina em `.env.docker` na VPS (copiar de `.env.docker.example`) e repasse ao serviço `backend` no `docker-compose.yml`.

| Variável | Onde obter | Produção (referência) |
|----------|-----------|------------------------|
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developers > App > WhatsApp > API Setup | `1144756872051746` |
| `WHATSAPP_ACCESS_TOKEN` | Business Manager > Usuários do Sistema > Gerar Token (permissões: `whatsapp_business_management`, `whatsapp_business_messaging`) | *(não versionar)* |
| `WHATSAPP_VERIFY_TOKEN` | Definido por você (string secreta para verificação do webhook) | *(não versionar)* |
| `WHATSAPP_WABA_ID` | Business Manager > Contas do WhatsApp | `1272311911765478` |
| `WHATSAPP_APP_SECRET` | Meta Developers > App > Configurações > Básico > Chave Secreta do App | *(não versionar)* |
| `WHATSAPP_VALIDATE_SIGNATURE` | `true` em produção, `false` em dev | `true` |

Em produção, use também `SPRING_PROFILES_ACTIVE=prod` no container do backend (profile carrega `application-prod.properties`).

**Nunca** commite tokens reais. O `.env.docker` está no `.gitignore`.

## Deploy na VPS (Docker Compose)

1. Copiar/atualizar `.env.docker` com as variáveis acima (IDs de produção na tabela acima).
2. Rebuild e subir o stack:
   ```bash
   docker compose build backend
   docker compose up -d backend frontend
   ```
3. Confirmar migrations Flyway (inclui `whatsapp_messages` e `scheduled_whatsapp_messages`).
4. Rodar verificação: `./scripts/verify-whatsapp.sh`

## Configuração do webhook na Meta

Após deploy, em **developers.facebook.com > App > WhatsApp > Configuração**:

- **URL do webhook:** `https://portal.villarealadvocacia.adv.br/api/webhook/whatsapp`
- **Token de verificação:** mesmo valor de `WHATSAPP_VERIFY_TOKEN`
- **Campos assinados:** `messages`, `message_template_status_update`

Teste manual de verificação (substitua o token real):

```bash
curl -s "https://portal.villarealadvocacia.adv.br/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_VERIFY_TOKEN&hub.challenge=teste123"
```

Deve retornar `teste123` (texto puro).

## Nginx / roteamento

O frontend Docker (`e-vilareal-react-web/nginx/default.conf`) já expõe:

```nginx
location /api/ {
    proxy_pass http://backend:8080/api/;
    ...
}
```

Isso cobre o webhook (`/api/webhook/whatsapp`) e a API REST (`/api/whatsapp/**`). Não é necessária rota nginx dedicada, salvo se a VPS usar um Nginx **externo** ao stack — nesse caso, garanta proxy de `/api/` para o backend e TLS válido para o domínio público.

Opcional para webhooks Meta (body completo): `proxy_request_buffering off;` na location `/api/webhook/whatsapp`.

A página de privacidade exigida pela Meta está em `/privacidade` no portal público.

## Templates configurados

| Nome | Categoria | Status | Parâmetros |
|------|-----------|--------|------------|
| `lembrete_audiencia` | Utility | **APPROVED** (pt_BR, ID `2589903884760478`) | `{{1}}`=nome, `{{2}}`=nº processo, `{{3}}`=data/hora |
| `atualizacao_processo` | Utility | Não criado ainda | `{{1}}`=nome, `{{2}}`=nº processo, `{{3}}`=movimentação |
| `boas_vindas_cliente` | Utility | Não criado ainda | `{{1}}`=nome |

## Endpoints REST (autenticados — JWT)

- `POST /api/whatsapp/send` — enviar texto
- `POST /api/whatsapp/send-template` — enviar template
- `GET /api/whatsapp/messages?phoneNumber=` — histórico
- `GET /api/whatsapp/messages/cliente/{id}` — histórico por cliente
- `GET /api/whatsapp/scheduled` — agendamentos
- `POST /api/whatsapp/schedule` — criar agendamento
- `DELETE /api/whatsapp/schedule/{id}` — cancelar
- `GET /api/whatsapp/stats` — estatísticas

## Webhook (público — sem JWT)

- `GET /api/webhook/whatsapp` — verificação Meta
- `POST /api/webhook/whatsapp` — recebimento de mensagens/status

A rota do webhook está em `permitAll()` no Spring Security; `/api/whatsapp/**` exige autenticação.

## Lembretes automáticos (produção)

Configurados em `application-prod.properties`:

- Envio principal: seg–sex às 07:00 (`whatsapp.reminder.cron`)
- Reforço: seg–sex às 18:00 (`whatsapp.reminder.reforco-cron`)
- Antecedência: 3 dias úteis antes da audiência
- Template: `lembrete_audiencia`

## Troubleshooting

- **Webhook não verifica:** conferir `WHATSAPP_VERIFY_TOKEN`, nginx proxy para `/api/`, logs do backend (`Webhook verification`).
- **Mensagens não enviam:** token expirado? conferir `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` (`1144756872051746`).
- **Assinatura inválida (401 no POST):** conferir `WHATSAPP_APP_SECRET`; em produção `WHATSAPP_VALIDATE_SIGNATURE=true`.
- **Templates rejeitados:** aprovar no Meta Business Manager.
- **Rate limit da Meta:** Cloud API suporta até ~80 msgs/s por número (tier depende da conta).

## Integrações relacionadas (já em produção)

- **Gmail:** tokens em volume `/home/vilareal/gmail-tokens`
- **Drive / Claude:** credenciais via classpath ou env (`ANTHROPIC_API_KEY`, `google-drive-credentials.json`)

O WhatsApp usa apenas variáveis de ambiente listadas acima — não requer volume adicional.
