import { listarPublicacoesModulo } from '../repositories/publicacoesRepository.js';
import { request } from './httpClient.js';

/**
 * Publicações importadas automaticamente via Gmail/Jusbrasil (origem MONITORAMENTO).
 */
export async function buscarPublicacoesEmail({ texto, status, filtroVinculo } = {}) {
  return listarPublicacoesModulo({
    origemImportacao: 'MONITORAMENTO',
    texto: texto || undefined,
    statusTratamento: status || undefined,
    filtroVinculo: filtroVinculo || 'todos',
  });
}

/** Dispara importação manual (mesmo fluxo do scheduler). */
export async function processarEmailsAgora() {
  return request('/api/email/publicacoes/processar', { method: 'POST' });
}
