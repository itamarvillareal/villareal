import { request } from '../api/httpClient.js';

let tribunaisCache = null;

export async function listarTribunais(ativo) {
  const query = {};
  if (ativo != null) query.ativo = ativo;
  return request('/api/tribunais', { query });
}

export async function resolverTribunalIdPorSigla(sigla = 'TJGO') {
  if (!tribunaisCache) {
    tribunaisCache = await listarTribunais();
  }
  const s = String(sigla || '').trim().toUpperCase();
  const t = (Array.isArray(tribunaisCache) ? tribunaisCache : []).find((x) => x.sigla === s);
  return t?.id ?? null;
}

export async function buscarOrgaosJulgadores({ tribunalId, tribunalSigla, municipioId, q, limit = 20 } = {}) {
  let tid = tribunalId;
  if (tid == null && tribunalSigla) {
    tid = await resolverTribunalIdPorSigla(tribunalSigla);
  }
  const query = {};
  if (tid != null) query.tribunalId = tid;
  if (municipioId != null) query.municipioId = municipioId;
  if (q) query.q = q;
  if (limit) query.limit = limit;
  return request('/api/orgaos-julgadores', { query });
}

export async function obterOrgaoJulgador(id) {
  return request(`/api/orgaos-julgadores/${id}`);
}

export async function sincronizarTribunal(id) {
  return request(`/api/tribunais/${id}/sincronizar`, { method: 'POST' });
}
