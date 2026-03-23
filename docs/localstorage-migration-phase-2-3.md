# Migracao LocalStorage Fase 2-3

## Chaves identificadas
- `vilareal:agenda-usuarios:v2`
- `vilareal.usuarios.permissoes.v1`
- `vilareal:cadastro-clientes-dados:v1`
- `vilareal:agenda-eventos:v1`

## Estrategia implementada
- Utilitario central: `src/services/localStorageMigrationPhase23.js`.
- Execucao controlada por `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23=true`.
- Execucao unica por ambiente com marcador `vilareal:migration:phase2-3:done:v1`.

## Regras de seguranca
- Usuarios: importa apenas IDs ainda inexistentes.
- Clientes: upsert por `codigoCliente` (via repositorio).
- Agenda: evita duplicacao por combinacao `data + usuario + hora + descricao`.
- Se a flag estiver desligada, nao existe importacao automatica.

## Modulos com risco maior
- Perfis/permissoes: legado por usuario e novo modelo RBAC podem divergir sem catalogo final fechado.
- CadastroClientes: processos ainda permanecem em persistencia local nesta fase.

## Operacao recomendada
- Ativar uma flag por vez em homologacao.
- Rodar com importacao ligada somente no primeiro bootstrap.
- Desligar `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23` apos importar.
