/**
 * Montagem de payload de rodada (UI / API) a partir dos txt Dropbox — paridade Excel.
 */

import { parseValorMonetarioBr } from '../../src/utils/parseValorMonetarioBr.js';
import {
  formatCampoMonetarioTxt,
  tituloFromCamposTaxa,
} from '../../src/data/calculosDebitosTitulos.js';
/** Defaults mínimos (evita puxar repositório/API no script Node). */
const DEFAULTS_PAINEL_CALCULO = {
  indice: 'INPC',
  honorariosVariaveisTexto: '> 30 = 0%\n< 30 < 60 = 10%\n< 60 = 20%',
  modeloListaDebitos: '01',
};
import {
  TIPOS_CALCULO,
  valorPorTipoLinha,
} from './calculos-dropbox-txt.mjs';
import { extrairConfigRodada } from './calculos-recalcular-rodada.mjs';
import { formatDataBr } from './calculos-legacy-fns.mjs';

function formatPercentualPainel(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0 %';
  const s = Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
  return `${s} %`;
}

/**
 * @param {ReturnType<import('./calculos-dropbox-txt.mjs').carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 */
export function montarPanelConfigDesdeTxt(rodada) {
  const cfg = extrairConfigRodada(rodada);
  const honorariosTipoRaw = String(cfg.honorariosTipo || 'FIXO').toLowerCase();
  const honorariosTipo = honorariosTipoRaw.includes('var') ? 'variaveis' : 'fixos';

  let periodicidade = valorPorTipoLinha(rodada, TIPOS_CALCULO.PERIODICIDADE, 1);
  if (!periodicidade) {
    const ent = rodada.porTipo.get(String(TIPOS_CALCULO.PERIODICIDADE));
    periodicidade = ent?.valor != null ? String(ent.valor).trim() : '';
  }
  const perNorm = String(periodicidade).toLowerCase();
  const periodicidadeUi =
    perNorm.includes('dia') ? 'diario' : perNorm.includes('ano') ? 'anual' : 'mensal';

  return {
    juros: formatPercentualPainel(cfg.taxaJurosPct),
    multa: formatPercentualPainel(cfg.taxaMultaPct),
    indice: cfg.indice || DEFAULTS_PAINEL_CALCULO.indice,
    honorariosTipo,
    honorariosValor:
      honorariosTipo === 'fixos' ? formatPercentualPainel(cfg.taxaHonorariosPct) : '0',
    honorariosVariaveisTexto: DEFAULTS_PAINEL_CALCULO.honorariosVariaveisTexto,
    periodicidade: periodicidadeUi,
    modeloListaDebitos: DEFAULTS_PAINEL_CALCULO.modeloListaDebitos,
  };
}

/**
 * @param {ReturnType<import('./calculos-dropbox-txt.mjs').carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 */
export function montarCamposRodadaProcessoDesdeTxt(rodada) {
  const cfg = extrairConfigRodada(rodada);
  const qtd = Math.max(0, cfg.quantidadeParcelas);
  const taxaParc = cfg.taxaJurosParcelamentoPct;
  const dataCalculo = formatDataBr(cfg.dataCalculo);

  const ler = (tipo) => {
    const ent = rodada.porTipo.get(String(tipo));
    return ent?.valor != null ? String(ent.valor).trim() : '';
  };

  return {
    quantidadeParcelasInformada: String(qtd).padStart(2, '0'),
    taxaJurosParcelamento: Number.isFinite(taxaParc)
      ? taxaParc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0,00',
    dataCalculoRodada: dataCalculo,
    totaisImportados: {
      valorFinalTaxas: ler(TIPOS_CALCULO.TOTAL_TAXAS),
      valorFinalCustas: ler(TIPOS_CALCULO.TOTAL_CUSTAS),
      valorTotalAPagar: ler(TIPOS_CALCULO.TOTAL_A_PAGAR),
      valorFinalParcela: ler(TIPOS_CALCULO.VALOR_FINAL_PARCELA),
      valorTotalPago: ler(TIPOS_CALCULO.TOTAL_PAGO),
    },
  };
}

/**
 * Débitos + títulos (grade Excel) a partir das linhas 100–108 do txt.
 * @param {ReturnType<import('./calculos-dropbox-txt.mjs').carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 */
