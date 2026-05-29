import { listarPublicacoesModulo } from '../repositories/publicacoesRepository.js';
import { request } from './httpClient.js';

/**
 * Manifestações importadas via Gmail (sistema-projudi@tjgo.jus.br).
 */
export async function buscarManifestacoesProjudi({ texto, status, filtroVinculo } = {}) {
  return listarPublicacoesModulo({
    origemImportacao: 'PROJUDI',
    texto: texto || undefined,
    statusTratamento: status || undefined,
    filtroVinculo: filtroVinculo || 'todos',
  });
}

/** Status da última busca incremental no Gmail. */
export async function obterSyncProjudi() {
  return request('/api/email/projudi/sync');
}

/** Busca incremental (desde última sincronização) ou caixa completa com `forcar: true`. */
export async function processarEmailsProjudiAgora({ forcar = false } = {}) {
  const qs = forcar ? '?forcar=true' : '';
  return request(`/api/email/projudi/processar${qs}`, { method: 'POST' });
}
