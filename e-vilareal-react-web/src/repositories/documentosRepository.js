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
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 1000);
}

export function nomeArquivoPeticaoPdf(sufixo) {
  const base = sufixo
    ? String(sufixo)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40)
    : 'peticao';
  return `${base}_${new Date().toISOString().split('T')[0]}.pdf`;
}

function headersMultipart() {
  const h = { ...buildAuditoriaHeaders() };
  const t = getAccessToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

/**
 * Envia Word (.docx) ou PDF e devolve PDF com identidade visual do escritório.
 */
export async function formatarArquivoPdf(arquivo, opts = {}) {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  if (opts.enderecamento) fd.append('enderecamento', opts.enderecamento);
  if (opts.numeroProcesso) fd.append('numeroProcesso', opts.numeroProcesso);
  if (opts.cidadeEstado) fd.append('cidadeEstado', opts.cidadeEstado);
  if (opts.data) fd.append('data', opts.data);
  if (opts.codigoCliente) fd.append('codigoCliente', String(opts.codigoCliente));
  if (opts.numeroInterno != null && opts.numeroInterno !== '') {
    fd.append('numeroInterno', String(opts.numeroInterno));
  }
  if (opts.preview) fd.append('preview', 'true');

  const res = await fetch(`${API_BASE_URL}/api/documentos/reformatar`, {
    method: 'POST',
    headers: headersMultipart(),
    body: fd,
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.blob();
}

/**
 * Extrai conteúdo editável de Word/PDF para prévia antes do PDF final.
 */
export async function extrairConteudoArquivo(arquivo, opts = {}) {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  if (opts.enderecamento) fd.append('enderecamento', opts.enderecamento);
  if (opts.numeroProcesso) fd.append('numeroProcesso', opts.numeroProcesso);
  if (opts.cidadeEstado) fd.append('cidadeEstado', opts.cidadeEstado);
  if (opts.data) fd.append('data', opts.data);

  const res = await fetch(`${API_BASE_URL}/api/documentos/reformatar/conteudo`, {
    method: 'POST',
    headers: headersMultipart(),
    body: fd,
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.json();
}

/**
 * Gera PDF a partir do conteúdo editado na prévia (modo reformatado).
 */
export async function gerarPdfReformatado(conteudo, opts = {}) {
  const params = new URLSearchParams();
  if (opts.preview) params.set('preview', 'true');
  if (opts.nomeArquivo) params.set('nomeArquivo', opts.nomeArquivo);
  if (opts.codigoCliente) params.set('codigoCliente', String(opts.codigoCliente));
  if (opts.numeroInterno != null && opts.numeroInterno !== '') {
    params.set('numeroInterno', String(opts.numeroInterno));
  }
  const qs = params.toString();
  const url = `${API_BASE_URL}/api/documentos/reformatar/gerar-pdf${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: headersJson(),
    body: JSON.stringify(conteudo),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.blob();
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

/** Gera a petição de Execução de Taxa Condominial (PDF). Retorna Blob. */
export function gerarPeticaoExecucao(body, opts = {}) {
  return postPdf('/api/documentos/peticao-execucao', body, opts);
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
