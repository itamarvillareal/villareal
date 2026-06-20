import { createHash } from 'node:crypto';

import { LETRA_PARA_CONTA } from './extrato-bancos-planilha-constantes.mjs';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function excelSerialParaISO(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** @param {unknown} v */
export function parseDataPlanilha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const whole = Math.floor(v);
    if (whole > 20000 && whole < 600000) return excelSerialParaISO(v);
  }
  if (typeof v === 'string') {
    const t = v.trim();
    const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  }
  return null;
}

/** @param {unknown} v */
export function parseValorPlanilha(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function normalizarCodigoCliente8(val) {
  if (val == null || val === '') return null;
  const digits = String(val).trim().replace(/\D/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  const pad = String(n).padStart(8, '0');
  return pad.length > 8 ? pad.slice(-8) : pad;
}

/**
 * Coluna L: código numérico do cliente ou rótulo textual (ex. «Tarifas e Juros»).
 * @returns {{ kind: 'codigo', codigo: string } | { kind: 'label', text: string } | null}
 */
export function interpretarColunaCliente(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const codigo = normalizarCodigoCliente8(val);
    return codigo ? { kind: 'codigo', codigo } : null;
  }
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d+$/.test(s.replace(/\s/g, ''))) {
    const codigo = normalizarCodigoCliente8(s);
    return codigo ? { kind: 'codigo', codigo } : null;
  }
  return { kind: 'label', text: s };
}

/** Col. M — ID do par de compensação (letra E). */
export function parseGrupoCompensacaoPlanilha(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n > 0 ? String(n) : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (digits && Number(digits) > 0) return String(Number(digits));
  return s.slice(0, 40);
}

export function parseNumeroInternoProcesso(val) {
  if (val == null || val === '') return null;
  const n = Number.parseInt(String(val).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** Remove diacríticos (È → E, Á → A, etc.). */
function removerAcentos(s) {
  return String(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Normaliza texto bruto da coluna B antes do lookup em LETRA_PARA_CONTA:
 * trim → upper → sem acentos → colapsa repetição (EE → E).
 * @param {unknown} raw
 */
export function prepararLetraPlanilhaRaw(raw) {
  let s = String(raw ?? '').trim().toUpperCase();
  if (!s) return '';
  s = removerAcentos(s);
  if (/^([A-Z])\1+$/.test(s)) s = s[0];
  return s;
}

export function normalizarLetraPlanilha(raw) {
  const L = prepararLetraPlanilhaRaw(raw);
  if (!L) return null;
  if (LETRA_PARA_CONTA[L]) return L;
  return null;
}

export function normalizarRefTipo(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'R') return 'R';
  if (s === 'N') return 'N';
  return null;
}

export function textoCelula(val) {
  if (val == null || val === '') return '';
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return parseDataPlanilha(val) || String(val).trim();
  }
  return String(val).trim();
}

/**
 * @param {object} p
 * @param {string} p.bancoNome
 * @param {string} p.dataIso
 * @param {number} p.valor
 * @param {string} p.descricao
 * @param {number} p.linhaExcel
 */
export function gerarNumeroLancamento({ bancoNome, dataIso, valor, descricao, linhaExcel }) {
  const cents = Math.round((Number(valor) || 0) * 100);
  const base = `${bancoNome}|${dataIso}|${cents}|${String(descricao).trim().slice(0, 120)}|${linhaExcel}`;
  return `PL-${createHash('sha256').update(base).digest('hex').slice(0, 24)}`;
}

/**
 * @param {{ e?: string, f?: string, j?: string, labelCliente?: string, procPlanilha?: number | null }} parts
 */
export function montarDescricaoDetalhada(parts) {
  const blocos = [];
  if (parts.e) blocos.push(parts.e);
  if (parts.f) blocos.push(parts.f);
  if (parts.j) blocos.push(parts.j);
  if (parts.labelCliente) blocos.push(`Categoria planilha: ${parts.labelCliente}`);
  if (parts.procPlanilha != null) blocos.push(`Proc. (planilha): ${parts.procPlanilha}`);
  const s = blocos.filter(Boolean).join(' · ').trim();
  return s.length > 2000 ? s.slice(0, 2000) : s;
}
