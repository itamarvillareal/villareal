# O6.5 — Confirmação pontual antes do Gate 2

Documento apenas informativo (sem alterações de código). Data de referência do levantamento O6: produção 2026-04-19.

---

## Item 1 — Escritas em `financeiro_lancamento` (ocorrências literais de `set…(`)

Escopo: **todo** o `e-vilareal-java-backend` (incluindo `src/main` e `src/test`).  
Resultado do `grep` por `setClassificacaoFinanceiraId(`, `setEloFinanceiroId(`, `setParcelaRef(`, `setEqReferencia(`: **apenas** `FinanceiroApplicationService.java` (mais gerados Lombok em entidades/DTOs, sem corpo fonte).

A entidade `LancamentoFinanceiroEntity` usa Lombok `@Setter`: existe setter gerado para estes campos, mas **não há** outras chamadas explícitas `set…(` no repositório além das abaixo.

### classificacao_financeira_id — `setClassificacaoFinanceiraId(`

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:330`

```java
        e.setStatus(StringUtils.hasText(status) ? status : "ATIVO");

        // PUT do React não envia estes campos; preservar no update para não zerar no banco.
        if (criacao || req.getClassificacaoFinanceiraId() != null) {
            e.setClassificacaoFinanceiraId(req.getClassificacaoFinanceiraId());   // <-- linha 330
        }
        if (criacao || req.getEloFinanceiroId() != null) {
            e.setEloFinanceiroId(req.getEloFinanceiroId());
        }
```

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:374`

```java
        r.setRefTipo(Utf8MojibakeUtil.corrigir(e.getRefTipo()));
        r.setEqReferencia(Utf8MojibakeUtil.corrigir(e.getEqReferencia()));
        r.setParcelaRef(Utf8MojibakeUtil.corrigir(e.getParcelaRef()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        r.setClassificacaoFinanceiraId(e.getClassificacaoFinanceiraId());   // <-- linha 374
        r.setEloFinanceiroId(e.getEloFinanceiroId());
        return r;
```

**Nota:** A linha 374 grava no **DTO de resposta** `LancamentoFinanceiroResponse`, não na tabela; reflete o valor lido da entidade (hoje `null` em produção para a coluna).

---

