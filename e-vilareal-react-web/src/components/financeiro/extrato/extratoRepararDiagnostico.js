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
  executarAlinhamentoExtratoComOfxCore,
  extrairMetadadosOfx,
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
  prepararExclusaoReparoExtrato,
  prepararImportacaoReparoExtrato,
  diagnosticarExtratoComOfxCore,
  precisaReparoExtratoComOfx,
  extratoAlinhadoComOfx,
  transacoesDesalinhadasNoPeriodoOfx,
  saldoLedgerDesalinhadoComOfx,
};

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
  const diagnosticar =
    carregarExistente || obterSaldo
      ? async () => {
          const existenteAll = carregarExistente
            ? await carregarExistente(numeroBanco, signal)
            : await carregarLancamentosExistentesBanco(numeroBanco, signal);
          const saldoApi = obterSaldo
            ? await obterSaldo(numeroBanco, {
                signal,
                dataReferencia: extrairMetadadosOfx(ofxText).dataFim ?? undefined,
              })
            : await obterSaldoBancoFinanceiro(numeroBanco, {
                signal,
                dataReferencia: extrairMetadadosOfx(ofxText).dataFim ?? undefined,
              });
          return diagnosticarExtratoComOfxCore({ ofxText, existenteAll, saldoApi });
        }
      : () => montarDiagnosticoReparoExtrato({ ofxText, numeroBanco, signal });

  return executarAlinhamentoExtratoComOfxCore({
    ofxText,
    numeroBanco,
    nomeBanco,
    signal,
    diagnosticar,
    removerLote,
    salvarLancamentos,
  });
}
