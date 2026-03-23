/**
 * Variáveis `VITE_*` — homologação F1–F5: `npm run dev:homolog` + `.env.homolog` (ver docs/homologation-quick-start.md).
 */
export const featureFlags = {
  useApiUsuarios: import.meta.env.VITE_USE_API_USUARIOS === 'true',
  useApiClientes: import.meta.env.VITE_USE_API_CLIENTES === 'true',
  useApiAgenda: import.meta.env.VITE_USE_API_AGENDA === 'true',
  useApiPessoasComplementares: import.meta.env.VITE_USE_API_PESSOAS_COMPLEMENTARES === 'true',
  useApiPerfisPermissoes: import.meta.env.VITE_USE_API_PERFIS_PERMISSOES === 'true',
  useApiProcessos: import.meta.env.VITE_USE_API_PROCESSOS === 'true',
  useApiFinanceiro: import.meta.env.VITE_USE_API_FINANCEIRO === 'true',
  useApiPublicacoes: import.meta.env.VITE_USE_API_PUBLICACOES === 'true',
  /** Imóveis / contratos / repasses (Fase 7) — integração progressiva com API. */
  useApiImoveis: import.meta.env.VITE_USE_API_IMOVEIS === 'true',
  /** Migração assistida mock `imoveisMockData` → API (prévia + execução explícita; ver docs). */
  enableImoveisMockMigrationPhase7: import.meta.env.VITE_ENABLE_IMOVEIS_MOCK_MIGRATION_PHASE7 === 'true',
  enableLocalStorageImportPhase5Financeiro:
    import.meta.env.VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO === 'true',
  /** Migração assistida vilareal.processos.publicacoes.v2 → API (UI/execução em evolução). */
  enableLocalStorageImportPhase6Publicacoes:
    import.meta.env.VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES === 'true',
  /** Tarefas operacionais (Fase 8) — integração progressiva com API. */
  useApiTarefas: import.meta.env.VITE_USE_API_TAREFAS === 'true',
};

export function isApiEnabled(flagName) {
  return Boolean(featureFlags[flagName]);
}
