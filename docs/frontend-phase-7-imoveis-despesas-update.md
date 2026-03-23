# Micro-fase Fase 7 — Edição de despesas de locação (PUT)

Documento da entrega que completa o ciclo operacional de **despesas de locação** com atualização via API, alinhado ao padrão já usado em repasses.

---

## A) Endpoint criado

| Método | Caminho | Comportamento |
|--------|---------|----------------|
| **PUT** | `/api/locacoes/despesas/{id}` | Atualiza uma despesa existente; corpo: `DespesaLocacaoRequest` (mesmo DTO do POST) |

**Encontrado no código:** o projeto já usava `DespesaLocacaoRequest` com `contratoId`, `competenciaMes`, `descricao`, `valor`, `categoria`, `lancamentoFinanceiroId`, `observacao`.

**Implementado:** validação de existência (`RecursoNaoEncontradoException`), bloqueio de troca de contrato (`RegraNegocioException`), mesma regra de competência `YYYY-MM` ou vazio que em `criar`, atualização de vínculo opcional com lançamento financeiro ou `null` para limpar.

---

## B) Arquivos alterados

### Backend (Java)

- `DespesaLocacaoService.java` — método `atualizar(Long id, DespesaLocacaoRequest request)` (**implementado**)
- `DespesaLocacaoServiceImpl.java` — implementação de `atualizar` (**implementado**)
- `LocacaoDespesaController.java` — `@PutMapping("/{id}")` (**implementado**)

### Frontend (React)

- `e-vilareal-react-web/src/repositories/imoveisRepository.js` — `salvarDespesaLocacao` com ramo PUT quando `payload.id` existe (**adaptado**)
- `e-vilareal-react-web/src/components/ImoveisAdministracaoFinanceiro.jsx` — edição inline de despesas (estado, handlers, lista com **Editar** / Salvar / Cancelar) (**implementado**)

**Não alterado:** migrations, repasses além do necessário (apenas condições de `disabled` cruzadas entre repasse e despesa), módulo financeiro.

---

## C) Comportamento de edição na UI

- Local: seção **Despesas (API)** em `ImoveisAdministracaoFinanceiro.jsx`, mesmo bloco que “Operação mínima de repasses e despesas”.
- **Editar** abre formulário com competência, descrição, valor e categoria (enum do backend: `OUTROS`, `REPASSE_ADMIN`, `ADMINISTRACAO`).
- **Salvar** chama `salvarDespesaLocacao({ id, contratoId, ... })` → `PUT /api/locacoes/despesas/{id}`.
- Feedback: banner com “Salvando despesa…”, sucesso ou erro; após sucesso, `recarregar()` (re-fetch) sem reload completo.
- Fallback: com `useApiImoveis` desligado, fluxo legado inalterado (sem PUT).

---

## D) Relação com contrato vigente

- As despesas listadas continuam sendo as do **contrato vigente** selecionado por `selecionarContratoVigente` em `carregarPainelAdministracaoImovel` (**encontrado** em `imoveisRepository.js`).
- O PUT exige `contratoId` igual ao contrato da entidade; o frontend envia sempre `mock._apiContratoId` do mesmo contexto — **coerente** com a listagem.

---

## E) Limitações remanescentes

| Limitação | Tipo |
|-----------|------|
| Vínculo `lancamentoFinanceiroId` não editável no formulário mínimo | **Pendente** de UX; backend aceita alteração se enviado |
| Sem exclusão (DELETE) de despesa nesta entrega | **Pendente** |
| Contrato da despesa não pode ser alterado pelo PUT (por desígnio) | **Encontrado** / regra de integridade |

---

## F) Próximos passos possíveis

- Expor edição opcional de `lancamentoFinanceiroId` / `observacao` na mesma tela, se necessário operacionalmente.
- Endpoint DELETE alinhado à política de negócio.
- Testes de integração do controller de despesas.

---

## Rigor

- **Encontrado:** código existente antes desta micro-fase (DTOs, entidade, padrão PUT em repasses).
- **Adaptado:** `salvarDespesaLocacao` no frontend para POST/PUT condicional ao `id`.
- **Implementado:** service, controller, UI de edição, documentação.
- **Pendente:** itens listados em E e F.
