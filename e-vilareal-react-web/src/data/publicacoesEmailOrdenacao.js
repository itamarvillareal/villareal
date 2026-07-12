/**
 * Ordenação da fila «Movimentações / Publicações Email» pela entrada do email (Gmail),
 * não pela data da movimentação processual.
 */

function msDataPublicacaoFallback(row) {
  const raw = row?.dataPublicacao;
  if (!raw) return Number.NEGATIVE_INFINITY;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = new Date(s.slice(0, 10)).getTime();
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  }
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const t = new Date(`${br[3]}-${br[2]}-${br[1]}`).getTime();
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  }
  return Number.NEGATIVE_INFINITY;
}

/** Epoch ms do recebimento do email; null se ausente. */
export function msEntradaEmail(row) {
  const iso = row?.emailRecebidoEm;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Comparador: entrada do email (desc por padrão), depois id (mais recente no banco).
 * Sem emailRecebidoEm, cai na data da movimentação.
 */
export function compararPorEntradaEmail(a, b, asc = false) {
  const da = msEntradaEmail(a);
  const db = msEntradaEmail(b);

  if (da == null && db == null) {
    const pa = msDataPublicacaoFallback(a);
    const pb = msDataPublicacaoFallback(b);
    if (pa !== pb) return asc ? pa - pb : pb - pa;
  } else if (da == null) {
    return 1;
  } else if (db == null) {
    return -1;
  } else if (da !== db) {
    return asc ? da - db : db - da;
  }

  return Number(b.id ?? 0) - Number(a.id ?? 0);
}

export function ordenarPorEntradaEmail(rows, asc = false) {
  return [...rows].sort((a, b) => compararPorEntradaEmail(a, b, asc));
}
