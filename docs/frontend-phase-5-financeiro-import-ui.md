# Frontend Fase 5 - UI de importacao do legado financeiro

## A) Onde a ação foi inserida

- **adaptado**: a ação `Importar legado financeiro` foi adicionada no cabeçalho operacional de `src/components/Financeiro.jsx`, ao lado das ações de OFX/pareamento/busca.
- **encontrado no frontend**: o fluxo anterior dependia de bootstrap no `App.jsx`.
- **adaptado**: o bootstrap da fase 5 agora ficou como fallback técnico opcional por `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO_BOOTSTRAP=true`, evitando importação silenciosa por padrão.

## B) Comportamento da prévia

- **adaptado**: botão abre prévia operacional com dados de `previsualizarMigracaoAssistidaPhase5Financeiro()`.
- A prévia exibe:
  - total legado encontrado;
  - potencialmente importável (estimado);
  - potenciais duplicados (estimado);
  - sem vínculo resolvido (estimado);
  - chaves localStorage consideradas;
  - chave do marker e status de execução.
- **mitigado**: a UI explicita que parte dos números é estimativa e o resultado final só fecha após execução.

## C) Comportamento da confirmação

- **adaptado**: a importação manual exige confirmação explícita (`window.confirm`) antes de gravar na API.
- O texto da confirmação informa:
  - tentativa de gravação na API;
  - deduplicação;
  - possibilidade de ignorados;
  - possibilidade de registros sem vínculo.

## D) Resumo final exibido ao usuário

- **adaptado**: ao final, a UI mostra resumo com:
  - `importados`
  - `ignorados`
  - `semVinculo`
  - `totalLidos`
- **adaptado**: feedback também aparece na barra de status existente (`ofxStatus`), mantendo padrão visual atual.

## E) Relação com flag e marker

- **adaptado**: execução manual só acontece quando:
  - `VITE_USE_API_FINANCEIRO=true`
  - `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO=true`
- **adaptado**: marker `vilareal:migration:phase5-financeiro:done:v1` segue soberano para evitar reimportação cega.
- **adaptado**: se marker estiver ativo, a UI informa que já foi executada e bloqueia nova execução comum nesta etapa.
- **pendente**: estratégia de reimportação forçada segura (com confirmação reforçada e escopo por lote).

## F) Riscos e limitações

- **encontrado no frontend**: sem vínculo resolvido pode variar conforme qualidade de `codCliente/proc` legado.
- **mitigado**: deduplicação por chave composta reduz duplicidades mais comuns.
- **mitigado**: importação manual evita execução silenciosa acidental.
- **pendente**: prévia com validação completa de vínculo por linha (hoje semVínculo na prévia é estimado).

## G) Pendências para evolução futura

- **pendente**: liberar reimportação manual controlada (por período, banco ou dry-run por lote).
- **pendente**: painel de auditoria com histórico de execuções da importação.
- **pendente**: reduzir mais dependência de campos textuais legados no fluxo financeiro.
