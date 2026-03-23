# Transição do frontend — Fase 4 (Processos)

## Base documental

Continuidade com `docs/frontend-transition-phase-2-3.md`, `docs/database-phases.md` e `docs/database-gap-analysis.md`.

## Telas e componentes (encontrado no código)

| Área | Arquivo / rota | Observação |
|------|----------------|------------|
| Processos principal | `src/components/Processos.jsx` | `/processos` — formulário extenso por `codigoCliente` + `processo` (número) |
| Cadastro de clientes (grade processos) | `src/components/CadastroClientes.jsx` | `/pessoas` — grade local de processos por cliente |
| Relatório / dados enriquecidos | `src/data/processosDadosRelatorio.js` | Agrega mock + `getRegistroProcesso` |
| Diagnósticos (dependência) | `src/components/Diagnosticos.jsx` + seeds | Usa dados demo em `processosHistoricoData.js` |

## Persistência atual (encontrado)

| Chave / origem | Uso |
|-----------------|-----|
| `vilareal:processos-historico:v1` | Registro por `codCliente:proc` — campos do formulário e histórico |
| `vilareal:processos-historico:demo-seed-version` | Versão do seed demo |
| `vilareal:processos:edicao-desabilitada-ao-sair:v1` | Preferência de UI |
| `processosMock.js` / `gerarMockProcesso` | Dados base quando não há persistência |
| `financeiroData` | Conta corrente por cliente/processo (fora do escopo Fase 4) |
| `imoveisMockData` | Vínculo mock imóvel × cliente × proc (fora do escopo Fase 4) |

## Endpoints backend (implementados nesta fase)

| Recurso | Métodos | Uso pretendido na UI |
|---------|---------|------------------------|
| `/api/processos` | GET, POST | Lista; filtros `clienteId`, `codigoCliente`, `ativo`; criar processo |
| `/api/processos/{id}` | GET | Detalhe por id técnico |
| `/api/processos/{id}` | PUT | Atualizar (inclui `clienteId` + `numeroInterno`) |
| `/api/processos/{id}/ativo` | PATCH `?value=` | Ativar/inativar |
| `/api/processos/{id}/partes` | GET, POST | Partes |
| `/api/processos/{id}/partes/{parteId}` | PUT, DELETE | |
| `/api/processos/{id}/andamentos` | GET, POST | Histórico |
| `/api/processos/{id}/andamentos/{andamentoId}` | PUT, DELETE | |
| `/api/processos/{id}/prazos` | GET, POST | Prazos |
| `/api/processos/{id}/prazos/{prazoId}` | PUT, DELETE | |
| `/api/processos/{id}/prazos/{prazoId}/cumprimento` | PATCH `?cumprido=` | Marcar cumprimento |

## Feature flag (implementado)

- `VITE_USE_API_PROCESSOS=true` — `featureFlags.useApiProcessos` em `src/config/featureFlags.js`.

Transição **recomendada:** criar `src/repositories/processosRepository.js` (ou `api/processosService.js`) e um único switch por flag, sem `if` espalhado em `Processos.jsx`.

## Gaps que não fecham nesta fase (pendente)

| Gap | Motivo |
|-----|--------|
| Conta corrente / financeiro | Fase 5 |
| Publicações completas | Fase 6 |
| Anexos pesados | Fora do escopo |
| Imóveis vinculados ao processo | Mock atual; tabela dedicada futura |
| Unicidade global de CNJ | Validar na aplicação ou migration futura |
| `processo_ref` na agenda | Já existe string; alinhar com `processos.id` quando migrar agenda |

## Adaptadores necessários (recomendado)

1. **Chave natural → técnica:** `codigoCliente` + `proc` → `GET /api/processos?codigoCliente=&` + filtrar `numeroInterno` **ou** manter mapa local `id` após primeiro GET.
2. **Histórico:** linhas do `localStorage` → `POST /api/processos/{id}/andamentos` com `movimento_em` parseado de `dd/mm/aaaa`.
3. **Partes:** `parteCliente` / `parteOposta` strings → `POST` partes com `polo` `AUTOR`/`REU` e `nome_livre` ou `pessoaId` após resolução.

## Ordem ideal de adaptação (recomendado)

1. Resolver `clienteId` real via `/api/clientes` (já existe).
2. CRUD mínimo de processo por cliente (`numeroInterno` = proc da UI).
3. Sincronizar partes quando a flag estiver ativa.
4. Andamentos e prazos.
5. Desligar gravação em `processosHistoricoData` para chaves migradas.
