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

import { dispararDownloadBlob } from '../utils/streamFileDownload.js';

export function downloadPdfBlob(blob, filename) {
  dispararDownloadBlob(blob, filename);
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
  if (opts.processoId != null && opts.processoId !== '') {
    fd.append('processoId', String(opts.processoId));
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

  const body = { ...conteudo };
  if (opts.processoId != null && opts.processoId !== '') {
    body.processoId = Number(opts.processoId);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: headersJson(),
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.blob();
}

/**
 * Gera o PDF final (mesmo de gerarPdfReformatado) e insere na pasta Assinar + cópia na pasta do processo.
 */
export async function inserirPdfReformatadoNaPastaAssinar(conteudo, opts = {}) {
  const params = new URLSearchParams();
  if (opts.nomeArquivo) params.set('nomeArquivo', opts.nomeArquivo);
  if (opts.codigoCliente) params.set('codigoCliente', String(opts.codigoCliente));
  if (opts.numeroInterno != null && opts.numeroInterno !== '') {
    params.set('numeroInterno', String(opts.numeroInterno));
  }
  if (opts.processoId != null && opts.processoId !== '') {
    params.set('processoId', String(opts.processoId));
  }
  const qs = params.toString();
  const url = `${API_BASE_URL}/api/documentos/reformatar/inserir-pasta-assinar${qs ? `?${qs}` : ''}`;

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
  return res.json();
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

export async function gerarProcuracao({ pessoaId, cidadeEstado, data, processoId }, opts = {}) {
  const body = { pessoaId: Number(pessoaId) };
  if (cidadeEstado) body.cidadeEstado = cidadeEstado;
  if (data) body.data = data;
  if (processoId != null && processoId !== '') body.processoId = Number(processoId);
  return postPdf('/api/documentos/procuracao', body, opts);
}

export async function gerarContratoHonorarios(
  {
    pessoaId,
    cidadeEstado,
    data,
    processoId,
    codigoCliente,
    numeroInterno,
    objetoContrato,
    clausula3Remuneracao,
    clausula3Dados,
    persistirDados,
    formaAssinatura,
    conteudoEditado,
  },
  opts = {},
) {
  const body = { pessoaId: Number(pessoaId) };
  if (cidadeEstado) body.cidadeEstado = cidadeEstado;
  if (data) body.data = data;
  if (processoId != null && processoId !== '') body.processoId = Number(processoId);
  if (codigoCliente) body.codigoCliente = String(codigoCliente);
  if (numeroInterno != null && numeroInterno !== '') body.numeroInterno = Number(numeroInterno);
  if (objetoContrato?.trim()) body.objetoContrato = objetoContrato.trim();
  if (clausula3Dados) {
    body.clausula3Dados = clausula3Dados;
    body.persistirDados = persistirDados !== false;
  } else if (clausula3Remuneracao?.trim()) {
    body.clausula3Remuneracao = clausula3Remuneracao.trim();
  }
  if (formaAssinatura) body.formaAssinatura = formaAssinatura;
  if (conteudoEditado) body.conteudoEditado = conteudoEditado;
  return postPdf('/api/documentos/contrato-honorarios', body, opts);
}

export async function previewConteudoContratoHonorarios(payload, opts = {}) {
  return request('/api/documentos/contrato-honorarios/preview-conteudo', {
    method: 'POST',
    body: payload,
    signal: opts.signal,
  });
}

export async function previewPdfContratoHonorarios(conteudo, { processoId, signal } = {}) {
  return postPdf(
    '/api/documentos/contrato-honorarios/preview-pdf',
    {
      conteudo,
      processoId: processoId != null && processoId !== '' ? Number(processoId) : null,
    },
    { signal },
  );
}

export async function montarClausula3TextoContratoHonorarios(clausula3Dados, opts = {}) {
  return request('/api/documentos/contrato-honorarios/clausula3-texto', {
    method: 'POST',
    body: {
      dados: clausula3Dados,
      pessoaId: opts.pessoaId != null && opts.pessoaId !== '' ? Number(opts.pessoaId) : null,
      contratantePessoaIds: opts.contratantePessoaIds,
    },
    signal: opts.signal,
  });
}

export async function listarContratosHonorarios(params = {}, opts = {}) {
  const q = new URLSearchParams();
  if (params.processoId != null) q.set('processoId', String(params.processoId));
  if (params.pessoaId != null) q.set('pessoaId', String(params.pessoaId));
  if (params.de) q.set('de', params.de);
  if (params.ate) q.set('ate', params.ate);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return request(`/api/documentos/contratos-honorarios${suffix}`, { signal: opts.signal });
}

export async function listarSugestoesFinanceiroHonorarios(params = {}, opts = {}) {
  const q = new URLSearchParams();
  if (params.processoId != null) q.set('processoId', String(params.processoId));
  if (params.pessoaId != null) q.set('pessoaId', String(params.pessoaId));
  if (params.de) q.set('de', params.de);
  if (params.ate) q.set('ate', params.ate);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return request(`/api/documentos/contratos-honorarios/sugestoes-financeiro${suffix}`, { signal: opts.signal });
}

export async function aprovarSugestaoFinanceiroHonorarios(payload, opts = {}) {
  return request('/api/documentos/contratos-honorarios/sugestoes-financeiro/aprovar', {
    method: 'POST',
    body: payload,
    signal: opts.signal,
  });
}

export async function buscarContratoHonorariosProcesso(processoId, opts = {}) {
  return request(`/api/documentos/contrato-honorarios/processo/${Number(processoId)}`, {
    signal: opts.signal,
  });
}

export async function salvarContratoHonorariosProcesso(processoId, payload, opts = {}) {
  return request(`/api/documentos/contrato-honorarios/processo/${Number(processoId)}`, {
    method: 'PUT',
    body: payload,
    signal: opts.signal,
  });
}

export async function gerarContratoAluguel(
  { processoId, cidadeEstado, data, codigoCliente, numeroInterno, formaAssinatura },
  opts = {},
) {
  const body = { processoId: Number(processoId) };
  if (cidadeEstado) body.cidadeEstado = cidadeEstado;
  if (data) body.data = data;
  if (codigoCliente) body.codigoCliente = String(codigoCliente);
  if (numeroInterno != null && numeroInterno !== '') body.numeroInterno = Number(numeroInterno);
  if (formaAssinatura) body.formaAssinatura = formaAssinatura;
  return postPdf('/api/documentos/contrato-aluguel', body, opts);
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

export function nomeArquivoContratoPdf(nomeContratante, sufixoModelo) {
  const base = (nomeContratante || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  const modelo = sufixoModelo ? `_${sufixoModelo}` : '';
  return `contrato${modelo}_${base || 'cliente'}.pdf`;
}
