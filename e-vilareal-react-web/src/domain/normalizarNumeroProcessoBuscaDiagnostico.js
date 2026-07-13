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

/** Número interno Projudi em email de intimação (ex.: {@code 5500622.97}, {@code 5829123.7}). */
export function ehNumeroProjudiInternoEmail(raw) {
  return /^\d{1,9}\.\d{1,2}$/i.test(String(raw ?? '').trim());
}

export function padSequencialProjudiInterno7(seq) {
  const d = String(seq ?? '').replace(/\D/g, '');
  if (d.length >= 7) return d;
  return d.padStart(7, '0');
}

/** Ex.: {@code 133057.9} → {@code 0133057.9} */
export function formatarNumeroProjudiInternoEmail(raw) {
  const s = String(raw ?? '').trim();
  const m = /^(\d{1,9})\.(\d{1,2})$/i.exec(s);
  if (!m) return s;
  return `${padSequencialProjudiInterno7(m[1])}.${m[2]}`;
}

/** Sequencial (7) + DV para prefixo de busca. */
export function digitosNumeroProjudiInternoEmail(raw) {
  const s = String(raw ?? '').trim();
  const m = /^(\d{1,9})\.(\d{1,2})$/i.exec(s);
  if (!m) return '';
  return padSequencialProjudiInterno7(m[1]) + m[2];
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
  if (ehNumeroProjudiInternoEmail(s)) {
    return digitosNumeroProjudiInternoEmail(s);
  }
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
  if (ehNumeroProjudiInternoEmail(s)) {
    return formatarNumeroProjudiInternoEmail(s);
  }
  return normalizarCnjParaChave(s) || chaveNumeroProcessoBuscaDiagnostico(s);
}
