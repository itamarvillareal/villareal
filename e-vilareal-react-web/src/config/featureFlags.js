/**
 * Variáveis `VITE_*` — `.env.development` ou `npm run dev:homolog` + `.env.homolog`.
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
  useApiImoveis: import.meta.env.VITE_USE_API_IMOVEIS === 'true',
  useApiTarefas: import.meta.env.VITE_USE_API_TAREFAS === 'true',
  /** Hierarquia da tela Tópicos — `GET /api/topicos/hierarchy`. */
  useApiTopicos: import.meta.env.VITE_USE_API_TOPICOS === 'true',
  /**
   * Tela de login JWT antes do app. Por enquanto fica desligado por padrão.
   * Para voltar a exigir login/senha: `VITE_REQUIRE_API_AUTH=true` no build/env.
   * `VITE_SKIP_API_AUTH=true` força sem login mesmo se REQUIRE estiver ativo.
   */
  requiresApiAuth:
    import.meta.env.VITE_SKIP_API_AUTH === 'true'
      ? false
      : import.meta.env.VITE_REQUIRE_API_AUTH === 'true',
  /**
   * Menu + tela lab «Integrações → DataJud (CNJ) · TJGO» (consulta API pública CNJ via proxy).
   * Requer chave DataJud no dev (`DATAJUD_API_KEY` ou `VITE_DATAJUD_API_KEY` + proxy `/datajud-proxy`).
   * Nome da env mantido por compatibilidade: `VITE_SHOW_TRIBUNAL_SCRAPER_LAB`.
   */
  showTribunalScraperLab: import.meta.env.VITE_SHOW_TRIBUNAL_SCRAPER_LAB === 'true',
};

export function isApiEnabled(flagName) {
  return Boolean(featureFlags[flagName]);
}
