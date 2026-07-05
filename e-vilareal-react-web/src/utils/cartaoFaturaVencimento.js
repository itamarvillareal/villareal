/** Crédito-síntese de fechamento (AUTO-FAT) — visível só em /financeiro/cartoes/fechamentos. */
export function ehLancamentoFechamentoAutomatico(row) {
  const numero = String(row?.numeroLancamento ?? '').trim();
  const origem = String(row?.origem ?? '').trim();
  return /^AUTO-FAT-/i.test(numero) || origem === 'AUTO';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Ano da compra em fatura de cartão quando a planilha traz só dia/mês.
 * Compras após o mês de vencimento pertencem ao ano anterior (ex.: 30/12 na fatura com venc. 01/2026 → 2025).
 */
export function inferirAnoCompraFaturaCartao(dia, mes, mesVencimento, anoVencimento) {
  const d = Number(dia);
  const m = Number(mes);
  const mesVenc = Number(mesVencimento);
  const anoBase = Number(anoVencimento);
  if (!Number.isFinite(d) || !Number.isFinite(m) || d < 1 || m < 1 || m > 12) return null;
  if (!Number.isFinite(anoBase) || anoBase < 1900) return new Date().getFullYear();
  const ano = m > (Number.isFinite(mesVenc) && mesVenc >= 1 && mesVenc <= 12 ? mesVenc : 12) ? anoBase - 1 : anoBase;
  return ano;
}

/** Corrige data da compra gravada com ano errado em importações de fatura (Excel BTG/Itaú). */
export function dataCompraCartaoCorrigida(row) {
  const lanc = isoDataCartao(row?.dataLancamento);
  if (!lanc) return lanc;
  const origem = String(row?.origem ?? '').trim();
  if (!/^FATURA_/i.test(origem)) return lanc;
  const comp = isoDataCartao(row?.dataCompetencia);
  if (!comp) return lanc;

  const dia = Number(lanc.slice(8, 10));
  const mes = Number(lanc.slice(5, 7));
  const mesVenc = Number(comp.slice(5, 7));
  const anoVenc = Number(comp.slice(0, 4));
  const ano = inferirAnoCompraFaturaCartao(dia, mes, mesVenc, anoVenc);
  if (!Number.isFinite(ano)) return lanc;

  const corrigida = `${ano}-${pad2(mes)}-${pad2(dia)}`;
  return corrigida;
}

/** Normaliza data ISO (YYYY-MM-DD) ou BR (DD/MM/AAAA) para YYYY-MM-DD. */
export function isoDataCartao(val) {
  const s = String(val ?? '').trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
}

/**
 * Vencimento da fatura (data única por importação), distinto da data da compra (`dataLancamento`).
 * Só considera competência quando veio de importação de fatura ou quando difere da data do lançamento.
 */
export function vencimentoFaturaDeLancamento(row) {
  const comp = isoDataCartao(row?.dataCompetencia);
  if (!comp) return '';
  const numero = String(row?.numeroLancamento ?? '').trim();
  const origem = String(row?.origem ?? '').trim();
  if (/^AUTO-FAT-/i.test(numero) || origem === 'AUTO') return comp;
  const lanc = isoDataCartao(row?.dataLancamento);
  if (/^FATURA_/i.test(origem)) return comp;
  if (lanc && comp !== lanc) return comp;
  return '';
}

/** Valor com sinal da fatura (negativo = débito/compra). Aceita linha API ou extrato row. */
export function valorAssinadoLinhaCartao(row) {
  const bruto = Number(row?.valor) || 0;
  if (row?.natureza != null) {
    const abs = Math.abs(bruto);
    return String(row.natureza).toUpperCase() === 'DEBITO' ? -abs : abs;
  }
  return bruto;
}

/** Agrupa vencimentos de fatura disponíveis para filtro na tela do cartão. */
export function listarVencimentosFaturaCartao(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    if (ehLancamentoFechamentoAutomatico(row)) continue;
    const iso = vencimentoFaturaDeLancamento(row);
    if (!iso) continue;
    const cur = map.get(iso) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += valorAssinadoLinhaCartao(row);
    map.set(iso, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([iso, info]) => ({ iso, count: info.count, total: info.total }));
}
