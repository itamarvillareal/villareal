import { API_BASE_URL } from '../api/config.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { getAccessToken } from '../api/authTokenStorage.js';
import { emitApiUnauthorized } from '../api/apiAuthHeaders.js';
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

function headersDownload() {
  const h = { ...buildAuditoriaHeaders() };
  const t = getAccessToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export async function buscarPagamentosPendentesPrestacao(params = {}, opts = {}) {
  return request('/api/prestacao-contas/pagamentos-pendentes', {
    query: limparQuery(params),
    signal: opts.signal,
  });
}

export async function criarPrestacaoContas(body, opts = {}) {
  return request('/api/prestacao-contas', { method: 'POST', body, signal: opts.signal });
}

export async function listarPrestacaoContas(filtros = {}, opts = {}) {
  return request('/api/prestacao-contas', { query: limparQuery(filtros), signal: opts.signal });
}

export async function buscarPrestacaoContas(id, opts = {}) {
  return request(`/api/prestacao-contas/${Number(id)}`, { signal: opts.signal });
}

export async function atualizarPrestacaoContas(id, body, opts = {}) {
  return request(`/api/prestacao-contas/${Number(id)}`, { method: 'PUT', body, signal: opts.signal });
}

export async function excluirPrestacaoContas(id, opts = {}) {
  return request(`/api/prestacao-contas/${Number(id)}`, { method: 'DELETE', signal: opts.signal });
}

export async function enviarPrestacaoContas(id, opts = {}) {
  return request(`/api/prestacao-contas/${Number(id)}/enviar`, { method: 'POST', signal: opts.signal });
}

export async function aprovarPrestacaoContas(id, opts = {}) {
  return request(`/api/prestacao-contas/${Number(id)}/aprovar`, { method: 'POST', signal: opts.signal });
}

export async function baixarPdfPrestacaoContas(id, opts = {}) {
  const url = `${API_BASE_URL}/api/prestacao-contas/${Number(id)}/pdf`;
  const res = await fetch(url, { method: 'GET', headers: headersDownload(), signal: opts.signal });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro ${res.status} ao baixar PDF.`);
  }
  return res.blob();
}
