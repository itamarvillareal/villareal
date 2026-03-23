# Transição do frontend — Fase 7 (Imóveis / Locações)

## Situação atual (encontrado no código)

| Área | Componente / arquivo | Comportamento |
|------|------------------------|---------------|
| Cadastro imóvel | `Imoveis.jsx` | Estado local + `getImovelMock(id)` de `imoveisMockData.js`; campos espelham operação real (endereço, utilidades, contrato, partes). |
| Financeiro locação | `ImoveisAdministracaoFinanceiro.jsx` | Agrega **financeiroData** / conta corrente por Cod. cliente + Proc.; sem persistência própria. |
| Regras de classificação | `imoveisAdministracaoFinanceiro.js` | Tags `[ADM_IMOVEL:ALUGUEL]`, `[ADM_IMOVEL:REPASSE]`, `[ADM_IMOVEL:DESPESA_REPASSAR]` e heurísticas. |

## Feature flag (recomendado)

- `VITE_USE_API_IMOVEIS` → `featureFlags.useApiImoveis` em `config/featureFlags.js`.
- Transição **progressiva**: repositório único (`imoveisRepository.js` — a criar na integração) com fallback mock até homologação.

## Endpoints backend (implementado nesta fase)

- Imóveis: `GET/POST/PUT /api/imoveis`
- Contratos: `GET/POST/PUT /api/locacoes/contratos`
- Repasses: `GET/POST/PUT /api/locacoes/repasses`
- Despesas locação: `GET/POST /api/locacoes/despesas`

## Ordem sugerida de adaptação do frontend

1. **Imóveis:** carregar/salvar imóvel por `id` API; mapear `codigo`+`proc` da UI para `clienteId` + `processoId` resolvidos via APIs já existentes de clientes/processos.
2. **Contrato:** persistir contrato vinculado ao `imovelId`; mapear locador/inquilino para `pessoaId` do cadastro quando possível.
3. **Repasses:** tela administrativa mensal pode passar a ler/gravar `repasses_locador` **e** manter leitura do extrato financeiro para conferência.
4. **Despesas:** despesas com lançamento no financeiro devem usar `lancamento_financeiro_id`; demais ficam só em `despesas_locacao`.

## Gaps que esta fase **não** fecha

- Integração automática repasse ↔ lançamento financeiro.
- Migração de mocks `getImoveisMockTotal()` para dados reais.
- OCR/anexos de contrato.
- Flags de assinatura do modal persistidas em colunas dedicadas.

## Riscos

- Divergência entre totais do **repasse** cadastrado e soma do **extrato** se usuários não vincularem `lancamento_financeiro_id`.
- `campos_extras_json` exige disciplina de formato no frontend ao serializar utilidades.
