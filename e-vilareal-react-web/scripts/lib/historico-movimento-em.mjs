/**
 * Converte texto de data do histórico local → ISO UTC para `movimento_em` (API / MySQL).
 */

import fs from 'node:fs';
import { parseDataSlashComHint, ymdComLinhaEPastaAno } from './historico-local-txt-paths.mjs';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Serial Excel → meia-noite UTC. */
export function excelSerialParaIsoMeiaNoiteUtc(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T00:00:00.000Z`;
}

/**
 * @param {unknown} val
 * @param {number | null} [mmPastaHint]
 * @returns {string | null} ISO UTC …Z
 */
export function parseMovimentoEmIso(val, mmPastaHint = null) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}T${pad2(val.getHours())}:${pad2(val.getMinutes())}:${pad2(val.getSeconds())}.000Z`;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    if (whole > 20000 && whole < 200000) return excelSerialParaIsoMeiaNoiteUtc(val);
  }
  const s = String(val).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
  const slash = parseDataSlashComHint(s, mmPastaHint);
  if (slash) {
    return `${slash.yyyy}-${pad2(slash.mo)}-${pad2(slash.dd)}T12:00:00.000Z`;
  }
  const n = Number(s.replace(',', '.'));
  if (Number.isFinite(n)) {
    const whole = Math.floor(n);
    if (whole > 20000 && whole < 600000) return excelSerialParaIsoMeiaNoiteUtc(n);
  }
  return null;
}

/**
 * Data de criação do ficheiro (birthtime; senão mtime) → meio-dia UTC no dia local.
 * @param {string | null} absPath
 * @returns {string | null}
 */
export function movimentoEmFromCriacaoFicheiro(absPath) {
  if (!absPath || !String(absPath).trim()) return null;
  try {
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return null;
    const st = fs.statSync(absPath);
    let t = st.birthtime;
    if (!t || Number.isNaN(t.getTime()) || t.getTime() <= 0) t = st.mtime;
    if (!t || Number.isNaN(t.getTime())) return null;
    return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}T12:00:00.000Z`;
  } catch {
    return null;
  }
}

/**
 * Data do tipo 16 com ano/mês da pasta `Ano/aaaa/mm` quando aplicável.
 * Sem data no txt: usa data de criação do ficheiro da informação (tipo 15).
 * @param {string} dataBruta
 * @param {number | null} yyyyPasta
 * @param {number | null} mmPasta
 * @param {string | null} [infoArquivoAbs]
 */
export function movimentoEmFromHistoricoLocal(dataBruta, yyyyPasta, mmPasta, infoArquivoAbs = null) {
  if (dataBruta && String(dataBruta).trim()) {
    const ymd = ymdComLinhaEPastaAno(dataBruta, yyyyPasta, mmPasta);
    if (ymd) return `${ymd}T12:00:00.000Z`;
    return parseMovimentoEmIso(dataBruta, mmPasta);
  }
  return movimentoEmFromCriacaoFicheiro(infoArquivoAbs);
}
