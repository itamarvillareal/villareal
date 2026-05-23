/**
 * Tramitação do processo (VBA): `Gerais/1000/…/{cod8}.147.1.<proc>.txt`
 * Conteúdo: PROJUDI | PjE | TJ Go - Autos Físicos → valores canónicos da API/UI.
 */

import { parseNomeArquivoCodTipoProc } from './gerais-fase-processo-txt.mjs';

export const TIPO_TRAMITACAO_ARQUIVO = '147.1';

export const TRAMITACAO_OPCOES_CANONICAS = ['Projudi', 'PJe', 'TJ Go - Autos Físicos'];

/** @param {string} fileName */
export function parseNomeArquivoTramitacao147_1(fileName) {
  return parseNomeArquivoCodTipoProc(fileName, TIPO_TRAMITACAO_ARQUIVO);
}

function chaveCompactaPt(s) {
  return String(s ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string | null | undefined} textoBruto
 * @returns {{ tramitacao: string | null, aviso: string | null }}
 */
export function normalizarTramitacaoTxt(textoBruto) {
  const raw = textoBruto == null ? '' : String(textoBruto).trim();
  if (!raw) return { tramitacao: null, aviso: 'vazio' };

  for (const op of TRAMITACAO_OPCOES_CANONICAS) {
    if (raw === op) return { tramitacao: op, aviso: null };
  }

  const c = chaveCompactaPt(raw);
  if (c === 'projudi') return { tramitacao: 'Projudi', aviso: 'legado_projudi' };
  if (c === 'pje') return { tramitacao: 'PJe', aviso: 'legado_pje' };
  if (c.includes('tj') && c.includes('fisic')) {
    return { tramitacao: 'TJ Go - Autos Físicos', aviso: 'legado_tj_fisico' };
  }

  const truncado = [...raw].length <= 120 ? raw : [...raw].slice(0, 120).join('');
  return { tramitacao: truncado, aviso: 'valor_nao_canonico' };
}
