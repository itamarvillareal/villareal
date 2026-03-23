# Dicionário de dados — Fase 4 (Núcleo processual)

Documento alinhado a `docs/database-entities-proposed.md`, `docs/database-phases.md`, `docs/database-gap-analysis.md` e evidência no código do frontend (`Processos.jsx`, `processosHistoricoData.js`, `processosDadosRelatorio.js`).

## Legenda de rigor

| Marcador | Significado |
|----------|-------------|
| **encontrado** | Campo ou regra visível no frontend/backend atual |
| **inferido** | Necessário para coerência ou migração, sem coluna explícita na UI |
| **recomendado** | Decisão de modelagem para evolução segura |
| **implementado** | Presente nas migrations V8/V9 e entidades JPA desta entrega |

---

## Tabela `processos` (V8) — **implementado**

**Finalidade:** Núcleo do processo judicial vinculado a um cliente (`clientes.id`); substitui o par lógico `(codigoCliente, proc)` do `localStorage` por chave técnica estável (`id`) e unicidade `(cliente_id, numero_interno)`.

| Campo | Tipo SQL | Null | Default | Unique | FK | Índice | Origem | Regra |
|-------|----------|------|---------|--------|-----|--------|--------|--------|
| `id` | BIGINT | não | auto_increment | PK | — | — | recomendado | Identificador técnico |
| `cliente_id` | BIGINT | não | — | — | `clientes(id)` | idx | encontrado + implementado | Processo pertence a um cliente (Fase 3) |
| `numero_interno` | INT | não | — | com `cliente_id` | — | — | encontrado | Equivale ao «Proc.» (1, 2, …) na UI |
| `numero_cnj` | VARCHAR(32) | sim | — | — (app) | — | idx | encontrado | «Nº processo novo» / CNJ |
| `numero_processo_antigo` | VARCHAR(64) | sim | — | — | — | — | encontrado | «Nº processo velho» |
| `descricao_acao` | TEXT | sim | — | — | — | — | inferido | Texto longo opcional; UI usa mais `natureza_acao` |
| `natureza_acao` | VARCHAR(255) | sim | — | — | — | — | encontrado | Natureza da ação na grade |
| `competencia` | VARCHAR(120) | sim | — | — | — | — | encontrado | Lista `COMPETENCIAS` |
| `fase` | VARCHAR(120) | sim | — | — | — | — | encontrado | `FASES` na UI |
| `status` | VARCHAR(80) | sim | — | — | — | — | inferido | Situação textual; não confundir com `ativo` |
| `tramitacao` | VARCHAR(120) | sim | — | — | — | — | encontrado | `TRAMITACAO_OPCOES` |
| `data_protocolo` | DATE | sim | — | — | — | — | encontrado | |
| `prazo_fatal` | DATE | sim | — | — | — | idx | encontrado | Prazo fatal no cadastro (também existem prazos na tabela `processo_prazos`) |
| `proxima_consulta` | DATE | sim | — | — | — | idx | encontrado | Diagnósticos / acompanhamento |
| `observacao` | TEXT | sim | — | — | — | — | encontrado | |
| `valor_causa` | DECIMAL(15,2) | sim | — | — | — | — | encontrado | |
| `uf` | CHAR(2) | sim | — | — | — | — | encontrado | |
| `cidade` | VARCHAR(120) | sim | — | — | — | — | encontrado | |
| `comarca` | VARCHAR(160) | sim | — | — | — | — | inferido | Suporte a relatório e endereçamento |
| `vara` | VARCHAR(255) | sim | — | — | — | — | inferido | Campo comum em escritórios |
| `tribunal` | VARCHAR(120) | sim | — | — | — | — | inferido | |
| `consulta_automatica` | BOOLEAN | não | FALSE | — | — | — | encontrado | Checkbox na UI |
| `ativo` | BOOLEAN | não | TRUE | — | — | idx | encontrado | «Status ativo» inverso de inativo |
| `usuario_responsavel_id` | BIGINT | sim | — | — | `usuarios(id)` | — | inferido | Responsável interno |
| `consultor` | VARCHAR(255) | sim | — | — | — | — | inferido | Nome livre (externo) |
| `created_at` | TIMESTAMP | não | CURRENT_TIMESTAMP | — | — | — | recomendado | |
| `updated_at` | TIMESTAMP | não | ON UPDATE | — | — | — | recomendado | |

**Regras de negócio (implementadas no serviço):**

- Unicidade `UK (cliente_id, numero_interno)` — **implementado**.
- `cliente_id` obrigatório — **implementado** (processo sempre nasce de um cliente cadastrado).
- `numero_cnj` único global: **pendente** na aplicação (evitar duplicar CNJ exige validação ou índice único parcial; não forçado no SQL nesta fase).

