# Financeiro — Levantamento (Fase 1 de 3)

> **Escopo desta fase:** inventário e mapeamento PRECISO do estado atual das estruturas financeiras e da integração com imóveis, processos e contas contábeis. **Não** propõe soluções — apenas retrata o que existe e lista achados. Fases 2 (revisão) e 3 (modernização) virão depois.
>
> **Convenção de referências:** `arquivo:linha`. Migrations em `e-vilareal-java-backend/src/main/resources/db/migration/`. Entidades em `e-vilareal-java-backend/src/main/java/br/com/vilareal/`. Frontend em `e-vilareal-react-web/src/`.
>
> **Data do levantamento:** 2026-06-14. Baseado em leitura direta do código (sem alterações). Inspeções de dados, quando feitas, foram no ambiente DEV (`localhost:3307`), somente leitura.

---

## Sumário

1. [Modelo de dados](#1-modelo-de-dados)
2. [Convenções e valores mágicos](#2-convencoes-e-valores-magicos)
3. [Serviços](#3-servicos)
4. [API](#4-api)
5. [Fluxos ponta-a-ponta](#5-fluxos-ponta-a-ponta)
6. [Frontend](#6-frontend)
7. [Pontos de integração e costuras](#7-pontos-de-integracao-e-costuras)
8. [Achados](#8-achados)

---
## 1. MODELO DE DADOS

### 1.0 Diagrama textual dos caminhos de join

```
pessoa (V1)
  ▲ FK pessoa_id
cliente (V10)  ──UK codigo_cliente CHAR(8)
  ▲ FK cliente_id (real)
  │
  ├──◄ processo.cliente_id (V56/V63, NOT NULL)  ── UK (cliente_id, numero_interno)
  │        ▲ processo.pessoa_id → pessoa (titular)
  │
  ├──◄ imovel.cliente_id (V56)        imovel.pessoa_id → pessoa (legado)
  │        │                          imovel.processo_id → processo (FK real, SET NULL)
  │        │
  │        └──◄ imovel_processo (V67) N:N  (imovel_id, processo_id) ativo/historico
  │
  └──◄ financeiro_lancamento.cliente_id (V56, FK real → cliente)
           financeiro_lancamento.processo_id → processo (FK real)
           financeiro_lancamento.conta_contabil_id → financeiro_conta_contabil (FK real)
           financeiro_lancamento.pessoa_ref_id → pessoa (SOFT, sem FK)

contrato_locacao (V14)  imovel_id → imovel (FK real, CASCADE)
           locador_pessoa_id / inquilino_pessoa_id → pessoa (FK real, SET NULL)
  │
  ├──◄ locacao_repasse (V14)   contrato_locacao_id (FK real)  | lancamento_financeiro_vinculo_id (SOFT)
  ├──◄ locacao_despesa (V14)   contrato_locacao_id (FK real)  | lancamento_financeiro_id (SOFT)
  └──◄ locacao_repasse_lancamento (V112)  contrato_locacao_id (FK real, CASCADE)
            lancamento_financeiro_id → financeiro_lancamento (FK real, CASCADE)
            papel ∈ {ALUGUEL, REPASSE, DESPESA}   ← FONTE DA VERDADE do /resultado
```

**Caminho financeiro→imóvel (a "costura" central):** um `financeiro_lancamento` é amarrado a um contrato pela tabela `locacao_repasse_lancamento` (vínculo com `papel`). Não há FK direta lançamento→contrato; a ligação é sempre via `locacao_repasse_lancamento`. O `/resultado` do imóvel deriva exclusivamente desses vínculos.

**Caminho lançamento→imóvel via processo:** a reconciliação descobre os lançamentos candidatos de um contrato por `imovel.processo_id` → `financeiro_lancamento.processo_id` (`LocacaoReconciliacaoService.java:110,115`). Sem `imovel.processo_id`, a reconciliação não enxerga lançamentos.

---

### 1.1 `financeiro_conta_contabil`

- **Entity:** `financeiro/infrastructure/persistence/entity/ContaContabilEntity.java`
- **Migrations:** cria + seed `V7__financeiro.sql:1-23`; conta G adicionada `V19__financeiro_conta_geral.sql:3-4`.

| coluna | tipo | null | default | ref |
|---|---|---|---|---|
| id | BIGINT AUTO_INCREMENT | NOT NULL | — | V7:2 |
| codigo | VARCHAR(4) | NOT NULL | — | V7:3 |
| nome | VARCHAR(255) | NOT NULL | — | V7:4 |
| ativo | BOOLEAN | NOT NULL | TRUE | V7:5 |
| ordem_exibicao | INT | NOT NULL | 0 | V7:6 |

- **PK:** `id` (V7:2). **UK:** `uk_fin_cc_codigo`(codigo) V7:7; `uk_fin_cc_nome`(nome) V7:8.
- **FKs:** nenhuma. **JPA:** só campos escalares (sem `@ManyToOne`).

---

### 1.2 `financeiro_lancamento` (núcleo do financeiro)

- **Entity:** `financeiro/infrastructure/persistence/entity/LancamentoFinanceiroEntity.java`
- **Migrations:** cria `V7:25-61`; drop colunas mortas `V34`; grupo_compensacao `V43`; etapa `V44`; índices `V47`; refactor cliente/pessoa `V56`; descricao_norm `V110`; UK banco+numero `V89`. Referenciada por `V42`, `V58`, `V65`, `V112`.

| coluna | tipo | null | default | origem |
|---|---|---|---|---|
| id | BIGINT | NOT NULL | AUTO_INCREMENT | V7:26 |
| conta_contabil_id | BIGINT | **NOT NULL** | — | V7:27 |
| pessoa_ref_id | BIGINT | NULL | — | V56:57 (ex-`cliente_id` legado) |
| cliente_id | BIGINT | NULL | — | V56:64 |
| processo_id | BIGINT | NULL | — | V7:29 |
| banco_nome | VARCHAR(120) | NULL | — | V7:30 |
| numero_banco | INT | NULL | — | V7:31 |
| numero_lancamento | VARCHAR(80) | NOT NULL | — | V7:32 |
| data_lancamento | DATE | NOT NULL | — | V7:33 |
| data_competencia | DATE | NULL | — | V7:34 |
| descricao | VARCHAR(500) | NOT NULL | — | V7:35 |
| descricao_detalhada | VARCHAR(2000) | NULL | — | V7:36 |
| descricao_norm | VARCHAR(255) | NULL | — | V110:2 |
| valor | DECIMAL(19,2) | NOT NULL | — | V7:37 |
| natureza | VARCHAR(10) | NOT NULL | — (CHECK DEBITO/CREDITO) | V7:38,54 |
| ref_tipo | VARCHAR(1) | NOT NULL | `'N'` (CHECK N/R) | V7:39,55 |
| origem | VARCHAR(40) | NOT NULL | `'MANUAL'` | V7:42 |
| status | VARCHAR(20) | NOT NULL | `'ATIVO'` | V7:43 |
| etapa | VARCHAR(20) | NOT NULL | `'IMPORTADO'` | V44:5 |
| grupo_compensacao | VARCHAR(40) | NULL | — | V43:2 |
| created_at | TIMESTAMP(3) | NOT NULL | CURRENT_TIMESTAMP(3) | V7:46 |
| updated_at | TIMESTAMP(3) | NOT NULL | ON UPDATE | V7:47 |

- **Colunas removidas** `V34:7-11`: `classificacao_financeira_id`, `elo_financeiro_id`, `parcela_ref`, `eq_referencia` (haviam sido criadas em V7:40-45).
- **PK:** `id`. **CHECKs:** `chk_fl_natureza` IN ('DEBITO','CREDITO') V7:54; `chk_fl_ref` IN ('N','R') V7:55.
- **UK:** `uk_fl_numero_banco_lancamento`(numero_banco, numero_lancamento) — V89:4-5.

**FKs reais vs soft:**

| coluna | FK no banco | mapeamento JPA | obs |
|---|---|---|---|
| conta_contabil_id | **FK real** `fk_fl_conta`→financeiro_conta_contabil (RESTRICT) V7:48-49 | `@ManyToOne ContaContabilEntity` :31-33 | |
| cliente_id | **FK real** `fk_fl_cliente`→**cliente**(id) SET NULL — V56:97-99 | `@ManyToOne ClienteEntity clienteEntidade` :39-41 | em V7:50-51 apontava para **pessoa(id)** (legado), trocada em V56 |
| processo_id | **FK real** `fk_fl_processo`→processo SET NULL V7:52-53 | `@ManyToOne ProcessoEntity` :43-45 | |
| pessoa_ref_id | **SEM FK** (só índice) | `@ManyToOne PessoaEntity pessoaRef` :35-37 | DROP comentado em V63:19-21 |

**Índices (estado final):** `idx_fl_data`(data_lancamento) V7:58; `idx_fl_pessoa_ref` V56:61; `idx_fl_cliente` V56:95; `idx_fl_processo` V7:60; `idx_fl_conta` V7:61; `idx_lanc_cliente_fk_processo`(cliente_id,processo_id) V56:101; `idx_fl_grupo_compensacao` V43:5; `idx_lancamento_etapa` V44:22; `idx_lancamento_etapa_banco` V44:23; `idx_lancamento_etapa_data` V44:24; `idx_lanc_etapa_conta_data` V47:3-4; `idx_lanc_banco_data` V47:6-7; `idx_lanc_descricao_prefix`(descricao(100)) V47:9-10; `idx_lanc_cliente_processo` V47:12-13; `idx_lanc_descricao_conta` V47:15-16; `idx_fl_norm_banco_conta` V110:4-5; `idx_fl_etapa_norm_banco` V110:7-8.

---

### 1.3 `financeiro_cartao`, `financeiro_lancamento_cartao`, vínculos de fatura

**`financeiro_cartao`** — entity `CartaoEntity.java`; migration `V41:1-16`. Colunas: id, nome VARCHAR(120) NN, numero_cartao INT NN, ativo BOOL NN TRUE, ordem_exibicao INT NN 0. UK nome (V41:7), UK numero_cartao (V41:8). Sem FK.

**`financeiro_lancamento_cartao`** (pedido como `lancamento_cartao`) — entity `LancamentoCartaoEntity.java`; migration `V41:18-50` + V56. Espelha `financeiro_lancamento` para extrato de cartão: id, cartao_id NN, conta_contabil_id NN, pessoa_ref_id (V56:111), cliente_id (V56:118), processo_id, numero_lancamento, data_lancamento, data_competencia, descricao, descricao_detalhada, valor, ref_tipo, origem `'MANUAL'`, status `'ATIVO'`, timestamps. FKs reais: `fk_flc_cartao`→financeiro_cartao (V41:35-36), `fk_flc_conta` (V41:37-38), `fk_flc_cliente`→**cliente** (V56:151-153, antes pessoa), `fk_flc_processo` (V41:41-42). **Não tem `etapa` nem `grupo_compensacao`** (não passa por compensação).

**`financeiro_pagamento_fatura_vinculo`** — entity `PagamentoFaturaVinculoEntity.java`; migration `V42:1-15`. Liga lançamento bancário (débito) ↔ lançamento de fatura do cartão. Colunas: id, lancamento_banco_id NN, lancamento_cartao_id NN, created_at. FKs reais a ambos (CASCADE) V42:6-9. **UK** em cada lado (V42:10-11) → relação 1:1.

**`financeiro_cartao_banco_mapeamento`** — entity `CartaoBancoMapeamentoEntity.java`; migration `V46:4-24`. Regra para casar débito do banco → fatura do cartão: cartao_id NN (FK real V46:13-14), numero_banco INT NN, padrao_descricao VARCHAR(255) NN, tipo_match ENUM('CONTAINS','REGEX') default CONTAINS, tolerancia_valor DECIMAL(5,4) default 0.05, tolerancia_dias INT default 31, ativo. Seeds INSERT V46:19-24 (numero_banco 1/4/21).

---

### 1.4 `financeiro_regra_classificacao`, `financeiro_saldo_inicial`, `financeiro_recorrencia_descarte`

**`financeiro_regra_classificacao`** — entity `RegraClassificacaoEntity.java`; migrations `V45` (create+seeds), `V49` (confianca DECIMAL(5,4) default 0.8000 + letra_destino CHAR(1)), `V48`/`V55`/`V108`/`V109` (mais seeds), `V56` (pessoa_ref/cliente). Colunas: id, padrao_descricao NN, tipo_match VARCHAR(20) default CONTAINS, conta_contabil_id NN (FK real V45:13-14), letra_destino CHAR(1) NULL, numero_banco INT NULL, prioridade INT default 100, confianca, ativo, pessoa_ref_id (soft), cliente_id (FK real→cliente V56:199-201), processo_id (FK real), timestamps.

**`financeiro_saldo_inicial`** — entity `SaldoInicialBancoEntity.java`; migration `V107:12-21`. **PK = numero_banco** (INT), sem FK. Colunas: banco_nome NULL, data_referencia DATE NN, valor DECIMAL(15,2) default 0.00, criado_em/atualizado_em. Saldo de abertura por banco — chave é o `numero_banco` (não há tabela de "conta bancária").

**`financeiro_recorrencia_descarte`** — entity `RecorrenciaPadraoDescarteEntity.java`; migration `V111:1-12`. Oculta padrões recorrentes. Colunas: id, descricao_norm NN, numero_banco NN, somente_vinculo BOOL default FALSE, **cliente_id BIGINT NN default 0**, **processo_id BIGINT NN default 0**, criado_em. **Sem FK**; JPA usa `Long clienteId/processoId` (não `@ManyToOne`). UK composta V111:9. Usa `0` como sentinela "sem cliente/processo".

---
### 1.5 Módulo imóveis/locação

**`imovel`** — entity `imovel/infrastructure/persistence/entity/ImovelEntity.java`; migrations `V14:4-28`, `V15` (numero_planilha, responsavel), `V16` (pessoa_id nullable), `V56` (cliente_id), `V67` (UK).

| coluna | tipo | null | default | ref |
|---|---|---|---|---|
| id | BIGINT | NOT NULL | AI | V14:5 |
| pessoa_id | BIGINT | NULL | — | V14:6 (NN→null em V16:2-3) |
| cliente_id | BIGINT | NULL | — | V56:208 |
| processo_id | BIGINT | NULL | — | V14:7 |
| numero_planilha | INT | NULL | — | V15:4 |
| responsavel_pessoa_id | BIGINT | NULL | — | V15:5 |
| titulo, endereco_completo(TEXT), condominio, unidade, tipo_imovel | vários | NULL | — | V14:8-12 |
| situacao | VARCHAR(40) | NOT NULL | `'DESOCUPADO'` | V14:13 |
| garagens, inscricao_imobiliaria, observacoes(TEXT), campos_extras_json(TEXT) | vários | NULL | — | V14:14-17 |
| ativo | BOOLEAN | NOT NULL | TRUE | V14:18 |
| created_at/updated_at | TIMESTAMP | NOT NULL | now / ON UPDATE | V14:19-20 |

- **FKs reais:** pessoa_id→pessoa RESTRICT (V14:21-22); processo_id→processo SET NULL (V14:23-24); responsavel_pessoa_id→pessoa SET NULL (V15:10-11); cliente_id→cliente SET NULL (V56:247-249). Todas `@ManyToOne` (`ImovelEntity.java:23-41`).
- **UK:** `uk_imovel_numero_planilha` V15:7 → **dropada** V67:24, substituída por `uk_imovel_cliente_numero_planilha`(cliente_id, numero_planilha) V67:26-27.
- Comentário legado em `ImovelEntity.java:22`: "clienteId na API = pessoa.id".

**`contrato_locacao`** — entity `ContratoLocacaoEntity.java`; migrations `V14:30-56`, `V112` (taxa_administracao_percent), `V113` (data_inicio nullable).

| coluna | tipo | null | default | ref |
|---|---|---|---|---|
| id | BIGINT | NOT NULL | AI | V14:31 |
| imovel_id | BIGINT | **NOT NULL** | — | V14:32 |
| locador_pessoa_id | BIGINT | NULL | — | V14:33 |
| inquilino_pessoa_id | BIGINT | NULL | — | V14:34 |
| data_inicio | DATE | NULL | — | V14:35 (NN→null em V113:6) |
| data_fim | DATE | NULL | — | V14:36 |
| valor_aluguel | DECIMAL(19,2) | NOT NULL | — | V14:37 |
| valor_repasse_pactuado | DECIMAL(19,2) | NULL | — | V14:38 |
| dia_vencimento_aluguel | INT | NULL | — | V14:39 |
| dia_repasse | INT | NULL | — | V14:40 |
| taxa_administracao_percent | DECIMAL(5,2) | NOT NULL | **10.00** | V112:30 |
| garantia_tipo, valor_garantia, dados_bancarios_repasse_json(TEXT) | vários | NULL | — | V14:41-43 |
| status | VARCHAR(40) | NOT NULL | `'RASCUNHO'` | V14:44 |
| observacoes(TEXT) | TEXT | NULL | — | V14:45 |
| created_at/updated_at | TIMESTAMP | NOT NULL | now / ON UPDATE | V14:46-47 |

- **FKs reais:** imovel_id→imovel CASCADE (V14:48-49); locador/inquilino→pessoa SET NULL (V14:50-53). `@ManyToOne` (`ContratoLocacaoEntity.java:22-32`).

**`locacao_repasse`** (modelo manual legado) — entity `LocacaoRepasseEntity.java`; migration `V14:58-76`. Colunas: id, contrato_locacao_id NN (FK CASCADE), competencia_mes VARCHAR(7), valor_recebido_inquilino, valor_repassado_locador, valor_despesas_repassar, remuneracao_escritorio, status default 'PENDENTE', data_repasse_efetiva, observacao(TEXT), **lancamento_financeiro_vinculo_id BIGINT NULL (SOFT — sem FK)** (V14:69; JPA `Long` :49-50), timestamps. V112:4-5 documenta que o cálculo migrou para `locacao_repasse_lancamento`.

**`locacao_despesa`** (modelo manual legado) — entity `LocacaoDespesaEntity.java`; migration `V14:78-93`. Colunas: id, contrato_locacao_id NN (FK CASCADE), competencia_mes VARCHAR(7), descricao NN, valor NN, categoria default 'OUTROS', observacao, **lancamento_financeiro_id BIGINT NULL (SOFT — sem FK)** (V14:86; JPA `Long` :39-40), timestamps.

**`locacao_repasse_lancamento`** (modelo NOVO — fonte da verdade da reconciliação) — entity `LocacaoRepasseLancamentoEntity.java`; migration `V112:8-26`.

| coluna | tipo | null | default | ref |
|---|---|---|---|---|
| id | BIGINT | NOT NULL | AI | V112:9 |
| contrato_locacao_id | BIGINT | **NOT NULL** | — | V112:10 |
| competencia_mes | VARCHAR(7) | NULL | — | V112:11 |
| lancamento_financeiro_id | BIGINT | **NOT NULL** | — | V112:12 |
| papel | VARCHAR(20) | **NOT NULL** | — | V112:13 |
| valor | DECIMAL(19,2) | NULL | — | V112:14 |
| created_at/updated_at | TIMESTAMP | NOT NULL | now / ON UPDATE | V112:15-16 |

- **FKs reais:** contrato_locacao_id→contrato_locacao CASCADE (V112:17-18); lancamento_financeiro_id→financeiro_lancamento CASCADE (V112:19-20). `@ManyToOne` ambos; `papel` enum `PapelReconciliacao` (`:26-40`).
- **UK:** (contrato_locacao_id, lancamento_financeiro_id, papel) V112:22 → idempotência do vínculo.
- **Índices:** `idx_lrl_contrato_competencia`, `idx_lrl_lancamento` V112:25-26.

**`imovel_processo`** (N:N histórico) — entity `ImovelProcessoEntity.java`; migration `V67:1-22`. Colunas: id, imovel_id NN (FK), processo_id NN (FK), data_inicio, data_fim, ativo BOOL default TRUE, observacao VARCHAR(500), created_at. UK (imovel_id, processo_id) V67:12. Backfill de `imovel.processo_id` → INSERT V67:19-22. **Sem `updated_at`.** `@ManyToOne` imovel+processo (`:21-27`).

---

### 1.6 Tabelas de ligação (cliente/pessoa/processo) — resumo

- **`cliente`** (`V10:1-14`): PK id; **UK codigo_cliente CHAR(8)**; FK pessoa_id→pessoa CASCADE. Alvo das FKs reais `cliente_id` de financeiro_lancamento, imovel, processo, regra_classificacao, lancamento_cartao.
- **`pessoa`** (`V1:1-16`, seeds V12): PK id; UK cpf, UK email (email deixou de ser único em V40).
- **`processo`** (`V3`): FK pessoa_id (titular); FK cliente_id→cliente NOT NULL (V56 add, V63:5-6 NN); **UK (cliente_id, numero_interno)** V63:11-12 (substitui uk antiga por pessoa).
- **`planilha_pasta1_cliente`** (`V9`, normalização V13): PK chave_cliente VARCHAR(128) LPAD 8 dígitos; FK pessoa_id.

**Referências cruzadas a `financeiro_lancamento` fora do módulo financeiro:** `pagamento.financeiro_lancamento_id` (FK + UK, V58:2-3,13-14,18); `financeiro_pagamento_fatura_vinculo.lancamento_banco_id` (FK + UK, V42).

---
## 2. CONVENÇÕES E VALORES MÁGICOS

### 2.1 Contas contábeis — IDs fixos e significado

Os IDs são **implícitos** (AUTO_INCREMENT, na ordem dos INSERT de `V7:11-23` + `V19:3-4`). O código Java resolve sempre por **código-letra** (`findFirstByCodigoIgnoreCase`), não por id numérico:

| id | codigo | nome (seed) | usado no código para |
|---|---|---|---|
| 1 | **A** | Conta Escritório | conta de administração de imóvel / cliente; etapa VINCULADO; débito de repasse interno |
| 2 | B | Conta Trabalhos Extras | — |
| 3 | C | Conta Pessoal | — |
| 4 | D | Conta Veredas | — |
| 5 | **N** | Conta Não Identificados | "inbox" / não classificado; etapa IMPORTADO; alvo do auto-classificar; id 5 citado em `V44:2,9` |
| 6 | **E** | Conta Compensação | pareamento débito↔crédito (transferências internas); etapa COMPENSADO |
| 7 | **F** | Conta Fundos Investimentos | rendimentos (COR JURS, CRI, LCA, CDB) |
| 8 | M | Conta Marcenaria | — |
| 9 | R | Conta Rachel | — |
| 10 | P | Conta Pessoa Jurídica | — |
| 11 | **I** | Conta Imóveis | financiamento imobiliário; era destino do crédito "renda de investimento" no modelo antigo de repasse (hoje removido) |
| 12 | J | Conta Julio | — |
| 13 | G | Geral | V19:3-4 |

- **Único id numérico hardcoded:** `N=5` em `V44__financeiro_etapa_lancamento.sql:2,9` (backfill). No Java, há fallback `findById(1L)` para a conta A em `LocacaoReconciliacaoService.java:688-689`.
- **`CODIGO_CONTA_ADMINISTRACAO = "A"`** — `LocacaoReconciliacaoService.java:69`.

### 2.2 `numero_banco` / `banco_nome` — contas reais vs manuais vs virtual

**Não existe tabela de "conta bancária".** O banco é **denormalizado** em duas colunas (`numero_banco INT`, `banco_nome VARCHAR(120)`) repetidas em cada `financeiro_lancamento`. A única tabela com `numero_banco` como chave é `financeiro_saldo_inicial` (PK = numero_banco, V107). **Não há flag** que distinga conta-real-com-extrato de conta-manual de banco-virtual; é **só convenção**:

| numero_banco | natureza | como se distingue hoje |
|---|---|---|
| **900** | banco **virtual** "REPASSE INTERNO" (sem extrato, fora da conciliação) | constante `NUMERO_BANCO_REPASSE_INTERNO = 900` + `BANCO_NOME_REPASSE_INTERNO = "REPASSE INTERNO"` (`LocacaoReconciliacaoService.java:77-78`); lançamentos têm `origem=AUTO` |
| **9, 17, 18** | contas **manuais** (lançamentos digitados, sem extrato real) | **apenas convenção do frontend legado** `e-vilareal-react-web/src/data/financeiroData.js:96-103` (`'LANÇ MANUAIS'=9`, `'LANÇ EM DINHEIRO'=17`, `'LANÇ MANUAIS (2)'=18`). **Não há constante no backend** nem flag no schema. |
| **1, 4, 21, 30** | contas reais (extrato importado) referenciadas em seeds de regras/mapeamento | `V46:19-24` (cartão↔banco), `V48:14` (99Pay→F), `V49:54,64` (PIX VRV / tarifa) |

> **Achado-chave:** a separação "real / manual / virtual" não é modelada — é deduzida por número e por `origem`. Ver §8.

### 2.3 `codigo_cliente` — sentinelas de imóvel próprio

- Formato canônico: **CHAR(8) com LPAD de zeros** (`cliente.codigo_cliente`, UK em V10; convenção LPAD em V13/V56:80).
- **Imóvel próprio** (não há repasse bancário real → repasse é gerado interno): `CODIGOS_CLIENTE_PROPRIO = Set.of("00000938", "00000149")` — `LocacaoReconciliacaoService.java:75`.
  - `00000938` = **VRV** → `cliente.id` **938**
  - `00000149` = **Itamar** → `cliente.id` **151** (⚠️ **pegadinha**: o código 149 mapeia para `cliente.id` 151, **não** 149; comentário em `LocacaoReconciliacaoService.java:71-74`).
- Detecção feita por `imovel.cliente.codigo_cliente` normalizado a 8 dígitos (`isImovelProprio`, `:820-839`), **não** por locador/pessoa.
- **Não há seed Flyway** desses códigos; são constantes de aplicação.

### 2.4 `origem`, `etapa`, `natureza`, `papel`, `grupo_compensacao`, `numero_lancamento`, `status`

| convenção | valores | onde |
|---|---|---|
| **`natureza`** (NaturezaLancamento) | `DEBITO`, `CREDITO` | `domain/NaturezaLancamento.java`; CHECK V7:54 |
| **`origem`** (string livre) | default `MANUAL`; `AUTO` (só repasse interno) | entity :81-82; `ORIGEM_AUTO` `LocacaoReconciliacaoService.java:80`. **Sem CHECK no banco.** |
| **`etapa`** (EtapaLancamento) | `IMPORTADO` → `CLASSIFICADO` → `COMPENSADO` / `VINCULADO` / `FECHADO` | `domain/EtapaLancamento.java:7-11`. **Sem CHECK no banco** (FECHADO nem aparece no backfill V44). Regra `calcular(codigo,grupo,clienteId)` :16-29: N→IMPORTADO; E+grupo→COMPENSADO; A+clienteId→VINCULADO; senão CLASSIFICADO |
| **`status`** | default `ATIVO` | entity :85; queries filtram `status='ATIVO'`. **Sem CHECK**; não há valor `INATIVO` seedado — soft-delete coexiste com exclusão física (ver §8) |
| **`papel`** (PapelReconciliacao) | `ALUGUEL`, `REPASSE`, `DESPESA` | `imovel/domain/PapelReconciliacao.java:7-14`; coluna `locacao_repasse_lancamento.papel` (sem CHECK, V112:13) |
| **`grupo_compensacao`** | `COMP-{8 hex do UUID}` | gerado em `FinanceiroCompensacaoService` :592-593; null fora de compensação |
| **`numero_lancamento`** | livre no import; **`AUTO-REP-{aluguelVinculoId}-D`** para débito de repasse interno | `PREFIXO_GRUPO_REPASSE_INTERNO="AUTO-REP-"` `LocacaoReconciliacaoService.java:82`; `numeroDebitoRepasseInterno` :895-897. UK (numero_banco, numero_lancamento) V89 garante unicidade |
| **`StatusRepasse`** (derivado, não persistido) | `PENDENTE` / `FEITO` / `DIVERGENTE` | `imovel/domain/StatusRepasse.java`; calculado no `/resultado` :997-1005 |
| **`ConfiancaSugestao`** | `ALTA` / `MEDIA` / `BAIXA` | `domain/ConfiancaSugestao.java` |
| **`OrigemSugestao`** | `REGRA`, `DEPOSITO_IDENTIFICADO`, `PESSOA_PROCESSO`, `HISTORICO`, `RECORRENCIA` | `domain/OrigemSugestao.java` (≠ coluna `origem` do lançamento) |

### 2.5 Tolerâncias / limiares numéricos

| valor | contexto | ref |
|---|---|---|
| 0.85 | confiança mínima default auto-classificar | `ClassificacaoAutomaticaService.java:50` |
| 0.99 | confiança regras sintéticas F/E/I | `ClassificacaoAutomaticaService.java:206,219,232` |
| 0.80 | confiança default nova regra | `RegraClassificacaoApplicationService.java:97` |
| 0.90 | confiança regra criada por recorrência | `FinanceiroAnaliseService.java:568` |
| 0.01 | tolerância soma grupo compensação | `FinanceiroCompensacaoService.java:29` |
| 5% | tolerância par compensação | `FinanceiroCompensacaoService.java:547` |
| 10% ou R$50 | faixa do aluguel no "Aprovar"→vínculo | `LocacaoReconciliacaoService.java:446-448,476-483` |
| [×0,85 ; ×1,05] | banda de valor para sugerir REPASSE (terceiros) | `LocacaoReconciliacaoService.java:292-312` |
| ±5% (0.05) | órfãos | `TOLERANCIA_VALOR_ORFAO` :67 |
| 0.01 | tolerância status FEITO | `TOLERANCIA_REPASSE` :61 |
| 3 dias | proximidade dia esperado | `TOLERANCIA_DIAS` :64 |
| 10.00 | taxa administração default | `taxaEsperadaPercent` :1150-1154; default coluna V112:30 |

---
## 3. SERVIÇOS

### 3.1 Grafo de alto nível

```
FinanceiroController ─┬─► FinanceiroApplicationService ◄──► FinanceiroSaudeService   (ciclo @Lazy)
                      ├─► FinanceiroSugestaoService ──► (ProcessoApplicationService, ClienteResolverService,
                      │        │                          FinanceiroSaudeService) e ──► LocacaoReconciliacaoService
                      │        └─ usa ClassificacaoAutomaticaService.matchRegra (static)
                      ├─► ClassificacaoAutomaticaService
                      ├─► FinanceiroCompensacaoService ──► FinanceiroSaudeService
                      ├─► FinanceiroCartaoApplicationService
                      ├─► FinanceiroFaturaSugestaoService
                      ├─► FinanceiroPagamentoFaturaApplicationService
                      ├─► FinanceiroMesApplicationService
                      ├─► RegraClassificacaoApplicationService
                      └─► CartaoBancoMapeamentoApplicationService

FinanceiroAnaliseController ─► FinanceiroAnaliseService ──► FinanceiroSugestaoService
FinanceiroAdminController   ─► FinanceiroDescricaoNormBackfillService

LocacoesController ─► LocacaoReconciliacaoService ──► (LancamentoFinanceiroRepository, ContaContabilRepository)
ImoveisController/LocacoesController ─► ImovelApplicationService ──► ImovelProcessoLinkService
                                                              └─publishEvent─► IPTU (AFTER_COMMIT)
RepasseInternoBackfillRunner ─► LocacaoReconciliacaoService (job CLI one-shot)
```

**Ponte financeiro↔imóvel:** `FinanceiroSugestaoService.aplicarSugestao` chama `LocacaoReconciliacaoService.registrarAluguelClassificado` (`FinanceiroSugestaoService.java:129`). `ImovelApplicationService` **não** chama a reconciliação diretamente.

### 3.2 Serviços do domínio financeiro (`financeiro/application`)

| Service | Responsabilidade | Arquivo:linha |
|---|---|---|
| **FinanceiroApplicationService** | Orquestrador central: CRUD contas/lançamentos, saldos, extrato paginado, resumo por processo, backfill grupo_compensacao, limpeza de extrato, débitos não vinculados. `aplicarLancamento` resolve processo/cliente, default origem=MANUAL/status=ATIVO, recalcula etapa | `:44`; aplicarLancamento `:556-614` |
| **FinanceiroSugestaoService** | Motor de sugestão de classificação em camadas (regras sintéticas F/E/I, regras DB, depósito identificado, pessoa→processos, histórico, recorrência); aplica sugestão e converge com reconciliação de aluguel | `:40`; aplicarSugestao `:123-129` |
| **FinanceiroAnaliseService** | Painel de recorrências (agregação SQL + perfil de valor), descarte de padrões, aplicação em lote (delega à Sugestao), criação opcional de regra | `:60`; aplicarRecorrencia `:240` |
| **FinanceiroCompensacaoService** | Pareamento/despareamento de compensação (conta E + grupo_compensacao); sugestão greedy de pares opostos; grupos inconsistentes; auto-parear | `:27`; parear `:55`; desparear `:69` |
| **ClassificacaoAutomaticaService** | Auto-classificação em massa da conta N por regras ativas + heurísticas F/E/I | `:29`; autoClassificar `:48`; matchRegra(static) `:237` |
| **FinanceiroCartaoApplicationService** | CRUD de extrato de cartão (`lancamento_cartao`), listagem de cartões, limpeza | `:31` |
| **FinanceiroFaturaSugestaoService** | Sugere vínculos banco↔cartão por `cartao_banco_mapeamento` + tolerâncias | `:33`; listarSugestoes `:52` |
| **FinanceiroPagamentoFaturaApplicationService** | CRUD de vínculos explícitos pagamento bancário ↔ fatura cartão, com validação | `:23` |
| **FinanceiroMesApplicationService** | Fechamento/reabertura mensal por numero_banco (etapa FECHADO) | `:17`; fecharMes `:26`; reabrirMes `:63` |
| **FinanceiroSaudeService** | Dashboard de saúde com cache TTL 60s: totais, contagem por etapa, conta A sem cliente, grupos inconsistentes, pares órfãos, meses abertos | `:18`; obterSaude `:44` |
| **FinanceiroDescricaoNormBackfillService** | Backfill admin de `descricao_norm` em lotes | `:14`; backfill `:26` |
| **LancamentoFinanceiroImportDedupService** | Dedup por (numero_banco, numero_lancamento). **NÃO integrado** a criarLancamento nem a controller | `:17` |
| **RegraClassificacaoApplicationService** | CRUD de regras de classificação (vínculo opcional cliente/processo) | `:25` |
| **CartaoBancoMapeamentoApplicationService** | CRUD de regras débito→cartão | `:18` |

### 3.3 Domain financeiro relevante

- **DescricaoNormalizer** (`domain/DescricaoNormalizer.java:10`): normaliza descrições para agrupamento (uppercase, remove datas/horas finais). `normalizar(String)` :29. Chamado no `@PrePersist` da entity (`LancamentoFinanceiroEntity:101-105`).
- **EtapaLancamento** (`:6`): enum + `calcular()` (:16-29).
- **NaturezaLancamento**, **ConfiancaSugestao**, **OrigemSugestao**, **TipoMatch** (CONTAINS/REGEX/EXACT).
- **FinanceiroDescricaoIndicaContaE/F/I**: heurísticas de descrição → conta E (transferência interna), F (rendimento), I (financiamento imobiliário).
- **FinanceiroDescricaoPessoaExtrator**: extrai CPF/nome de descrições bancárias.
- **CompensacaoDateUtils**: normaliza sex/sáb/dom→segunda para matching de compensação.
- **RecorrenciaValorPerfilUtil**: perfil modal/dispersão de valores recorrentes (EXATO/APROXIMADO/DIVERGENTE).

### 3.4 Serviços do domínio imóvel (`imovel/application`)

| Service | Responsabilidade | Arquivo:linha |
|---|---|---|
| **ImovelApplicationService** | CRUD de imóveis, contratos, repasses/despesas **manuais** (legado); resolução por planilha; delega vínculo imóvel↔processo; publica `ContratoLocacaoAlteradoEvent` (IPTU) | `:33`; criarContrato `:349-357` |
| **ImovelProcessoLinkService** | Gerencia `imovel_processo` (N:N histórico); sincroniza `imovel.processo_id` com o vínculo ativo; valida `processo.cliente_id == imovel.cliente_id` | `:25`; vincular `:49-89` |
| **LocacaoReconciliacaoService** | **Backbone da reconciliação**: liga ciclo de locação ao caixa real via `locacao_repasse_lancamento`; calcula `/resultado` só dos vínculos; gera repasse interno automático (imóvel próprio) | `:58` |
| **RepasseInternoBackfillRunner** | Job CLI one-shot (`@ConditionalOnProperty vilareal.backfill.repasse-interno.enabled`): backfill + correção do contrato e `SpringApplication.exit` | `:28`; sequência `:45-58` |
| **ContratoLocacaoAlteradoEvent** | `record(Long contratoId)`; consumido só por IPTU (`@TransactionalEventListener AFTER_COMMIT`), **não** pela reconciliação | `event/ContratoLocacaoAlteradoEvent.java:4` |

**`LocacaoReconciliacaoService` — métodos-chave:**

| método | linha | o que faz |
|---|---|---|
| `sugerir(contratoId, competencia)` | `:106-154` | candidatos por `imovel.processo_id`→lançamentos do processo; infere papel; + órfãos da competência |
| `vincular(contratoId, req)` | `:352-392` | upsert idempotente em `locacao_repasse_lancamento`; adota órfão (conta A + cliente + processo); dispara repasse interno se ALUGUEL+próprio |
| `desvincular(contratoId, vinculoId)` | `:696-708` | remove vínculo; se ALUGUEL → remove débito de repasse interno |
| `resultado(...)` | `:906-949` | agrega por `competencia_mes`; aluguel−repasse−despesa; status |
| `registrarAluguelClassificado(lanc)` | `:434-458` | convergência do "Aprovar": cria vínculo ALUGUEL se (crédito, contrato VIGENTE no processo, valor na faixa, sem vínculo) |
| `gerarRepasseInternoSeProprio(...)` | `:723-764` | gera **só o débito** conta A, banco 900, origem AUTO, `AUTO-REP-{id}-D`, etapa VINCULADO; data = data do aluguel; cria vínculo REPASSE |
| `corrigirRepasseInternoContrato(contratoId)` | `:539-582` | correção idempotente (NO-OP se já correto); remove AUTO indesejados; regenera débito errado |
| `backfillRepasseInternoContrato(contratoId)` | `:493-526` | vincula créditos ≈ aluguel como ALUGUEL em lote (imóvel próprio) |
| `repasseEsperadoDoAluguel(...)` | `:645-654` | `aluguel×(1−taxa/100) − despesasDaCompetencia` |
| `despesasDaCompetencia(...)` | `:841-853` | soma `|valor|` dos vínculos DESPESA da competência |
| `isImovelProprio(...)` | `:820-839` | true se `imovel.cliente.codigo_cliente ∈ {00000938,00000149}` |

**Como o `/resultado` deriva dos vínculos:** carrega `locacao_repasse_lancamento` do contrato; agrupa por `competencia_mes` (independe da data bancária); por competência soma `|valor|` por papel → `aluguelRecebido` (ALUGUEL), `repassado` (REPASSE), `despesas` (DESPESA); `resultadoEscritorio = aluguel − repassado − despesas`; `taxaEfetivaPercent`; `statusRepasse` (PENDENTE/FEITO/DIVERGENTE vs `repasseEsperado`). Refs `:906-1005`.

---
## 4. API

### 4.1 `FinanceiroController` — base `/api/financeiro` (`api/FinanceiroController.java:37`)

**Saúde / contas:**
- `GET /saude` → `FinanceiroSaudeResponse` (indicadores, cache 60s) :78
- `GET /contas` → `List<ContaContabilResponse>` :84
- `POST /contas` (ContaContabilWriteRequest) → 201 :90
- `PUT /contas/{id}` → ContaContabilResponse :100

**Lançamentos — leitura:**
- `GET /lancamentos/resumo-processo/{processoId}` → ResumoProcessoFinanceiroResponse :105
- `GET /lancamentos` (clienteId, processoId, contaContabilId, dataInicio, dataFim; até 5000) :111
- `GET /lancamentos/contadores-etapa` → Map<String,Long> :124
- `GET /lancamentos/saldo-banco` (numeroBanco, data?) :130
- `GET /lancamentos/saldo-banco-mensal` (numeroBanco, ano, mes) :138
- `GET /lancamentos/saldo-inicial` (numeroBanco) :147 | `PUT` :155 | `DELETE` :161
- `GET /lancamentos/resumo-consolidado` (meses=12) :168
- `GET /lancamentos/extrato/paginada` (filtros + Pageable) → Page<LancamentoExtratoListItemResponse> :175
- `GET /lancamentos/nao-vinculados-pagamento` (periodoInicio, periodoFim, numeroBanco?) :217
- `GET /lancamentos/paginada` (filtros + Pageable) → Page<LancamentoFinanceiroResponse> :226
- `GET /lancamentos/inbox/classificar` (numeroBanco?, ano?, mes?, Pageable) → IMPORTADO + sugestões :268
- `GET /lancamentos/{id}` :306

**Lançamentos — escrita / workflow:**
- `POST /lancamentos` (LancamentoFinanceiroWriteRequest) → 201 :311
- `PUT /lancamentos/{id}` :321 | `DELETE /lancamentos/{id}` → 204 (**exclusão física**) :328
- `POST /lancamentos/grupos-compensacao/lote` → backfill grupo por numeroLancamento :334
- `GET /lancamentos/{id}/sugestao-classificacao` :341
- `POST /lancamentos/sugestoes-classificacao/lote` (até 1000 ids) :347
- `POST /lancamentos/aplicar-sugestao` → aplica conta/cliente/processo + recalcula etapa **+ dispara reconciliação de aluguel** :356
- `POST /lancamentos/aplicar-sugestoes/lote` :362
- `POST /lancamentos/auto-classificar` (conta N por regras) :368
- `POST /lancamentos/parear` (compensação→conta E) :374 | `DELETE /lancamentos/parear/{grupo}` :380
- `GET /lancamentos/pares-sugeridos` :386 | `GET /lancamentos/grupos-compensacao/inconsistentes` :410 | `POST /lancamentos/auto-parear` :421
- `POST /lancamentos/fechar-mes` :427 | `POST /lancamentos/reabrir-mes` :433
- `POST /lancamentos/limpar-extrato` (JSON e form-urlencoded legado) :476/:484 | `POST /lancamentos/limpar-extrato-cora` :492

**Regras de classificação:** `GET /regras-classificacao` :441 | `GET /{id}` :447 | `POST` :452 | `PUT /{id}` :463 | `DELETE /{id}` :470

**Cartões:** `GET /cartoes` :500 | `GET /cartoes/lancamentos` :506 | `GET /cartoes/lancamentos/{id}` :519 | `POST /cartoes/lancamentos` :524 | `PUT /{id}` :535 | `DELETE /{id}` :542 | `POST /cartoes/limpar-extrato` :548

**Pagamentos de fatura:** `GET /pagamentos-fatura/vinculos` :556 | `POST` :562 | `DELETE /{id}` :573 | `GET /pagamentos-fatura/sugestoes` :579

**Mapeamento cartão↔banco:** `GET /cartao-banco-mapeamento` :590 | `GET /{id}` :596 | `POST` :601 | `PUT /{id}` :612 | `DELETE /{id}` :618

### 4.2 `FinanceiroAdminController` — base `/api/financeiro/admin` (`:14`)
- `POST /backfill-descricao-norm` (loteSize) :24

### 4.3 `FinanceiroAnaliseController` — base `/api/financeiro/analises` (`:24`)
- `GET /recorrencias` (confiancaMinima, numeroBanco, apenasAcionaveis, contaContabilId, precisaoValor, somenteConfiancaPerfeita, Pageable) :34
- `POST /recorrencias/descartar` :54
- `POST /recorrencias/aplicar` :60

### 4.4 `ImoveisController` — base `/api/imoveis` (`api/ImoveisController.java:22`)
- `GET /` :32 | `GET /numero-por-vinculo?codigoCliente&numeroInterno` :38
- `GET /por-numero-planilha/{n}?clienteId&codigoCliente` :45 | `.../vinculos-processo` :54
- `GET /{id}/vinculos-processo` :60 | `GET /{id}/processos` :66 | `POST /{id}/processos` :72 | `PATCH /{id}/processos/{processoId}` :84
- `GET /{id}` :94 | `POST /` :99 | `PUT /{id}` :109

### 4.5 `LocacoesController` — base `/api/locacoes` (`api/LocacoesController.java:17`)

**CRUD legado:**
- `GET /contratos?imovelId` :31 | `POST /contratos` :37 | `PUT /contratos/{id}` :47
- `GET /repasses?contratoId` :53 | `POST /repasses` :58 | `PUT /repasses/{id}` :68
- `GET /despesas?contratoId` :74 | `POST /despesas` :79 | `PUT /despesas/{id}` :89

**Reconciliação (caixa real):**
- `GET /{contratoId}/reconciliacao/sugestoes?competencia` → List<ReconciliacaoSugestaoItemResponse> :97
- `POST /{contratoId}/reconciliacao/vincular` (`{vinculos:[{lancamentoFinanceiroId,papel,competenciaMes}]}`) → vínculos (idempotente; adota órfão; gera repasse interno) :105
- `DELETE /{contratoId}/reconciliacao/vinculos/{vinculoId}` → 204 :112
- `GET /{contratoId}/resultado?competencia&inicio&fim` → ReconciliacaoResultadoResponse :120

---
## 5. FLUXOS PONTA-A-PONTA

### 5.1 Importação de extrato (OFX/PDF) → lançamentos

- **Frontend:** `extrato/ExtratoImportModal.jsx` + `extrato/importUtils.js` parseiam OFX/PDF e fazem preview de dedup.
- **Persistência:** `persistirImportacaoOfxFinanceiroApi` (`financeiroRepository.js:659-737`): em "substituir" faz `GET /lancamentos` + `DELETE /lancamentos/{id}` + `POST /lancamentos`; em "mesclar" só `POST /lancamentos`.
- **Backend:** `POST /api/financeiro/lancamentos` → `FinanceiroApplicationService.aplicarLancamento` (:556-614): default `origem=MANUAL`, `status=ATIVO`, `etapa` calculada (conta N → IMPORTADO).
- **Dedup:** existe `LancamentoFinanceiroImportDedupService` (chave numero_banco+numero_lancamento) mas **não está plugado** ao create; a dedup atual é feita no front e pela UK `uk_fl_numero_banco_lancamento` (V89).
- **Manual/dinheiro:** lançamentos digitados entram com `numero_banco` 9/17/18 (convenção do front, `financeiroData.js:96-103`).
- **Cartão:** caminho paralelo via `lancamento_cartao` (sem etapa/compensação).

### 5.2 Normalização

- `@PrePersist`/`@PreUpdate` na entity chama `DescricaoNormalizer.normalizar` → grava `descricao_norm` (`LancamentoFinanceiroEntity:101-105`, `DescricaoNormalizer.java:29`).
- Backfill retroativo: `POST /api/financeiro/admin/backfill-descricao-norm` → `FinanceiroDescricaoNormBackfillService`.

### 5.3 Classificação / sugestão

- **Auto em massa:** `POST /lancamentos/auto-classificar` → `ClassificacaoAutomaticaService.autoClassificar` (conta N → conta destino por regra ativa ou heurística F/E/I; confiança ≥ 0.85).
- **Sugestão por lançamento:** `FinanceiroSugestaoService.sugerir` (camadas: histórico por `descricao_norm`, regras DB, depósito identificado, pessoa→processos, recorrência).
- **Aprovar (UI Inbox):** `POST /lancamentos/aplicar-sugestao` → grava conta/cliente/processo + recalcula etapa → **converge** com reconciliação chamando `LocacaoReconciliacaoService.registrarAluguelClassificado` (`FinanceiroSugestaoService.java:129`).
- **Recorrências:** `FinanceiroAnaliseService` agrega padrões; `aplicar` classifica pendentes em lote; `descartar` registra em `financeiro_recorrencia_descarte`.

### 5.4 Reconciliação (locação ↔ caixa)

- **Sugerir:** `GET /api/locacoes/{contratoId}/reconciliacao/sugestoes` → `sugerir` lê lançamentos do `imovel.processo_id`, infere papel (ALUGUEL crédito ≈ aluguel; REPASSE débito na banda; DESPESA caso contrário), e adiciona órfãos da competência.
- **Vincular:** `POST .../reconciliacao/vincular` → upsert em `locacao_repasse_lancamento` (idempotente pela UK). Órfão é "adotado" (conta A + cliente + processo do imóvel).
- **Desvincular:** `DELETE .../reconciliacao/vinculos/{id}` (se ALUGUEL, remove o débito de repasse interno acoplado).

### 5.5 Compensação (transferências internas)

- `POST /lancamentos/parear` → `FinanceiroCompensacaoService.parear`: move o par débito↔crédito para conta E, gera `grupo_compensacao = COMP-{uuid8}`, etapa COMPENSADO (:579-589).
- `DELETE /lancamentos/parear/{grupo}` → desfaz (conta N, grupo null, etapa recalculada).
- Inconsistências (soma do grupo ≠ 0) em `GET /lancamentos/grupos-compensacao/inconsistentes`.

### 5.6 Repasse — automático (imóvel próprio) vs manual (terceiro)

- **Próprio (VRV/Itamar):** ao confirmar vínculo ALUGUEL (via tela ou via "Aprovar"), `gerarRepasseInternoSeProprio` cria **somente um débito** (conta A, banco virtual 900, origem AUTO, `AUTO-REP-{aluguelVinculoId}-D`, etapa VINCULADO, sem grupo, `data_lancamento` = data do recebimento) e o vincula como `papel=REPASSE`. Idempotente por `numero_lancamento`. Sugestão de REPASSE é **suprimida** para próprios (`:295-297`).
- **Terceiro:** não há geração automática; a tela sugere o débito de repasse real (banda `[×0,85;×1,05]`) e o usuário vincula como `papel=REPASSE`.
- **Backfill/correção:** `RepasseInternoBackfillRunner` (CLI) → `backfillRepasseInternoContrato` + `corrigirRepasseInternoContrato`.

### 5.7 Relatórios / resultado

- **`/resultado` por imóvel:** `GET /api/locacoes/{contratoId}/resultado` deriva tudo de `locacao_repasse_lancamento` (aluguel − repasse − despesa por competência).
- **Relatório financeiro de imóveis (front):** `RelatorioFinanceiroImoveis.jsx` cruza `GET /api/imoveis` + `GET /api/financeiro/lancamentos` por par Cod.+Proc.
- **Relatórios financeiros gerais:** saldos por banco/conta (`FinanceiroRelatorios.jsx`), verificação de saldo diário (`saldo-banco-mensal`), consolidado por conta (`resumo-consolidado`).

---
## 6. FRONTEND

### 6.1 Navegação (`src/data/navConfig.js`)

- **Grupo Financeiro:** `Extratos` → `/financeiro`; `Relatórios` → `/financeiro/relatorios`. Rotas internas do `FinanceiroLayout` (sem item no nav global): `/financeiro/extrato`, `/inbox`, `/consolidado`, `/analises`, `/compensacao`, `/fatura`, `/cartao/:id`, `/configuracao`, `/legado`.
- **Grupo Administração de Imóveis:** Imóveis `/imoveis`; Demandas; Pagamentos `/imoveis/pagamentos`; Conciliação bancária `/imoveis/pagamentos/conciliacao`; Acerto com Cliente; Relatório Pagamentos; Sugestões de vínculo `/imoveis/sugestoes-vinculo`; IPTU `/iptu`; Relatório Financeiro Imóveis `/imoveis/relatorio-financeiro`; Relatório Imóveis `/relatorio-imoveis`.
- **Fora do navConfig:** `/imoveis/financeiro` → `ImoveisAdministracaoFinanceiro.jsx` (acesso por state/query `?imovel=`).

### 6.2 Telas financeiras → endpoints

| Tela (arquivo) | Rota | Endpoints consumidos |
|---|---|---|
| `financeiro/FinanceiroLayout.jsx` | `/financeiro/*` | GET `/lancamentos/contadores-etapa` |
| `financeiro/dashboard/DashboardPage.jsx` | `/financeiro` | GET `/saude` |
| `financeiro/extrato/ExtratoPage.jsx` | `/financeiro/extrato` | GET `/contas`, `/lancamentos/extrato/paginada` (fallback `/lancamentos/paginada`), `/lancamentos/saldo-banco`, `/lancamentos/{id}`; DELETE `/lancamentos/{id}` |
| `extrato/SaldoInicialDialog.jsx` | (dialog) | GET/PUT/DELETE `/lancamentos/saldo-inicial` |
| `extrato/ExtratoDetailPanel.jsx` | (painel) | GET `/contas`; POST/PUT/DELETE `/lancamentos`; GET `/api/clientes/resolucao`, `/api/processos` |
| `extrato/ExtratoImportModal.jsx` | (modal) | GET `/lancamentos/paginada`, `/lancamentos`; POST/DELETE `/lancamentos` |
| `financeiro/inbox/InboxPage.jsx` | `/financeiro/inbox` | GET `/lancamentos/inbox/classificar`, `/pares-sugeridos`, `/grupos-compensacao/inconsistentes`, `/pagamentos-fatura/sugestoes`, `/saude`, `/contas`; POST `/aplicar-sugestao`, `/aplicar-sugestoes/lote`, `/parear`, `/sugestoes-classificacao/lote` |
| `financeiro/consolidado/ConsolidadoPage.jsx` | `/financeiro/consolidado` | GET `/contas`, `/lancamentos/resumo-consolidado`, `/lancamentos/paginada` |
| `financeiro/analises/AnalisesPage.jsx` | `/financeiro/analises` | GET `/saude`, `/lancamentos/resumo-consolidado`, `/analises/recorrencias`; POST `/analises/recorrencias/aplicar`, `/descartar` |
| `financeiro/compensacao/CompensacaoPage.jsx` | `/financeiro/compensacao` | GET `/lancamentos/contadores-etapa`, `/saude`, `/lancamentos/paginada` (COMPENSADO), `/grupos-compensacao/inconsistentes` |
| `financeiro/fatura/FaturaPage.jsx` | `/financeiro/fatura` | GET `/pagamentos-fatura/vinculos`, `/cartao-banco-mapeamento`, `/cartoes`; POST/PUT/DELETE `/cartao-banco-mapeamento` |
| `financeiro/cartao/CartaoPage.jsx` | `/financeiro/cartao/:id` | GET `/cartoes`, `/cartoes/lancamentos`; POST `/cartoes/limpar-extrato` |
| `financeiro/config/ConfigPage.jsx` | `/financeiro/configuracao` | GET/POST/PUT/DELETE `/regras-classificacao`; GET `/contas`,`/cartoes`,`/saude`; POST limpar-extrato |
| `components/FinanceiroRelatorios.jsx` | `/financeiro/relatorios` | GET `/contas`, `/lancamentos`, `/cartoes/lancamentos` |
| `financeiro/relatorios/VerificacaoSaldoDiario.jsx` | (aba) | GET `/lancamentos/saldo-banco-mensal` |

Camada HTTP: `repositories/financeiroRepository.js` via `api/httpClient.js`.

### 6.3 Telas imóveis-financeiro → endpoints

| Tela (arquivo) | Rota | Endpoints (locações/imóveis/financeiro) |
|---|---|---|
| `ImoveisAdministracaoFinanceiro.jsx` | `/imoveis/financeiro` | **Reconciliação:** GET `/api/locacoes/{id}/reconciliacao/sugestoes`; POST `/reconciliacao/vincular`; DELETE `/reconciliacao/vinculos/{vinculoId}`; GET `/api/locacoes/{id}/resultado`. **Carga:** GET `/api/imoveis/por-numero-planilha/{n}` ou `/api/imoveis/{id}`, `/api/locacoes/contratos`, `/repasses`, `/despesas`, `/api/financeiro/lancamentos`(+cartões). **CRUD:** POST/PUT `/api/locacoes/repasses`, `/despesas` |
| `ImoveisSugestoesVinculoPanel.jsx` | `/imoveis/sugestoes-vinculo` (+embutido) | GET `/api/imoveis`, `/api/financeiro/lancamentos/paginada`, `/api/financeiro/lancamentos`; PUT/POST `/api/financeiro/lancamentos`; GET `/api/clientes/resolucao`, `/api/processos` |
| `ConciliacaoBancaria.jsx` | `/imoveis/pagamentos/conciliacao` | GET `/api/financeiro/lancamentos/nao-vinculados-pagamento`, `/api/imoveis`, `/api/pagamentos`; GET `/api/pagamentos/conciliacao/sugestoes`; POST `/conciliacao/vincular`, `/desvincular` |
| `RelatorioFinanceiroImoveis.jsx` | `/imoveis/relatorio-financeiro` | GET `/api/imoveis` + por par `/api/financeiro/lancamentos`, `/cartoes/lancamentos` |

**Seletor de competência inline (reconciliação)** em `ImoveisAdministracaoFinanceiro.jsx`: competência global (`type=month`, filtra sugestões/vínculos), modo período (De/Até, só altera query do `/resultado`), e competência inline por vínculo ALUGUEL (`onChange` → POST `reconciliacao/vincular` com novo `competenciaMes`, recarrega sugestões e resultado). Refs `:303-330`, `:409-421`. Helpers em `data/imoveisReconciliacao.js`.

---
## 7. PONTOS DE INTEGRAÇÃO E COSTURAS

Onde imóvel, processo, cliente/pessoa e conta contábil se conectam — e quão sólida é cada conexão.

| # | Costura | Como está feito | Solidez |
|---|---|---|---|
| C1 | **lançamento ↔ contrato/imóvel** | só via `locacao_repasse_lancamento` (FK real para lançamento e contrato, CASCADE, UK por papel). **Não** há FK direta lançamento→contrato | FK real, mas indireta; depende do vínculo existir |
| C2 | **lançamento ↔ imóvel via processo** | `imovel.processo_id` → `financeiro_lancamento.processo_id`. A reconciliação descobre candidatos por aí | **Frágil:** se `imovel.processo_id` for NULL, `sugerir` retorna vazio e não há reconciliação (`:110,115`) |
| C3 | **conta bancária** | **inexistente como entidade.** `numero_banco`+`banco_nome` denormalizados em cada lançamento; `financeiro_saldo_inicial` usa numero_banco como PK solta | **Denormalizado**, sem tabela mestre nem FK |
| C4 | **real vs manual vs virtual** | só convenção numérica (900 virtual; 9/17/18 manual no front; demais reais) + `origem=AUTO` | **Implícito**, sem flag/coluna |
| C5 | **cliente** | hoje FK real `cliente_id`→`cliente` em lançamento/imovel/processo/regra/cartão (corrigido em V56/V63). `codigo_cliente` CHAR(8) é a chave de negócio (string) | FK real ✓, mas dívida legada (ver C8) |
| C6 | **imóvel próprio** | detecção por `codigo_cliente ∈ {00000938,00000149}` hardcoded; pegadinha 149→cliente.id 151 | **Hardcode** de regra de negócio em constante de código |
| C7 | **repasse interno** | débito sintético em banco virtual 900, `numero_lancamento=AUTO-REP-{id}-D`, sem partida dobrada; idempotência por string | Convenção de string; reversão acoplada ao vínculo ALUGUEL |
| C8 | **legado pessoa×cliente** | `pessoa_ref_id` (sem FK) mantido ao lado de `cliente_id`; FK original V7 apontava lançamento→pessoa; comentário `ImovelEntity:22` "clienteId = pessoa.id" | Dívida técnica documentada (regra `pessoa-cliente-processo`) |
| C9 | **dois modelos de repasse/despesa** | `locacao_repasse`/`locacao_despesa` (manual, FK soft a lançamento) coexistem com `locacao_repasse_lancamento` (reconciliação). `/resultado` usa **só** o segundo | Duplicação de modelo |
| C10 | **resultado derivado** | `/resultado` recomputa tudo de vínculos a cada chamada (nada materializado) | Sempre consistente com vínculos, mas não auditável historicamente |
| C11 | **convergência "Aprovar"** | classificar crédito (financeiro) chama `registrarAluguelClassificado` (imóvel) | Acoplamento cruzado de domínios via `@Lazy` |

---

## 8. ACHADOS

> Lista de fatos/observações do estado atual. **Sem propostas de solução** (isso é Fase 3). Cada achado tem referência.

### Integridade / persistência

- **A1 — Soft-delete inconsistente.** Há coluna `status` default `ATIVO` (V7:43) e queries filtram `status='ATIVO'`, mas **também há exclusão física** (`DELETE /api/financeiro/lancamentos/{id}` :328; `removerLancamento`). Não há valor `INATIVO` seedado nem CHECK em `status`. Coexistência de dois mecanismos de remoção.
- **A2 — `etapa` sem CHECK.** Enum Java tem 5 valores incl. `FECHADO` (`EtapaLancamento.java:6-11`), mas o banco não tem CHECK e o backfill V44 só popula 3. Valor inválido é possível por escrita direta.
- **A3 — `origem` string livre sem CHECK.** `MANUAL`/`AUTO` por convenção (entity :82; `:80`). Sem enum no banco.
- **A4 — `papel` sem CHECK** em `locacao_repasse_lancamento.papel` (V112:13); validade só no enum Java `PapelReconciliacao`.
- **A5 — Sentinelas em vez de NULL/FK.** `financeiro_recorrencia_descarte.cliente_id/processo_id` usam **default 0** como "sem vínculo" (V111:6-7), sem FK. `contrato_locacao.data_inicio` usava `2000-01-01` como ausência (corrigido p/ NULL em V113).

### Conta bancária / denormalização

- **A6 — Conta bancária não é entidade.** `numero_banco`+`banco_nome` são repetidos e denormalizados em cada `financeiro_lancamento` (V7:30-31) e `lancamento_cartao`. A única "âncora" é `financeiro_saldo_inicial` com PK `numero_banco` solta (V107). Não há FK, nome canônico, nem flag de tipo (real/manual/virtual). Ver C3/C4.
- **A7 — Banco virtual 900 fora do schema.** O número 900 e o nome "REPASSE INTERNO" são constantes de código (`LocacaoReconciliacaoService.java:77-78`), invisíveis a quem só olha o banco. Mesmo para 9/17/18 (manuais) a definição vive no **frontend** (`financeiroData.js:96-103`).

### Acoplamento / duplicação

- **A8 — Dois modelos de repasse/despesa.** `locacao_repasse` + `locacao_despesa` (manual, com FK **soft** `lancamento_financeiro(_vinculo)_id`, V14:69/86) vs `locacao_repasse_lancamento` (reconciliação). O `/resultado` ignora o primeiro. Risco de dados divergentes entre os dois. (C9)
- **A9 — Ciclos de dependência via `@Lazy`.** `FinanceiroApplicationService` ↔ `FinanceiroSaudeService`; `FinanceiroSugestaoService` → `LocacaoReconciliacaoService` (cross-domínio). Indica acoplamento que exigiu `@Lazy` para compilar (`FinanceiroSugestaoService.java:56-77`).
- **A10 — Repasse interno por string mágica.** Idempotência/reversão dependem do padrão `AUTO-REP-{aluguelVinculoId}-D` (`:895-897`) e da UK (numero_banco, numero_lancamento). Não há FK ligando o débito ao vínculo ALUGUEL — a relação é por convenção de nome. (C7)
- **A11 — Hardcode de regra de negócio.** "Imóvel próprio" depende de 2 códigos de cliente fixos no código (`CODIGOS_CLIENTE_PROPRIO`, `:75`) e da pegadinha 149→151. Novo imóvel próprio exige alteração de código + deploy. (C6)
- **A12 — Dedup de import não plugado.** `LancamentoFinanceiroImportDedupService` existe mas não é chamado por `criarLancamento` nem por controller; a proteção real é a UK V89 + lógica no frontend. (§5.1)

### Dívida legada pessoa × cliente

- **A13 — `pessoa_ref_id` órfão.** Mantido sem FK ao lado de `cliente_id` (V56:57; DROP comentado V63:19-21). Resquício da FK original lançamento→pessoa (V7:50-51).
- **A14 — Comentários de convenção legada** ainda no código: `ImovelEntity.java:22` ("clienteId na API = pessoa.id"). Coerente com a dívida descrita na regra `.cursor/rules/pessoa-cliente-processo.mdc`.

### Reconciliação / resultado

- **A15 — Reconciliação refém de `imovel.processo_id`.** Sem processo no imóvel, não há candidatos (`:110`). O vínculo processo↔imóvel vive em dois lugares: coluna `imovel.processo_id` **e** tabela `imovel_processo` (N:N), sincronizados por `ImovelProcessoLinkService` — duplicação de fonte de verdade. (C2)
- **A16 — `/resultado` não materializado.** Recomputado a cada chamada a partir dos vínculos; não há snapshot por competência (nenhuma persistência de "fechamento" do ciclo de locação, diferente de `locacao_repasse.status`). (C10)
- **A17 — `locacao_repasse_lancamento.valor` nullable** (V112:14) embora o cálculo dependa dele; o serviço usa `|valor|` e trata null defensivamente.
- **A18 — Competência (`competencia_mes`) é VARCHAR(7) nullable** em 3 tabelas (locacao_repasse, locacao_despesa, locacao_repasse_lancamento) — formato `AAAA-MM` por convenção, sem constraint.

### Cartão / fatura

- **A19 — `lancamento_cartao` é um espelho paralelo** de `financeiro_lancamento` sem `etapa`/`grupo_compensacao`; vínculo banco↔fatura é 1:1 por UK (V42:10-11), limitando rateios de uma fatura entre vários pagamentos.

---

### Apêndice — fontes do levantamento

Subagentes de exploração (somente leitura) que embasaram este documento:
- Schema/entidades: [Schema fin/imovel](6956f872-82c3-41cb-bfbb-7fffc23f8893)
- Services/API financeiro: [Services financeiro](736ceabf-2a04-44a1-a0f3-c4eb09521641)
- Services/API imóveis: [Services imóveis](08a8db00-66a4-4008-8482-1ecc58683f5f)
- Frontend: [Frontend financeiro](43824dec-faf7-43f3-b87a-e4b7f7b08ac1)

Verificações diretas adicionais: `V7__financeiro.sql` (seeds de conta e DDL do lançamento) lido na íntegra.

