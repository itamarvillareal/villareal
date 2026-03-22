/**
 * Fonte única para os dados de um processo (código de cliente × nº do processo)
 * na grade do Cadastro de Clientes e na tela Processos (números CNJ, parte oposta, descrição/natureza).
 */
import { getMockProcesso10x10 } from './processosMock.js';
import { processosClienteMock } from './mockData.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function pad3(n) {
  return String(n).padStart(3, '0');
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

  const seq = 5600000 + n * 37 + p * 11;
  const dv = String(10 + ((n + p) % 90)).padStart(2, '0');
  const foro = String(1000 + ((n * 13 + p * 7) % 900)).slice(-4);
  const numeroProcessoNovo = `${String(seq).slice(0, 7)}-${dv}.2025.8.09.${foro}`;
  const parteOposta = `RÉU MOCK C${pad3(n)}/P${pad2(p)}`;
  const autor = `AUTOR MOCK C${pad3(n)}/P${pad2(p)}`;
  const descricao = baseTipo ?? `AÇÃO MOCK CLIENTE ${pad3(n)} — PROC ${pad2(p)}`;

  return {
    processoVelho: '-',
    processoNovo: numeroProcessoNovo,
    autor,
    reu: parteOposta,
    parteOposta,
    parteCliente: `PARTE CLIENTE ${pad3(n)} — PROC ${pad2(p)}`,
    tipoAcao: baseTipo ?? 'AÇÃO (MOCK)',
    descricao,
    naturezaAcao: descricao,
  };
}
