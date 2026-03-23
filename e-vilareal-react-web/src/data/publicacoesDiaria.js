/**
 * Consolidação diária das publicações importadas (agrupamento por data).
 */

import { normalizarDataBrCompleta } from './publicacoesPdfParser.js';

/** Chave yyyy-mm-dd para ordenação decrescente (mais recente primeiro). */
export function chaveOrdenacaoDia(dataBr) {
  const n = normalizarDataBrCompleta(String(dataBr ?? '').trim());
  const m = n.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '0000-00-00';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * @param {Array<object>} itens — prévia ou gravados (campos dataPublicacao, dataDisponibilizacao)
 * @param {'publicacao'|'disponibilizacao'} criterio — qual data usar para agrupar o dia
 * @returns {Array<{ dia: string, chaveSort: string, total: number, itens: object[] }>}
 */
export function agruparPublicacoesPorDia(itens, criterio = 'publicacao') {
  const lista = Array.isArray(itens) ? itens : [];
  const map = new Map();

  for (const row of lista) {
    let bruto =
      criterio === 'disponibilizacao'
        ? row.dataDisponibilizacao || row.dataPublicacao
        : row.dataPublicacao || row.dataDisponibilizacao;
    const dia = normalizarDataBrCompleta(String(bruto ?? '').trim());
    if (!dia) continue;
    const chave = chaveOrdenacaoDia(dia);
    if (!map.has(chave)) {
      map.set(chave, { dia, chaveSort: chave, itens: [] });
    }
    map.get(chave).itens.push(row);
  }

  const blocos = [...map.values()].map((b) => ({
    ...b,
    total: b.itens.length,
  }));
  blocos.sort((a, b) => (a.chaveSort < b.chaveSort ? 1 : a.chaveSort > b.chaveSort ? -1 : 0));
  return blocos;
}
