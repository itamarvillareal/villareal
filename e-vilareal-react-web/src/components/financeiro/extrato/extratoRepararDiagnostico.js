import { featureFlags } from '../../../config/featureFlags.js';
import {
  obterContextoImportacaoExtratoApi,
  obterSaldoBancoFinanceiro,
  removerLancamentosFinanceiroApiEmLote,
  salvarLancamentosExtratoEmLote,
} from '../../../repositories/financeiroRepository.js';
import {
  carregarLancamentosExistentesBanco,
  carregarLancamentosExistentesBancoDesde,
  carregarLancamentosExistentesBancoNoPeriodo,
} from './importUtils.js';
import {
  diagnosticarExtratoComOfxCore,
  diagnosticarExtratoComArquivoCore,
  executarAlinhamentoExtratoComOfxCore,
  extrairMetadadosOfx,
  extrairMetadadosDeRows,
  extratoAlinhadoComOfx,
  precisaReparoExtratoComOfx,
  transacoesDesalinhadasNoPeriodoOfx,
  saldoLedgerDesalinhadoComOfx,
  calcularDeltasAlinhamentoSaldo,
  alinhamentoSaldoCoerenteComOfx,
  podeContinuarImportacaoExtratoComOfx,
  prepararExclusaoReparoExtrato,
  prepararImportacaoReparoExtrato,
} from './extratoRepararDiagnosticoCore.js';

export {
  extrairMetadadosOfx,
  extrairMetadadosDeRows,
  prepararExclusaoReparoExtrato,
  prepararImportacaoReparoExtrato,
  diagnosticarExtratoComOfxCore,
  diagnosticarExtratoComArquivoCore,
  precisaReparoExtratoComOfx,
  extratoAlinhadoComOfx,
  transacoesDesalinhadasNoPeriodoOfx,
  saldoLedgerDesalinhadoComOfx,
};

async function montarDiagnosticoReparoExtratoArquivo({ arquivoRows, numeroBanco, signal }) {
  const nb = Number(numeroBanco);
  const meta = extrairMetadadosDeRows(arquivoRows);

  if (!featureFlags.useApiFinanceiro || !Number.isFinite(nb)) {
    const existenteAll = await carregarLancamentosExistentesBanco(nb, signal);
    const saldoApi = await obterSaldoBancoFinanceiro(nb, {
      signal,
      dataReferencia: meta.dataFim ?? undefined,
    });
    return diagnosticarExtratoComArquivoCore({
      arquivoRows,
      meta,
      existenteAll,
      saldoApi,
      origemImportacao: 'PDF',
    });
  }

  const [ctx, saldoApi] = await Promise.all([
    obterContextoImportacaoExtratoApi(nb, signal),
    obterSaldoBancoFinanceiro(nb, {
      signal,
      dataReferencia: meta.dataFim ?? undefined,
    }),
  ]);

  if (!meta.dataInicio || !meta.dataFim) {
    const existenteAll = await carregarLancamentosExistentesBanco(nb, signal);
    return diagnosticarExtratoComArquivoCore({
      arquivoRows,
      meta,
      existenteAll,
      saldoApi,
      dataCorteOverride: ctx?.dataCorte ?? null,
      origemImportacao: 'PDF',
    });
  }

  const dataCorte = ctx?.dataCorte ? String(ctx.dataCorte).slice(0, 10) : null;
  const [periodo, existenteMesclagem] = await Promise.all([
    carregarLancamentosExistentesBancoNoPeriodo(nb, meta.dataInicio, meta.dataFim, signal),
    dataCorte
      ? carregarLancamentosExistentesBancoDesde(nb, dataCorte, signal)
      : Promise.resolve([]),
  ]);

  const sistemaTotal = Number(ctx?.totalNoBanco ?? periodo.totalInPeriod);
  const existenteIgnoradosForaPeriodo = Math.max(0, sistemaTotal - periodo.totalInPeriod);

  return diagnosticarExtratoComArquivoCore({
    arquivoRows,
    meta,
    existenteAll: periodo.rows,
    existenteMesclagem: existenteMesclagem.length ? existenteMesclagem : null,
    saldoApi,
    dataCorteOverride: dataCorte,
    sistemaTotalOverride: sistemaTotal,
    existenteIgnoradosForaPeriodoOverride: existenteIgnoradosForaPeriodo,
    origemImportacao: 'PDF',
  });
}

