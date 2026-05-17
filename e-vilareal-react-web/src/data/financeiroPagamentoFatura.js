/** Heurísticas para pagamento de fatura: débito no banco ↔ crédito na fatura do cartão. */

export const RE_DESC_DEBITO_BANCO_CARTAO =
  /cart[aã]o|personnalite|pagto\s+eletron\s+cobr|pagto\s+cobranca|pagamento.*cart/i;

export const RE_DESC_PAGAMENTO_CARTAO =
  /pagto\s+conta\s+titulos|pagamento\s+efetuado|pagamento\s+de\s+fatura|debito\s+automatico/i;

export function centavos(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function dataBrParaMs(dataStr) {
  const s = String(dataStr ?? '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (!m) {
    const iso = String(dataStr ?? '').slice(0, 10);
    const t = Date.parse(`${iso}T12:00:00`);
    return Number.isFinite(t) ? t : null;
  }
  let y = m[3];
  if (y.length === 2) y = `20${y}`;
  return Date.parse(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T12:00:00`);
}

export function lancamentoBancoElegivelPagamentoFatura(t) {
  const v = Number(t?.valor ?? 0);
  if (!t?.data || !Number.isFinite(v) || v >= 0) return false;
  const letra = String(t.letra ?? '').trim().toUpperCase();
  const desc = String(t.descricao ?? '');
  return letra === 'E' || RE_DESC_DEBITO_BANCO_CARTAO.test(desc);
}

export function lancamentoCartaoElegivelPagamentoFatura(t) {
  const v = Number(t?.valor ?? 0);
  if (!t?.data || !Number.isFinite(v) || v <= 0) return false;
  return RE_DESC_PAGAMENTO_CARTAO.test(String(t.descricao ?? ''));
}

/**
 * Sugere pares banco (débito) ↔ cartão (pagamento na fatura) por valor absoluto e proximidade de data.
 * Não altera dados; vínculo explícito fica na API (`/pagamentos-fatura/vinculos`).
 */
export function detectarSugestoesPagamentoFatura(
  extratosPorBanco,
  extratosPorCartao,
  opts = {},
) {
  const diasTolerancia = Number(opts.diasTolerancia ?? 31);
  const tolCent = Number(opts.centavosTolerancia ?? 2);
  const msTol = diasTolerancia * 86400000;

  const poolB = [];
  for (const [nomeBanco, list] of Object.entries(extratosPorBanco || {})) {
    if (!Array.isArray(list)) continue;
    list.forEach((t, idx) => {
      if (!lancamentoBancoElegivelPagamentoFatura(t)) return;
      poolB.push({ nomeBanco, idx, t, k: `b|${nomeBanco}|${t.numero}|${t.data}|${idx}` });
    });
  }

  const poolC = [];
  for (const [nomeCartao, list] of Object.entries(extratosPorCartao || {})) {
    if (!Array.isArray(list)) continue;
    list.forEach((t, idx) => {
      if (!lancamentoCartaoElegivelPagamentoFatura(t)) return;
      poolC.push({ nomeCartao, idx, t, k: `c|${nomeCartao}|${t.numero}|${t.data}|${idx}` });
    });
  }

  const usadoB = new Set();
  const usadoC = new Set();
  const sugestoes = [];

  for (const a of poolB) {
    if (usadoB.has(a.k)) continue;
    const ca = centavos(a.t.valor);
    const da = dataBrParaMs(a.t.data);
    if (ca === null || da === null) continue;
    const alvo = Math.abs(ca);

    let melhor = null;
    let melhorDelta = Infinity;
    for (const b of poolC) {
      if (usadoC.has(b.k)) continue;
      const cb = centavos(b.t.valor);
      const db = dataBrParaMs(b.t.data);
      if (cb === null || db === null) continue;
      if (Math.abs(Math.abs(cb) - alvo) > tolCent) continue;
      const delta = Math.abs(db - da);
      if (delta > msTol) continue;
      if (delta < melhorDelta) {
        melhorDelta = delta;
        melhor = b;
      }
    }
    if (!melhor) continue;
    usadoB.add(a.k);
    usadoC.add(melhor.k);
    sugestoes.push({
      confianca: melhorDelta <= 3 * 86400000 ? 'alta' : 'media',
      diasDistancia: Math.round(melhorDelta / 86400000),
      banco: {
        nome: a.nomeBanco,
        numero: a.t.numero,
        data: a.t.data,
        valor: a.t.valor,
        descricao: a.t.descricao || '',
        apiId: a.t.apiId ?? null,
      },
      cartao: {
        nome: melhor.nomeCartao,
        numero: melhor.t.numero,
        data: melhor.t.data,
        valor: melhor.t.valor,
        descricao: melhor.t.descricao || '',
        apiId: melhor.t.apiId ?? null,
      },
    });
  }

  return sugestoes;
}
