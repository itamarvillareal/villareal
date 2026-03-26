/**
 * Cod Cliente → pessoa (modo local). Sem dados de demonstração.
 */
export const CLIENTE_PARA_PESSOA = {};

export const MAX_COD_CLIENTE_MOCK = 0;

/** @returns {number|null} */
export function getIdPessoaPorCodCliente(codCliente) {
  const n = parseInt(String(codCliente ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  const id = CLIENTE_PARA_PESSOA[n];
  return id != null ? id : null;
}

/**
 * @param {number|string} idPessoa
 * @returns {string[]}
 */
export function listarCodigosClientePorIdPessoa(idPessoa) {
  const idNum = Number(idPessoa);
  if (!Number.isFinite(idNum) || idNum < 1) return [];
  const out = [];
  for (const [codStr, pid] of Object.entries(CLIENTE_PARA_PESSOA)) {
    if (Number(pid) === idNum) out.push(codStr);
  }
  out.sort((a, b) => Number(a) - Number(b));
  return out;
}
