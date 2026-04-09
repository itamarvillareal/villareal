/**
 * Vínculo código de cliente ↔ pessoa a partir da lista da API (`GET /api/clientes`).
 */
import { padCliente8Cadastro } from './cadastroClientesStorage.js';
import { listarClientesCadastro } from '../repositories/clientesRepository.js';

/**
 * @param {number|string} idPessoa
 * @param {Array<{ codigo?: string, pessoa?: string }>|null|undefined} clientesLista
 * @returns {string[]}
 */
export function listarCodigosClientePorIdPessoa(idPessoa, clientesLista) {
  const idNum = Number(idPessoa);
  if (!Number.isFinite(idNum) || idNum < 1) return [];
  if (!Array.isArray(clientesLista)) return [];
  const out = [];
  for (const c of clientesLista) {
    const pid = Number(String(c?.pessoa ?? '').replace(/\D/g, ''));
    if (pid === idNum && c?.codigo != null && String(c.codigo).trim() !== '') {
      out.push(padCliente8Cadastro(c.codigo));
    }
  }
  const uniq = [...new Set(out)];
  uniq.sort((a, b) => {
    const na = Number(String(a).replace(/\D/g, '')) || 0;
    const nb = Number(String(b).replace(/\D/g, '')) || 0;
    return na - nb;
  });
  return uniq;
}

/**
 * @param {number|string} codCliente
 * @param {Array<{ codigo?: string, pessoa?: string }>|null|undefined} clientesLista
 * @returns {number|null}
 */
export function getIdPessoaPorCodCliente(codCliente, clientesLista) {
  const cod = padCliente8Cadastro(codCliente);
  if (!Array.isArray(clientesLista)) return null;
  const row = clientesLista.find((c) => padCliente8Cadastro(c.codigo) === cod);
  if (!row || row.pessoa == null || String(row.pessoa).trim() === '') return null;
  const n = Number(String(row.pessoa).replace(/\D/g, ''));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** Busca na API quando a lista ainda não está em memória. */
export async function listarCodigosClientePorIdPessoaAsync(idPessoa) {
  try {
    const list = await listarClientesCadastro();
    return listarCodigosClientePorIdPessoa(idPessoa, list);
  } catch {
    return [];
  }
}
