# Dicionário de dados — Fase 7 (Imóveis / Contratos / Repasses)

Base usada: `data-dictionary-phase-2-3` (clientes, pessoas), `data-dictionary-phase-4-processos`, `data-dictionary-phase-5-financeiro`, telas `Imoveis.jsx`, `ImoveisAdministracaoFinanceiro.jsx`, `imoveisMockData.js`, `imoveisAdministracaoFinanceiro.js`.

## Legenda de rigor

- **encontrado no código**: evidência direta no frontend ou SQL desta fase.
- **inferido**: coerência com FKs e regras já existentes (ex.: processo × cliente).
- **recomendado**: decisão pragmática sem esgotar o domínio imobiliário completo.
- **implementado**: V14/V15 + entidades JPA + API REST descrita no fim deste documento.
- **pendente**: evolução futura (anexos, integração total com extrato, automações).

---

## Evidência do frontend (resumo)

- **encontrado no código** (`Imoveis.jsx` / `imoveisMockData.js`):
  - Vínculo operacional: **código cliente** (`codigo`) + **proc. interno** (`proc`) alinhados a Processos/Financeiro.
  - Imóvel: endereço, condomínio, unidade, garagens, IPTU, utilidades (água/energia/gás), inscrição imobiliária.
  - Locação: valor locação, dia pagamento aluguel, datas contrato, garantia, dados bancários / PIX repasse, dia repasse, proprietário e inquilino (nome, CPF, contato, “nº pessoa”).
  - Contrato (modal): flags de assinatura/arquivamento (texto na UI).
- **encontrado no código** (`ImoveisAdministracaoFinanceiro.jsx` / `imoveisAdministracaoFinanceiro.js`):
  - Consolidação mensal derivada de **lançamentos financeiros** (Cod. cliente + Proc.): recebido, despesas a repassar, líquido, repasse ao locador, remuneração escritório.
  - Classificação por **tags** `[ADM_IMOVEL:…]` ou heurísticas sobre descrição.
- **recomendado**:
  - Tabela `imoveis` com FK para `clientes` e opcionalmente `processos` (1:1 por processo quando preenchido).
  - Campos muito granulares da UI (dezenas de inputs de utilidade) **não** colocados em colunas nesta fase — `campos_extras_json` guarda snapshot para evolução.
  - Repasses mensais como entidade própria **além** do financeiro: permite registrar competência e vínculo opcional a `lancamentos_financeiros` sem duplicar valor monetário como regra obrigatória.

---

## Tabela `imoveis` (V14) — implementado

| Campo | Tipo SQL | Null | Default | Unique | FK | Índices | Origem |
|--------|-----------|------|---------|--------|-----|---------|--------|
| `id` | BIGINT | não | auto_increment | PK | — | — | recomendado |
| `cliente_id` | BIGINT | não | — | — | `clientes(id)` RESTRICT | idx | encontrado (locador / cadastro cliente) |
| `processo_id` | BIGINT | sim | — | sim (um imóvel por processo) | `processos(id)` SET NULL | uk | encontrado (Cod. + Proc. → processo) |
| `titulo` | VARCHAR(200) | sim | — | — | — | — | inferido |
| `endereco_completo` | TEXT | sim | — | — | — | — | encontrado |
| `condominio` | VARCHAR(200) | sim | — | — | — | — | encontrado |
| `unidade` | VARCHAR(120) | sim | — | — | — | — | encontrado |
| `tipo_imovel` | VARCHAR(40) | sim | — | — | — | — | inferido |
| `situacao` | VARCHAR(20) | não | `OCUPADO` | — | — | idx | encontrado (ocupado/desocupado) |
| `garagens` | VARCHAR(20) | sim | — | — | — | — | encontrado |
| `inscricao_imobiliaria` | VARCHAR(80) | sim | — | — | — | — | encontrado |
| `observacoes` | TEXT | sim | — | — | — | — | encontrado |
| `campos_extras_json` | JSON | sim | — | — | — | — | recomendado (demais campos da UI) |
| `ativo` | BOOLEAN | não | TRUE | — | — | idx | inferido |
| `created_at` | TIMESTAMP | não | current_timestamp | — | — | — | recomendado |
| `updated_at` | TIMESTAMP | não | current_timestamp on update | — | — | — | recomendado |

**Regras de negócio (implementadas no serviço):**

- Se `processo_id` informado, o processo deve pertencer ao mesmo `cliente_id`.
- Não pode existir outro imóvel com o mesmo `processo_id` (unique).

**Enums JPA:** `ImovelSituacao` (OCUPADO, DESOCUPADO, INATIVO).

---

## Tabela `contratos_locacao` (V14) — implementado

