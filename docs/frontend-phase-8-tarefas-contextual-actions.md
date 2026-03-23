# Frontend — Fase 8: ações contextuais para criar tarefa operacional

Criação **assistida e explícita** (sem automação silenciosa) a partir de **Processos**, **Publicações** e atalho ligado ao **Prazo Fatal** na tela de processo. Reutiliza `POST /api/tarefas` e vínculos opcionais já suportados pelo backend.

## A) Pontos de entrada adicionados

| Onde | Ação | Condição |
|------|------|----------|
| **Processos** — cabeçalho | Botão **Criar tarefa** | `VITE_USE_API_TAREFAS=true` |
| **Processos** — bloco Prazo Fatal | Link **Criar tarefa com esta data** | Mesma flag + prazo fatal preenchido (dd/mm/aaaa) |
| **Publicações** — coluna Ações (gravações) | Botão **Criar tarefa** | Mesma flag |

**Encontrado:** `Processos.jsx`, `PublicacoesProcessos.jsx`.  
**Pendente:** Ponto dedicado para **prazo processual** com `processo_prazo_id` (entidade) — não há UI simples de lista de prazos com id nesta etapa; ver seção G.

## B) Contexto pré-preenchido por módulo

### Processos (geral)

- **Título:** CNJ quando existir; senão “Acompanhamento — Cliente {código} / proc. {n}”.
- **Descrição:** cliente, proc. interno, CNJ.
- **Vínculos:** `processoId` quando `processoApiId` existe; `clienteId` resolvido via `buscarClientePorCodigo` (API clientes) quando `useApiProcessos` está ativo.

### Processos (prazo fatal)

- **Adaptado:** `buildContextFromProcessoComPrazoFatal` — mesma base + `dataLimiteInicial` em ISO (`yyyy-MM-dd`) a partir do prazo fatal em `dd/mm/aaaa`, e menção na descrição.

### Publicações

- **Título:** CNJ + tipo de publicação.
- **Descrição:** resumo (truncado), datas de publicação/disponibilização.
- **Vínculos:** `publicacaoId`, `processoId`, `clienteId` quando presentes na linha (`mapApiPublicacaoToUi`).

## C) Campos que o usuário ainda edita

**Encontrado no modal:** `ModalCriarTarefaContextual.jsx` — título, descrição, responsável (opcional), prioridade, data limite (editável mesmo quando pré-preenchida).

## D) Vínculos enviados à API

Corpo `POST` (campos opcionais omitidos quando ausentes):

- `titulo`, `descricao`, `origem: MANUAL`, `prioridade`
- `responsavelUsuarioId` (se selecionado)
- `processoId`, `clienteId`, `publicacaoId`, `processoPrazoId` (este último reservado quando houver fluxo futuro)
- `dataLimite` (ISO date)

**Helpers:** `src/data/tarefasContextualPayload.js` — montagem do contexto inicial; `ModalCriarTarefaContextual.jsx` — merge final e chamada a `criarTarefaOperacional`.

## E) Gaps remanescentes

- **`processoPrazoId`:** não preenchido nesta etapa (sem seleção de prazo processual por id).
- **Cliente em Processos:** se `useApiProcessos` estiver desligado, `buscarClientePorCodigo` não resolve `clienteId` — vínculo de cliente fica ausente.
- **Publicações legadas (sem API):** aviso no modal; vínculos numéricos zerados; apenas texto pré-preenchido.
- **IDs de publicação legados:** `id` local não numérico → `publicacaoId` não enviado.

## F) Riscos

- Divergência entre dados em tela e backend (processo ainda não sincronizado) — mitigado pelo aviso quando `processoApiId` falta.
- Coerência cliente/processos — validada no backend (`RegraNegocioException`).

## G) Próximos passos

- Tela ou menu de **prazos processuais** com id, para preencher `processoPrazoId`.
- Opcional: após criar tarefa, navegar para `/pendencias` ou incrementar `refreshTick` global (não implementado para manter escopo mínimo).

---

*Rigor: **encontrado** = código atual; **adaptado** = escolhas feitas nesta etapa; **mitigado** = avisos/UX; **pendente** = itens não implementados.*
