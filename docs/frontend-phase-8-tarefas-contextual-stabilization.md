# Frontend — Fase 8: estabilização das ações contextuais de tarefas

Mini-fase após `ModalCriarTarefaContextual` e helpers em `tarefasContextualPayload.js`. Objetivo: previsibilidade dos vínculos, transparência no modal, feedback alinhado e refresh do board sem depender de cada tela de origem.

## A) Fluxos contextuais revisados

| Origem | Encontrado / adaptado |
|--------|------------------------|
| **Processos (botão)** | **Adaptado:** `clienteId` preferencialmente do GET do processo (`ProcessoResponse.clienteId`), estado `clienteProcessoApiId` em `Processos.jsx`, repassado como `clienteIdNativo` ao helper. |
| **Processos (prazo fatal)** | **Adaptado:** mesmo fluxo + `dataLimiteInicial`; rótulo `sourceLabel` distinto no modal. |
| **Publicações** | **Mitigado:** flag API desligada força `apenasTextoContextual: true` + aviso; sem inventar ids. |

## B) Resolução de vínculos reais vs texto contextual

- **Vínculos reais (POST):** `processoId`, `clienteId`, `publicacaoId`, `processoPrazoId`, `dataLimite` — só quando ids/datas válidos.
- **Texto contextual:** `titulo`, `descrição` — sempre enviados como campos de texto; descrevem o processo/publicação mesmo quando não há id.
- **Cliente em Processos:** 1) `clienteId` do processo na API; 2) senão, resolução por `buscarClientePorCodigo(codigoCliente)` quando `useApiProcessos`; 3) senão, vínculo não enviado (sem valor inventado).

## C) Melhorias no modal

- Bloco **Origem** (`sourceLabel` + nota para prazo fatal).
- Bloco **Vínculos na API** com lista explícita (processo, cliente com origem “processo (API)” / “publicação (API)” / “código do cliente (API)”, publicação, prazo processual, data limite).
- **Pendente documentado** para `processoPrazoId`: linha mostra “não disponível na UI” até existir seleção de prazo com id.
- Modo **somente texto** (`apenasTextoContextual`) com faixa âmbar quando não há ids estruturados.
- Estado **resolvendo cliente** ao buscar por código; botão Salvar desabilitado até concluir (evita POST sem cliente resolvido quando a resolução ainda está em andamento).

## D) Estratégia de refresh / feedback

- **Sucesso:** mensagem fixa informando que a tarefa aparecerá no board ao atualizar / ao abrir Pendências.
- **Erro:** mensagem genérica amigável + detalhe da API quando existir.
- **Refresh global:** evento `window` `vilareal:tarefas-criada` disparado após `POST` bem-sucedido; `Board.jsx` (API tarefas) incrementa `refreshTickTarefasApi` — mesmo mecanismo já usado para mutações no board.

## E) Situação de `clienteId` no fluxo de Processos

- **Encontrado:** `mapApiProcessoToUiShape` não expunha `clienteId` — **adaptado:** campo `clienteId` mapeado a partir de `ProcessoResponse`.
- **Adaptado:** `carregarProcessoApiAtual` popula `clienteProcessoApiId`; limpa quando o processo não existe na API.
- **Mitigado:** fallback por código apenas quando não há `clienteId` nativo no processo.

## F) Preparação para `processoPrazoId`

- **Encontrado:** modal já inclui `processoPrazoId` no payload quando `context.processoPrazoId` for preenchido.
- **Pendente:** UI de escolha de prazo processual com id; helpers documentam extensão em `tarefasContextualPayload.js` (comentário).
- **Não implementado:** campo ou lista de prazos nesta etapa.

## G) Gaps remanescentes

- `processoPrazoId` continua sempre `null` na prática.
- Resolução de cliente por código depende de `useApiProcessos` e lista `/api/clientes`.
- Usuário pode fechar o modal antes de ler o sucesso — aceitável; mensagem reaparece ao criar outra tarefa.

---

*Rigor: **encontrado** = código inspecionado; **adaptado** = mudança feita; **mitigado** = risco reduzido; **pendente** = não coberto.*
