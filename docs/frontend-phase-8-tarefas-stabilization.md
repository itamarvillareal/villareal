# Frontend — Fase 8: estabilização do board de tarefas

Mini-fase após a integração API-first em `/pendencias` (`Board.jsx`). Objetivo: reduzir gaps de visibilidade, filtros e previsibilidade de atualização, sem alterar o backend salvo o necessário e sem remover o fallback legado.

## A) Tratamento de tarefas sem responsável

**Encontrado no frontend (antes):** `agruparTarefasPorColunas` só preenchia colunas cujo `id` coincidia com `responsavelUsuarioId`; tarefas sem responsável ou com responsável fora das colunas de usuário **não apareciam**.

**Adaptado:** Foi introduzido o id sintético `COLUNA_SEM_RESPONSAVEL_ID` (`__sem_responsavel__`) em `tarefasBoardAdapter.js`, com coluna de exibição **“Sem responsável”** (via `colunasBoardComSemResponsavel`). O agrupamento passa a enviar para esse bucket:

- tarefas com `responsavelUsuarioId` nulo/ausente na resposta;
- tarefas cujo responsável **não** corresponde a nenhuma coluna de usuário atual.

**Mitigado:** Tarefas “órfãs” deixam de sumir do board quando a flag API está ligada.

**Pendente:** Se não existir coluna sintética (código legado que chame o adapter sem a coluna extra), órfãos continuam sem bucket — o board API-first sempre inclui a coluna extra.

## B) Filtros adicionados

Com `VITE_USE_API_TAREFAS=true`, acima do board:

| Filtro | Comportamento |
|--------|----------------|
| **Responsável** | `Todos` — sem `responsavelId` na query; `Sem responsável` — lista completa da API e filtro **no cliente** por `responsavelUsuarioId == null`; usuário específico — query `responsavelId` (nome do parâmetro do backend). |
| **Status** | Query `status` (enum do backend). |
| **Prioridade** | Query `prioridade` (enum do backend). |

**Pendente:** Filtros combinados com agrupamento amplo podem gerar colunas vazias (esperado). Performance em bases muito grandes ao usar “Sem responsável” (traz lista completa antes de filtrar no cliente).

## C) Alinhamento de nomenclatura com o backend

**Encontrado no backend:** `GET /api/tarefas` usa `@RequestParam Long responsavelId` (entre outros).

**Adaptado em** `tarefasOperacionaisRepository.js`:

- Objeto de opções com **`responsavelId`** na query (não `responsavelUsuarioId`).
- Comentário no arquivo ligando: query `responsavelId` ↔ resposta JSON `responsavelUsuarioId` ↔ colunas do board (id de usuário).

**Pendente:** Outros módulos que importem o repository devem usar `responsavelId` nas opções de listagem.

## D) Estratégia de refresh pós-mutação

**Encontrado (antes):** Após `POST`/`PUT`/`PATCH`, o estado era atualizado com `setPendenciasPorUsuario` / `appendEmptySlot` localmente.

**Adaptado:** Foi centralizado `refreshTarefasApi()` → incremento de `refreshTickTarefasApi`, disparando o mesmo `useEffect` que carrega a lista. **Uma única fonte de verdade** após salvar/finalizar: recarregar lista com a query de filtros atual e reagrupar.

**Mitigado:** Comportamento pós-mutação fica explícito e alinhado aos filtros ativos.

## E) Uso ou não uso de `GET /api/tarefas/{id}`

**Avaliação:** Para esta etapa, **não** foi integrado ao fluxo do board.

**Motivo (adaptado):** O refresh completo já devolve itens consistentes com filtros e colunas; `GET` por id não agregaria ganho proporcional ao custo de chamadas extras nesta UI.

**Pendente:** Uso futuro para modal de detalhe rico, reconciliação otimista ou edição colaborativa.

**Repository:** `buscarTarefaOperacional(id)` permanece disponível.

## F) Legado / localStorage remanescente

Inalterado em relação à Fase 8: com flag **desligada**, `pendencias_por_usuario_v2` / v1 e fluxo legado; com flag **ligada**, board não persiste pendências no `localStorage`. Processos em `vilareal:processos-historico:v1` para “Localizar processo” permanece.

## G) Gaps para fase futura

- Coluna “Sem responsável” **não** envia `responsavelUsuarioId` ao criar/editar (corpo com campo omitido ou `null`); validações de negócio no backend podem restringir isso em alguns ambientes.
- Filtro “Sem responsável” depende de listagem ampla + filtro cliente (sem parâmetro dedicado no backend nesta etapa).
- Sincronização em tempo real / conflitos entre abas não tratados.
- Documentação de dados: `docs/data-dictionary-phase-8-tarefas.md` pode ser cruzada com esta estabilização.

---

*Rigor: itens marcados como **encontrado** vêm do código inspecionado; **adaptado** descreve mudanças feitas; **mitigado** indica risco reduzido; **pendente** permanece em aberto.*
