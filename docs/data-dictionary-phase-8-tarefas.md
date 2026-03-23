# Dicionário de dados — Fase 8 (tarefas operacionais / workflow)

Baseado em **encontrado** nas fases anteriores (MySQL 8, Flyway, padrões de FK/índice) e **recomendado** para integração pragmática com processos, clientes, publicações, agenda e prazos.

---

## 1. `tarefas_operacionais`

| Campo | Tipo SQL | Null | Default | Índice | Finalidade / regra |
|-------|-----------|------|---------|--------|---------------------|
| `id` | BIGINT AI | NOT NULL | — | PK | Identificador (**implementado**) |
| `titulo` | VARCHAR(500) | NOT NULL | — | — | Resumo da providência (**recomendado**) |
| `descricao` | TEXT | NULL | — | — | Detalhe livre (**recomendado**) |
| `status` | VARCHAR(30) | NOT NULL | `PENDENTE` | idx | `PENDENTE`, `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA` — enum JPA (**implementado**) |
| `prioridade` | VARCHAR(30) | NOT NULL | `NORMAL` | idx | `BAIXA`, `NORMAL`, `ALTA`, `URGENTE` (**implementado**) |
| `origem` | VARCHAR(40) | NOT NULL | `MANUAL` | idx | `MANUAL`, `PUBLICACAO`, `PRAZO`, `AGENDA`, `OUTRO` — preparação futura sem automação agora (**recomendado**) |
| `responsavel_usuario_id` | BIGINT | NULL | — | FK + idx | Usuário responsável (**encontrado** padrão `usuarios`) |
| `criador_usuario_id` | BIGINT | NULL | — | FK + idx | Quem criou (opcional na API) (**recomendado**) |
| `cliente_id` | BIGINT | NULL | — | FK + idx | Vínculo opcional (**encontrado** `clientes`) |
| `processo_id` | BIGINT | NULL | — | FK + idx | Vínculo opcional (**encontrado** `processos`) |
| `publicacao_id` | BIGINT | NULL | — | FK + idx | Vínculo opcional (**encontrado** `publicacoes`) |
| `agenda_evento_id` | BIGINT | NULL | — | FK + idx | Referência a compromisso (**encontrado** `agenda_eventos`) |
| `processo_prazo_id` | BIGINT | NULL | — | FK + idx | Referência a prazo processual (**encontrado** `processo_prazos`) |
| `data_limite` | DATE | NULL | — | idx | Prazo operacional da tarefa (≠ obrigatoriamente `data_fim` do prazo CNJ) (**recomendado**) |
| `data_conclusao` | DATETIME | NULL | — | — | Preenchida ao concluir (**recomendado**) |
| `observacao_conclusao` | TEXT | NULL | — | — | Nota ao encerrar (**recomendado**) |
| `created_at` | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | — | Auditoria mínima (**encontrado** padrão) |
| `updated_at` | TIMESTAMP | NOT NULL | ON UPDATE | — | Idem (**encontrado** padrão) |

**FKs:** `usuarios` (×2), `clientes`, `processos`, `publicacoes`, `agenda_eventos`, `processo_prazos` — `ON DELETE SET NULL` nos vínculos opcionais (**implementado**).

**Unique:** nenhum composto — várias tarefas podem referenciar o mesmo processo/publicação (**inferido**: operação real exige isso).

**Regras de negócio (serviço):**

- Se `cliente_id` e `processo_id` vierem ambos, o cliente deve ser o do processo (**implementado**).
- Se `processo_prazo_id` e `processo_id` vierem ambos, o prazo deve ser do mesmo processo; se só o prazo vier, o processo é deduzido do prazo (**implementado**).
- Publicação com processo preenchido deve coincidir com o processo da tarefa, se houver (**implementado**).

**Origem da decisão:** necessidade **encontrada** no frontend (`Board.jsx` / pendências por usuário) e **inferida** para separar “tarefa operacional” de “evento de agenda” e “prazo processual” (ver doc de transição).

---

## 2. `tarefa_operacional_historico`

| Campo | Tipo SQL | Null | Finalidade |
|-------|-----------|------|------------|
| `id` | BIGINT AI | NOT NULL | PK |
| `tarefa_id` | BIGINT | NOT NULL | FK → `tarefas_operacionais` CASCADE |
| `usuario_id` | BIGINT | NULL | FK → `usuarios` (quem alterou, se conhecido no futuro) |
| `tipo` | VARCHAR(30) | NOT NULL | Por ora `STATUS_ALTERADO` (**implementado** no PATCH) |
| `status_anterior` | VARCHAR(30) | NULL | Snapshot |
| `status_novo` | VARCHAR(30) | NULL | Snapshot |
| `detalhe` | TEXT | NULL | Observação / contexto |
| `created_at` | TIMESTAMP | NOT NULL | Quando ocorreu |

**Regra:** linhas inseridas em `PATCH /api/tarefas/{id}/status` quando o status muda (**implementado**). PUT geral **não** duplica histórico por ora (**pendente** opcional).

**Decisão:** histórico **leve** em tabela separada — suficiente para auditoria sem motor BPM (**recomendado**).

---

## 3. Relação conceitual com outros módulos

| Módulo | Papel | Decisão |
|--------|--------|---------|
| **Agenda** | Compromissos/calendário por usuário | Continua sendo o lugar de **eventos datados**; tarefa pode **apontar** para `agenda_evento_id` sem substituir a agenda (**recomendado**) |
| **processo_prazos** | Prazo processual (CNJ / fatal etc.) | Continua na competência do processo; tarefa pode **espelhar** trabalho a fazer derivado do prazo (**recomendado**) |
| **Publicações** | Tratamento de intimação | Tarefa pode **vincular** publicação para “providência” sem duplicar o teor (**recomendado**) |

---

## Rigor

- **Encontrado:** convenções de migrations V1–V15, entidades `Usuario`, `Processo`, etc.
- **Inferido:** coexistência de vínculos opcionais; ausência de unique artificial.
- **Recomendado:** coluna `origem`, histórico mínimo, validações no service.
- **Implementado:** V16 + código Java listado no repositório.
- **Pendente:** histórico em PUT; integração frontend; automações a partir de publicação/prazo.
