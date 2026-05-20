/** Converte data BR (DD/MM/AAAA) em chave de período YYYY-MM para filtros do extrato. */
export function mesAnoFromDataBr(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBr ?? '').trim());
  return m ? `${m[3]}-${m[2]}` : null;
}

/**
 * URL do extrato financeiro focada em um lançamento (banco + mês + id).
 * @param {{ lancamentoId: number | string, numeroBanco?: number | string | null, data?: string }} opts
 */
export function buildExtratoUrlParaLancamento({ lancamentoId, numeroBanco, data }) {
  const id = Number(lancamentoId);
  if (!Number.isFinite(id) || id <= 0) return '/financeiro/extrato';

  const params = new URLSearchParams();
  params.set('lancamento', String(id));

  const nb = Number(numeroBanco);
  if (Number.isFinite(nb) && nb > 0) params.set('banco', String(nb));

  const mes = mesAnoFromDataBr(data);
  if (mes) params.set('mes', mes);

  return `/financeiro/extrato?${params.toString()}`;
}

export function scrollExtratoParaLancamento(lancamentoId) {
  const id = Number(lancamentoId);
  if (!Number.isFinite(id)) return;
  const el = document.querySelector(`[data-lancamento-id="${id}"]`);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
