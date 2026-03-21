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
