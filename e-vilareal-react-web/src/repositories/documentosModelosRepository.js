import { API_BASE_URL } from '../api/config.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { getAccessToken } from '../api/authTokenStorage.js';
import { emitApiUnauthorized } from '../api/apiAuthHeaders.js';
import { parseApiJsonResponse } from '../api/parseApiResponse.js';
import { request } from '../api/httpClient.js';

export const MAX_CABECALHO_MODELO_BYTES = 2 * 1024 * 1024;
export const CABECALHO_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/jpg'];

function headersAuth() {
  const h = { ...buildAuditoriaHeaders() };
  const t = getAccessToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function parseError(res) {
  const text = await res.text();
  if (!text) return `Erro ${res.status}`;
  try {
    const data = JSON.parse(text);
    return data.message || data.error || text;
  } catch {
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  }
}

function montarFormData(dados, cabecalhoFile) {
  const fd = new FormData();
  fd.append(
    'dados',
    new Blob([JSON.stringify(dados)], { type: 'application/json' }),
  );
  if (cabecalhoFile) {
    fd.append('cabecalho', cabecalhoFile);
  }
  return fd;
}

export function validarArquivoCabecalhoModelo(arquivo) {
  if (!arquivo) return null;
  const type = (arquivo.type || '').toLowerCase();
  if (!CABECALHO_TIPOS_PERMITIDOS.includes(type)) {
    return 'Imagem de cabeçalho deve ser JPEG ou PNG.';
  }
  if (arquivo.size > MAX_CABECALHO_MODELO_BYTES) {
    return 'Imagem de cabeçalho excede o limite de 2 MB.';
  }
  return null;
}

export async function listarModelosDocumento(opts = {}) {
  const data = await request('/api/documentos/modelos', { signal: opts.signal });
  return Array.isArray(data) ? data : [];
}

export async function buscarModeloDocumento(id, opts = {}) {
  return request(`/api/documentos/modelos/${Number(id)}`, { signal: opts.signal });
}

export async function buscarCabecalhoModeloBlob(id, opts = {}) {
  const authTokenSnapshotAtRequest = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/documentos/modelos/${Number(id)}/cabecalho`, {
    headers: headersAuth(),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.blob();
}

export async function criarModeloDocumento(dados, cabecalhoFile, opts = {}) {
  const authTokenSnapshotAtRequest = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/documentos/modelos`, {
    method: 'POST',
    headers: headersAuth(),
    body: montarFormData(dados, cabecalhoFile),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  return parseApiJsonResponse(res, { authTokenSnapshotAtRequest });
}

export async function atualizarModeloDocumento(id, dados, cabecalhoFile, opts = {}) {
  const authTokenSnapshotAtRequest = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/documentos/modelos/${Number(id)}`, {
    method: 'PUT',
    headers: headersAuth(),
    body: montarFormData(dados, cabecalhoFile),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  return parseApiJsonResponse(res, { authTokenSnapshotAtRequest });
}

export async function excluirModeloDocumento(id, opts = {}) {
  const authTokenSnapshotAtRequest = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/documentos/modelos/${Number(id)}`, {
    method: 'DELETE',
    headers: headersAuth(),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok && res.status !== 204) {
    throw new Error(await parseError(res));
  }
}

export async function previewModeloDocumentoPdf(dados, cabecalhoFile, opts = {}) {
  const authTokenSnapshotAtRequest = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/documentos/modelos/preview-pdf`, {
    method: 'POST',
    headers: headersAuth(),
    body: montarFormData(dados, cabecalhoFile),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.blob();
}
