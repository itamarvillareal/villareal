import { request } from '../api/httpClient.js';

/**
 * Árvore raiz da tela Tópicos (`GET /api/topicos/hierarchy`).
 */
export async function fetchTopicosHierarchy() {
  return request('/api/topicos/hierarchy');
}

/** @returns {Promise<string[]>} */
export async function fetchCategorias() {
  const data = await request('/api/topicos/categorias');
  return Array.isArray(data) ? data : [];
}

/** @returns {Promise<object[]>} */
export async function fetchTopicosPorCategoria(categoria) {
  const cat = encodeURIComponent(String(categoria ?? '').trim());
  if (!cat) return [];
  const data = await request(`/api/topicos/categoria/${cat}`);
  return Array.isArray(data) ? data : [];
}

/** @returns {Promise<object[]>} */
export async function buscarTopicos(query) {
  const q = String(query ?? '').trim();
  if (!q) return [];
  const data = await request('/api/topicos/buscar', { query: { q } });
  return Array.isArray(data) ? data : [];
}

/** @returns {Promise<object>} */
export async function processarTopico(topicoId, processoId, parametros = {}) {
  return request(`/api/topicos/${topicoId}/processar`, {
    method: 'POST',
    body: { processoId: processoId ?? null, parametros },
  });
}

/** @returns {Promise<{ itens: object[] }>} */
export async function processarMultiplos(topicoIds, processoId, parametros = {}) {
  return request('/api/topicos/processar-multiplos', {
    method: 'POST',
    body: { topicoIds, processoId: processoId ?? null, parametros },
  });
}
