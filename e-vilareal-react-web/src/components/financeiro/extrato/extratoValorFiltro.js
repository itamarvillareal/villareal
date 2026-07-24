/** Filtro da coluna Valor no extrato: todos | lt0 | gt0 | exato. */

export const VALOR_FILTRO_TODOS = 'todos';
export const VALOR_FILTRO_LT0 = 'lt0';
export const VALOR_FILTRO_GT0 = 'gt0';
export const VALOR_FILTRO_EXATO = 'exato';

/**
 * @param {URLSearchParams} params
 * @returns {{ valorFiltro: string, valorExato: number | null }}
 */
export function parseValorFiltroParam(params) {
  const kind = String(params.get('valorFiltro') ?? '').trim().toLowerCase();
  if (kind === VALOR_FILTRO_LT0 || kind === VALOR_FILTRO_GT0) {
    return { valorFiltro: kind, valorExato: null };
  }
  if (kind === VALOR_FILTRO_EXATO) {
    const raw = params.get('valorExato');
    const n = raw != null && raw !== '' ? Number(raw) : NaN;
    if (Number.isFinite(n) && n !== 0) {
      return { valorFiltro: VALOR_FILTRO_EXATO, valorExato: n };
    }
  }
  return { valorFiltro: VALOR_FILTRO_TODOS, valorExato: null };
}

/** Interpreta valor em formato BR (ex.: 1.234,56 ou -50) para número. */
export function parseValorExtratoBr(s) {
  const cleaned = String(s ?? '')
    .trim()
    .replace(/R\$\s?/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Mapeia o filtro de valor da URL para params da API do extrato.
 * Valor no banco é módulo; sinal vem de natureza (CREDITO/DEBITO).
 * @param {{ valorFiltro?: string, valorExato?: number | null }} filtro
 * @returns {{ natureza?: string, valorExato?: number }}
 */
export function valorFiltroParaQueryApi(filtro) {
  const kind = filtro?.valorFiltro || VALOR_FILTRO_TODOS;
  if (kind === VALOR_FILTRO_LT0) return { natureza: 'DEBITO' };
  if (kind === VALOR_FILTRO_GT0) return { natureza: 'CREDITO' };
  if (kind === VALOR_FILTRO_EXATO && filtro?.valorExato != null && Number.isFinite(filtro.valorExato)) {
    const signed = Number(filtro.valorExato);
    if (signed === 0) return {};
    return {
      natureza: signed < 0 ? 'DEBITO' : 'CREDITO',
      valorExato: Math.abs(signed),
    };
  }
  return {};
}

export function rotuloValorFiltro(filtro) {
  const kind = filtro?.valorFiltro || VALOR_FILTRO_TODOS;
  if (kind === VALOR_FILTRO_LT0) return 'Valor < 0';
  if (kind === VALOR_FILTRO_GT0) return 'Valor > 0';
  if (kind === VALOR_FILTRO_EXATO && filtro?.valorExato != null) {
    const n = Number(filtro.valorExato);
    const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
    return `Valor = ${fmt}`;
  }
  return 'Valor';
}
