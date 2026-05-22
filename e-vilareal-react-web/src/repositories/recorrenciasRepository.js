import { request } from '../api/httpClient.js';

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

export async function listarRecorrencias(params = {}, opts = {}) {
  return request('/api/pagamentos/recorrencias', { query: limparQuery(params), signal: opts.signal });
}

export async function buscarRecorrencia(id, opts = {}) {
  return request(`/api/pagamentos/recorrencias/${Number(id)}`, { signal: opts.signal });
}

export async function criarRecorrencia(body, opts = {}) {
  return request('/api/pagamentos/recorrencias', { method: 'POST', body, signal: opts.signal });
}

export async function editarRecorrencia(id, body, opts = {}) {
  return request(`/api/pagamentos/recorrencias/${Number(id)}`, { method: 'PUT', body, signal: opts.signal });
}

export async function desativarRecorrencia(id, opts = {}) {
  return request(`/api/pagamentos/recorrencias/${Number(id)}`, { method: 'DELETE', signal: opts.signal });
}

export async function ativarRecorrencia(id, opts = {}) {
  return request(`/api/pagamentos/recorrencias/${Number(id)}/ativar`, { method: 'PATCH', signal: opts.signal });
}

export async function buscarPagamentosGerados(id, params = {}, opts = {}) {
  return request(`/api/pagamentos/recorrencias/${Number(id)}/pagamentos-gerados`, {
    query: limparQuery(params),
    signal: opts.signal,
  });
}

export async function gerarMes(mesAno, opts = {}) {
  const q = mesAno ? { mesAno } : {};
  return request('/api/pagamentos/recorrencias/gerar-mes', {
    method: 'POST',
    query: limparQuery(q),
    signal: opts.signal,
  });
}
