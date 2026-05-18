/**
 * Datas no legado VB / planilha — distingue padrão brasileiro (dd/mm/aaaa)
 * e armazenamento US (mm/dd/aaaa) em campos de audiência.
 */

import XLSX from 'xlsx';
import { parseDataDdMmYyyy, parseDataSlashComHint } from './historico-local-txt-paths.mjs';

/**
 * @param {number} yyyy
 * @param {number} mo
 * @param {number} dd
 * @returns {string | null}
 */
export function isoFromYmd(yyyy, mo, dd) {
  if (!Number.isFinite(yyyy) || !Number.isFinite(mo) || !Number.isFinite(dd)) return null;
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
  const dim = new Date(yyyy, mo, 0).getDate();
  if (dd > dim) return null;
  return `${yyyy}-${String(mo).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * Cabeçalho do processo (3.1, 145.1, etc.) — **dd/mm/aaaa** brasileiro.
 * @param {string | null | undefined} texto
 * @returns {string | null}
 */
export function parseDataCabecalhoProcessoIso(texto) {
  if (texto == null) return null;
  const t = String(texto).trim();
  if (!t) return null;

  const br = parseDataDdMmYyyy(t);
  if (br) return isoFromYmd(br.yyyy, br.mo, br.dd);

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}

/**
 * Converte armazenamento VB → texto exibido no formulário (Mid 4,2 / 1,2 / 7,4).
 * @param {string} dado
 * @returns {string | null} dd/mm/aaaa
 */
export function audienciaStorageParaExibicaoVB(dado) {
  const t = String(dado ?? '').trim();
  if (!t) return null;

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t) && t.length >= 8) {
    const dd = t.slice(3, 5);
    const mm = t.slice(0, 2);
    const yyyy = t.slice(6, 10);
    if (/^\d{2}$/.test(dd) && /^\d{2}$/.test(mm) && /^\d{4}$/.test(yyyy)) {
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  const digits = t.replace(/\D/g, '');
  if (digits.length >= 8) {
    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yyyy = digits.length >= 8 ? digits.slice(-4) : '';
    if (yyyy.length === 4) return `${dd}/${mm}/${yyyy}`;
  }

  return null;
}

/**
 * Data de audiência no txt — aplica Mid do VB e interpreta a exibição como **dd/mm/aaaa**.
 * @param {string | null | undefined} texto
 * @returns {string | null}
 */
export function parseDataAudienciaLegadoIso(texto) {
  if (texto == null) return null;
  const t = String(texto).trim();
  if (!t) return null;

  const exibicao = audienciaStorageParaExibicaoVB(t);
  if (exibicao) {
    const iso = parseDataCabecalhoProcessoIso(exibicao);
    if (iso) return iso;
  }

  return parseDataCabecalhoProcessoIso(t);
}

/**
 * Célula de data na planilha `Processos_imp.xls` (string dd/mm ou serial Excel).
 * @param {unknown} v
 * @returns {string | null}
 */
export function parseDataPlanilhaCellIso(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 1000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return isoFromYmd(d.y, d.m, d.d);
  }
  return parseDataCabecalhoProcessoIso(v);
}
