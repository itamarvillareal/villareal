# Frontend transition - Fase 6 (Publicações)

## Estado atual mapeado

- **encontrado no código**:
  - Tela principal: `src/components/PublicacoesProcessos.jsx`.
  - Pipeline de importação local:
    - `publicacoesPdfExtract.js`
    - `publicacoesPdfParser.js`
    - `publicacoesPipeline.js`
    - `datajudApiClient.js`
    - `publicacoesVinculoProcessos.js`
  - Persistência local:
    - `publicacoesStorage.js` (`vilareal.processos.publicacoes.v2`)
    - cache DataJud em `localStorage`.
  - Operações da UI atual:
    - prévia do PDF;
    - confirmação de importação;
    - vínculo manual/automático (CNJ -> cliente/proc interno);
    - filtros e busca sobre base local.

## Endpoints da fase 6

- `GET /api/publicacoes`
- `GET /api/publicacoes/{id}`
- `POST /api/publicacoes`
- `PUT /api/publicacoes/{id}`
- `PATCH /api/publicacoes/{id}/status`
- `PATCH /api/publicacoes/{id}/vinculo-processo`
- `DELETE /api/publicacoes/{id}`

Filtros disponíveis no `GET`:
- `dataInicio`
- `dataFim`
- `status`
- `processoId`
- `clienteId`
- `texto`
- `origemImportacao`

## Feature flag

- **implementado**:
  - `VITE_USE_API_PUBLICACOES`
  - `featureFlags.useApiPublicacoes`

## Mapeamento API x UI (adapters necessários)

- **recomendado** criar `src/repositories/publicacoesRepository.js` com:
  - `listarPublicacoesApiFirst(filtros)`
  - `buscarPublicacao(id)`
  - `criarPublicacao(payload)`
  - `atualizarPublicacao(id, payload)`
  - `alterarStatusPublicacao(id, { status, observacao, usuarioId })`
  - `vincularPublicacaoProcesso(id, { processoId, usuarioId, observacao })`

- **encontrado no código**: a UI atual usa campos como:
  - `numero_processo_cnj`
  - `statusValidacaoCnj`
  - `scoreConfianca`
  - `codCliente` / `procInterno`
  - `teorIntegral` / `resumoPublicacao`
  - `hashTeor` / `hashDedup`
- **recomendado**:
  - mapear para contrato backend:
    - `numeroProcessoEncontrado`
    - `statusTratamento`
    - `processoId` / `clienteId`
    - `teor` / `resumo`
    - `hashTeor` / `hashConteudo`

## Estratégia de migração progressiva

1. **Leitura API-first (sem remover fallback)**  
   - Tela `PublicacoesProcessos.jsx` passa a listar via API quando `VITE_USE_API_PUBLICACOES=true`.  
   - Se flag desligada, mantém `publicacoesStorage.js`.

2. **Persistência de novas importações**  
   - Após parser/pipeline local, confirmar importação via `POST /api/publicacoes` em lote controlado no frontend.

3. **Status e vínculo**  
   - Botões atuais de vínculo/estado passam para `PATCH` de status e vínculo-processo.

4. **Migração assistida legado**  
   - Etapa futura: utilitário de importação de `vilareal.processos.publicacoes.v2` para API com dedup por `hashConteudo`.

## Gaps que não fecham nesta fase

- **pendente**: automação completa CNJ -> criação automática de andamento/prazo/tarefa.
- **pendente**: ingestão massiva server-side de múltiplas fontes.
- **pendente**: anexos pesados e gestão documental completa de publicações.
- **pendente**: UI dedicada de auditoria de histórico (`publicacoes_tratamentos`).

## Ordem recomendada de adaptação da UI

1. Criar repository/adapters de publicações.
2. Trocar grade “Publicações gravadas” para API-first com fallback.
3. Migrar ações de status e vínculo para endpoints PATCH.
4. Migrar confirmação de importação para persistência API.
5. Só depois evoluir automações mais pesadas.
