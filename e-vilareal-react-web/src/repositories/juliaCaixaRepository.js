import { request } from '../api/httpClient.js';

const BASE = '/api/julia/caixa';

export async function fetchJuliaCaixa(status = 'AGUARDANDO_VOCE', opts = {}) {
  return request(BASE, { query: { status }, signal: opts.signal });
}

export async function patchJuliaCaixa(triagemId, body, opts = {}) {
  return request(`${BASE}/${Number(triagemId)}`, {
    method: 'PATCH',
    body,
    signal: opts.signal,
  });
}
