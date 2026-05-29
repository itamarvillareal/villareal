import { request } from '../api/httpClient.js';

const BASE = '/api/demandas';

function limparQuery(q) {
  const out = {};
  if (!q) return out;
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}

export async function fetchDemandas(filtros = {}, opts = {}) {
  return request(BASE, { query: limparQuery(filtros), signal: opts.signal });
}

export async function fetchDemanda(id, opts = {}) {
  return request(`${BASE}/${Number(id)}`, { signal: opts.signal });
}

export async function criarDemanda(body, opts = {}) {
  return request(BASE, { method: 'POST', body, signal: opts.signal });
}

export async function editarDemanda(id, body, opts = {}) {
  return request(`${BASE}/${Number(id)}`, { method: 'PUT', body, signal: opts.signal });
}

export async function excluirDemanda(id, opts = {}) {
  return request(`${BASE}/${Number(id)}`, { method: 'DELETE', signal: opts.signal });
}

export async function alterarStatusDemanda(id, status, opts = {}) {
  return request(`${BASE}/${Number(id)}/status`, { method: 'POST', body: { status }, signal: opts.signal });
}

export async function vincularPagamentoDemanda(id, pagamentoId, opts = {}) {
  return request(`${BASE}/${Number(id)}/vincular-pagamento`, {
    method: 'POST',
    body: { pagamentoId },
    signal: opts.signal,
  });
}

export async function criarPagamentoAutomaticoDemanda(id, body = {}, opts = {}) {
  return request(`${BASE}/${Number(id)}/criar-pagamento`, { method: 'POST', body, signal: opts.signal });
}

export async function desvincularPagamentoDemanda(id, opts = {}) {
  return request(`${BASE}/${Number(id)}/desvincular-pagamento`, { method: 'POST', signal: opts.signal });
}

export async function fetchMetricasDemandas(filtros = {}, opts = {}) {
  return request(`${BASE}/metricas`, { query: limparQuery(filtros), signal: opts.signal });
}

export async function fetchAcertoImovel(imovelId, opts = {}) {
  return request(`${BASE}/acerto/${Number(imovelId)}`, { signal: opts.signal });
}

export async function fetchHistoricoDemanda(id, opts = {}) {
  return request(`${BASE}/${Number(id)}/historico`, { signal: opts.signal });
}
