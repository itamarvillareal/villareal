# Estabilização — Publicações (Fase 6, frontend)

Documento de **mini-fase de estabilização** após a integração principal (`frontend-phase-6-publicacoes-implementation.md`). Diferencia o que foi **encontrado no código**, **inferido**, **adaptado**, **mitigado** e o que permanece **pendente**.

---

## A) Relatório de publicações por processo (API-first)

**Encontrado (antes):** `ModalRelatorioPublicacoesProcesso.jsx` importava apenas `listarPublicacoesDoProcesso` de `data/publicacoesPorProcesso.js`, que lê `vilareal.processos.publicacoes.v2` e cruza por código cliente × proc. interno e/ou CNJ.

**Adaptado:**

- O modal passou a carregar dados de forma **assíncrona** ao abrir (`useEffect`), com **loading**, **erro**, **estado vazio** e texto de **fonte** (API vs local vs mesclado).
- Nova função **`listarPublicacoesRelatorioPorProcesso`** em `repositories/publicacoesRepository.js`:
  - Com `VITE_USE_API_PUBLICACOES=true`: `GET /api/publicacoes?processoId=…` após resolver o id do processo (`processoId` da UI ou `resolverProcessoId` com código × proc. quando `VITE_USE_API_PROCESSOS=true`).
  - **Transição:** itens do legado cuja `hashDedup` não existe na resposta da API são **mesclados** (ordenados por data de publicação), para não perder registros ainda não espelhados no servidor.
  - Falha de rede/API: fallback para a mesma lista legado que antes (`legado_fallback_erro`), com mensagem no painel.

**Inferido:** a mesclagem assume que `hashDedup` (local) corresponde a `hashConteudo` (API), alinhado ao desenho da Fase 6 backend.

---

## B) `Processos.jsx`

**Adaptado:** o modal recebe `processoId={featureFlags.useApiPublicacoes ? processoApiId : null}`.

- Quando a API de publicações está ativa e o estado `processoApiId` foi preenchido pelo fluxo de processos na API, o relatório **prioriza** esse id.
- Com a flag de publicações desligada, o comportamento permanece **100% legado** (o modal ignora id nativo).

**Mitigado:** dependência exclusiva de `codCliente + procInterno` no relatório quando há id nativo disponível; ainda há fallback por chave natural via `resolverProcessoId` se `processoApiId` ainda for nulo.

---

## C) `publicacoesRepository.js` e adapters

**Organização (adaptada):** comentários de módulo descrevendo API-first, legado e transição; seções para leitura principal, relatório por processo, escrita/importação e ações operacionais.

**Novas exportações:**

| Função | Papel |
|--------|--------|
| `listarPublicacoesRelatorioPorProcesso` | Relatório modal; API + mescla opcional com legado |
| `mapLegacyPublicacaoItemToApiRequest` | Mapa item do `localStorage` → corpo `POST` (migração) |
| `vincularPublicacaoProcessoPorProcessoId` | `PATCH` vínculo quando já existe `processoId` numérico |

**Mitigado:** `vincularPublicacaoProcessoPorChaveNatural` delega para `vincularPublicacaoProcessoPorProcessoId` após resolver o processo, evitando duplicar a chamada HTTP.

---

## D) Dependências remanescentes de chave natural

**Pendentes / estruturais:**

- Índice CNJ → cadastro em `publicacoesVinculoProcessos.js` (`montarIndiceCnjClienteProc`) continua **sem** `processoId`; fluxos automáticos que dependem desse índice ainda passam por `codCliente` + `proc`.
- Formulário manual de vínculo na tela de publicações continua captando **texto** código × proc. (compatibilidade de entrada).
- Prévia PDF / parser: ainda produz metadados com chave natural onde o usuário informa.

**Mitigado nesta etapa:** vínculo na API quando já existe id numérico; relatório por processo usa `processoId` quando disponível.

---

## E) Legado / localStorage

**Encontrado:**

- Chave principal: `vilareal.processos.publicacoes.v2` (`STORAGE_PUBLICACOES_IMPORTADAS`), formato `{ v: 2, itens: [...] }`.
- Migração automática antiga de `vilareal.processos.publicacoes.v1` → v2 em `publicacoesStorage.js`.

**Preservado:** fallback legado **não** foi removido; feature flag `VITE_USE_API_PUBLICACOES` controla a fonte.

---

## F) Estratégia para migração assistida (próxima UI)

**Implementado (técnico, não obrigatório na UI ainda):**

- Arquivo `services/publicacoesMigrationPhase6.js`:
  - `previsualizarMigracaoAssistidaPhase6Publicacoes()` — contagens locais, duplicatas de hash **dentro** do JSON legado.
  - `executarMigracaoAssistidaPhase6Publicacoes()` — `POST` por item, vínculo opcional via API de processos, marcador `vilareal:migration:phase6-publicacoes:done:v1`.
- Flag: `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES` (default `false` em `.env.development`).

**Deduplicação:** servidor usa unicidade de `hash_conteudo`; itens que colidirem geram falha no `POST` e são contados como ignorados (mesmo padrão da importação da prévia).

**Inferido:** prévia **não** lista todos os hashes já existentes na API (evita `GET` massivo); a execução real é a fonte de verdade para duplicados remotos.

---

## G) Gaps para fase futura

- UI operacional (botão, prévia, confirmação, progresso) para migração Phase 6, no modelo da Fase 5 financeiro.
- Histórico de `publicacoes_tratamentos` na UI.
- `GET/PUT/DELETE` por id expostos na tela.
- Automação CNJ completa, geração de andamento/prazo/tarefa, anexos pesados (fora de escopo explícito).

---

## Referências de arquivos

| Arquivo | Papel |
|---------|--------|
| `e-vilareal-react-web/src/components/ModalRelatorioPublicacoesProcesso.jsx` | Relatório API-first + UX |
| `e-vilareal-react-web/src/components/Processos.jsx` | Passa `processoId` ao modal |
| `e-vilareal-react-web/src/repositories/publicacoesRepository.js` | Relatório, adapters, vínculo por id |
| `e-vilareal-react-web/src/data/publicacoesPorProcesso.js` | Legado — filtro por processo (inalterado na lógica base) |
| `e-vilareal-react-web/src/services/publicacoesMigrationPhase6.js` | Base migração assistida |
| `e-vilareal-react-web/src/config/featureFlags.js` | `enableLocalStorageImportPhase6Publicacoes` |