export function montarDebitosETitulosDesdeTxt(rodada) {
  const debitos = [];
  const titulos = [];
  const linhasOrdenadas = [...rodada.linhas.keys()].sort((a, b) => a - b);
  let posDebito = 0;

  for (const linha of linhasOrdenadas) {
    const row = rodada.linhas.get(linha);
    const g = (t) => row.campos.get(t)?.valor ?? '';

    const venc = String(g(TIPOS_CALCULO.VENCIMENTO_TAXA)).trim();
    const valor = String(g(TIPOS_CALCULO.VALOR_TITULO)).trim();
    if (!venc && !valor) continue;

    posDebito += 1;
    const diasAtraso = valorPorTipoLinha(rodada, TIPOS_CALCULO.CALCULO_ACEITO, linha);

    const debito = {
      posicao: posDebito,
      linhaTxt: linha,
      chaveCodigo: String(g(TIPOS_CALCULO.DESCRICAO_NUM)).trim() || null,
      chaveDescricao: String(g(TIPOS_CALCULO.DESCRICAO_TEXTUAL)).trim() || null,
      dataVencimento: venc || null,
      dataPagamento: String(g(TIPOS_CALCULO.DATA_PAG_CUSTAS)).trim() || null,
      valor: valor || null,
      dataInicialJuros: String(g(TIPOS_CALCULO.DATA_INIC_JUROS)).trim() || null,
      dataInicialAtualizacaoMonetaria: String(g(TIPOS_CALCULO.DATA_INIC_ATUAL)).trim() || null,
      atualizacaoMonetaria: String(g(TIPOS_CALCULO.ATUAL_MONET_TAXA)).trim() || null,
      juros: String(g(TIPOS_CALCULO.JUROS_TAXA)).trim() || null,
      multa: String(g(TIPOS_CALCULO.MULTA_TAXA)).trim() || null,
      honorarios: String(g(TIPOS_CALCULO.HONORARIOS_TAXA)).trim() || null,
      diasAtraso: diasAtraso || null,
    };
    debitos.push(debito);

    const titulo = tituloFromCamposTaxa({
      dataVencimento: debito.dataVencimento,
      valor: debito.valor,
      atualizacaoMonetaria: debito.atualizacaoMonetaria,
      diasAtraso: debito.diasAtraso,
      juros: debito.juros,
      multa: debito.multa,
      honorarios: debito.honorarios,
      chaveDescricao: debito.chaveDescricao,
    });
    if (titulo) titulos.push(titulo);
  }

  return { debitos, titulos };
}

/**
 * Parcelas + datas de pagamento (139) — abas Parcelamento e Pagamento.
 * @param {ReturnType<import('./calculos-dropbox-txt.mjs').carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 */
export function montarParcelasDesdeTxt(rodada) {
  const parcelas = [];
  const linhasOrdenadas = [...rodada.linhas.keys()].sort((a, b) => a - b);
  const numsParcela = new Set();

  for (const [chave, ent] of rodada.porTipo) {
    if (ent.linha != null && chave.startsWith(`${TIPOS_CALCULO.VENCIMENTO_PARC}.`)) numsParcela.add(ent.linha);
  }
  for (const linha of linhasOrdenadas) {
    if (valorPorTipoLinha(rodada, TIPOS_CALCULO.VENCIMENTO_PARC, linha)) numsParcela.add(linha);
  }

  for (const linha of [...numsParcela].sort((a, b) => a - b)) {
    const vencP = valorPorTipoLinha(rodada, TIPOS_CALCULO.VENCIMENTO_PARC, linha);
    const valorP = valorPorTipoLinha(rodada, TIPOS_CALCULO.VALOR_PARC, linha);
    const honP = valorPorTipoLinha(rodada, TIPOS_CALCULO.HONORARIOS_PARC, linha);
    const dataPag = valorPorTipoLinha(rodada, TIPOS_CALCULO.DATA_PAG_PARC, linha);
    const obsP = valorPorTipoLinha(rodada, TIPOS_CALCULO.OBS_PARC, linha);
    if (!vencP && !valorP && !honP && !dataPag) continue;

    parcelas.push({
      numero: linha,
      dataVencimento: vencP || null,
      dataPagamento: dataPag || null,
      valorParcela: valorP ? formatCampoMonetarioTxt(valorP) : null,
      honorariosParcela: honP ? formatCampoMonetarioTxt(honP) : null,
      observacao: obsP || null,
    });
  }

  parcelas.sort((a, b) => a.numero - b.numero);

  const maxNum = parcelas.length
    ? Math.max(...parcelas.map((p) => Number(p.numero) || 0))
    : 0;
  return { parcelas, maxNumeroParcela: maxNum };
}
