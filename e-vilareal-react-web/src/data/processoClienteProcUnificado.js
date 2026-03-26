/**
 * Fonte única para os dados de um processo (código de cliente × nº do processo)
 * na grade do Cadastro de Clientes e na tela Processos (números CNJ, parte oposta, descrição/natureza).
 */
import { getMockProcesso10x10 } from './processosMock.js';
import { processosClienteMock } from './mockData.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function descricaoBasePorProcIndex(p) {
  const idx = ((Math.floor(Number(p)) - 1) % 10 + 10) % 10;
  return processosClienteMock[idx]?.descricao;
}

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

  const baseTipo = descricaoBasePorProcIndex(p);
  const mock10 = getMockProcesso10x10(n, p);

  if (mock10) {
    const descricao = baseTipo ?? `AÇÃO (MOCK) PROC ${pad2(p)}`;
    return {
      processoVelho: mock10.numeroProcessoVelho || '-',
      processoNovo: mock10.numeroProcessoNovo,
      autor: mock10.autor,
      reu: mock10.reu,
      parteOposta: mock10.reu,
      parteCliente: mock10.parteCliente,
      tipoAcao: baseTipo ?? 'AÇÃO (MOCK)',
      descricao,
      naturezaAcao: descricao,
    };
  }

  /* Sem seed estático (PDF/10×10): não inventar processos — use API, histórico ou cadastro persistido. */
  return null;
}
