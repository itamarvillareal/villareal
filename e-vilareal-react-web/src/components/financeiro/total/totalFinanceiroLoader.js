import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  listarLancamentosCartaoFinanceiro,
  listarLancamentosExtratoPaginados,
} from '../../../repositories/financeiroRepository.js';
import { ehLancamentoFechamentoAutomatico } from '../../../utils/cartaoFaturaVencimento.js';
import { mapApiLancamentoCartaoToExtratoRow, mapApiLancamentoToExtratoRow } from '../extrato/extratoMappers.js';
import { periodoParaListagemApi, periodoParaQueryApi } from '../shared/periodoFinanceiro.js';
import {
  extratoRowKey,
  filtrarLinhasTotal,
  mesclarLinhasTotal,
  paginarLinhasTotal,
} from './totalFinanceiroMerge.js';

const MAX_PAGINAS_BANCO = 40;
const TAM_PAGINA_BANCO = 500;

function mapBancoRow(l, contaToLetra) {
  const row = mapApiLancamentoToExtratoRow(l, contaToLetra);
  return {
    ...row,
    origemExtrato: 'banco',
    _rowKey: extratoRowKey({ ...row, origemExtrato: 'banco' }),
  };
}

function mapCartaoRow(l, contaToLetra) {
  const row = mapApiLancamentoCartaoToExtratoRow(l, contaToLetra);
  return {
    ...row,
    origemExtrato: 'cartao',
    _rowKey: extratoRowKey({ ...row, origemExtrato: 'cartao' }),
  };
}

async function carregarLinhasBancoTotal(filtros, contaToLetra, signal) {
  const periodo = {
    ...periodoParaListagemApi(filtros.mes),
    ...periodoParaQueryApi(filtros.mes),
  };
  const out = [];
  let page = 0;
  let totalPages = 1;
  let truncado = false;

  while (page < totalPages && page < MAX_PAGINAS_BANCO) {
    const res = await listarLancamentosExtratoPaginados(
      {
        ...periodo,
        page,
        size: TAM_PAGINA_BANCO,
        sort: 'dataLancamento,desc',
        etapa: filtros.etapa || undefined,
      },
      { signal },
    );
    for (const l of res?.content ?? []) {
      out.push(mapBancoRow(l, contaToLetra));
    }
    totalPages = Math.max(1, Number(res?.totalPages) || 1);
    page += 1;
    if (!(res?.content?.length)) break;
  }
  if (page >= MAX_PAGINAS_BANCO && page < totalPages) {
    truncado = true;
  }
  return { rows: out, truncado };
}

async function carregarLinhasCartaoTotal(filtros, contaToLetra, signal) {
  const intervalo = periodoParaQueryApi(filtros.mes);
  const lista = await listarLancamentosCartaoFinanceiro(intervalo, { signal });
  return (Array.isArray(lista) ? lista : [])
    .map((l) => mapCartaoRow(l, contaToLetra))
    .filter((row) => !ehLancamentoFechamentoAutomatico(row));
}

/**
 * Extratos bancários + cartões, mesclados e paginados no cliente.
 * @param {{ mes?: string, busca?: string, etapa?: string, page?: number, size?: number, sortAsc?: boolean }} filtros
 */
export async function carregarTotalFinanceiroPaginado(filtros = {}, opts = {}) {
  const { signal } = opts;
  const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());

  const [{ rows: bancoRows, truncado: truncadoBanco }, cartaoRows] = await Promise.all([
    carregarLinhasBancoTotal(filtros, contaToLetra, signal),
    carregarLinhasCartaoTotal(filtros, contaToLetra, signal),
  ]);

  const mesclado = mesclarLinhasTotal(bancoRows, cartaoRows, { sortAsc: Boolean(filtros.sortAsc) });
  const filtrado = filtrarLinhasTotal(mesclado, {
    busca: filtros.busca,
    etapa: filtros.etapa,
  });
  const pagina = paginarLinhasTotal(filtrado, {
    page: filtros.page,
    size: filtros.size,
  });

  return {
    ...pagina,
    truncado: truncadoBanco,
    totalBanco: bancoRows.length,
    totalCartao: cartaoRows.length,
  };
}
