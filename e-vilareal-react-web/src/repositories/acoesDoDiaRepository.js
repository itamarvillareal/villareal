import { request } from '../api/httpClient.js';

/** @param {{ competencia?: string }} params */
export async function obterAcoesDoDiaApi(params = {}) {
  const { competencia } = params;
  return request('/api/acoes-do-dia', {
    query: { competencia: competencia || undefined },
  });
}
