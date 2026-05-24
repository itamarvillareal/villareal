import { request } from './httpClient.js';

/**
 * Publicações importadas automaticamente via Gmail/Jusbrasil (origem MONITORAMENTO).
 */
export async function buscarPublicacoesEmail({ texto, status } = {}) {
  const data = await request('/api/publicacoes', {
    query: {
      origemImportacao: 'MONITORAMENTO',
      texto: texto || undefined,
      status: status || undefined,
    },
  });
  return Array.isArray(data) ? data : [];
}

/** Dispara importação manual (mesmo fluxo do scheduler). */
export async function processarEmailsAgora() {
  return request('/api/email/publicacoes/processar', { method: 'POST' });
}
