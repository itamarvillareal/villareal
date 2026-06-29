import { request } from '../api/httpClient.js';
import { API_BASE_URL } from '../api/config.js';
import { buildDefaultApiHeaders } from '../api/apiAuthHeaders.js';
import { parseApiJsonResponse } from '../api/parseApiResponse.js';
import { featureFlags } from '../config/featureFlags.js';
import { corrigirNomePessoaExibicao } from '../utils/utf8MojibakeUtil.js';
import {
  loadCadastroClienteDados,
  saveCadastroClienteDados,
  padCliente8Cadastro,
} from '../data/cadastroClientesStorage.js';
import {
  readIndiceClientesCache,
  writeIndiceClientesCache,
} from '../data/clientesIndiceCache.js';

function mapApiToFront(c) {
  let pessoaIdStr =
    c.pessoaId != null && String(c.pessoaId).trim() !== '' ? String(c.pessoaId) : '';
  if (
    !pessoaIdStr &&
    (c.clienteId == null || c.clienteId === '') &&
    c.id != null &&
    String(c.id).trim() !== ''
  ) {
    pessoaIdStr = String(c.id);
  }
  const pessoaNum =
    pessoaIdStr && Number.isFinite(Number(pessoaIdStr)) ? Number(pessoaIdStr) : null;
  const clientePk =
    c.clienteId != null && String(c.clienteId).trim() !== ''
      ? Number(c.clienteId)
      : c.pessoaId != null && c.id != null && String(c.id).trim() !== ''
        ? Number(c.id)
        : null;
  const idPk =
    clientePk != null && Number.isFinite(clientePk)
      ? clientePk
      : pessoaNum != null && Number.isFinite(pessoaNum)
        ? pessoaNum
        : null;
  return {
    id: idPk,
    clienteId: clientePk != null && Number.isFinite(clientePk) ? clientePk : null,
    pessoaId: pessoaIdStr,
    codigo: padCliente8Cadastro(String(c.codigoCliente ?? '').trim()),
    pessoa: pessoaIdStr,
    nomeRazao: corrigirNomePessoaExibicao(c.nomeReferencia ?? c.nome ?? ''),
    cnpjCpf: c.documentoReferencia ?? '',
    observacao: c.observacao ?? '',
    clienteInativo: c.inativo === true,
  };
}

function mapFrontToApi(d) {
  const doc = String(d.cnpjCpf ?? '').replace(/\D/g, '').slice(0, 20);
  return {
    codigoCliente: padCliente8Cadastro(d.codigo),
    pessoaId: d.pessoa ? Number(String(d.pessoa).replace(/\D/g, '')) || null : null,
    nomeReferencia: corrigirNomePessoaExibicao(String(d.nomeRazao ?? '').trim()) || null,
    documentoReferencia: doc || null,
    observacao: String(d.observacao ?? ''),
    inativo: d.clienteInativo === true,
  };
}

export async function listarClientesCadastro() {
  if (!featureFlags.useApiClientes) return [];
  const data = await request('/api/clientes');
  return Array.isArray(data) ? data.map(mapApiToFront) : [];
}

function indiceClientesApiIndisponivel(err) {
  const msg = String(err?.message ?? '');
  return (
    msg.includes('404') ||
    msg.includes('500') ||
    /No static resource|NoResourceFound|api\/clientes\/indice/i.test(msg) ||
    /ECONNREFUSED|502|503|Bad Gateway|proxy error/i.test(msg)
  );
}

async function fetchIndiceClientesComEtag(etagAnterior) {
  const headers = {
    ...buildDefaultApiHeaders(),
    ...(etagAnterior ? { 'If-None-Match': etagAnterior } : {}),
  };
  const response = await fetch(`${API_BASE_URL}/api/clientes/indice`, { method: 'GET', headers });
  if (response.status === 304) {
    const cached = readIndiceClientesCache();
    if (cached?.data?.length) return { data: cached.data, etag: etagAnterior || cached.etag };
    return { data: [], etag: etagAnterior };
  }
  const body = await parseApiJsonResponse(response);
  const etag = response.headers.get('ETag') || response.headers.get('Etag') || null;
  const mapped = Array.isArray(body) ? body.map(mapApiToFront) : [];
  writeIndiceClientesCache(mapped, etag);
  return { data: mapped, etag };
}

