/**
 * Resolução de rodadas de cálculo com parcelamento aceito por processo.
 */

import { fetchCalculoRodadasResumoProcesso } from '../repositories/calculosRepository.js';
import { padCliente8Config } from '../data/clienteConfigCalculoStorage.js';

export const MSG_SEM_CALCULO_ACEITO =
  'Não há cálculo aceito para este processo. Aceite o parcelamento na tela de Cálculos primeiro.';

function normalizarProc(val) {
  const n = Number(String(val ?? '').trim());
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseDimensaoDaChave(chave) {
  const parts = String(chave ?? '').split(':');
  if (parts.length < 3) return NaN;
  return parseInt(parts[2], 10);
}

/** Lista dimensões com parcelamento aceito, da maior para a menor. */
export async function listarDimensoesAceitasProcesso({ codigoCliente, numeroInterno }) {
  const cod8 = padCliente8Config(codigoCliente);
  const proc = String(normalizarProc(numeroInterno));
  const prefixo = `${cod8}:${proc}:`;
  const resumo = await fetchCalculoRodadasResumoProcesso(cod8, proc);
  const rodadas = Array.isArray(resumo?.rodadas) ? resumo.rodadas : [];
  return rodadas
    .filter((r) => r?.parcelamentoAceito && String(r?.chave ?? '').startsWith(prefixo))
    .map((r) => ({
      dimensao: parseDimensaoDaChave(r.chave),
      chave: r.chave,
    }))
    .filter((r) => Number.isFinite(r.dimensao))
    .sort((a, b) => b.dimensao - a.dimensao);
}

/**
 * Maior dimensão com parcelamento aceito (última rodada aceita do processo).
 * @returns {{ dimensao: number | null, dimensoes: { dimensao: number, chave: string }[], motivo: string }}
 */
export async function resolverUltimaDimensaoAceita({ codigoCliente, numeroInterno }) {
  const dimensoes = await listarDimensoesAceitasProcesso({ codigoCliente, numeroInterno });
  if (!dimensoes.length) {
    return { dimensao: null, dimensoes: [], motivo: MSG_SEM_CALCULO_ACEITO };
  }
  return { dimensao: dimensoes[0].dimensao, dimensoes, motivo: '' };
}
