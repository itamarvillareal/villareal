import { request } from '../api/httpClient.js';

/** @typedef {{ ativo: boolean, assuntoPrefixo: string, destinatarios: string[] }} ProjudiProtocoloEmailConfig */

/** @returns {Promise<ProjudiProtocoloEmailConfig>} */
export async function obterConfigProjudiProtocoloEmail() {
  return request('/api/configuracoes/projudi-protocolo-email');
}

/**
 * @param {string[]} destinatarios
 * @returns {Promise<ProjudiProtocoloEmailConfig>}
 */
export async function salvarConfigProjudiProtocoloEmail(destinatarios) {
  return request('/api/configuracoes/projudi-protocolo-email', {
    method: 'PUT',
    body: { destinatarios },
  });
}

/** Código TOTP atual do autenticador PDPJ/PJe TRT18 (admin). */
export async function obterCodigoPdpj() {
  return request('/api/configuracoes/pdpj-codigo');
}
