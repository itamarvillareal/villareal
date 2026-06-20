import { isNumeroCartaoFinanceiro } from '../../../data/financeiroData.js';
import { mesAnoFromDataLancamento } from './extratoMesUtils.js';

/** Converte data BR (DD/MM/AAAA) em chave de período YYYY-MM para filtros do extrato. */
export function mesAnoFromDataBr(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBr ?? '').trim());
  return m ? `${m[3]}-${m[2]}` : null;
}

/** Identifica número do cartão a partir de uma linha de extrato/inbox. */
export function numeroCartaoFromRow(row) {
  if (!row) return null;
  if (row.origemExtrato === 'cartao' || row.cartaoId != null) {
    const nc = Number(row.numeroCartao ?? row.numeroBanco);
    if (Number.isFinite(nc) && nc > 0) return nc;
  }
  const candidato = Number(row.numeroCartao ?? row.numeroBanco);
  if (isNumeroCartaoFinanceiro(candidato)) return candidato;
  return null;
}

/**
 * URL do extrato bancário focada em um lançamento (banco + mês + id).
 * @param {{ lancamentoId: number | string, numeroBanco?: number | string | null, data?: string }} opts
 */
export function buildExtratoUrlParaLancamento({ lancamentoId, numeroBanco, data }) {
  const id = Number(lancamentoId);
  if (!Number.isFinite(id) || id <= 0) return '/financeiro/extrato';

  const nb = Number(numeroBanco);
  if (Number.isFinite(nb) && nb > 0 && isNumeroCartaoFinanceiro(nb)) {
    return buildCartaoUrlParaLancamento({ lancamentoId: id, numeroCartao: nb, data });
  }

  const params = new URLSearchParams();
  params.set('lancamento', String(id));

  if (Number.isFinite(nb) && nb > 0) params.set('banco', String(nb));

  const mes = mesAnoFromDataBr(data) ?? mesAnoFromDataLancamento(data);
  if (mes) params.set('mes', mes);

  return `/financeiro/extrato?${params.toString()}`;
}

/**
 * URL do extrato de cartão focada em um lançamento.
 * @param {{ lancamentoId: number | string, numeroCartao: number | string, data?: string, mes?: string }} opts
 */
export function buildCartaoUrlParaLancamento({ lancamentoId, numeroCartao, data, mes }) {
  const id = Number(lancamentoId);
  const nc = Number(numeroCartao);
  if (!Number.isFinite(nc) || nc <= 0) return '/financeiro/cartao';

  const params = new URLSearchParams();
  if (Number.isFinite(id) && id > 0) params.set('lancamento', String(id));

  const mesParam = mes ?? mesAnoFromDataBr(data) ?? mesAnoFromDataLancamento(data);
  if (mesParam) params.set('mes', mesParam);

  const qs = params.toString();
  return qs ? `/financeiro/cartao/${nc}?${qs}` : `/financeiro/cartao/${nc}`;
}

/** Navega para o extrato correto (banco ou cartão) na linha do lançamento. */
export function navegarExtratoLancamento(navigate, row) {
  if (!row?.id || typeof navigate !== 'function') return;

  const numeroCartao = numeroCartaoFromRow(row);
  if (numeroCartao) {
    navigate(
      buildCartaoUrlParaLancamento({
        lancamentoId: row.id,
        numeroCartao,
        data: row.dataExibicao ?? row.dataLancamento,
      }),
    );
    return;
  }

  navigate(
    buildExtratoUrlParaLancamento({
      lancamentoId: row.id,
      numeroBanco: row.numeroBanco,
      data: row.dataExibicao ?? row.dataLancamento,
    }),
  );
}

/** Navega para o extrato bancário a partir de um item da aba Escritório (semelhantes). */
export function navegarExtratoSemelhanteItem(navigate, item, grupo) {
  if (!item?.lancamentoId || typeof navigate !== 'function') return;
  navigate(
    buildExtratoUrlParaLancamento({
      lancamentoId: item.lancamentoId,
      numeroBanco: grupo?.numeroBanco ?? item?.numeroBanco,
      data: item.dataLancamento,
    }),
  );
}

export function scrollExtratoParaLancamento(lancamentoId) {
  const id = Number(lancamentoId);
  if (!Number.isFinite(id)) return;
  const el = document.querySelector(`[data-lancamento-id="${id}"]`);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** Índice de página (0-based) onde o lançamento aparece na lista paginada. */
export function paginaDoLancamentoNaLista(lista, lancamentoId, pageSize) {
  const id = Number(lancamentoId);
  const size = Math.max(1, Number(pageSize) || 50);
  const idx = (lista ?? []).findIndex((r) => Number(r.id) === id);
  if (idx < 0) return null;
  return Math.floor(idx / size);
}