**Parte cliente / parte oposta na UI:** não duplicadas em colunas de `processos` — **recomendado** mapear para `processo_partes` (polos `AUTOR`/`REU` ou equivalentes). A UI atual ainda usa strings no `localStorage`; migração descrita em `docs/frontend-transition-phase-4-processos.md`.

---

## Tabela `processo_partes` (V9) — **implementado**

**Finalidade:** Litigantes e advogados com polo processual; suporta pessoa cadastrada ou nome avulso.

| Campo | Tipo SQL | Null | FK | Origem | Regra |
|-------|----------|------|-----|--------|--------|
| `id` | BIGINT | não | PK | recomendado | |
| `processo_id` | BIGINT | não | `processos(id)` CASCADE | implementado | |
| `pessoa_id` | BIGINT | sim | `cadastro_pessoas(id)` SET NULL | encontrado + implementado | Quando há cadastro |
| `nome_livre` | VARCHAR(255) | sim | — | inferido | Quando não há `pessoa_id` |
| `polo` | VARCHAR(40) | não | — | inferido | Valores normalizados: `AUTOR`, `REU`, `REQUERENTE`, `REQUERIDO`, `TERCEIRO`, `ADVOGADO`, `OUTRO` |
| `qualificacao` | VARCHAR(120) | sim | — | inferido | Texto auxiliar |
| `ordem` | INT | não | — | inferido | Desempate na UI |
| `created_at` / `updated_at` | TIMESTAMP | — | — | recomendado | |

**Regra:** exatamente um dentre `pessoa_id` ou `nome_livre` — **implementado** no serviço (validação; CHECK SQL removido para compatibilidade).

---

## Tabela `processo_andamentos` (V9) — **implementado**

**Finalidade:** Histórico de movimentações; substitui linhas do `vilareal:processos-historico:v1` para processos migrados.

| Campo | Tipo SQL | Null | FK | Origem | Regra |
|-------|----------|------|-----|--------|--------|
| `id` | BIGINT | não | PK | recomendado | |
| `processo_id` | BIGINT | não | `processos(id)` CASCADE | implementado | |
| `movimento_em` | DATETIME | não | — | inferido | Ordenação cronológica precisa |
| `titulo` | VARCHAR(500) | não | — | encontrado | Equivale ao resumo/tipo da linha de histórico |
| `detalhe` | TEXT | sim | — | encontrado | Texto completo |
| `origem` | VARCHAR(40) | não | — | inferido | `MANUAL`, `PUBLICACAO`, etc. |
| `origem_automatica` | BOOLEAN | não | — | inferido | Base para integrações futuras |
| `usuario_id` | BIGINT | sim | `usuarios(id)` | encontrado | Quem registrou |
| `created_at` / `updated_at` | TIMESTAMP | — | — | recomendado | |

---

## Tabela `processo_prazos` (V9) — **implementado**

**Finalidade:** Prazos operacionais com vínculo opcional a um andamento.

| Campo | Tipo SQL | Null | FK | Origem | Regra |
|-------|----------|------|-----|--------|--------|
| `id` | BIGINT | não | PK | recomendado | |
| `processo_id` | BIGINT | não | `processos(id)` CASCADE | implementado | |
| `andamento_id` | BIGINT | sim | `processo_andamentos(id)` SET NULL | inferido | Origem do prazo |
| `descricao` | VARCHAR(500) | não | — | encontrado | |
| `data_inicio` | DATE | sim | — | encontrado | |
| `data_fim` | DATE | não | — | encontrado | Data limite |
| `prazo_fatal` | BOOLEAN | não | — | encontrado | Flag de fatalidade neste registro |
| `status` | VARCHAR(30) | não | — | inferido | `PENDENTE`, `CUMPRIDO`, `CANCELADO` |
| `cumprido_em` | DATETIME | sim | — | inferido | |
| `observacao` | TEXT | sim | — | encontrado | |
| `created_at` / `updated_at` | TIMESTAMP | — | — | recomendado | |

**Decisão `prazo_fatal` no processo vs prazo:** `processos.prazo_fatal` — **implementado** como visão geral / filtro rápido; `processo_prazos.prazo_fatal` — **implementado** por prazo individual. A UI pode sincronizar ou derivar; **pendente** no frontend.

---

## Relação pessoa → cliente → processo — **implementado**

- `cadastro_pessoas` ← opcional `clientes.pessoa_id` (Fase 3).
- `processos.cliente_id` → `clientes.id` (**obrigatório**).
- `processo_partes.pessoa_id` → `cadastro_pessoas.id` quando a parte é cadastrada.
- Não há FK direta `processos` → `cadastro_pessoas`: o vínculo passa pelo cliente quando necessário.

---

## Migrações

| Arquivo | Conteúdo |
|---------|----------|
| `V8__processos_nucleo.sql` | Tabela `processos` |
| `V9__processo_partes_andamentos_prazos.sql` | `processo_partes`, `processo_andamentos`, `processo_prazos` |
