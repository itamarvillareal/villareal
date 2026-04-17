import { normalizarCnjParaChave } from '../data/publicacoesPdfParser.js';

/**
 * Chave estável para comparar número de processo (CNJ / nº novo) ignorando pontos, traços e espaços.
 * Aceita entrada só com dígitos ou no formato CNJ com `.` e `-`.
 *
 * @param {string} raw
 * @returns {string} sequência de dígitos (20 para CNJ completo)
 */
export function chaveNumeroProcessoBuscaDiagnostico(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const cnjFmt = normalizarCnjParaChave(s);
  if (cnjFmt) {
    return cnjFmt.replace(/\D/g, '');
  }
  return s
    .replace(/[.\-\s/\u00AD\u2013\u2014]/g, '')
    .replace(/\D/g, '');
}
