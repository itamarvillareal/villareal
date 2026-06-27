/**
 * Interpreta valores monetários em formato brasileiro com segurança.
 * Evita tratar «1.200» como decimal inglês quando o correto é milhar + «,45» como centavos.
 *
 * Aceita: número Excel; "R$ 1.234,56"; "1234,56"; "1.234,56"; números simples.
 */
export function parseValorMonetarioBr(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  let s = String(v).trim().replace(/\u00a0/g, ' ');
  if (!s) return null;
  s = s.replace(/\s/g, '').replace(/R\$/gi, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastComma > lastDot) {
    const intPart = s.slice(0, lastComma).replace(/\./g, '').replace(/[^\d-]/g, '');
    const frac = s.slice(lastComma + 1).replace(/\D/g, '');
    if (!intPart && !frac) return null;
    const normalized = frac.length ? `${intPart || '0'}.${frac}` : intPart || '0';
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  if (lastDot !== -1 && lastDot > lastComma) {
    // Milhar BR sem vírgula (campo durante digitação/blur: «1.700» → 1700).
    if (lastComma === -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      const n = Number(s.replace(/\./g, ''));
      return Number.isFinite(n) ? n : null;
    }
    const intPart = s.slice(0, lastDot).replace(/,/g, '').replace(/[^\d-]/g, '');
    const frac = s.slice(lastDot + 1).replace(/\D/g, '');
    if (!intPart && !frac) return null;
    const normalized = frac.length ? `${intPart || '0'}.${frac}` : intPart || '0';
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  if (lastComma !== -1) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  const digits = s.replace(/[^\d.-]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}
