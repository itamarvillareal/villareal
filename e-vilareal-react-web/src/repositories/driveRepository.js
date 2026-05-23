import { postFormData, request } from '../api/httpClient.js';

export async function obterStatusDrive() {
  const data = await request('/api/drive/status');
  return Boolean(data?.configurado);
}

/**
 * @param {string} codigoCliente
 * @param {number} numeroInterno
 * @param {string|null} [pastaId]
 * @returns {Promise<Array<{ id: string, nome: string, tipo: string, mimeType?: string, tamanho?: number, dataModificacao?: string, webViewLink?: string, webContentLink?: string, iconLink?: string }>>}
 */
export async function listarArquivos(codigoCliente, numeroInterno, pastaId = null) {
  const query = {
    codigoCliente: String(codigoCliente ?? '').trim(),
    numeroInterno: Number(numeroInterno),
  };
  if (pastaId) query.pastaId = pastaId;
  return request('/api/drive/arquivos', { query });
}

/**
 * @param {string} codigoCliente
 * @param {number} numeroInterno
 * @param {File} arquivo
 * @param {string|null} [pastaId]
 */
export async function uploadArquivo(codigoCliente, numeroInterno, arquivo, pastaId = null) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  formData.append('codigoCliente', String(codigoCliente ?? '').trim());
  formData.append('numeroInterno', String(numeroInterno));
  if (pastaId) formData.append('pastaId', pastaId);
  return postFormData('/api/drive/upload', formData);
}

/**
 * @param {string} codigoCliente
 * @param {number} numeroInterno
 * @returns {Promise<{ pastaId: string, webViewLink: string, nomePasta: string }>}
 */
export async function obterLinkPasta(codigoCliente, numeroInterno) {
  return request('/api/drive/pasta-processo', {
    query: {
      codigoCliente: String(codigoCliente ?? '').trim(),
      numeroInterno: Number(numeroInterno),
    },
  });
}
