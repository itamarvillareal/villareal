import { postFormData, request } from '../api/httpClient.js';

/**
 * @param {string} clienteCodigo
 * @param {File} file — .xls ou .xlsx
 */
export async function extrairUnidadesPessoasPlanilha(clienteCodigo, file) {
  const fd = new FormData();
  fd.append('clienteCodigo', String(clienteCodigo ?? '').trim());
  fd.append('arquivo', file);
  return postFormData('/api/condominio/inadimplencia/extrair-pessoas', fd);
}

/**
 * @param {{ clienteCodigo: string, unidades: unknown[], importacaoId?: string | null }} payload
 */
export async function importarUnidadesPessoasPlanilha(payload) {
  return request('/api/condominio/inadimplencia/importar-pessoas', { method: 'POST', body: payload });
}
