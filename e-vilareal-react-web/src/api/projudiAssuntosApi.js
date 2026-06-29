import { request } from './httpClient.js';

/**
 * @typedef {Object} AssuntoProjudiItem
 * @property {number} idAssunto
 * @property {string} rotuloCompleto
 * @property {boolean} [cadastroUsuario]
 */

/** @returns {Promise<AssuntoProjudiItem[]>} */
export async function listarAssuntosProjudi() {
  return request('/api/projudi/assuntos');
}

/**
 * @param {number} idAssunto
 * @param {string} descricao
 * @returns {Promise<AssuntoProjudiItem>}
 */
export async function cadastrarAssuntoProjudi(idAssunto, descricao) {
  return request('/api/projudi/assuntos', {
    method: 'POST',
    body: { idAssunto, descricao },
  });
}

/** @param {number} idAssunto */
export async function removerAssuntoProjudi(idAssunto) {
  return request(`/api/projudi/assuntos/${idAssunto}`, { method: 'DELETE' });
}
