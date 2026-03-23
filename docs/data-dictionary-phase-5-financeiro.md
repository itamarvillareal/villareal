# Dicionario de dados - Fase 5 (Nucleo Financeiro)

Base obrigatoria usada: `database-inventory-backend`, `database-inventory-frontend`, `database-gap-analysis`, `database-entities-proposed`, `database-phases`, `data-dictionary-phase-2-3`, `data-dictionary-phase-4-processos` e transicoes de frontend.

## Legenda de rigor

- **encontrado no codigo**: evidenciado em `Financeiro.jsx`, `financeiroData.js` e utilitarios relacionados.
- **inferido**: necessidade tecnica para manter coerencia transacional, filtros e relatorios.
- **recomendado**: decisao pragmatica de modelagem para evolucao segura.
- **implementado**: criado nesta etapa (V10/V11 + backend).
- **pendente**: fica para fases seguintes.

## Evidencia real do frontend financeiro (resumo)

- **encontrado no codigo**:
  - Lancamento usa: `letra` (conta contabil), `numero`, `data`, `descricao`, `valor`, `categoria/descricaoDetalhada`, `codCliente`, `proc`, `ref` (`N`/`R`), `eq/dimensao`, `parcela`.
  - Compensacao por elo: conta `E`, agrupamento por identificador (`proc` no mock financeiro) e conciliacao por soma.
  - Filtros ativos: cliente, processo, conta contabil, periodo (mes/bimestre/trimestre/semestre/personalizado), elo.
  - OFX/importacao: banco de origem, numero do lancamento e merge/substituicao.
  - Persistencia local atual: extratos, contas extras, contas contabeis extras/inativas e log de busca de vinculos.
- **recomendado**:
  - separar catalogos (conta/classificacao/elo) da tabela transacional de lancamentos.
  - manter vinculo opcional com `clientes` e `processos`, sem duplicar dados de processo no financeiro.

---

## Tabela `contas_contabeis` (V10) - implementado

Finalidade: catalogo contabil principal (equivalente as letras A/B/C/.../E usadas no financeiro), com suporte a ativacao/inativacao e ordenacao.

| Campo | Tipo SQL | Null | Default | Unique | FK | Indice | Origem |
|---|---|---|---|---|---|---|---|
| `id` | BIGINT | nao | auto_increment | PK | - | - | recomendado |
| `codigo` | VARCHAR(10) | nao | - | sim | - | uk + idx impl. | encontrado no codigo (`letra`) |
| `nome` | VARCHAR(120) | nao | - | sim | - | uk | encontrado no codigo |
| `tipo` | VARCHAR(30) | nao | `OPERACIONAL` | nao | - | - | inferido/recomendado |
| `natureza_padrao` | VARCHAR(20) | sim | - | nao | - | - | inferido |
| `grupo_contabil` | VARCHAR(80) | sim | - | nao | - | - | inferido |
| `aceita_vinculo_processo` | BOOLEAN | nao | FALSE | nao | - | - | recomendado |
| `aceita_compensacao` | BOOLEAN | nao | FALSE | nao | - | - | encontrado (Conta Compensacao) |
| `ativa` | BOOLEAN | nao | TRUE | nao | - | idx | encontrado |
| `ordem_exibicao` | INT | nao | 0 | nao | - | idx | encontrado/inferido |
| `created_at` | TIMESTAMP | nao | current_timestamp | nao | - | - | recomendado |
| `updated_at` | TIMESTAMP | nao | current_timestamp on update | nao | - | - | recomendado |

Regras:
- `codigo` e `nome` unicos.
- contas de base do frontend foram semeadas (A, B, C, D, N, E, F, M, R, P, I, J).

---

## Tabela `classificacoes_financeiras` (V10) - implementado

Finalidade: catalogo de classificacao para substituir o uso exclusivamente textual de categoria/descricao nos lancamentos.

| Campo | Tipo SQL | Null | Default | Unique | FK | Indice | Origem |
|---|---|---|---|---|---|---|---|
| `id` | BIGINT | nao | auto_increment | PK | - | - | recomendado |
| `codigo` | VARCHAR(40) | nao | - | sim | - | uk | recomendado |
| `nome` | VARCHAR(120) | nao | - | sim | - | uk | encontrado/inferido |
| `categoria` | VARCHAR(30) | nao | `GERAL` | nao | - | idx | inferido |
| `ativa` | BOOLEAN | nao | TRUE | nao | - | idx | recomendado |
| `created_at` | TIMESTAMP | nao | current_timestamp | nao | - | - | recomendado |
| `updated_at` | TIMESTAMP | nao | current_timestamp on update | nao | - | - | recomendado |

Regras:
- usada como catalogo opcional no lancamento (nao bloqueia uso textual).
- seeds minimos criados: `ALUGUEL`, `REPASSE`, `HONORARIOS`, `DESPESA_PROCESSUAL`, `TRANSFERENCIA_INTERNA`, `OUTROS`.

---

## Tabela `elos_financeiros` (V10) - implementado

Finalidade: representar agrupamentos de compensacao/repasses sem reaproveitar indevidamente `proc` como elo tecnico.

