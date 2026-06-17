import { listarPublicacoesModulo } from '../repositories/publicacoesRepository.js';
import { request } from './httpClient.js';

/**
 * Publicações importadas automaticamente via Gmail/Jusbrasil (origem MONITORAMENTO).
 */
export async function buscarPublicacoesEmail({ texto, status, filtroVinculo, recebimentoInicio, recebimentoFim } = {}) {
  return listarPublicacoesModulo({
    origemImportacao: 'MONITORAMENTO',
    texto: texto || undefined,
    statusTratamento: status || undefined,
    filtroVinculo: filtroVinculo || 'todos',
    recebimentoInicio: recebimentoInicio || undefined,
    recebimentoFim: recebimentoFim || undefined,
  });
}

/** Status da última busca incremental no Gmail. */
export async function obterSyncPublicacoesEmail() {
  return request('/api/email/publicacoes/sync');
}

/** Busca incremental (desde última sincronização) ou caixa completa com `forcar: true`. */
export async function processarEmailsAgora({ forcar = false } = {}) {
  const qs = forcar ? '?forcar=true' : '';
  return request(`/api/email/publicacoes/processar${qs}`, { method: 'POST' });
}
