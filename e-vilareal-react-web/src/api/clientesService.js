import { API_BASE_URL } from './config';

const BASE = `${API_BASE_URL}/api/cadastro-pessoas`;

function getOptions(method, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return opts;
}

async function handleResponse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || data?.error || `Erro ${res.status}`;
    throw new Error(msg);
  }
  return data;
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
 * @param {Object} dados - { nome, email, cpf, telefone?, dataNascimento?, ativo? }
 * @returns {Promise<Object>}
 */
export async function criarCliente(dados) {
  const res = await fetch(BASE, getOptions('POST', dados));
  return handleResponse(res);
}

/**
 * Atualiza cliente existente.
 * @param {number} id
 * @param {Object} dados - { nome, email, cpf, telefone?, dataNascimento?, ativo? }
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
