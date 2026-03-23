# Frontend — Fase 8: tarefas operacionais (integração API)

Documento de implementação da integração controlada do módulo de **Pendências / Board** com a API de tarefas operacionais.

## A) Telas e componentes afetados

| Encontrado no frontend | Descrição |
|------------------------|-----------|
| `e-vilareal-react-web/src/components/Board.jsx` | Rota `/pendencias`: listagem por colunas (usuários), textarea por card, modal de confirmação de alteração, modal de ações (finalizar / localizar / consultar), modal de consulta. Integração API quando `VITE_USE_API_TAREFAS=true`. |
| `e-vilareal-react-web/src/data/tarefasBoardAdapter.js` | Adaptadores: texto ↔ título/descrição, item de API ↔ card do board, agrupamento por coluna, payloads POST/PUT, slot vazio no fim da lista. |
| `e-vilareal-react-web/src/repositories/tarefasOperacionaisRepository.js` | Cliente HTTP centralizado (`GET/POST/PUT/PATCH`); retorna `null` se a flag estiver desligada. |
| `e-vilareal-react-web/src/config/featureFlags.js` | `useApiTarefas` ← `VITE_USE_API_TAREFAS`. |

**Inferido:** Outras telas do app não foram alteradas nesta etapa; o Kanban “mock” fora de `/pendencias` permanece com `mockData`.

## B) Endpoints usados

| Método | Caminho | Uso no frontend |
|--------|---------|-----------------|
| `GET` | `/api/tarefas` | Listagem inicial e após `refreshTickTarefasApi` (extensível). Query params do backend (`responsavelId`, etc.) **não** são enviados pelo board nesta versão — lista completa. |
| `POST` | `/api/tarefas` | Criação ao confirmar alteração em card novo (sem `apiId`) ou ao finalizar sem tarefa persistida na API. |
| `PUT` | `/api/tarefas/{id}` | Atualização ao confirmar alteração em card com `apiId`. |
| `PATCH` | `/api/tarefas/{id}/status` | Finalizar (`CONCLUIDA`) após fluxo de ações ou após confirmação com ação “finalizar”. |

**Pendente / gap:** `GET /api/tarefas/{id}` está no repository mas não é usado pelo board (consulta usa apenas dados já no estado).

## C) Repositories / adapters criados

- **Repository:** `tarefasOperacionaisRepository.js` — `listarTarefasOperacionais`, `buscarTarefaOperacional`, `criarTarefaOperacional`, `atualizarTarefaOperacional`, `patchStatusTarefaOperacional`.
- **Adapter:** `tarefasBoardAdapter.js` — `itemFromApi`, `textoVisivelFromApi`, `parseTextoParaTituloDescricao`, `pendenciaVaziaApi`, `agruparTarefasPorColunas`, `appendEmptySlot`, `buildCriarTarefaBody`, `buildAtualizarTarefaBody`.

## D) Pontos do board já ligados à API

Com `featureFlags.useApiTarefas === true` e rota `/pendencias`:

1. **Leitura:** `useEffect` chama `listarTarefasOperacionais()`, agrupa com `agruparTarefasPorColunas` por `responsavelUsuarioId` = id da coluna.
2. **Persistência local:** `persistirPendencias` é no-op (não grava `pendencias_por_usuario_v2`).
3. **Criação/edição:** modal “Sim” após blur → `POST` ou `PUT` conforme `apiId`.
4. **Status:** “Finalizar Pendência” → `PATCH` com `CONCLUIDA` (e criação prévia se necessário).
5. **UX:** banners de carregamento, salvamento, erro (dismiss), sucesso (auto-dismiss ~4,5s).

## E) Legado / localStorage remanescente

| Chave | Comportamento com API ligada |
|-------|-------------------------------|
| `pendencias_por_usuario_v2` | **Não escrito** pelo board; leitura inicial evitada (`pendenciasInicial` = `{}`). |
| `pendencias_por_usuario_v1` | Não usado na inicialização API-first. |
| `vilareal:processos-historico:v1` | **Permanece** para “Localizar processo” (mesma lógica legada). |

Com flag **desligada**, o fluxo anterior (storage v2/v1, seed mock, `persistirPendencias`) permanece.

## F) Gaps remanescentes

- **Encontrado / adaptado:** Tarefas sem `responsavelUsuarioId` ou com responsável fora das colunas atuais **não aparecem** no board (comentário no adapter).
- **Pendente:** Filtros do backend (`responsavelId`, status, prioridade, datas) não estão expostos na UI do board.
- **Pendente:** Edição de prioridade, data limite e vínculos (cliente, processo, etc.) — UI continua sendo textarea único; PUT só preserva campos já carregados no item quando existirem.
- **Pendente:** Parâmetro de query do backend é `responsavelId`; o repository não mapeia nomes — documentado para evolução.
- **Inferido:** Refresh explícito após mutação usa estado local; não há `GET` por id pós-save (aceitável para esta fase).

## G) Riscos

- Divergência de **ids de usuário** entre colunas do board e `responsavelUsuarioId` no banco → tarefas “sumindo” ou indo para coluna errada.
- **Criação** exige usuário existente no backend; `responsavelUsuarioId` inválido gera erro de negócio.
- Concorrência: dois usuários editando a mesma tarefa — último write vence; sem lock otimista na UI.

## H) Homologação com a flag ligada

Pronto para testar com `VITE_USE_API_TAREFAS=true`:

- Listagem e colunas alinhadas a usuários ativos.
- Criar/editar via modal de confirmação.
- Finalizar com PATCH e histórico no backend (servidor).
- Fallback legado verificável com flag `false`.

---

*Última atualização: integração Fase 8A–8C no `Board.jsx` + adapter + repository.*
