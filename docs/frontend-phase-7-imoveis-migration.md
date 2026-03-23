# Migração assistida — legado/mock de imóveis (Fase 7)

Documento da **mini-fase** que reduz dependência do mock procedural sem removê-lo: prévia, deduplicação explícita e execução confirmada no frontend.

---

## A) Fontes legadas encontradas

| Fonte | Conteúdo | Onde |
|--------|-----------|------|
| `imoveisMockData.js` | `getImovelMock(imovelId)` para ids **1..45** (`getImoveisMockTotal()`), objeto plano (endereço, utilidades, cod/proc sintéticos, partes, datas, banco, etc.) | **Encontrado** |
| `imoveisRepository.js` | `mapMockToUi` — mapeia mock → formato de formulário; campos de assinatura/arquivamento fixos em valores padrão | **Encontrado** / **adaptado** (export para migração) |
| `imoveisAdministracaoFinanceiro.js` | Painel financeiro a partir de **Cod.+Proc.** + dados locais de extrato; **não** é fonte de imóvel/contrato para POST | **Encontrado** |
| Repasses / despesas no mock | **Inexistentes** — não há arrays nem localStorage de repasse/despesa ligados ao mock | **Encontrado** |

**Inferido:** o “legado” migrável nesta etapa é essencialmente o **cadastro sintético** gerado por `getImovelMock`, não extratos financeiros reais.

---

## B) Estratégia de deduplicação

| Entidade | Chave | Comportamento |
|----------|--------|----------------|
| **Imóvel** | `(clienteId, processoId)` resolvidos na API a partir de Cod.+Proc. do mock | Se `GET /api/imoveis?clienteId=` já retorna linha com o mesmo `processoId`, **não cria** de novo (**implementado** em `imoveisMigrationPhase7.js`) |
| **Contrato** | Não deduplicado isoladamente | Criado apenas via `salvarImovelCadastro` após POST do imóvel; se imóvel for pulado, contrato também não é criado (**encontrado** no fluxo existente) |
| **Repasse / despesa** | N/A | Fora do escopo — mock não possui dados (**encontrado**) |

---

## C) O que entra e o que fica fora

**Entra (com API e flags ativas):**

- Payload equivalente ao fluxo manual: `salvarImovelCadastro(ui)` com `ui = mapMockToUi(mock, mockId)` (**implementado**).

**Fica fora nesta etapa:**

- Importação de repasses/despesas (sem dados no mock).
- Atualização forçada de imóvel já existente (somente **skip**).
- Qualquer geração de lançamento financeiro (**pendente** / fora de escopo explícito).
- Backend novo (usa apenas endpoints já existentes) (**encontrado**).

---

## D) Relação com flags / marcador

| Item | Valor |
|------|--------|
| API imóveis | `VITE_USE_API_IMOVEIS=true` → `featureFlags.useApiImoveis` |
| UI + execução migração | `VITE_ENABLE_IMOVEIS_MOCK_MIGRATION_PHASE7=true` → `featureFlags.enableImoveisMockMigrationPhase7` |
| Marcador localStorage | `vilareal:migration:phase7-imoveis:lastRun:v1` — JSON com `at`, `criados`, `pulados`, `erros`, `detalhesErros` (**implementado**) |

Fallback: com `useApiImoveis` falso, mock continua como hoje; a caixa de migração **não** aparece.

---

## E) Riscos

- **Cliente/processo inexistentes** na API: linha pulada; prévia mostra contagem (**mitigado** por pré-visualização).
- **Dados sintéticos** no mock: importação em produção pode poluir base — uso deve ser **consciente** (**inferido**).
- **Volume de chamadas**: prévia faz sequencial por id (N pequeno = 45) (**aceito** nesta fase).

---

## F) Limitações

- Depende de resolução **Cod.+Proc.** → `clienteId` / `processoId` como no cadastro manual.
- Não lista diff campo a campo na UI (apenas resumo numérico + último resultado).
- Reexecução tende a **pular** tudo após primeira importação bem-sucedida (deduplicação).

---

## G) Próximos passos possíveis

- Prévia exportável (CSV/JSON) para auditoria.
- Opção “atualizar se existir” (PUT) com confirmação separada.
- Fonte adicional se no futuro houver export real (não mock) dedicado.

---

## Rigor

- **Encontrado:** arquivos e ausência de repasse/despesa no mock.
- **Inferido:** risco de uso em produção com dados sintéticos.
- **Adaptado:** exports no `imoveisRepository` para reutilizar resolução e mapeamento.
- **Implementado:** `src/services/imoveisMigrationPhase7.js`, bloco em `Imoveis.jsx`, flag em `featureFlags.js`.
- **Pendente:** importação de dados reais fora do mock; reconciliação com financeiro.
