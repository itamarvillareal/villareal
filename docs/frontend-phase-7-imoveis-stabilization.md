# Estabilização Fase 7 — Imóveis / contratos / repasses (frontend)

Documento de **mini-fase de estabilização** após a integração API-first principal. Complementa `frontend-phase-7-imoveis-implementation.md` e `frontend-transition-phase-7-imoveis.md`.

---

## A) Pontos da UI estabilizados

| Área | O que foi feito | Origem |
|------|-------------------|--------|
| `Imoveis.jsx` | Faixa “Referência principal (API)” com `imovelId`, `contratoId`, `clienteId`, `processoId` quando `useApiImoveis` e imóvel carregado da API; Cod.+Proc. mantidos como vínculo legado | **Encontrado** no código; **adaptado** para priorizar IDs na leitura |
| `ImoveisAdministracaoFinanceiro.jsx` | Linha de IDs nativos; bloco explícito do **contrato vigente** (id, status, datas); lista de repasses com **edição** (PUT); nota sobre despesas sem PUT | **Encontrado** + **implementado** |
| `imoveisRepository.js` | `selecionarContratoVigente()` exportada; uso em `carregarImovelCadastro` e `carregarPainelAdministracaoImovel`; retorno `contratoVigente` no painel; comentários API / legado / transição | **Implementado** |

---

## B) Edição de repasses e despesas

### Repasses

- **Habilitada** em `ImoveisAdministracaoFinanceiro.jsx`, seção “Repasses (API)”, botão **Editar** por linha (somente com `VITE_USE_API_IMOVEIS=true`).
- Persistência: `salvarRepasseLocacao` em `imoveisRepository.js` — se `payload.id` está definido, chama `PUT /api/locacoes/repasses/{id}` (**encontrado** no repositório; fluxo de edição **implementado** na UI).
- Após salvar: mensagem de sucesso, `recarregar()` (re-fetch) sem reload da página.
- Fallback legado: sem flag API, não há chamadas PUT; mensagens de “referência visual” permanecem como antes (**mitigado** por flag).

### Despesas

- **Não habilitada** para edição: o backend expõe apenas `GET` e `POST` em `/api/locacoes/despesas` (`LocacaoDespesaController` — **encontrado**). Não há `PUT`/`PATCH`; expor edição sem endpoint seria **inferido** como inseguro (duplicação ou inconsistência).
- A UI exibe nota explicando o motivo (**documentado** inline e neste arquivo).
- Criação via POST permanece como na fase anterior.

---

## C) Regra de contrato vigente adotada

Implementação: `selecionarContratoVigente(contratos, dataReferencia?)` em `imoveisRepository.js`.

1. Entre contratos com status **VIGENTE**, preferir o cuja **data de referência** (padrão: hoje ao meio-dia local) esteja entre `dataInicio` e `dataFim` (`dataFim` ausente = sem limite superior).
2. Se nenhum VIGENTE couber no período: entre os **VIGENTE**, o de **`dataInicio` mais recente** (empate: **id** maior).
3. Se não houver **VIGENTE**: entre **RASCUNHO**, `dataInicio` mais recente (mesmo critério de empate).
4. Caso contrário: ordenar por “peso” de status (ENCERRADO antes de RESCINDIDO, etc.) e depois `dataInicio` descendente.

**Justificativa:** alinha “contrato em vigência no período atual” com o modelo de negócio; desambigua múltiplos contratos sem depender da ordem retornada pelo backend (**adaptado** ao enum `ContratoLocacaoStatus` **encontrado** no backend).

---

## D) Pontos convertidos para IDs nativos como referência principal

- Com API ativa, **cadastro** (`Imoveis.jsx`): exibição explícita de `imovelId`, `contratoId`, `clienteId`, `processoId` da resposta mapeada (`mapApiToUi` já preenchia `_api*` — **encontrado**).
- **Painel financeiro imobiliário** (`ImoveisAdministracaoFinanceiro.jsx`): mesma linha de referência quando `_apiImovelId` existe.
- Listagem de repasses/despesas continua filtrada por **`contratoId`** do contrato vigente (**inferido** como referência correta para operação).

---

## E) Dependências remanescentes de Cod.+Proc.

| Uso | Motivo |
|-----|--------|
| Campos Código + Proc. no cadastro do imóvel | Entrada e vínculo com **Processos** e **Financeiro** (extrato/conta corrente) ainda baseados nessa chave natural — **encontrado** no fluxo existente |
| `montarPainelAdministracaoImovel(codigo, proc)` | Painel de **conferência** derivado de lançamentos locais do módulo financeiro — **legado** intencional |
| `salvarImovelCadastro` | Resolve `clienteId` / `processoId` via API a partir de Cod.+Proc. ao persistir imóvel — **transição** documentada |
| Navegação “Abrir Processos” / “Abrir Financeiro” | Continua passando Cod.+Proc. no `state` — **compatibilidade operacional** |

---

## F) Relação com o financeiro

- O extrato consolidado, transações detalhadas e alertas permanecem **conferência** sobre lançamentos do Financeiro (mesmo Cod.+Proc.) — **sem mudança de conceito**.
- Repasses e despesas da API de locações são **dados operacionais do módulo imobiliário**; não substituem nem duplicam o extrato; **não** há geração automática de lançamentos financeiros nesta etapa (**encontrado** no escopo da fase).

---

## G) Legado / mock remanescente

- `featureFlags.useApiImoveis === false`: `getImovelMock`, painel `montarPainelAdministracaoImovel` sem chamadas REST de locação — **intacto**.
- Persistência mock: imóvel sem API real — mensagens informativas — **intacto**.
- **Candidato a migração futura:** quando o financeiro expuser IDs de forma estável, reduzir ainda mais a superfície de Cod.+Proc. no painel (**pendente**, fora desta etapa).

---

## H) Gaps para fase futura

| Gap | Tipo |
|-----|------|
| `PUT` (ou `PATCH`) para despesas de locação | **Pendente** — depende de backend |
| Seleção manual de outro contrato (não vigente) para operação | **Pendente** — UX adicional |
| Testes automatizados de `selecionarContratoVigente` | **Pendente** |
| Sincronização formal repasse/despesa ↔ lançamentos financeiros | **Pendente** — política de produto, não escopo desta estabilização |

---

## Rigor (legenda)

- **Encontrado:** evidência direta no repositório (frontend/backend).
- **Inferido:** conclusão lógica a partir do código ou contratos HTTP.
- **Adaptado:** regra ou UI ajustada ao que já existia.
- **Mitigado:** risco reduzido (ex.: flag, fallback).
- **Pendente:** não tratado nesta etapa.
