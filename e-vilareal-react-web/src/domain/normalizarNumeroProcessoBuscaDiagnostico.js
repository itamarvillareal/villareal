import { normalizarCnjParaChave } from '../data/publicacoesPdfParser.js';

/**
 * CNJ legado (txt/import): sequencial com 6 dígitos → 19 dígitos após remover pontuação.
 * Completo: 20 dígitos (7+2+4+1+2+4).
 */
export function padCnjDigitos19para20(digits) {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (d.length === 19) return `0${d}`;
  return d;
}

/**
 * Chave estável para comparar número de processo (CNJ / nº novo) ignorando pontos, traços e espaços.
 * Aceita entrada só com dígitos ou no formato CNJ com `.` e `-`.
 *
 * @param {string} raw
 * @returns {string} sequência de dígitos (20 para CNJ completo quando padronizável)
 */
export function chaveNumeroProcessoBuscaDiagnostico(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const cnjFmt = normalizarCnjParaChave(s);
  if (cnjFmt) {
    return padCnjDigitos19para20(cnjFmt.replace(/\D/g, ''));
  }
  return padCnjDigitos19para20(
    s
      .replace(/[.\-\s/\u00AD\u2013\u2014]/g, '')
      .replace(/\D/g, '')
  );
}

/** Chave para deduplicar sugestões de vínculo (CNJ formatado ou só dígitos para nº Projudi parcial). */
export function chaveSugestaoVinculoPublicacao(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return normalizarCnjParaChave(s) || chaveNumeroProcessoBuscaDiagnostico(s);
}
