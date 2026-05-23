import { API_BASE_URL } from '../api/config.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { getAccessToken } from '../api/authTokenStorage.js';
import { emitApiUnauthorized } from '../api/apiAuthHeaders.js';
import { request } from '../api/httpClient.js';

function headersJson() {
  const h = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...buildAuditoriaHeaders(),
  };
  const t = getAccessToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function parseErrorResponse(res) {
  const text = await res.text();
  if (!text) return `Erro ${res.status}`;
  try {
    const data = JSON.parse(text);
    return data.message || data.error || text;
  } catch {
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  }
}

async function postPdf(path, body, { signal } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: headersJson(),
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.blob();
}

export function downloadPdfBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export function nomeArquivoPeticaoPdf() {
  return `peticao_${new Date().toISOString().split('T')[0]}.pdf`;
}

export async function gerarPdfComIA(dados, opts = {}) {
  const blob = await postPdf('/api/documentos/gerar-pdf-ia', dados, opts);
  return blob;
}

export async function gerarPdfManual(dados, opts = {}) {
  const blob = await postPdf('/api/documentos/gerar-pdf', dados, opts);
  return blob;
}

export async function gerarPreviewIA(dados, opts = {}) {
  return request('/api/documentos/gerar-conteudo-ia', {
    method: 'POST',
    body: dados,
    signal: opts.signal,
  });
}

export async function gerarProcuracao({ pessoaId, cidadeEstado, data }, opts = {}) {
  const body = { pessoaId: Number(pessoaId) };
  if (cidadeEstado) body.cidadeEstado = cidadeEstado;
  if (data) body.data = data;
  return postPdf('/api/documentos/procuracao', body, opts);
}

export function nomeArquivoProcuracaoPdf(nomeOutorgante) {
  const base = (nomeOutorgante || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return `procuracao_${base || 'cliente'}.pdf`;
}
