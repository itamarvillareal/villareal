import { request } from './httpClient.js';

/** Dispara a importação de extrato Cora via Gmail (mesmo fluxo do scheduler). */
export async function processarExtratoCoraEmail({ incluirLidos = false } = {}) {
  const qs = incluirLidos ? '?incluirLidos=true' : '';
  return request(`/api/email/extrato-cora/processar${qs}`, { method: 'POST' });
}
