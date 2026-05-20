import { resolverAliasHojeEmTexto } from '../../services/hjDateAliasService.js';

function parseDateBRModulo(str) {
  let s = String(str ?? '').trim();
  const alias = resolverAliasHojeEmTexto(s, 'br');
  if (alias) s = alias;
  if (!s || s.length < 10) return null;
  const [dd, mm, yyyy] = s.split('/');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBRFromDate(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** Normaliza texto digitado para dd/mm/aaaa; vazio ou inválido → ''. */
export function normalizarTextoDataBRparaSalvar(s) {
  let t = String(s ?? '').trim();
  const alias = resolverAliasHojeEmTexto(t, 'br');
  if (alias) t = alias;
  if (!t) return '';
  const d0 = parseDateBRModulo(t);
  if (d0 && !Number.isNaN(d0.getTime())) return formatDateBRFromDate(d0);
  const parts = t.split(/[/-]/).map((p) => p.trim());
  if (parts.length !== 3) return '';
  const dd = String(Math.min(31, Math.max(1, Number(parts[0]) || 0))).padStart(2, '0');
  const mm = String(Math.min(12, Math.max(1, Number(parts[1]) || 0))).padStart(2, '0');
  let yyyy = String(parts[2] ?? '').replace(/\D/g, '');
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  if (yyyy.length !== 4) return '';
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? '' : formatDateBRFromDate(d);
}

export function parseBRL(str) {
  if (str == null) return 0;
  const s = String(str).trim();
  if (!s) return 0;
  const cleaned = s.replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

export function formatBRL(n) {
  const v = Number(n) || 0;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
