import { postFormData, request } from '../api/httpClient.js';

/**
 * @param {number} pessoaId
 * @param {{ tipo?: string }} [opcoes]
 * @returns {Promise<Array<{ id: number, pessoaId: number, tipo: string, nomeArquivo: string, driveFileId?: string, p7sDriveFileId?: string, pdfSha256?: string, p7sSha256?: string, mimeType?: string, createdAt?: string }>>}
 */
export async function listarDocumentosDrivePessoa(pessoaId, opcoes = {}) {
  const query = {};
  if (opcoes.tipo) query.tipo = opcoes.tipo;
  return request(`/api/cadastro-pessoas/${Number(pessoaId)}/documentos-drive`, { query });
}

/**
 * @param {number} pessoaId
 */
export async function listarDocumentosAssinadosPessoa(pessoaId) {
  return request(`/api/cadastro-pessoas/${Number(pessoaId)}/documentos-drive/assinados`);
}

/**
 * @param {number} pessoaId
 * @param {File} arquivo
 * @param {{ tipo?: string }} [opcoes]
 */
export async function uploadDocumentoDrivePessoa(pessoaId, arquivo, opcoes = {}) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (opcoes.tipo) formData.append('tipo', opcoes.tipo);
  return postFormData(`/api/cadastro-pessoas/${Number(pessoaId)}/documentos-drive`, formData);
}
