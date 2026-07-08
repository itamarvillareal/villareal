/**
 * Montagem do corpo da requisição de Petição de Homologação de Acordo
 * (`POST /api/documentos/peticao-homologacao-acordo`).
 */

import { calcularResumoTitulosGrade } from './calculosRodadaTitulosPaginacao.js';
import {
  indicesLinhasPlanoPagamento,
  temPlanoPagamento,
  valorTotalLinhaPlanoPagamento,
} from './parcelamentoEntrada.js';
import { formatBRL } from '../components/calculos/calculosTitulosGridUtils.js';
import {
  montarTitulosRequestPeticao,
  normalizarPercentParaEnvio,
  dataBRparaISO,
} from './peticaoExecucaoBuilder.js';

export const FORMA_PAGAMENTO_HOMOLOGACAO_PADRAO =
  'liquidadas por intermédio do pagamento dos boletos bancários anexos';

export const CLAUSULAS_HOMOLOGACAO_PADRAO = {
  multaPercent: '30',
  jurosPercent: '1',
  honorariosPercent: '20',
  formaPagamentoTexto: FORMA_PAGAMENTO_HOMOLOGACAO_PADRAO,
  incluirArt1335: true,
  incluirIrrevogavel: true,
  incluirDesistenciaRecursos: true,
  incluirCustas90: true,
  incluirArt922: true,
};

/** Boletos do plano aceito: valor total da parcela (coluna Valor); honorários não somam. */
export function extrairBoletosHomologacao(rodada) {
  const parcelas = Array.isArray(rodada?.parcelas) ? rodada.parcelas : [];
  const indices = indicesLinhasPlanoPagamento(rodada);
  const boletos = [];
  for (const idx of indices) {
    const p = parcelas[idx];
    if (!p) continue;
    const totalCent = Math.round(valorTotalLinhaPlanoPagamento(p) * 100);
    if (totalCent <= 0) continue;
    const vencimento = String(p?.dataVencimento ?? p?.dataPagamento ?? '').trim();
    if (!vencimento) continue;
    boletos.push({ valorParcela: formatBRL(totalCent / 100), vencimento });
  }
  return boletos;
}

export function validarElegibilidadeHomologacao(rodada) {
  if (!rodada || rodada.parcelamentoAceito !== true) {
    return {
      elegivel: false,
      motivo:
        'Não há cálculo aceito para este processo. Aceite o parcelamento na tela de Cálculos antes de gerar a homologatória.',
    };
  }
  if (!temPlanoPagamento(rodada)) {
    return {
      elegivel: false,
      motivo:
        'O cálculo aceito não possui plano de pagamento (entrada ou parcelas com valor). Preencha a aba Parcelamento antes de gerar.',
    };
  }
  const boletos = extrairBoletosHomologacao(rodada);
  if (!boletos.length) {
    return {
      elegivel: false,
      motivo:
        'Nenhum boleto com valor e vencimento foi encontrado no plano aceito. Revise a aba Parcelamento.',
    };
  }
  return { elegivel: true, boletos };
}

/**
 * @param {object} params
 * @param {number} params.processoId
 * @param {string} params.numeroCnj
 * @param {string} params.enderecamento
 * @param {string} params.dataIso — yyyy-mm-dd
 * @param {string} params.unidade
 * @param {Array<object>} params.titulos
 * @param {Array<{ valorParcela: string, vencimento: string }>} params.boletos
 * @param {object} params.clausulas
 */
export function montarBodyPeticaoHomologacaoAcordo({
  processoId,
  numeroCnj,
  enderecamento,
  dataIso,
  unidade,
  titulos,
  boletos,
  clausulas,
}) {
  const lista = Array.isArray(titulos) ? titulos : [];
  const cl = { ...CLAUSULAS_HOMOLOGACAO_PADRAO, ...(clausulas || {}) };
  return {
    processoId: Number(processoId),
    numeroCnj: String(numeroCnj ?? '').trim(),
    enderecamento: String(enderecamento ?? '').trim(),
    data: dataIso,
    unidade: String(unidade ?? '').trim(),
    titulos: montarTitulosRequestPeticao(lista),
    totalGeral: calcularResumoTitulosGrade(lista).total,
    boletos: (Array.isArray(boletos) ? boletos : []).map((b) => ({
      valorParcela: String(b?.valorParcela ?? '').trim(),
      vencimento: String(b?.vencimento ?? '').trim(),
    })),
    clausulas: {
      multaPercent: normalizarPercentParaEnvio(cl.multaPercent),
      jurosPercent: normalizarPercentParaEnvio(cl.jurosPercent),
      honorariosPercent: normalizarPercentParaEnvio(cl.honorariosPercent),
      formaPagamentoTexto: String(cl.formaPagamentoTexto ?? FORMA_PAGAMENTO_HOMOLOGACAO_PADRAO).trim(),
      incluirArt1335: cl.incluirArt1335 !== false,
      incluirIrrevogavel: cl.incluirIrrevogavel !== false,
      incluirDesistenciaRecursos: cl.incluirDesistenciaRecursos !== false,
      incluirCustas90: cl.incluirCustas90 !== false,
      incluirArt922: cl.incluirArt922 !== false,
    },
  };
}

export { dataBRparaISO };
