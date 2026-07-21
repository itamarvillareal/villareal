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
import { letrasParaQueryApi } from '../extrato/extratoLetrasFiltro.js';
import { periodoParaListagemApi, periodoParaQueryApi } from '../shared/periodoFinanceiro.js';
import { filtroCompensacaoSemParAtivo } from '../extrato/compensacaoSemPar.js';
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
  const semPar = filtroCompensacaoSemParAtivo(filtros);
  const periodo = {
    ...periodoParaListagemApi(filtros.mes),
    ...periodoParaQueryApi(filtros.mes),
  };
  const letrasQuery = semPar
    ? letrasParaQueryApi({ letras: ['E'], letrasModo: 'incluir' })
    : letrasParaQueryApi({ letras: filtros.letras, letrasModo: filtros.letrasModo });
  const out = [];
  let page = 0;
  let totalPages = 1;
  let truncado = false;

  while (page < totalPages && page < MAX_PAGINAS_BANCO) {
    const res = await listarLancamentosExtratoPaginados(
      {
        ...periodo,
        ...letrasQuery,
        page,
        size: TAM_PAGINA_BANCO,
        sort: 'dataLancamento,desc',
        etapa: semPar ? undefined : filtros.etapa || undefined,
        compensacaoSemPar: semPar ? true : undefined,
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
 * Extratos bancários + cartões, mesclados e filtrados no cliente (sem paginação).
 * @param {{ mes?: string, busca?: string, etapa?: string, letras?: string[], letrasModo?: string, sortAsc?: boolean }} filtros
 */
export async function carregarTotalFinanceiroLinhas(filtros = {}, opts = {}) {
  const { signal } = opts;
  const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());

  const semParCompensacao = filtroCompensacaoSemParAtivo(filtros);

  const [{ rows: bancoRows, truncado: truncadoBanco }, cartaoRows] = await Promise.all([
    carregarLinhasBancoTotal(filtros, contaToLetra, signal),
    carregarLinhasCartaoTotal(filtros, contaToLetra, signal),
  ]);

  const mesclado = mesclarLinhasTotal(bancoRows, cartaoRows, { sortAsc: Boolean(filtros.sortAsc) });
  const filtrado = filtrarLinhasTotal(mesclado, {
    busca: filtros.busca,
    etapa: filtros.etapa,
    letras: filtros.letras,
    letrasModo: filtros.letrasModo,
    semParCompensacao,
  });

  return {
    linhas: filtrado,
    truncado: truncadoBanco,
    totalBanco: bancoRows.length,
    totalCartao: cartaoRows.length,
  };
}

/**
 * Extratos bancários + cartões, mesclados e paginados no cliente.
 * @param {{ mes?: string, busca?: string, etapa?: string, page?: number, size?: number, sortAsc?: boolean }} filtros
 */
export async function carregarTotalFinanceiroPaginado(filtros = {}, opts = {}) {
  const { linhas, truncado, totalBanco, totalCartao } = await carregarTotalFinanceiroLinhas(filtros, opts);
  const pagina = paginarLinhasTotal(linhas, {
    page: filtros.page,
    size: filtros.size,
  });

  return {
    ...pagina,
    truncado,
    totalBanco,
    totalCartao,
  };
}
