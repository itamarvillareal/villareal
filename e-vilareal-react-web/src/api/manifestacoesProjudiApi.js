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

/** Dispara importação manual (últimos 7 dias, inclusive já lidos). */
export async function processarEmailsProjudiAgora() {
  return request('/api/email/projudi/processar', { method: 'POST' });
}
