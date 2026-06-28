import { request } from '../api/httpClient.js';

export async function listarEstados() {
  return request('/api/estados');
}

export async function buscarMunicipios({ uf, q, limit = 20 } = {}) {
  const query = {};
  if (uf) query.uf = uf;
  if (q) query.q = q;
  if (limit) query.limit = limit;
  return request('/api/municipios', { query });
}

export async function obterMunicipio(id) {
  return request(`/api/municipios/${id}`);
}
