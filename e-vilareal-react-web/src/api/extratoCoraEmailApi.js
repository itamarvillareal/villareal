import { request } from './httpClient.js';

/** Dispara a importação de extrato Cora via Gmail (mesmo fluxo do scheduler). */
export async function processarExtratoCoraEmail({ reprocessar = false } = {}) {
  const qs = reprocessar ? '?incluirLidos=true' : '';
  return request(`/api/email/extrato-cora/processar${qs}`, { method: 'POST' });
}
