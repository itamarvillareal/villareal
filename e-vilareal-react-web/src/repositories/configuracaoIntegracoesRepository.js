import { request } from '../api/httpClient.js';

/** @typedef {{ instanciaId: string, instanciaRotulo: string, projudiChaveConfigurada: boolean, totpChaveConfigurada: boolean, gmailConta: string | null, gmailTokensConfigurados: boolean }} InstanciaIntegracoesStatus */

/** @returns {Promise<InstanciaIntegracoesStatus>} */
export async function obterStatusInstanciaIntegracoes() {
  return request('/api/configuracoes/integracoes/instancia');
}

/** @returns {Promise<Array<{ id: number, cpfUsuario: string, rotulo: string | null, ativo: boolean }>>} */
export async function listarCredenciaisProjudi() {
  return request('/api/configuracoes/integracoes/projudi/credenciais');
}

/**
 * @param {{ cpf: string, senha: string, rotulo?: string }} payload
 */
export async function salvarCredencialProjudi(payload) {
  return request('/api/configuracoes/integracoes/projudi/credenciais', {
    method: 'POST',
    body: payload,
  });
}

export async function excluirCredencialProjudi(id) {
  return request(`/api/configuracoes/integracoes/projudi/credenciais/${id}`, {
    method: 'DELETE',
  });
}

/** @returns {Promise<Array<{ id: number, tribunal: string, login: string, ativo: boolean, senhaCadastrada: boolean }>>} */
export async function listarCredenciaisPje() {
  return request('/api/configuracoes/integracoes/pje/credenciais');
}

/**
 * @param {{ tribunal: string, login: string, otpauthUriOuSecret: string, senha?: string, ativo?: boolean }} payload
 */
export async function salvarCredencialPje(payload) {
  return request('/api/configuracoes/integracoes/pje/credenciais', {
    method: 'POST',
    body: payload,
  });
}

export async function atualizarSenhaCredencialPje(id, senha) {
  return request(`/api/configuracoes/integracoes/pje/credenciais/${id}/senha`, {
    method: 'PUT',
    body: { senha },
  });
}

export async function testarCredencialPje(id) {
  return request(`/api/configuracoes/integracoes/pje/credenciais/${id}/teste`, {
    method: 'POST',
  });
}
