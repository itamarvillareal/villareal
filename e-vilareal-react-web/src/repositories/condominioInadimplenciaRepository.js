import { postFormData, request } from '../api/httpClient.js';

/**
 * @param {string} clienteCodigo — 8 dígitos (com ou sem padding)
 * @param {File} file
 */
export async function extrairInadimplenciaPdf(clienteCodigo, file) {
  const fd = new FormData();
  fd.append('clienteCodigo', String(clienteCodigo ?? '').trim());
  fd.append('arquivo', file);
  return postFormData('/api/condominio/inadimplencia/extrair', fd);
}

/**
 * @param {{
 *   clienteCodigo: string,
 *   unidades: Array<{ codigoUnidade: string, cobrancas: unknown[] }>,
 *   autorMesmaPessoaCliente?: boolean,
 * }} payload
 */
export async function importarInadimplenciaConfirmado(payload) {
  return request('/api/condominio/inadimplencia/importar', { method: 'POST', body: payload });
}
