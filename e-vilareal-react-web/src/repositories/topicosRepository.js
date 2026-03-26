import { request } from '../api/httpClient.js';

/**
 * Árvore raiz da tela Tópicos (`GET /api/topicos/hierarchy`).
 * @returns {Promise<object>} mesmo formato que `TOPICOS_RAIZ` em `topicosHierarchy.js`
 */
export async function fetchTopicosHierarchy() {
  return request('/api/topicos/hierarchy');
}
