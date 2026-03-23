# Fase 6 — Importação de legado de publicações (UI operacional)

Documento da mini-fase operacional para tornar explícita, na tela, a migração assistida do legado `vilareal.processos.publicacoes.v2` para API.

## A) Onde a ação foi inserida

- **Arquivo:** `e-vilareal-react-web/src/components/PublicacoesProcessos.jsx`
- **Local:** bloco superior da seção de importação de PDF.
- **Ação visível:** botão `Importar legado de publicações`.

## B) Comportamento da prévia

Ao clicar na ação, a UI chama `previsualizarMigracaoAssistidaPhase6Publicacoes()` e mostra:

- total legado encontrado;
- importável (estimativa local);
- duplicados locais (estimativa local por `hashDedup`);
- sem vínculo (estimativa local por ausência de código/proc);
- quantidade com/sem hash;
- chaves de `localStorage` consideradas;
- status do marker e das flags.

Observação explícita no painel: parte dos números é estimativa local; o resultado final depende da execução contra API.

## C) Comportamento da confirmação

Antes da execução há confirmação explícita (`window.confirm`) com avisos:

- gravação na API será tentada;
- deduplicação no servidor por `hash_conteudo`;
- registros podem ser ignorados;
- registros podem ficar sem vínculo resolvido;
- marker evita reimportação cega.

## D) Resumo final exibido ao usuário

Após executar `executarMigracaoAssistidaPhase6Publicacoes()`, a UI exibe:

- importados (`gravados`);
- ignorados (`ignorados`);
- sem vínculo (`semVinculo`);
- total lido (`total`);
- mensagem operacional na área de feedback da tela.

## E) Relação com flag e marker

- **Flag funcional:** `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES`.
- **Flag de API:** `VITE_USE_API_PUBLICACOES`.
- **Marker:** `vilareal:migration:phase6-publicacoes:done:v1`.

Com marker ativo, a UI informa que já houve execução e bloqueia reexecução comum nesta etapa.

## F) Impacto na listagem principal e no relatório por processo

- Após importar, a tela incrementa `gravadosTick` e recarrega a listagem principal (sem reload global).
- O relatório por processo segue API-first e passa a enxergar os novos registros da API quando aplicável.
- Fallback legado permanece como compatibilidade.

## G) Riscos e limitações

- A prévia não consulta toda a API para deduplicação remota (estimativa local, execução é fonte final).
- Sem vínculo resolvido depende de qualidade de `codCliente`/`procInterno` legados e resolução no módulo de processos.
- Reimportação forçada segura não foi aberta nesta mini-fase para evitar duplicidade operacional acidental.

## H) Pendências para evolução futura

- Fluxo de reimportação segura (com opção explícita de ignorar marker e regras adicionais).
- Painel de progresso detalhado por item/lote.
- Melhor diagnóstico por motivo de ignorado (duplicata vs validação vs vínculo).
