import { API_BASE_URL } from '../api/config.js';
import { getAccessToken } from '../api/authTokenStorage.js';
import { emitApiUnauthorized } from '../api/apiAuthHeaders.js';
import { request } from '../api/httpClient.js';

const BASE = '/api/documentos/contratos-honorarios/importar';

function authHeaders() {
  const h = { Accept: 'application/json' };
  const t = getAccessToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function parseError(res) {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.message || j.error || text;
  } catch {
    return text || `Erro ${res.status}`;
  }
}

export async function uploadLoteImportacao({ arquivos, codigoCliente, processoId, signal }) {
  const form = new FormData();
  for (const f of arquivos) {
    form.append('arquivos', f);
  }
  if (codigoCliente) form.append('codigoCliente', codigoCliente);
  if (processoId) form.append('processoId', String(processoId));
  const res = await fetch(`${API_BASE_URL}${BASE}/lote`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
    signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function statusLoteImportacao(loteId, { signal } = {}) {
  return request(`${BASE}/lote/${encodeURIComponent(loteId)}`, { signal });
}

export async function listarFilaImportacao({ status, codigoCliente, importacaoLoteId, page = 0, size = 20, signal } = {}) {
  const qs = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) qs.set('status', status);
  if (codigoCliente) qs.set('codigoCliente', codigoCliente);
  if (importacaoLoteId) qs.set('importacaoLoteId', importacaoLoteId);
  return request(`${BASE}/fila?${qs}`, { signal });
}

export async function obterImportacao(id, { signal } = {}) {
  return request(`${BASE}/${id}`, { signal });
}

export async function salvarRevisaoImportacao(id, body, { signal } = {}) {
  return request(`${BASE}/${id}/revisao`, { method: 'PATCH', body, signal });
}

export async function aprovarImportacao(id, body, { signal } = {}) {
  return request(`${BASE}/${id}/aprovar`, { method: 'POST', body, signal });
}

export async function rejeitarImportacao(id, { signal } = {}) {
  return request(`${BASE}/${id}/rejeitar`, { method: 'POST', signal });
}

export async function reverterImportacao(id, { signal } = {}) {
  return request(`${BASE}/${id}`, { method: 'DELETE', signal });
}

export async function conciliarRetroativoImportacao(id, { signal } = {}) {
  return request(`${BASE}/${id}/conciliar-retroativo`, { method: 'POST', signal });
}

export async function extratoCoberturaImportacao({ de, ate, signal } = {}) {
  const qs = new URLSearchParams();
  if (de) qs.set('de', de);
  if (ate) qs.set('ate', ate);
  const q = qs.toString();
  return request(`${BASE}/extrato-cobertura${q ? `?${q}` : ''}`, { signal });
}

export async function armarCobrancaHonorarios(body, { signal } = {}) {
  return request(`${BASE}/cobranca/armar`, { method: 'POST', body, signal });
}

export async function desarmarCobrancaHonorarios(contratoHonorariosIds, { signal } = {}) {
  return request(`${BASE}/cobranca/desarmar`, { method: 'POST', body: contratoHonorariosIds, signal });
}

export async function relatorioCensoHonorarios({ signal } = {}) {
  return request(`${BASE}/relatorio/censo`, { signal });
}

export async function listarExpectativasContingentes({ signal } = {}) {
  return request('/api/honorarios/expectativas-contingentes', { signal });
}
