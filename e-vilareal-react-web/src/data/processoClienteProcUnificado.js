/**
 * Fonte única para os dados de um processo (código de cliente × nº do processo)
 * na grade do Cadastro de Clientes e na tela Processos (números CNJ, parte oposta, descrição/natureza).
 * Sem seed estático: use API, histórico persistido ou cadastro local.
 */

/**
 * @param {number|string} codigoClienteNum
 * @param {number|string} procNum — nº do processo no cliente (≥ 1)
 * @returns {null | {
 *   processoVelho: string,
 *   processoNovo: string,
 *   autor: string,
 *   reu: string,
 *   parteOposta: string,
 *   parteCliente: string,
 *   tipoAcao: string,
 *   descricao: string,
 *   naturezaAcao: string,
 * }}
 */
export function getDadosProcessoClienteUnificado(codigoClienteNum, procNum) {
  const n = Math.floor(Number(codigoClienteNum));
  const p = Math.floor(Number(procNum));
  if (!Number.isFinite(n) || n < 1 || !Number.isFinite(p) || p < 1) return null;
  return null;
}
