import {
  obterSaldoBancoFinanceiro,
  removerLancamentosFinanceiroApiEmLote,
  salvarOuAtualizarLancamentoFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { carregarLancamentosExistentesBanco } from './importUtils.js';
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

/**
 * Compara OFX com lançamentos já gravados (sem importar).
 */
export async function diagnosticarExtratoComOfx({ ofxText, numeroBanco, signal }) {
  const nb = Number(numeroBanco);
  if (!Number.isFinite(nb) || nb <= 0) {
    throw new Error('Selecione uma conta bancária.');
  }

  const existenteAll = await carregarLancamentosExistentesBanco(nb, signal);
  const saldoApi = await obterSaldoBancoFinanceiro(nb, {
    signal,
    dataReferencia: extrairMetadadosOfx(ofxText).dataFim ?? undefined,
  });

  return diagnosticarExtratoComOfxCore({ ofxText, existenteAll, saldoApi });
}

/**
 * Alinha extrato com o OFX mestre: exclui sobras e importa faltantes (sem data de corte).
 */
export async function executarAlinhamentoExtratoComOfx({
  ofxText,
  numeroBanco,
  nomeBanco,
  signal,
  carregarExistente = carregarLancamentosExistentesBanco,
  obterSaldo = obterSaldoBancoFinanceiro,
  removerLote = removerLancamentosFinanceiroApiEmLote,
  salvarLancamento = salvarOuAtualizarLancamentoFinanceiroApi,
}) {
  return executarAlinhamentoExtratoComOfxCore({
    ofxText,
    numeroBanco,
    nomeBanco,
    signal,
    diagnosticar: async () => {
      const existenteAll = await carregarExistente(numeroBanco, signal);
      const saldoApi = await obterSaldo(numeroBanco, {
        signal,
        dataReferencia: extrairMetadadosOfx(ofxText).dataFim ?? undefined,
      });
      return diagnosticarExtratoComOfxCore({ ofxText, existenteAll, saldoApi });
    },
    removerLote,
    salvarLancamento,
  });
}
