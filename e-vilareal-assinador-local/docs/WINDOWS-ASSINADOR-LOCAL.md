# Assinador local Windows (pull + token A3)

Programa standalone que roda na máquina do escritório (Windows + token Soluti), faz **pull HTTPS** na VPS, assina PDFs com o token PKCS#11 e devolve os `.p7s`.

Substitui o fluxo manual ZIP → sai.jar → upload para **Diagnósticos → Aguardando Protocolo** quando o usuário clica «Assinar automaticamente» na web (item 6).

## Pré-requisitos (Windows)

1. **Java 21** (`java -version`)
2. **Token USB** Soluti/G&D plugado
3. **Driver SafeSign** (`aetpkss1.dll` em `C:\Windows\System32`)
4. Certificado com thumbprint conhecido no token (default G+D/SafeSign: `C695BA1EC72328487E8FCDC4C34357FEFDD3D100`; eToken SafeNet: defina `ASSINATURA_SIGNER_THUMBPRINT`)
5. **Backend VPS** com `ASSINADOR_API_SECRET` configurado e HTTPS ativo
6. JAR gerado: `e-vilareal-assinador-local/target/assinador-local-1.0.0-SNAPSHOT.jar`

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `ASSINADOR_API_URL` | Sim | Origem da VPS, ex.: `https://api.seudominio.com.br` (sem `/api/...`) |
| `ASSINADOR_API_SECRET` | Sim | Mesmo valor de `ASSINADOR_API_SECRET` no servidor |
| `ASSINADOR_ID` | Sim | Identificador desta máquina → header `X-Assinador-Id` / `locked_by` (ex.: `escritorio-win-01`) |
| `ASSINATURA_TOKEN_PIN` | Sim | PIN do token A3 |
| `ASSINATURA_SIGNER_THUMBPRINT` | Não | SHA-1 do certificado no token (hex, sem espaços). Default: `C695BA1E...` (G+D/SafeSign). eToken SafeNet: `012DD874D9F15473DA47B938B3D8300BBCEE70A1` |
| `ASSINATURA_PKCS11_SLOT_INDEX` | Não | Default **3** (slot SafeSign nesta instalação) |
| `ASSINATURA_PKCS11_CFG` | Não | Caminho customizado do `.cfg` PKCS#11 (senão usa o embutido no JAR) |

**Nunca** commite PIN nem segredo. Configure só na sessão do terminal ou no Agendador de Tarefas (variáveis de usuário/sistema).

## Build do JAR (Mac ou Windows)

Na raiz do repositório:

```bash
./e-vilareal-java-backend/mvnw -f pom.xml -pl e-vilareal-assinador-local -am package -DskipTests
```

O artefato executável:

```
e-vilareal-assinador-local/target/assinador-local-1.0.0-SNAPSHOT.jar
```

(assembly `jar-with-dependencies` — um único JAR com todas as dependências.)

## Executar no Windows (PowerShell)

```powershell
cd C:\caminho\para\villareal

$env:ASSINADOR_API_URL = "https://SUA-VPS.example.com"
$env:ASSINADOR_API_SECRET = "seu-segredo-compartilhado-com-a-vps"
$env:ASSINADOR_ID = "escritorio-win-01"
$env:ASSINATURA_TOKEN_PIN = "SEU_PIN"
# eToken SafeNet (Itamar — segunda máquina):
# $env:ASSINATURA_SIGNER_THUMBPRINT = "012DD874D9F15473DA47B938B3D8300BBCEE70A1"
# Opcional:
# $env:ASSINATURA_PKCS11_SLOT_INDEX = "3"

java -jar e-vilareal-assinador-local\target\assinador-local-1.0.0-SNAPSHOT.jar
```

O processo fica em loop: long-poll → assina lote → volta ao long-poll. **Ctrl+C** encerra com segurança (fecha sessão PKCS#11 no `finally`).

## Loop principal (resumo)

```
┌─────────────────────────────────────────────────────────────┐
│  1. GET /api/assinador/v1/lotes/pendente?timeout=55         │
│     Headers: X-Assinador-Secret, X-Assinador-Id             │
│     → 204: repete  |  200: lote com lista de arquivos       │
├─────────────────────────────────────────────────────────────┤
│  2. Para cada arquivo: GET .../lotes/{id}/pdfs/{arquivoId}  │
├─────────────────────────────────────────────────────────────┤
│  3. provider.open() UMA vez → assina todos → close()      │
│     (sessão PKCS#11 por lote — libera token para sai.jar)   │
├─────────────────────────────────────────────────────────────┤
│  4. POST .../lotes/{id}/concluir (multipart arquivosP7s)    │
│     ou POST .../falha se TOKEN_OCUPADO / erro de token      │
└─────────────────────────────────────────────────────────────┘
         ↑ rede caiu? backoff 2s→60s e continua tentando
```

## Logs

Formato estruturado (`event=...`):

- `assinador_iniciando`, `lote_recebido`, `token_sessao_abrindo`, `arquivo_assinado`, `lote_concluido`, `lote_falha`, `api_inacessivel`

**Não** registra PIN, segredo, CN nem CPF.

## TOKEN_OCUPADO

Se o sai.jar (ou outro programa) estiver usando o token:

1. O assinador local envia `POST .../falha` com `TOKEN_OCUPADO`
2. Na web, o usuário fecha o sai.jar e clica **«Tentar novamente»** (`reliberar` — item 4)
3. O assinador local pega o mesmo lote no próximo long-poll

## Rodar como serviço (opcional)

Use o **Agendador de Tarefas** do Windows:

1. Ação: `java -jar C:\...\assinador-local-1.0.0-SNAPSHOT.jar`
2. «Executar estando o usuário conectado ou não»
3. Variáveis de ambiente na aba correspondente ou script `.ps1` que exporta e chama o JAR
4. Reinício automático em falha: trigger «ao iniciar» + «repetir a cada 1 minuto» se desejado

## Testes (Mac, sem token)

```bash
./e-vilareal-java-backend/mvnw -f pom.xml -pl e-vilareal-assinador-local test
```

Usa mock HTTP + PKCS#12 de teste (`referencia-sintetica.pdf`). Assinatura real com hardware: só no Windows (ver `e-vilareal-assinatura-core/docs/WINDOWS-PKCS11-TEST.md`).

## Estrutura do módulo

```
e-vilareal-assinador-local/
├── pom.xml                          # shade → JAR executável
├── docs/WINDOWS-ASSINADOR-LOCAL.md  # este arquivo
└── src/main/java/br/com/vilareal/assinador/local/
    ├── AssinadorLocalMain.java      # entry point
    ├── config/AssinadorLocalConfig.java
    ├── api/
    │   ├── AssinadorApiClient.java
    │   ├── JdkAssinadorApiClient.java
    │   └── LotePendente.java
    ├── loop/AssinadorPullLoop.java  # loop principal
    ├── signing/
    │   ├── Pkcs11TokenSigningSessionFactory.java  # produção Windows
    │   └── TokenSigningSession.java
    ├── logging/AssinadorLog.java
    └── util/MultipartBodyBuilder.java
```

Depende apenas de **e-vilareal-assinatura-core** (`CmsAttachedPdfSigner`, `Pkcs11KeyMaterialProvider` — não alterados).
