import { API_BASE_URL } from './config';
import { buildDefaultApiHeaders } from './apiAuthHeaders.js';
import { parseApiJsonResponse } from './parseApiResponse.js';

const BASE = `${API_BASE_URL}/api/cadastro-pessoas`;

function getOptions(method, body = null) {
  const opts = {
    method,
    headers: buildDefaultApiHeaders(),
  };
  if (body) opts.body = JSON.stringify(body);
  return opts;
}

async function handleResponse(res) {
  return parseApiJsonResponse(res);
}

/**
 * Lista todos os clientes ou apenas ativos.
 * @param {boolean} apenasAtivos
 * @returns {Promise<Array>}
 */
export async function listarClientes(apenasAtivos = false) {
  const url = apenasAtivos ? `${BASE}?apenasAtivos=true` : BASE;
  const res = await fetch(url, getOptions('GET'));
  return handleResponse(res);
}

/**
 * Busca no cadastro por nome (contém, case-insensitive) **ou** por CPF/CNPJ (dígitos, contém).
 * Envia só um filtro por requisição (o backend combina filtros com AND).
 * @param {string} termo
 * @param {{ apenasAtivos?: boolean, limite?: number }} [opts]
 */
export async function pesquisarCadastroPessoasPorNomeOuCpf(termo, { apenasAtivos = false, limite } = {}) {
  const t = String(termo ?? '').trim();
  if (!t) return [];
  const hasLetters = /[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(t);
  const digits = t.replace(/\D/g, '');
  const qs = new URLSearchParams();
  if (apenasAtivos) qs.set('apenasAtivos', 'true');
  if (!hasLetters && digits.length >= 3) {
    qs.set('cpf', digits);
  } else {
    qs.set('nome', t);
  }
  const res = await fetch(`${BASE}?${qs.toString()}`, getOptions('GET'));
  const data = await handleResponse(res);
  const arr = Array.isArray(data) ? data : [];
  return typeof limite === 'number' && limite > 0 ? arr.slice(0, limite) : arr;
}

/**
 * Próximo id que será usado em um novo cadastro (pré-visualização na tela).
 * @returns {Promise<number>}
 */
export async function obterProximoIdCadastroPessoas() {
  const res = await fetch(`${BASE}/proximo-id`, getOptions('GET'));
  const data = await handleResponse(res);
  const n = data?.proximoId ?? data?.proximo_id;
  if (n == null || !Number.isFinite(Number(n))) {
    throw new Error('Resposta inválida do servidor (próximo id).');
  }
  return Number(n);
}

/**
 * Busca cliente por ID.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function buscarCliente(id) {
  const res = await fetch(`${BASE}/${id}`, getOptions('GET'));
  if (res.status === 404) return null;
  return handleResponse(res);
}

/**
 * Cria um novo cliente.
 * @param {Object} dados - { nome, email, cpf, telefone?, dataNascimento?, ativo?, marcadoMonitoramento?, responsavelId? }
 * @returns {Promise<Object>}
 */
export async function criarCliente(dados) {
  const res = await fetch(BASE, getOptions('POST', dados));
  return handleResponse(res);
}

/**
 * Atualiza cliente existente.
 * @param {number} id
 * @param {Object} dados - { nome, email, cpf, telefone?, dataNascimento?, ativo?, marcadoMonitoramento?, responsavelId? }
 * @returns {Promise<Object>}
 */
export async function atualizarCliente(id, dados) {
  const res = await fetch(`${BASE}/${id}`, getOptions('PUT', dados));
  return handleResponse(res);
}

/**
 * Exclui cliente.
 * @param {number} id
 */
export async function excluirCliente(id) {
  const res = await fetch(`${BASE}/${id}`, getOptions('DELETE'));
  await handleResponse(res);
}
