import { chaveNumeroProcessoBuscaDiagnostico } from './normalizarNumeroProcessoBuscaDiagnostico.js';

/** Distância de Levenshtein (cadeias curtas: CNJ / fragmentos). */
export function levenshtein(a, b) {
  const s = String(a ?? '');
  const t = String(b ?? '');
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s.charCodeAt(i - 1) === t.charCodeAt(j - 1) ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Só dígitos do CNJ (20 quando completo e bem formatado). */
export function digitosCnjNormalizados(cnjRaw) {
  return chaveNumeroProcessoBuscaDiagnostico(cnjRaw);
}

/**
 * Diz se o termo de busca (só dígitos) corresponde ao CNJ gravado, com tolerância a 1 dígito trocado
 * no primeiro segmento (OCR/PDF) e substring exacta como antes.
 *
 * @param {string} termDigits — já sem não-dígitos (ex. `normalizarNumeroBusca` do campo Pesquisar).
 * @param {string} campoCnjRaw — valor do campo «Nº Processo Novo» / CNJ no cadastro.
 * @returns {boolean}
 */
export function termoDigitosCorrespondeCnjCampo(termDigits, campoCnjRaw) {
  const t = String(termDigits ?? '').replace(/\D/g, '');
  if (!t) return false;
  const c = digitosCnjNormalizados(campoCnjRaw);
  if (!c) return false;
  if (c.includes(t)) return true;

  // Primeiro segmento do CNJ (7 dígitos do número + 2 do DV) — erros de leitura costumam estar aqui.
  if (t.length >= 7 && t.length <= 9 && c.length >= 7) {
    const slice9 = c.slice(0, Math.min(9, c.length));
    const slice7 = c.slice(0, 7);
    if (t.length <= 7 && levenshtein(t, slice7) <= 1) return true;
    if (t.length <= 9 && levenshtein(t, slice9) <= 1) return true;
  }

  // CNJ quase completo (ou termo longo): poucas diferenças em toda a cadeia (PDF truncado / sujeira).
  if (t.length >= 14 && c.length >= 14) {
    if (Math.abs(c.length - t.length) <= 3 && levenshtein(t, c) <= 2) return true;
    const pref = c.slice(0, Math.min(c.length, t.length + 2));
    if (pref.length >= t.length && levenshtein(t, pref) <= 2) return true;
  }

  return false;
}