| Campo | Tipo SQL | Null | Default | Unique | FK | Indice | Origem |
|---|---|---|---|---|---|---|---|
| `id` | BIGINT | nao | auto_increment | PK | - | - | recomendado |
| `codigo` | VARCHAR(30) | nao | - | sim | - | uk | encontrado/inferido (elo no frontend) |
| `tipo` | VARCHAR(30) | nao | `COMPENSACAO` | nao | - | idx | inferido |
| `descricao` | VARCHAR(255) | sim | - | nao | - | - | recomendado |
| `status` | VARCHAR(20) | nao | `ABERTO` | nao | - | idx | inferido |
| `data_referencia` | DATE | sim | - | nao | - | idx | inferido |
| `observacao` | TEXT | sim | - | nao | - | - | recomendado |
| `created_at` | TIMESTAMP | nao | current_timestamp | nao | - | - | recomendado |
| `updated_at` | TIMESTAMP | nao | current_timestamp on update | nao | - | - | recomendado |

Regras:
- `codigo` unico para reconciliacao historica.
- suporta conciliacao por elo sem "sumir" com trilha de lancamentos.

---

## Tabela `lancamentos_financeiros` (V11) - implementado

Finalidade: tabela transacional central do financeiro.

| Campo | Tipo SQL | Null | Default | Unique | FK | Indice | Origem |
|---|---|---|---|---|---|---|---|
| `id` | BIGINT | nao | auto_increment | PK | - | - | recomendado |
| `conta_contabil_id` | BIGINT | nao | - | nao | `contas_contabeis.id` | idx | encontrado/implementado |
| `classificacao_financeira_id` | BIGINT | sim | - | nao | `classificacoes_financeiras.id` | idx | encontrado/inferido |
| `elo_financeiro_id` | BIGINT | sim | - | nao | `elos_financeiros.id` | idx | encontrado/inferido |
| `cliente_id` | BIGINT | sim | - | nao | `clientes.id` | idx | encontrado no codigo |
| `processo_id` | BIGINT | sim | - | nao | `processos.id` | idx | encontrado no codigo |
| `usuario_id` | BIGINT | sim | - | nao | `usuarios.id` | - | inferido |
| `banco_nome` | VARCHAR(120) | sim | - | nao | - | idx composto | encontrado |
| `numero_banco` | INT | sim | - | nao | - | - | encontrado/inferido |
| `numero_lancamento` | VARCHAR(50) | nao | - | nao | - | idx composto | encontrado (`numero`) |
| `data_lancamento` | DATE | nao | - | nao | - | idx | encontrado |
| `data_competencia` | DATE | sim | - | nao | - | idx | inferido |
| `descricao` | VARCHAR(500) | nao | - | nao | - | - | encontrado |
| `descricao_detalhada` | TEXT | sim | - | nao | - | - | encontrado |
| `documento_referencia` | VARCHAR(120) | sim | - | nao | - | - | inferido |
| `valor` | DECIMAL(15,2) | nao | - | nao | - | - | encontrado |
| `natureza` | VARCHAR(20) | nao | - | nao | - | idx | encontrado/inferido (`debito`/`credito`) |
| `ref_tipo` | VARCHAR(1) | nao | `N` | nao | - | - | encontrado (`N`/`R`) |
| `eq_referencia` | VARCHAR(120) | sim | - | nao | - | idx | encontrado (`eq`/`dimensao`) |
| `parcela_ref` | VARCHAR(30) | sim | - | nao | - | - | encontrado |
| `status` | VARCHAR(20) | nao | `ATIVO` | nao | - | idx | inferido/recomendado |
| `origem` | VARCHAR(30) | nao | `MANUAL` | nao | - | idx | encontrado/inferido (OFX/manual) |
| `observacao` | TEXT | sim | - | nao | - | - | recomendado |
| `metadados_json` | JSON | sim | - | nao | - | - | recomendado |
| `created_at` | TIMESTAMP | nao | current_timestamp | nao | - | - | recomendado |
| `updated_at` | TIMESTAMP | nao | current_timestamp on update | nao | - | - | recomendado |

Regras de negocio (implementado):
- se `processo_id` vier preenchido e `cliente_id` vazio, o backend preenche `cliente_id` automaticamente pelo cliente do processo.
- se `cliente_id` e `processo_id` vierem juntos, o backend valida coerencia (processo precisa pertencer ao cliente).
- conta inativa nao aceita novos lancamentos.
- conta de compensacao exige `elo_financeiro_id` ou `eq_referencia`.
- exclusao de lancamento e fisica nesta fase (simples); trilha de auditoria detalhada fica pendente.

---

## Integracao financeiro x clientes x processos

- **implementado**: vinculos opcionais por FK em `lancamentos_financeiros`.
- **recomendado**:
  - `cliente_id` para todos os lancamentos com destinatario/origem juridica identificada.
  - `processo_id` quando o evento impacta conta corrente processual.
  - coexistencia (`cliente_id` + `processo_id`) permitida e preferivel para contexto completo.

Fluxo alvo:
`cadastro_pessoas -> clientes -> processos -> lancamentos_financeiros`

---

## Decisao tecnica sobre compensacao/transferencia

- **encontrado no codigo**: frontend usa conta de compensacao (`letra E`) e elo para reconciliar pares.
- **implementado**:
  - `elos_financeiros` para identidade da compensacao.
  - `lancamentos_financeiros.elo_financeiro_id` e `eq_referencia` para conciliacao.
- **recomendado**:
  - manter cada perna da compensacao como lancamento real (sem apagar historico).
  - usar status/elo para rastrear conciliado x pendente.

---

## Pendente para fases futuras

- ingestao de extrato com importador server-side completo.
- trilha de auditoria detalhada de alteracao/exclusao de lancamento financeiro.
- modulo completo de imoveis/repasses usando financeiro como fonte principal.