### elo_financeiro_id — `setEloFinanceiroId(`

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:178`

```java
            List<LancamentoFinanceiroEntity> comElos = lancamentoRepository.findByEloFinanceiroIdIn(eloIds);
            for (LancamentoFinanceiroEntity l : comElos) {
                l.setEloFinanceiroId(null);   // <-- linha 178
                l.setContaContabil(contaN);
                l.setCliente(null);
                l.setProcesso(null);
                l.setEqReferencia(null);
```

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:333`

```java
        if (criacao || req.getClassificacaoFinanceiraId() != null) {
            e.setClassificacaoFinanceiraId(req.getClassificacaoFinanceiraId());
        }
        if (criacao || req.getEloFinanceiroId() != null) {
            e.setEloFinanceiroId(req.getEloFinanceiroId());   // <-- linha 333
        }
    }
```

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:375`

```java
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        r.setClassificacaoFinanceiraId(e.getClassificacaoFinanceiraId());
        r.setEloFinanceiroId(e.getEloFinanceiroId());   // <-- linha 375
        return r;
    }
}
```

---

### parcela_ref — `setParcelaRef(`

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:317`

```java
        e.setEqReferencia(
                req.getEqReferencia() != null && StringUtils.hasText(req.getEqReferencia())
                        ? req.getEqReferencia().trim()
                        : null);
        e.setParcelaRef(
                req.getParcelaRef() != null && StringUtils.hasText(req.getParcelaRef())
                        ? req.getParcelaRef().trim()
                        : null);   // <-- bloco 317–320

        String origem = req.getOrigem() != null ? req.getOrigem().trim() : "";
        e.setOrigem(StringUtils.hasText(origem) ? origem : "MANUAL");

        String status = req.getStatus() != null ? req.getStatus().trim() : "";
```

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:371`

```java
        r.setNatureza(e.getNatureza());
        r.setRefTipo(Utf8MojibakeUtil.corrigir(e.getRefTipo()));
        r.setEqReferencia(Utf8MojibakeUtil.corrigir(e.getEqReferencia()));
        r.setParcelaRef(Utf8MojibakeUtil.corrigir(e.getParcelaRef()));   // <-- linha 371
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        r.setClassificacaoFinanceiraId(e.getClassificacaoFinanceiraId());
```

---

### eq_referencia — `setEqReferencia(`

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:182`

```java
                l.setEloFinanceiroId(null);
                l.setContaContabil(contaN);
                l.setCliente(null);
                l.setProcesso(null);
                l.setEqReferencia(null);   // <-- linha 182
            }
            lancamentoRepository.saveAll(comElos);
            desvinculados = (int) comElos.stream()
                    .filter(l -> !pertenceAoExtratoLimpo(l, bancoNorm, numeroBanco))
```

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:313`

```java
                ? req.getRefTipo().trim().toUpperCase()
                : "";
        e.setRefTipo("R".equals(refTipoReq) ? "R" : "N");
        e.setEqReferencia(
                req.getEqReferencia() != null && StringUtils.hasText(req.getEqReferencia())
                        ? req.getEqReferencia().trim()
                        : null);   // <-- bloco 313–316
        e.setParcelaRef(
                req.getParcelaRef() != null && StringUtils.hasText(req.getParcelaRef())
                        ? req.getParcelaRef().trim()
```

#### Arquivo: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:370`

```java
        r.setValor(e.getValor());
        r.setNatureza(e.getNatureza());
        r.setRefTipo(Utf8MojibakeUtil.corrigir(e.getRefTipo()));
        r.setEqReferencia(Utf8MojibakeUtil.corrigir(e.getEqReferencia()));   // <-- linha 370
        r.setParcelaRef(Utf8MojibakeUtil.corrigir(e.getParcelaRef()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
```

---

### Síntese Item 1 (risco DTO / frontend)

| Coluna | Escrita na **entidade** / persistência | Origem do valor |
|--------|----------------------------------------|-----------------|
| `classificacao_financeira_id` | Linha 330 | `req.getClassificacaoFinanceiraId()` — em **criação** o bloco corre sempre; se o JSON não enviar a propriedade, em Java tipicamente deserializa como **`null`**. Em **atualização**, só entra no `if` se o cliente enviar o campo com valor não-null **ou** JSON explícito `null` (ver nota abaixo). |
| `elo_financeiro_id` | 178 = `null`; 333 = request | Idem; 178 é limpeza operacional de extrato. |
| `parcela_ref` / `eq_referencia` | 313–316, 317–320 | Só string não vazia após `trim`; caso contrário **`null`**. |

**DTO público:** `LancamentoFinanceiroWriteRequest` expõe os quatro campos — qualquer cliente HTTP pode enviá-los amanhã; o Gate 2 remove **coluna** e deve alinhar/remover campos do contrato JSON.

**Frontend atual (`financeiroRepository.js`):** envia `classificacaoFinanceiraId` / `eloFinanceiroId` só quando `> 0`; envia `eqReferencia` / `parcelaRef` como strings (podem ser `""`). Strings vazias geram `null` na entidade pelos `StringUtils.hasText` acima. Isto é compatível com “sempre null na coluna” em produção até hoje, mas **não** impede o front ou outro cliente de passar a enviar valores não vazios no futuro — aí a coluna deixaria de estar morta.

**Nota Jackson:** em PUT/PATCH, omitir o campo ≠ enviar `null`. O comentário na linha 328 (“PUT do React não envia estes campos”) indica que em **atualização** sem a chave no JSON o valor **não** é reaplicado pelo `if`, logo o Hibernate tende a **preservar** o valor já carregado na entidade gerida — o que, com coluna já sempre `NULL` em produção, mantém `NULL`.

---

## Item 2 — DTOs públicos (request/response) ligados às 6 colunas

Rastreio até `@RestController`:

| Ficheiro | Campo | Request / Response | Endpoint(s) públicos (`@RestController`) |
|----------|-------|--------------------|-------------------------------------------|
| `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/api/dto/LancamentoFinanceiroWriteRequest.java` | `eqReferencia`, `parcelaRef`, `classificacaoFinanceiraId`, `eloFinanceiroId` | **Request** (corpo JSON) | `FinanceiroController`: `POST /api/financeiro/lancamentos`, `PUT /api/financeiro/lancamentos/{id}` |
| `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/api/dto/LancamentoFinanceiroResponse.java` | os mesmos quatro | **Response** | `FinanceiroController`: `GET /api/financeiro/lancamentos`, `GET /api/financeiro/lancamentos/paginada`, `GET /api/financeiro/lancamentos/{id}`, e respostas de `POST`/`PUT` lançamento |
| `e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/api/dto/ProcessoWriteRequest.java` | `status` | **Request** | `ProcessosController`: `POST /api/processos`, `PUT /api/processos/{id}` |
| `e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/api/dto/ProcessoResponse.java` | `status` | **Response** | `ProcessosController`: `GET /api/processos`, `GET /api/processos/por-numero-interno`, `GET /api/processos/{id}`, e corpos de `POST`/`PUT` processo |
| `e-vilareal-java-backend/src/main/java/br/com/vilareal/pessoa/api/dto/PessoaComplementarPayload.java` | `descricaoAcao` | **Request e response** (mesmo tipo no GET e no PUT) | `PessoaRecursosController` sob `@RequestMapping("/api/pessoas")`: `GET /api/pessoas/{id}/complementares`, `PUT /api/pessoas/{id}/complementares` |

**Não listar como coluna O6 em `processo`:** `ProcessoPrazoWriteRequest` / `ProcessoPrazoResponse` com campo `status` referem-se à tabela **`processo_prazo`**, não a `processo.status`.

**Contrato API:** remover colunas no Gate 2 implica **ajustar ou remover** estes campos nos DTOs e no frontend que os consome (`financeiroRepository.js` para financeiro; `processosRepository.js` / respostas GET para `status`; `pessoasComplementaresRepository.js` / payloads de complementares para `descricaoAcao` em pessoa).

---

## Item 3 — `processo.status` vs `processo_prazo.status`

### 3.1 — `ProcessoApplicationService`: `.getStatus()` / `.setStatus()` (com contexto literal)

**Ficheiro:** `e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/application/ProcessoApplicationService.java`

**Tabela `processo` (entidade `ProcessoEntity e`):**

```java
        e.setObservacaoFase(trimToNull(req.getObservacaoFase()));
        e.setStatus(trimToNull(req.getStatus()));   // cabeçalho processo — coluna processo.status
        e.setTramitacao(trimToNull(req.getTramitacao()));
        e.setDataProtocolo(req.getDataProtocolo());
```

```java
        r.setObservacaoFase(Utf8MojibakeUtil.corrigir(e.getObservacaoFase()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));   // ProcessoResponse ← processo.status
        r.setTramitacao(Utf8MojibakeUtil.corrigir(e.getTramitacao()));
        r.setDataProtocolo(e.getDataProtocolo());
```

**Tabela `processo_prazo` (entidade `ProcessoPrazoEntity z`) — não é a coluna O6:**

```java
        z.setPrazoFatal(Boolean.TRUE.equals(req.getPrazoFatal()));
        z.setStatus(trimToNull(req.getStatus()));   // prazo — coluna processo_prazo.status
        z.setObservacao(trimToNull(req.getObservacao()));
```

```java
        r.setPrazoFatal(z.getPrazoFatal());
        r.setStatus(Utf8MojibakeUtil.corrigir(z.getStatus()));   // ProcessoPrazoResponse ← processo_prazo.status
        r.setObservacao(Utf8MojibakeUtil.corrigir(z.getObservacao()));
```

**Mapeamento físico (literal nas entidades):**

- `ProcessoEntity`: campo Java `status` → coluna default **`status`** na tabela **`processo`** (`@Column(length = 120)` sem `name` explícito).

```59:60:e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/infrastructure/persistence/entity/ProcessoEntity.java
    @Column(length = 120)
    private String status;
```

- `ProcessoPrazoEntity`: campo Java `status` → coluna **`status`** na tabela **`processo_prazo`**.

```39:40:e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/infrastructure/persistence/entity/ProcessoPrazoEntity.java
    @Column(length = 40)
    private String status;
```

### 3.2 — Specifications de processo

**Não existe** ficheiro `ProcessoSpecifications` nem uso de `Specification` com `status` no pacote `processo` (pesquisa por `Specification` / `specification` em `.../processo/**`: **zero** ocorrências).

### 3.3 — Filtro HTTP `?status=` na API de processos

`ProcessosController` **não** declara `@RequestParam` de nome `status` em nenhum método. Listagens usam `codigoCliente` ou `numeroInterno`, etc. — **não há** `GET /api/processos?status=...`.

### 3.4 — Frontend (`e-vilareal-react-web`): `status` ligado a processo (excl. tarefa, contrato_locacao)

| Local | Relação com processo judicial |
|--------|-------------------------------|
| `src/repositories/processosRepository.js` **L394** | `salvarCabecalhoProcesso`: corpo inclui `status: payload.status \|\| null` → mapeia para `ProcessoWriteRequest.status` no **POST/PUT `/api/processos`**. |
| `src/repositories/processosRepository.js` **L575** | `upsertPrazoFatalProcesso`: `status: prazoFatal?.status \|\| 'PENDENTE'` → **prazo fatal** (`/api/processos/.../prazos`), tabela **`processo_prazo`**, não `processo.status`. |
| `src/components/Processos.jsx` **L2730–2742** | `<input name="status" …>` — controla **ativo/inativo** na UI (`statusAtivo`), não o campo de cabeçalho `payload.status` enviado ao backend. |
| `src/components/Processos.jsx` **`montarPayloadRegistroProcesso` (L1372–1416)** | O snapshot **não inclui** a chave `status`; ao chamar `salvarCabecalhoProcesso({ ...snapshot, ... })`, `payload.status` é **`undefined`**, logo o repositório envia **`null`** para `processo.status` (comportamento atual alinhado a coluna sempre NULL em produção). |
| `src/repositories/processosRepository.js` **`mapApiProcessoToUiShape` (L614–646)** | **Não** mapeia `p.status` da API para a forma usada na UI; a UI não depende hoje da leitura desse campo no mapeamento principal. O **GET** ainda pode devolver `status` no JSON até o Gate 2 remover do DTO. |

**Outros `status` no front** (ex.: `PublicacoesProcessos.jsx`, `ModalRelatorioPublicacoesProcesso.jsx`) referem **publicação / CNJ / vínculo**, não à coluna `processo.status`.

---

*Fim do relatório O6.5.*
