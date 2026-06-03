# Laboratório Cora (Integração Direta — stage)

Pacote isolado: `br.com.vilareal.integracao.cora.sandbox`

**Não** integra com financeiro/pagamentos. Só loga em console/arquivo.

## Ativar

1. Profile Spring: `cora-sandbox`
2. Propriedade: `cora.sandbox.enabled=true` (já vem em `application-cora-sandbox.properties`)

```bash
export CORA_CLIENT_ID="seu-client-id-stage"
export CORA_CERT_PATH="/caminho/certificate.pem"
export CORA_KEY_PATH="/caminho/private-key-pkcs8.pem"

# Opcional — hosts (defaults stage)
export CORA_BASE_URL="https://api.stage.cora.com.br"
export CORA_MTLS_BASE_URL="https://matls-clients.api.stage.cora.com.br"

cd e-vilareal-java-backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev,cora-sandbox
```

Ou via Docker: adicione `SPRING_PROFILES_ACTIVE=dev,cora-sandbox` e as envs acima no `.env.docker`.

## Variáveis de ambiente

| Variável | Obrigatória | Default | Descrição |
|----------|-------------|---------|-----------|
| `CORA_CLIENT_ID` | Sim | — | Client ID stage |
| `CORA_CERT_PATH` | Sim* | — | Certificado `.pem` |
| `CORA_KEY_PATH` | Sim* | — | Private key PKCS#8 `.pem` |
| `CORA_KEYSTORE_PATH` | Alternativa | — | PKCS#12 (`.p12`) — dispensa cert/key |
| `CORA_KEYSTORE_PASSWORD` | Se PKCS#12 | vazio | Senha do keystore |
| `CORA_BASE_URL` | Não | `https://api.stage.cora.com.br` | Pagamentos, extrato |
| `CORA_MTLS_BASE_URL` | Não | `https://matls-clients.api.stage.cora.com.br` | Token, boletos v2 |
| `CORA_SANDBOX_LOG_FILE` | Não | — | Arquivo de log adicional |

\* Use cert+key **ou** keystore PKCS#12.

## OpenSSL — converter chave / PKCS#12

Se a Cora entregou `BEGIN RSA PRIVATE KEY` (PKCS#1), converta para PKCS#8:

```bash
openssl pkcs8 -topk8 -nocrypt -in private-key.key -out private-key-pkcs8.pem
```

Ou gere PKCS#12 (alternativa ao par PEM):

```bash
openssl pkcs12 -export \
  -in certificate.pem \
  -inkey private-key.key \
  -out cora-stage.p12 \
  -name cora-client \
  -passout pass:

export CORA_KEYSTORE_PATH="/caminho/cora-stage.p12"
export CORA_KEYSTORE_PASSWORD=""
```

## Ordem sugerida de testes

1. **Smoke (mTLS + auth + extrato)**  
   `GET /api/cora-sandbox/run-smoke` (requer JWT login normal)

2. **Extrato**  
   `GET /api/cora-sandbox/test/consultar-extrato?start=2026-01-01&end=2026-01-31`

3. **Emitir boleto**  
   `POST /api/cora-sandbox/test/emitir-boleto`  
   Anote `id` e linha digitável nos logs.

4. **Consultar boleto**  
   `GET /api/cora-sandbox/test/consultar-boleto/{invoiceId}`

5. **Iniciar pagamento (foco)**  
   `POST /api/cora-sandbox/test/iniciar-pagamento?linhaDigitavel=...`  
   - Resposta imediata: `status: INITIATED` = **aguardando aprovação no app Cora**  
   - Consulta `GET /payments`: confirma se permanece `INITIATED`  
   - Extrato: liquidação aparece depois da aprovação

6. **Webhook**  
   - Endpoint público: `POST /api/cora-sandbox/webhook`  
   - Exponha com ngrok: `ngrok http 8081` → cadastre `https://xxxx.ngrok.io/api/cora-sandbox/webhook` no painel Cora  
   - Eventos de boleto pago / pagamento disparam payload logado no backend

## Segurança

- Em produção: **não** use profile `cora-sandbox` (`cora.sandbox.enabled=false`).
- Apenas `/api/cora-sandbox/webhook` é público (como WhatsApp webhook).
- Demais rotas exigem autenticação JWT.

## Referências Cora

- Token: `POST {CORA_MTLS_BASE_URL}/token` (client_credentials + mTLS)
- Boletos: `POST/GET {CORA_MTLS_BASE_URL}/v2/invoices`
- Pagamento: `POST {CORA_BASE_URL}/payments/initiate`
- Extrato: `GET {CORA_BASE_URL}/bank-statement/statement?start=&end=`

Documentação: https://developers.cora.com.br/docs/utiliza%C3%A7%C3%A3o-das-apis
