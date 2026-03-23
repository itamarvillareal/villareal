# Transição do frontend — Fase 8 (tarefas operacionais)

Plano para conectar o React à API `/api/tarefas` sem remover legado até a flag estar estável.

---

## Situação atual (**encontrado**)

| Área | Descrição |
|------|-----------|
| **Pendências** | `Board.jsx` — rota `/pendencias`; colunas por **usuário ativo** (`getUsuariosAtivos`); itens em `localStorage` `pendencias_por_usuario_v2` / v1; texto livre por card; modais de confirmação/ações; **sem** vínculo a processo/cliente/publicação na estrutura de dados |
| **Kanban genérico** | Mesmo arquivo: fora de `/pendencias`, exibe `getBoardData()` / `Column` / `TaskCard` a partir de `mockData.js` |
| **mockData** | `tasksByColumn`, colunas estáticas — **encontrado** |
| **Agenda** | Módulo próprio (eventos); não substituído por tarefas |
| **Prazos / publicações** | Telas específicas; ainda **não** há tarefa operacional persistida na API consumida pelo React |

---

## Endpoints correspondentes (**implementado** no backend)

| Operação | Método | Caminho |
|----------|--------|---------|
| Listar com filtros | GET | `/api/tarefas?responsavelId=&status=&prioridade=&clienteId=&processoId=&dataLimiteDe=&dataLimiteAte=` |
| Detalhe | GET | `/api/tarefas/{id}` |
| Criar | POST | `/api/tarefas` |
| Atualizar | PUT | `/api/tarefas/{id}` |
| Só status (+ observação conclusão) | PATCH | `/api/tarefas/{id}/status` |

Payloads: `TarefaOperacionalRequest`, `TarefaOperacionalStatusPatchRequest` (enums alinhados ao dicionário de dados).

---

## Feature flag

- `VITE_USE_API_TAREFAS=true` → `featureFlags.useApiTarefas` (**implementado** em `featureFlags.js`).

Comportamento sugerido (**pendente** de código na UI):

- `false`: manter `Board.jsx` + `localStorage` como hoje.
- `true`: caminho novo (repository + listagem API) ou modo híbrido com leitura API e fallback.

---

## Adapters necessários (**recomendado**)

- `tarefasRepository.js` (ou `repositories/tarefasOperacionaisRepository.js`): encapsular `request` do `httpClient`, mapear enums string ↔ UI.
- Opcional: normalizar filtros de data (`dataLimiteDe` / `dataLimiteAte` em ISO date).

---

## Telas / componentes afetados (ordem sugerida)

1. **`Board.jsx` / pendências** — maior impacto: substituir ou complementar storage por API quando `useApiTarefas`; manter colunas por responsável alinhadas a `responsavelId`.
2. **`App.jsx` / rotas** — nenhuma mudança obrigatória na primeira entrega backend-only.
3. **Processos / Publicações** — botões “Criar tarefa” com `processoId` / `publicacaoId` pré-preenchidos (**pendente**).
4. **Agenda** — link opcional `agendaEventoId` (**pendente**).

---

## Gaps remanescentes

- Autenticação/contexto de usuário para preencher `criadorUsuarioId` / filtro padrão por responsável (**inferido** do padrão atual do app).
- Migração de dados de `pendencias_por_usuario_v2` → API (**pendente**, projeto separado).
- Histórico na UI (**pendente** — endpoint de listagem de histórico não exposto no mínimo V16; pode usar só PATCH + auditoria futura).

---

## Rigor

- **Encontrado:** `Board.jsx`, chaves `localStorage`, `mockData.js`.
- **Inferido:** necessidade de não quebrar usuários sem API.
- **Recomendado:** repository + flag + migração gradual da tela Pendências.
- **Implementado:** flag no frontend; API no backend.
- **Pendente:** wiring completo da UI.
