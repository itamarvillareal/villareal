/**
 * Ordenação da fila «Movimentações / Publicações Email» pela entrada do email (Gmail),
 * não pela data da movimentação processual.
 */

const FUSO_ENTRADA_EMAIL = 'America/Sao_Paulo';

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

/** Epoch ms da entrada do email (cabeçalho Date do Gmail). */
export function msEntradaEmail(row) {
  const raw = row?.emailRecebidoEm;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

/** ISO da coluna Entrada — fiel ao cabeçalho Date do email Gmail. */
export function entradaEmailExibicaoIso(row) {
  const raw = row?.emailRecebidoEm;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** @deprecated Preferir {@link entradaEmailExibicaoIso} para exibição fiel ao email. */
export function entradaEmailEfetivaIso(row) {
  return entradaEmailExibicaoIso(row) ?? (() => {
    const ms = msEntradaEmail(row);
    if (ms == null) return null;
    return new Date(ms).toISOString();
  })();
}

/** ID da mensagem Gmail em `arquivoOrigem` / `arquivoOrigemNome` (ex.: `[19f58aab90524773]`). */
export function gmailMessageIdLinha(row) {
  const s = String(row?.arquivoOrigem || row?.arquivoOrigemNome || '').trim();
  const m = /\[([a-f0-9]{10,})\]\s*$/i.exec(s);
  return m ? m[1].toLowerCase() : '';
}

function ordemCaixaNum(row) {
  const n = Number(row?.gmailCaixaOrdem ?? row?.gmail_caixa_ordem);
  return Number.isFinite(n) ? n : null;
}

export function temOrdemCaixaGmail(row) {
  return ordemCaixaNum(row) != null;
}

/**
 * Comparador fiel à caixa Gmail: `gmailCaixaOrdem` asc (0 = topo), depois fallbacks.
 */
export function compararPorOrdemCaixaGmail(a, b, asc = false) {
  const oa = ordemCaixaNum(a);
  const ob = ordemCaixaNum(b);
  if (oa != null && ob != null && oa !== ob) {
    return asc ? ob - oa : oa - ob;
  }
  if (oa != null && ob == null) return -1;
  if (oa == null && ob != null) return 1;
  if (oa == null && ob == null) return Number(b.id ?? 0) - Number(a.id ?? 0);
  return compararPorEntradaEmail(a, b, asc);
}

export function ordenarPorOrdemCaixaGmail(rows, asc = false) {
  return [...rows].sort((a, b) => compararPorOrdemCaixaGmail(a, b, asc));
}

/**
 * Comparador: entrada do email (desc por padrão), depois id Gmail (mais recente no inbox),
 * depois id do banco. Sem emailRecebidoEm, cai na data da movimentação.
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

  const ga = gmailMessageIdLinha(a);
  const gb = gmailMessageIdLinha(b);
  if (ga !== gb) {
    return asc ? ga.localeCompare(gb) : gb.localeCompare(ga);
  }

  return Number(b.id ?? 0) - Number(a.id ?? 0);
}

export function ordenarPorEntradaEmail(rows, asc = false) {
  return [...rows].sort((a, b) => compararPorEntradaEmail(a, b, asc));
}
