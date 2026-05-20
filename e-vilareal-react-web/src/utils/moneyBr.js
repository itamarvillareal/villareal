import { parseValorMonetarioBr } from './parseValorMonetarioBr.js';

/**
 * Converte texto monetário pt-BR (como em Cálculos) para centavos inteiros.
 * Aceita "R$ 1.493,49", "1493,49", etc.
 */
export function parseBRLToCentavos(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  const cleaned = s.replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Exibição com símbolo R$ (aceita API «1605.6» e planilha «1.605,60»). */
export function formatValorMoeda(val) {
  const s = String(val ?? '').trim();
  if (!s) return '—';
  const n = parseValorMonetarioBr(val);
  if (n != null && Number.isFinite(n)) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return s.startsWith('R$') ? s : `R$ ${s}`;
}

/** Campo de formulário: 1605.6 → «1.605,60». */
export function formatValorMoedaCampo(val) {
  const n = parseValorMonetarioBr(val);
  if (n == null || !Number.isFinite(n)) return String(val ?? '').trim();
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
