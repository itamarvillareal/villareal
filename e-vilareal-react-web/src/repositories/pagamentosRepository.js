import { API_BASE_URL } from '../api/config.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { getAccessToken } from '../api/authTokenStorage.js';
import { emitApiUnauthorized } from '../api/apiAuthHeaders.js';
import { request, postFormData } from '../api/httpClient.js';

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

export async function listarPagamentos(filtros = {}, opts = {}) {
  const { signal } = opts;
  return request('/api/pagamentos', { query: limparQuery(filtros), signal });
}

export async function buscarPagamento(id, opts = {}) {
  return request(`/api/pagamentos/${Number(id)}`, { signal: opts.signal });
}

export async function criarPagamento(body, opts = {}) {
  return request('/api/pagamentos', { method: 'POST', body, signal: opts.signal });
}

export async function atualizarPagamento(id, body, opts = {}) {
  return request(`/api/pagamentos/${Number(id)}`, { method: 'PUT', body, signal: opts.signal });
}

export async function excluirPagamento(id, opts = {}) {
  return request(`/api/pagamentos/${Number(id)}`, { method: 'DELETE', signal: opts.signal });
}

export async function cancelarPagamento(id, observacao, opts = {}) {
  const body = observacao != null && String(observacao).trim() !== '' ? { observacao: String(observacao).trim() } : {};
  return request(`/api/pagamentos/${Number(id)}/cancelar`, { method: 'POST', body, signal: opts.signal });
}

export async function marcarPagamentoAgendado(id, opts = {}) {
  return request(`/api/pagamentos/${Number(id)}/marcar-agendado`, { method: 'POST', signal: opts.signal });
}

export async function marcarPagamentoPago(id, payload, opts = {}) {
  return request(`/api/pagamentos/${Number(id)}/marcar-pago`, { method: 'POST', body: payload, signal: opts.signal });
}

export async function substituirPagamento(id, novoPagamentoId, opts = {}) {
  return request(`/api/pagamentos/${Number(id)}/substituir`, {
    method: 'POST',
    query: { novoPagamentoId: Number(novoPagamentoId) },
    signal: opts.signal,
  });
}

export async function listarHistoricoPagamento(id, opts = {}) {
  return request(`/api/pagamentos/${Number(id)}/historico`, { signal: opts.signal });
}

export async function carregarDashboardPagamentos(ano, mes, opts = {}) {
  const q = {};
  if (ano != null) q.ano = ano;
  if (mes != null) q.mes = mes;
  return request('/api/pagamentos/dashboard', { query: q, signal: opts.signal });
}

export async function carregarAlertasPagamentos(opts = {}) {
  return request('/api/pagamentos/alertas', { signal: opts.signal });
}

export async function anexarBoletoPagamento(id, file, opts = {}) {
  const fd = new FormData();
  fd.append('file', file);
  return postFormData(`/api/pagamentos/${Number(id)}/anexo-boleto`, fd, opts);
}

export async function anexarComprovantePagamento(id, file, opts = {}) {
  const fd = new FormData();
  fd.append('file', file);
  return postFormData(`/api/pagamentos/${Number(id)}/anexo-comprovante`, fd, opts);
}

/**
 * Descarrega anexo (boleto ou comprovante) como Blob.
 * @param {'boleto'|'comprovante'} tipo
 */
export async function baixarAnexoPagamento(id, tipo, opts = {}) {
  const path = tipo === 'comprovante' ? 'comprovante' : 'boleto';
  const url = `${API_BASE_URL}/api/pagamentos/${Number(id)}/download/${path}`;
  const res = await fetch(url, { method: 'GET', headers: headersDownload(), signal: opts.signal });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro ${res.status} ao baixar anexo.`);
  }
  return res.blob();
}
