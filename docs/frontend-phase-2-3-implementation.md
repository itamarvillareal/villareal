# Frontend Fase 2-3 - Implementacao

## A) Telas adaptadas
- `Usuarios` integrado com `GET/POST/PUT/PATCH /api/usuarios` via `usuariosRepository`.
- `ModalPermissoesUsuario` integrado com `GET/POST/PUT /api/perfis` e `GET/POST /api/permissoes` via `perfisPermissoesRepository`.
- `Agenda` integrada com `GET/POST/PUT /api/agenda/eventos` via `agendaRepository`.
- `CadastroClientes` integrado ao backend de `clientes` para dados principais via `clientesRepository`.
- `CadastroPessoas` integrado com `GET/PUT /api/pessoas/{id}/complementares` via `pessoasComplementaresRepository`.

## B) Endpoints usados
- `/api/usuarios`
- `/api/usuarios/{id}`
- `/api/usuarios/{id}/ativo`
- `/api/usuarios/{id}/perfis`
- `/api/perfis`
- `/api/perfis/{id}/permissoes`
- `/api/permissoes`
- `/api/clientes`
- `/api/clientes/{id}`
- `/api/agenda/eventos`
- `/api/agenda/eventos/{id}`
- `/api/pessoas/{id}/complementares`

## C) Flags criadas
- `VITE_USE_API_USUARIOS`
- `VITE_USE_API_CLIENTES`
- `VITE_USE_API_AGENDA`
- `VITE_USE_API_PESSOAS_COMPLEMENTARES`
- `VITE_USE_API_PERFIS_PERMISSOES`
- `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23`

## D) Encontrado vs inferido vs adaptado vs pendente
- Encontrado no frontend: uso forte de `localStorage` em `agendaPersistenciaData`, `usuarioPermissoesStorage`, `cadastroClientesStorage`.
- Inferido: modulo `CadastroClientes` mistura cadastro de cliente com dados locais de processos; apenas parte de cliente foi migrada.
- Adaptado: servicos e repositorios com fallback por flag centralizado em `featureFlags`.
- Pendente: remover acoplamentos restantes de processos no `CadastroClientes` e consolidar ACL sem perfil tecnico por usuario.

## E) UX minima aplicada
- Loading e erro adicionados em `Usuarios` e `ModalPermissoesUsuario`.
- Atualizacao visual apos salvar em usuarios e agenda por recarga controlada.
- Estado vazio mantido onde ja existia e preservado no fallback.

## F) Producao controlada
- Pronto para ativacao gradual por modulo com flags.
- Fallback local preservado em todos os modulos priorizados.
- Migracao assistida desacoplada por `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23`.
