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
 * @returns {Promise<{ pastaId: string, webViewLink: string, nomePasta: string, caminho: string }>}
 */
export async function obterLinkPasta(codigoCliente, numeroInterno) {
  return request('/api/drive/pasta-processo', {
    query: {
      codigoCliente: String(codigoCliente ?? '').trim(),
      numeroInterno: Number(numeroInterno),
    },
  });
}

/**
 * @param {{ imovelId?: number|null, numeroPlanilha?: number|null }} params
 * @returns {Promise<{ pastaId: string, webViewLink: string, nomePasta: string, caminho: string }>}
 */
/**
 * @param {number} pessoaId — PK da tabela `pessoa` (pasta `Pessoas/00000NNN - nome`)
 * @returns {Promise<{ pastaId: string, webViewLink: string, nomePasta: string, caminho: string }>}
 */
export async function obterLinkPastaPessoa(pessoaId) {
  const id = Number(pessoaId);
  return request('/api/drive/pasta-pessoa', {
    query: { pessoaId: id },
  });
}

/**
 * @param {number} pessoaId
 * @param {string|null} [pastaId]
 */
export async function listarArquivosPessoa(pessoaId, pastaId = null) {
  const query = { pessoaId: Number(pessoaId) };
  if (pastaId) query.pastaId = pastaId;
  return request('/api/drive/arquivos-pessoa', { query });
}

/**
 * @param {number} pessoaId
 * @param {File} arquivo
 * @param {string|null} [pastaId]
 */
export async function uploadArquivoPessoa(pessoaId, arquivo, pastaId = null) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  formData.append('pessoaId', String(Number(pessoaId)));
  if (pastaId) formData.append('pastaId', pastaId);
  return postFormData('/api/drive/upload-pessoa', formData);
}

export async function obterLinkPastaImovel({ imovelId, numeroPlanilha } = {}) {
  const query = {};
  const idApi = Number(imovelId);
  const np = Number(numeroPlanilha);
  if (Number.isFinite(idApi) && idApi >= 1) query.imovelId = idApi;
  else if (Number.isFinite(np) && np >= 1) query.numeroPlanilha = np;
  return request('/api/drive/pasta-imovel', { query });
}

/**
 * Retorna a pasta e seu pai imediato (para subir de nível no painel).
 * @param {string} pastaId
 * @returns {Promise<{ id: string, nome: string, paiId: string|null, paiNome: string|null }>}
 */
export async function obterInfoPasta(pastaId) {
  return request('/api/drive/pasta-info', {
    query: { pastaId: String(pastaId ?? '').trim() },
  });
}
