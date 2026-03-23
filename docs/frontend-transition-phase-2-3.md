# Transição frontend (Fase 2 e 3)

## Critério

- Foco apenas em usuários/permissões e clientes/agenda mínima.
- Sem entrar ainda em processos/financeiro/imóveis/publicações completas.

## Matriz de transição por módulo/tela

| Módulo/Tela | Situação atual | Endpoint correspondente (novo/existente) | Adaptação necessária | Risco | Prioridade |
|---|---|---|---|---|---|
| `Usuarios.jsx` | `localStorage` via `agendaPersistenciaData` | `GET/POST/PUT /api/usuarios`, `PATCH /api/usuarios/{id}/ativo`, `PUT /api/usuarios/{id}/perfis` | Criar `src/api/usuariosService.js`; trocar `getUsuariosAtivos/setUsuariosAtivos` por API com fallback local | Médio | Alta |
| `ModalPermissoesUsuario.jsx` | permissões locais por módulo | `GET/POST /api/permissoes`, `GET/POST/PUT /api/perfis`, `PUT /api/perfis/{id}/permissoes` | Consumir catálogo real de permissões e perfis; remover persistência local de ACL gradualmente | Médio | Alta |
| `Sidebar` (controle de acesso) | usa `usuarioPermissoesStorage.js` | mesmos endpoints de usuário/perfil/permissão | Criar carregamento de permissões no boot da sessão; manter cache local transitório só de leitura | Médio | Alta |
| `Agenda.jsx` | eventos persistidos localmente | `GET/POST/PUT/DELETE /api/agenda/eventos`, `PATCH /api/agenda/eventos/{id}/status-curto` | Criar `agendaService.js`; substituir operações de create/update por API; manter lógica de recorrência avançada local nesta fase | Médio | Alta |
| `CadastroClientes.jsx` | persistência local por código | `GET/POST/PUT /api/clientes`, `GET /api/clientes/{id}` | Criar `clientesCadastroService.js`; mapear `codigo` ↔ `codigo_cliente`; manter fallback local por feature-flag | Médio | Alta |
| `CadastroPessoas.jsx` (campos complementares) | backend parcial + campos civis locais | `GET/PUT /api/pessoas/{id}/complementares` + endpoints já existentes de pessoas | Ao carregar/salvar ficha, unir payload de pessoa base + complemento | Baixo/Médio | Média |
| `Atividade.jsx` | já em API real | `/api/auditoria/atividades` (existente) | Sem mudança nesta fase | Baixo | Baixa |
| `MonitoringPeoplePage.jsx` | já em API real | `/api/monitoring/*` (existente) | Sem mudança nesta fase | Baixo | Baixa |

---

## Módulos que continuam mock/localStorage nesta etapa

- `Processos.jsx` e base de histórico processual
- `Financeiro.jsx` e `financeiroData.js`
- `PublicacoesProcessos.jsx` (`publicacoesStorage.js`)
- `Imoveis*.jsx` (`imoveisMockData.js`)
- `Calculos.jsx` e rodadas locais

## Estratégia prática de rollout sem quebra

1. Introduzir novos serviços de API no frontend (`usuariosService`, `perfisService`, `permissoesService`, `agendaService`, `clientesServiceV2`, `pessoasComplementaresService`).
2. Ativar por flag de ambiente:
   - `VITE_USE_API_USUARIOS_PERMISSOES`
   - `VITE_USE_API_CLIENTES_AGENDA`
3. Fallback:
   - se API indisponível, manter leitura local temporária para telas críticas.
4. Migração de dados local → backend:
   - exportar usuários/permissões/eventos/clientes do `localStorage`;
   - importar via endpoints administrativos em lote.
5. Após estabilizar:
   - remover escrita local dos módulos migrados;
   - manter localStorage apenas para preferências visuais.

---

## Riscos e mitigação

- **Risco:** divergência de IDs entre dados locais e banco.
  - **Mitigação:** migração inicial em lote com tabela de correspondência temporária.
- **Risco:** tela depender de campos ainda não expostos.
  - **Mitigação:** contratos DTO explícitos e testes de integração frontend/backend por tela.
- **Risco:** múltiplos usuários alterando agenda simultaneamente.
  - **Mitigação:** backend como fonte única e ordenação por `updated_at`.