| Campo | Tipo SQL | Null | Default | FK | Origem |
|--------|-----------|------|---------|-----|--------|
| `id` | BIGINT PK | não | auto | — | recomendado |
| `imovel_id` | BIGINT | não | — | `imoveis(id)` RESTRICT | encontrado |
| `locador_pessoa_id` | BIGINT | sim | — | `cadastro_pessoas(id)` SET NULL | encontrado (proprietário / nº pessoa) |
| `inquilino_pessoa_id` | BIGINT | sim | — | `cadastro_pessoas(id)` SET NULL | encontrado |
| `data_inicio` | DATE | não | — | — | encontrado |
| `data_fim` | DATE | sim | — | — | encontrado |
| `valor_aluguel` | DECIMAL(15,2) | não | — | — | encontrado |
| `valor_repasse_pactuado` | DECIMAL(15,2) | sim | — | — | encontrado / inferido |
| `dia_vencimento_aluguel` | TINYINT | sim | — | — | encontrado (`diaPagAluguel`) |
| `dia_repasse` | TINYINT | sim | — | — | encontrado |
| `garantia_tipo` | VARCHAR(40) | sim | — | — | encontrado |
| `valor_garantia` | DECIMAL(15,2) | sim | — | — | encontrado |
| `dados_bancarios_repasse_json` | JSON | sim | — | — | encontrado (banco, agência, conta, PIX) |
| `status` | VARCHAR(20) | não | `VIGENTE` | — | inferido |
| `observacoes` | TEXT | sim | — | — | encontrado |
| `created_at` / `updated_at` | TIMESTAMP | não | — | — | recomendado |

**Enums JPA:** `ContratoLocacaoStatus` (RASCUNHO, VIGENTE, ENCERRADO, RESCINDIDO).

**Pendente:** fluxo formal de assinatura/arquivamento do modal de contrato (apenas UI hoje).

---

## Tabela `repasses_locador` (V15) — implementado

| Campo | Tipo SQL | Null | Default | Unique | FK | Origem |
|--------|-----------|------|---------|--------|-----|--------|
| `id` | BIGINT PK | não | auto | — | — | recomendado |
| `contrato_id` | BIGINT | não | — | — | `contratos_locacao(id)` CASCADE | encontrado |
| `competencia_mes` | CHAR(7) | não | — | uk com contrato | — | encontrado/inferido (`YYYY-MM`) |
| `valor_recebido_inquilino` | DECIMAL(15,2) | sim | — | — | — | encontrado (coluna “Recebido”) |
| `valor_repassado_locador` | DECIMAL(15,2) | sim | — | — | — | encontrado |
| `valor_despesas_repassar` | DECIMAL(15,2) | sim | 0 | — | — | encontrado |
| `remuneracao_escritorio` | DECIMAL(15,2) | sim | — | — | — | encontrado (derivado na UI; pode ser informado) |
| `status` | VARCHAR(20) | não | `PENDENTE` | — | — | inferido |
| `data_repasse_efetiva` | DATE | sim | — | — | — | inferido |
| `observacao` | TEXT | sim | — | — | — | inferido |
| `lancamento_financeiro_vinculo_id` | BIGINT | sim | — | — | `lancamentos_financeiros(id)` SET NULL | recomendado (evitar duplicidade lógica) |
| `created_at` / `updated_at` | TIMESTAMP | não | — | — | — | recomendado |

**Enums JPA:** `RepasseLocadorStatus` (PENDENTE, CONFIRMADO, CANCELADO).

**UK:** (`contrato_id`, `competencia_mes`).

---

## Tabela `despesas_locacao` (V15) — implementado

| Campo | Tipo SQL | Null | FK | Origem |
|--------|-----------|------|-----|--------|
| `id` | BIGINT PK | não | — | recomendado |
| `contrato_id` | BIGINT | não | `contratos_locacao(id)` CASCADE | encontrado |
| `competencia_mes` | CHAR(7) | sim | — | inferido |
| `descricao` | VARCHAR(500) | não | — | encontrado/inferido |
| `valor` | DECIMAL(15,2) | não | — | encontrado |
| `categoria` | VARCHAR(40) | não | `OUTROS` | alinhado a tags ADM / inferido |
| `lancamento_financeiro_id` | BIGINT | sim | `lancamentos_financeiros(id)` SET NULL | recomendado: despesa **é** o lançamento quando vinculado |
| `observacao` | TEXT | sim | — | inferido |
| `created_at` / `updated_at` | TIMESTAMP | não | — | recomendado |

**Enums JPA:** `DespesaLocacaoCategoria` (REPASSE_ADMIN, ADMINISTRACAO, OUTROS).

**Decisão:** quando a despesa já existe no financeiro, o registro em `despesas_locacao` **referencia** `lancamento_financeiro_id` e não substitui o valor contábil. Quando não há lançamento, o valor fica só na tabela de locação (operacional).

---

## Integração com financeiro (documental)

- **Continua no financeiro:** todo movimento contábil com `cliente_id` / `processo_id`, conforme Fase 5.
- **Novo no módulo imobiliário:** cadastro de imóvel, contrato, repasse mensal e despesa contextual — **sem** obrigar segundo lançamento com o mesmo valor.
- **Vínculo opcional:** `repasses_locador.lancamento_financeiro_vinculo_id` e `despesas_locacao.lancamento_financeiro_id` para reconciliação e auditoria.
- **Evitar duplicidade:** não gerar `lancamentos_financeiros` automaticamente a partir de repasse nesta fase (pendente de regra explícita na próxima etapa).

---

## API REST mínima (implementado)

| Método | Caminho |
|--------|---------|
| GET/POST/PUT | `/api/imoveis`, `/api/imoveis/{id}` |
| GET/POST/PUT | `/api/locacoes/contratos`, `/api/locacoes/contratos/{id}` |
| GET/POST/PUT | `/api/locacoes/repasses`, `/api/locacoes/repasses/{id}` |
| GET/POST | `/api/locacoes/despesas` |