/** Lê índice em cache (sessionStorage, TTL 15 min) — síncrono para hidratação imediata. */
export function lerIndiceClientesCacheSincrono() {
  if (!featureFlags.useApiClientes) return [];
  const cached = readIndiceClientesCache();
  return cached?.data?.length ? cached.data : [];
}

/**
 * Índice leve (sem planilha Pasta1) — busca por nome e navegação na tela Clientes.
 * Usa cache sessionStorage + ETag/`If-None-Match` quando disponível.
 */
export async function listarClientesIndiceCadastro() {
  if (!featureFlags.useApiClientes) return [];
  const cached = readIndiceClientesCache();
  try {
    const { data } = await fetchIndiceClientesComEtag(cached?.etag ?? null);
    return data;
  } catch (e) {
    if (cached?.data?.length) return cached.data;
    if (!indiceClientesApiIndisponivel(e)) throw e;
    const legado = await request('/api/clientes');
    const mapped = Array.isArray(legado) ? legado.map(mapApiToFront) : [];
    writeIndiceClientesCache(mapped, null);
    return mapped;
  }
}

/** Busca server-side por nome ou código (autocomplete). */
export async function buscarClientesCadastroPorTermo(termo, { limite = 80 } = {}) {
  if (!featureFlags.useApiClientes) return [];
  const q = String(termo ?? '').trim();
  if (!q) return [];
  try {
    const data = await request('/api/clientes/busca', { query: { q, limit: limite } });
    return Array.isArray(data) ? data.map(mapApiToFront) : [];
  } catch {
    return [];
  }
}

/**
 * Cabeçalho + contagem de processos num único GET (abertura rápida do formulário).
 * @returns {Promise<{ cliente: object, totalProcessos: number } | null>}
 */
export async function obterContextoClienteCadastro(codigo) {
  if (!featureFlags.useApiClientes) return null;
  const cod = padCliente8Cadastro(codigo);
  try {
    const data = await request('/api/clientes/contexto', { query: { codigoCliente: cod } });
    if (!data?.cliente) return null;
    return {
      cliente: mapApiToFront(data.cliente),
      totalProcessos: Number(data.totalProcessos) || 0,
    };
  } catch {
    const cliente = await resolverClienteCadastroPorCodigo(cod);
    if (!cliente) return null;
    return { cliente, totalProcessos: 0 };
  }
}

export async function obterClienteCadastroPorCodigo(codigo) {
  if (!featureFlags.useApiClientes) return null;
  const cod = padCliente8Cadastro(codigo);
  return resolverClienteCadastroPorCodigo(cod);
}

/**
 * Resolve um código (8 dígitos) para pessoa/nome quando não está na lista compacta ou ao navegar setas.
 * Com planilha importada, 404 se não houver linha — nunca assume cliente N = pessoa N.
 */
export async function resolverClienteCadastroPorCodigo(codigo) {
  if (!featureFlags.useApiClientes) return null;
  const cod = padCliente8Cadastro(codigo);
  try {
    const data = await request('/api/clientes/resolucao', { query: { codigoCliente: cod } });
    return data ? mapApiToFront(data) : null;
  } catch {
    return null;
  }
}

function emitCadastroClientesAtualizado() {
  try {
    window.dispatchEvent(new CustomEvent('vilareal:cadastro-clientes-externo-atualizado'));
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} dados
 * @param {{ suppressEmit?: boolean }} [options] — `suppressEmit` evita `vilareal:cadastro-clientes-externo-atualizado` (ex.: auto-save na mesma aba; o evento re-dispararia `aplicarDadosCliente` e um ciclo com a grade de processos).
 */
export async function salvarClienteCadastro(dados, options = {}) {
  const suppressEmit = options.suppressEmit === true;
  if (!featureFlags.useApiClientes) {
    saveCadastroClienteDados(dados.codigo, dados);
    if (!suppressEmit) emitCadastroClientesAtualizado();
    return loadCadastroClienteDados(dados.codigo);
  }
  const body = mapFrontToApi(dados);
  if (body.pessoaId == null || body.pessoaId < 1) {
    throw new Error('Salvar cliente exige uma pessoa vinculada.');
  }
  /** Backend só expõe POST idempotente (codigoCliente+pessoaId); não há PUT /api/clientes/{id}. */
  const created = await request('/api/clientes', {
    method: 'POST',
    body,
  });
  if (!suppressEmit) emitCadastroClientesAtualizado();
  return mapApiToFront(created);
}
