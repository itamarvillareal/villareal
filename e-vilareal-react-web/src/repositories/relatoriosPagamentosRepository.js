import { request } from '../api/httpClient.js';

function limparQuery(q) {
  const out = {};
  if (!q) return out;
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}

export async function buscarGastosPorImovel(params = {}, opts = {}) {
  return request('/api/relatorios/pagamentos/gastos-por-imovel', {
    query: limparQuery(params),
    signal: opts.signal,
  });
}

export async function buscarComparativoMensal(params = {}, opts = {}) {
  return request('/api/relatorios/pagamentos/comparativo-mensal', {
    query: limparQuery(params),
    signal: opts.signal,
  });
}

export async function buscarLucratividade(params = {}, opts = {}) {
  return request('/api/relatorios/pagamentos/lucratividade', {
    query: limparQuery(params),
    signal: opts.signal,
  });
}

export async function buscarEficiencia(params = {}, opts = {}) {
  return request('/api/relatorios/pagamentos/eficiencia', {
    query: limparQuery(params),
    signal: opts.signal,
  });
}

export async function buscarPendencias(opts = {}) {
  return request('/api/relatorios/pagamentos/pendencias', { signal: opts.signal });
}
