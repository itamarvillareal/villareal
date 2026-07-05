/** Valor assinado do DTO de lançamento cartão (fechamento AUTO-FAT). */
export function signedValorFechamentoApi(l) {
  return Number(l?.valor ?? 0);
}

function chaveMesDeLancamento(l) {
  const iso = String(l?.dataLancamento ?? '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(iso) ? iso : null;
}

function chaveAnoDeLancamento(l) {
  const iso = String(l?.dataLancamento ?? '').slice(0, 4);
  return /^\d{4}$/.test(iso) ? iso : null;
}

function agruparPorChave(lancamentos, chaveFn) {
  const map = new Map();
  for (const l of lancamentos ?? []) {
    const chave = chaveFn(l);
    if (!chave) continue;
    const cur = map.get(chave) ?? { chave, quantidade: 0, valor: 0 };
    cur.quantidade += 1;
    cur.valor += signedValorFechamentoApi(l);
    map.set(chave, cur);
  }
  return [...map.values()].sort((a, b) => b.chave.localeCompare(a.chave));
}

export function agruparFechamentosPorMes(lancamentos) {
  return agruparPorChave(lancamentos, chaveMesDeLancamento);
}

export function agruparFechamentosPorAno(lancamentos) {
  return agruparPorChave(lancamentos, chaveAnoDeLancamento);
}

export function resumoTotalFechamentos(lancamentos) {
  const lista = lancamentos ?? [];
  return {
    quantidade: lista.length,
    valor: lista.reduce((s, l) => s + signedValorFechamentoApi(l), 0),
  };
}

function chaveCartaoDeLancamento(l) {
  const id = Number(l?.cartaoId);
  if (Number.isFinite(id) && id > 0) {
    return {
      key: `id:${id}`,
      cartaoId: id,
      cartaoNome: String(l.cartaoNome ?? '').trim() || `Cartão #${id}`,
    };
  }
  const nome = String(l.cartaoNome ?? 'Sem cartão').trim() || 'Sem cartão';
  return { key: `nome:${nome}`, cartaoId: null, cartaoNome: nome };
}

export function agruparFechamentosPorCartao(lancamentos) {
  const map = new Map();
  for (const l of lancamentos ?? []) {
    const { key, cartaoId, cartaoNome } = chaveCartaoDeLancamento(l);
    const cur = map.get(key) ?? { cartaoId, cartaoNome, lista: [] };
    cur.lista.push(l);
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ cartaoId, cartaoNome, lista }) => ({
      cartaoId,
      cartaoNome,
      total: resumoTotalFechamentos(lista),
      porMes: agruparFechamentosPorMes(lista),
      porAno: agruparFechamentosPorAno(lista),
    }))
    .sort((a, b) => a.cartaoNome.localeCompare(b.cartaoNome, 'pt-BR'));
}

/** Inclui cartões cadastrados sem fechamento AUTO-FAT. */
export function mesclarCartoesComResumos(resumos, cartoes) {
  const byId = new Map(
    (resumos ?? []).filter((r) => r.cartaoId != null).map((r) => [r.cartaoId, r]),
  );
  const merged = (cartoes ?? []).map(
    (c) =>
      byId.get(c.id) ?? {
        cartaoId: c.id,
        cartaoNome: c.nome,
        total: { quantidade: 0, valor: 0 },
        porMes: [],
        porAno: [],
      },
  );
  for (const r of resumos ?? []) {
    if (r.cartaoId != null && !merged.some((m) => m.cartaoId === r.cartaoId)) merged.push(r);
    else if (r.cartaoId == null) merged.push(r);
  }
  return merged.sort((a, b) => a.cartaoNome.localeCompare(b.cartaoNome, 'pt-BR'));
}

export function linkExtratoFechamentos({ cartaoId, mes, ano } = {}) {
  const params = new URLSearchParams();
  if (cartaoId != null) params.set('cartaoId', String(cartaoId));
  if (mes) params.set('mes', mes);
  if (ano) params.set('ano', ano);
  const q = params.toString();
  return `/financeiro/cartoes/fechamentos${q ? `?${q}` : ''}`;
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function labelMesFechamento(chaveMes) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(chaveMes ?? '').trim());
  if (!m) return String(chaveMes ?? '');
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return chaveMes;
  return `${MESES_CURTOS[mes - 1]}/${m[1]}`;
}