async function montarDiagnosticoReparoExtrato({ ofxText, numeroBanco, signal }) {
  const nb = Number(numeroBanco);
  const meta = extrairMetadadosOfx(ofxText);

  if (!featureFlags.useApiFinanceiro || !Number.isFinite(nb)) {
    const existenteAll = await carregarLancamentosExistentesBanco(nb, signal);
    const saldoApi = await obterSaldoBancoFinanceiro(nb, {
      signal,
      dataReferencia: meta.dataFim ?? undefined,
    });
    return diagnosticarExtratoComOfxCore({ ofxText, existenteAll, saldoApi });
  }

  const [ctx, saldoApi] = await Promise.all([
    obterContextoImportacaoExtratoApi(nb, signal),
    obterSaldoBancoFinanceiro(nb, {
      signal,
      dataReferencia: meta.dataFim ?? undefined,
    }),
  ]);

  if (!meta.dataInicio || !meta.dataFim) {
    const existenteAll = await carregarLancamentosExistentesBanco(nb, signal);
    return diagnosticarExtratoComOfxCore({
      ofxText,
      existenteAll,
      saldoApi,
      dataCorteOverride: ctx?.dataCorte ?? null,
    });
  }

  const dataCorte = ctx?.dataCorte ? String(ctx.dataCorte).slice(0, 10) : null;
  const [periodo, existenteMesclagem] = await Promise.all([
    carregarLancamentosExistentesBancoNoPeriodo(nb, meta.dataInicio, meta.dataFim, signal),
    dataCorte
      ? carregarLancamentosExistentesBancoDesde(nb, dataCorte, signal)
      : Promise.resolve([]),
  ]);

  const sistemaTotal = Number(ctx?.totalNoBanco ?? periodo.totalInPeriod);
  const existenteIgnoradosForaPeriodo = Math.max(0, sistemaTotal - periodo.totalInPeriod);

  return diagnosticarExtratoComOfxCore({
    ofxText,
    existenteAll: periodo.rows,
    existenteMesclagem: existenteMesclagem.length ? existenteMesclagem : null,
    saldoApi,
    dataCorteOverride: dataCorte,
    sistemaTotalOverride: sistemaTotal,
    existenteIgnoradosForaPeriodoOverride: existenteIgnoradosForaPeriodo,
  });
}

/**
 * Compara OFX com lançamentos já gravados (sem importar).
 */
export async function diagnosticarExtratoComOfx({ ofxText, numeroBanco, signal }) {
  const nb = Number(numeroBanco);
  if (!Number.isFinite(nb) || nb <= 0) {
    throw new Error('Selecione uma conta bancária.');
  }
  return montarDiagnosticoReparoExtrato({ ofxText, numeroBanco: nb, signal });
}

/**
 * Compara PDF (linhas já parseadas) com lançamentos gravados (sem importar).
 */
export async function diagnosticarExtratoComArquivo({ arquivoRows, numeroBanco, signal }) {
  const nb = Number(numeroBanco);
  if (!Number.isFinite(nb) || nb <= 0) {
    throw new Error('Selecione uma conta bancária.');
  }
  if (!Array.isArray(arquivoRows) || arquivoRows.length === 0) {
    throw new Error('Nenhum lançamento encontrado no PDF.');
  }
  return montarDiagnosticoReparoExtratoArquivo({ arquivoRows, numeroBanco: nb, signal });
}

/**
 * Alinha extrato com o arquivo mestre (OFX ou PDF): exclui sobras e importa faltantes.
 */
export async function executarAlinhamentoExtratoReparo({
  ofxText,
  arquivoRows,
  numeroBanco,
  nomeBanco,
  signal,
  origemImportacao = arquivoRows?.length ? 'PDF' : 'OFX',
  carregarExistente,
  obterSaldo,
  removerLote = removerLancamentosFinanceiroApiEmLote,
  salvarLancamentos = (linhas) =>
    salvarLancamentosExtratoEmLote(linhas, {
      nomeBanco,
      numeroBanco,
      origemImportacao,
    }),
}) {
  const diagnosticar =
    carregarExistente || obterSaldo
      ? async () => {
          const existenteAll = carregarExistente
            ? await carregarExistente(numeroBanco, signal)
            : await carregarLancamentosExistentesBanco(numeroBanco, signal);
          const dataFim =
            arquivoRows?.length
              ? extrairMetadadosDeRows(arquivoRows).dataFim
              : extrairMetadadosOfx(ofxText).dataFim;
          const saldoApi = obterSaldo
            ? await obterSaldo(numeroBanco, {
                signal,
                dataReferencia: dataFim ?? undefined,
              })
            : await obterSaldoBancoFinanceiro(numeroBanco, {
                signal,
                dataReferencia: dataFim ?? undefined,
              });
          if (arquivoRows?.length) {
            return diagnosticarExtratoComArquivoCore({
              arquivoRows,
              meta: extrairMetadadosDeRows(arquivoRows),
              existenteAll,
              saldoApi,
              origemImportacao,
            });
          }
          return diagnosticarExtratoComOfxCore({ ofxText, existenteAll, saldoApi });
        }
      : arquivoRows?.length
        ? () => montarDiagnosticoReparoExtratoArquivo({ arquivoRows, numeroBanco, signal })
        : () => montarDiagnosticoReparoExtrato({ ofxText, numeroBanco, signal });

  return executarAlinhamentoExtratoComOfxCore({
    ofxText,
    numeroBanco,
    nomeBanco,
    signal,
    diagnosticar,
    removerLote,
    salvarLancamentos,
    origemImportacao,
  });
}

/**
 * Alinha extrato com o OFX mestre: exclui sobras e importa faltantes (sem data de corte).
 */
export async function executarAlinhamentoExtratoComOfx({
  ofxText,
  numeroBanco,
  nomeBanco,
  signal,
  carregarExistente,
  obterSaldo,
  removerLote = removerLancamentosFinanceiroApiEmLote,
  salvarLancamentos = (linhas) =>
    salvarLancamentosExtratoEmLote(linhas, {
      nomeBanco,
      numeroBanco,
      origemImportacao: 'OFX',
    }),
}) {
  return executarAlinhamentoExtratoReparo({
    ofxText,
    numeroBanco,
    nomeBanco,
    signal,
    origemImportacao: 'OFX',
    carregarExistente,
    obterSaldo,
    removerLote,
    salvarLancamentos,
  });
}
