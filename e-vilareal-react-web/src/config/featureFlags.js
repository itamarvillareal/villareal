/**
 * Variáveis `VITE_*` — `.env.development` ou `npm run dev:homolog` + `.env.homolog`.
 */
const mockCadastroPessoas = import.meta.env.VITE_USE_MOCK_CADASTRO_PESSOAS === 'true';

export const featureFlags = {
  useApiUsuarios: import.meta.env.VITE_USE_API_USUARIOS === 'true',
  useApiClientes: import.meta.env.VITE_USE_API_CLIENTES === 'true',
  useApiAgenda: import.meta.env.VITE_USE_API_AGENDA === 'true',
  useApiPessoasComplementares: import.meta.env.VITE_USE_API_PESSOAS_COMPLEMENTARES === 'true',
  useApiPerfisPermissoes: import.meta.env.VITE_USE_API_PERFIS_PERMISSOES === 'true',
  useApiProcessos: import.meta.env.VITE_USE_API_PROCESSOS === 'true',
  useApiFinanceiro: import.meta.env.VITE_USE_API_FINANCEIRO === 'true',
  useApiPublicacoes: import.meta.env.VITE_USE_API_PUBLICACOES === 'true',
  useApiImoveis: import.meta.env.VITE_USE_API_IMOVEIS === 'true',
  useApiTarefas: import.meta.env.VITE_USE_API_TAREFAS === 'true',
  /** Hierarquia da tela Tópicos — `GET /api/topicos/hierarchy`. */
  useApiTopicos: import.meta.env.VITE_USE_API_TOPICOS === 'true',
  /**
   * Exige tela de login JWT antes do app quando há integração real com `/api` no backend.
   * Desative com `VITE_SKIP_API_AUTH=true` (ex.: só mock local).
   */
  requiresApiAuth:
    import.meta.env.VITE_SKIP_API_AUTH === 'true'
      ? false
      : import.meta.env.VITE_BACKEND_JWT === 'true' ||
        import.meta.env.VITE_USE_API_USUARIOS === 'true' ||
        import.meta.env.VITE_USE_API_PESSOAS_COMPLEMENTARES === 'true' ||
        import.meta.env.VITE_USE_API_TOPICOS === 'true' ||
        import.meta.env.VITE_USE_API_PROCESSOS === 'true' ||
        import.meta.env.VITE_USE_API_FINANCEIRO === 'true' ||
        mockCadastroPessoas === false,
};

export function isApiEnabled(flagName) {
  return Boolean(featureFlags[flagName]);
}
