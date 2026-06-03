/**
 * Recálculo de rodada (equivalente a Módulo3.Calculos_INICIAIS quando Calculo_Foi_Aceito <> "SIM").
 */

import { parseValorMonetarioBr } from '../../src/utils/parseValorMonetarioBr.js';
import {
  TIPOS_CALCULO,
  valorPorTipoLinha as valorPorTipoLinhaDropbox,
} from './calculos-dropbox-txt.mjs';
import {
  calculoLinhaCustas,
  calculoLinhaTaxas,
  criarLeitorIndiceMensal,
  formatBRL,
  formatDataBr,
  hojeDate,
  legacyTrunc,
  parseDataBr,
  pmt,
} from './calculos-legacy-fns.mjs';

function valorPorTipo(rodada, tipo, linha = null) {
  if (linha != null) return valorPorTipoLinhaDropbox(rodada, tipo, linha);
  const ent = rodada.porTipo.get(String(tipo));
  if (ent?.valor != null && String(ent.valor).trim() !== '') return String(ent.valor).trim();
  const cfgDim = rodada.configDimensao?.get(String(tipo));
  if (cfgDim?.valor != null && String(cfgDim.valor).trim() !== '') return String(cfgDim.valor).trim();
  const irma = rodada.processConfigIrmao;
  if (irma) {
    const entIrma = irma.porTipo.get(String(tipo));
    if (entIrma?.valor != null && String(entIrma.valor).trim() !== '') return String(entIrma.valor).trim();
  }
  return '';
}

function parseNumeroConfig(v, fallback) {
  if (v == null || String(v).trim() === '') return fallback;
  const n = parseValorMonetarioBr(v);
  if (n != null) return n;
  const x = Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Configuração da rodada a partir dos txt (fallbacks do Calculos_INICIAIS).
 * @param {import('./calculos-dropbox-txt.mjs').carregarBundleCalculosCliente extends Function ? ReturnType : never} rodada
 */
export function extrairConfigRodada(rodada) {
  const dim = rodada.dimensao;

  let taxaJuros = valorPorTipo(rodada, TIPOS_CALCULO.TAXA_JUROS_PROC);
  if (!taxaJuros) taxaJuros = valorPorTipo(rodada, TIPOS_CALCULO.TAXA_JUROS_GERAL) || '1';

  let taxaMulta = valorPorTipo(rodada, TIPOS_CALCULO.TAXA_MULTA_PROC);
  if (!taxaMulta) taxaMulta = valorPorTipo(rodada, TIPOS_CALCULO.TAXA_MULTA_GERAL) || '2';

  let honorariosTipo = valorPorTipo(rodada, TIPOS_CALCULO.HONORARIOS_FIXO_VAR_PROC);
  let taxaHonorarios = valorPorTipo(rodada, TIPOS_CALCULO.TAXA_HONORARIOS_PROC);
  if (!honorariosTipo) {
    honorariosTipo = valorPorTipo(rodada, TIPOS_CALCULO.HONORARIOS_FIXO_VAR) || 'FIXO';
    taxaHonorarios = valorPorTipo(rodada, TIPOS_CALCULO.TAXA_HONORARIOS_GERAL) || taxaHonorarios;
  }
  if (!taxaHonorarios) taxaHonorarios = '10';

  let indice =
    valorPorTipo(rodada, TIPOS_CALCULO.INDICE, 1) ||
    valorPorTipo(rodada, String(TIPOS_CALCULO.INDICE)) ||
    'INPC';

  const indiceUpper = String(indice).trim().toUpperCase();
  if (['INPC', 'IGPM', 'SELIC', 'POUPANCA', 'IPCA-E', 'TR', 'CDI', 'NENHUM'].includes(indiceUpper)) {
    indice = indiceUpper;
  }

  let taxaJurosParcelamento = valorPorTipo(rodada, TIPOS_CALCULO.TAXA_JUROS_PARC);
  if (!taxaJurosParcelamento) taxaJurosParcelamento = '1.5';

  let qtdParcelas = valorPorTipo(rodada, TIPOS_CALCULO.QTD_PARCELAS);
  if (!qtdParcelas || !Number.isFinite(Number(qtdParcelas))) qtdParcelas = '0';

  const dataCalculoRaw = valorPorTipo(rodada, TIPOS_CALCULO.DATA_CALCULO);
  const dataCalculo = parseDataBr(dataCalculoRaw) || hojeDate();

  return {
    dimensao: dim,
    taxaJurosPct: parseNumeroConfig(taxaJuros, 1),
    taxaMultaPct: parseNumeroConfig(taxaMulta, 2),
    honorariosTipo: String(honorariosTipo).toUpperCase(),
    taxaHonorariosPct: parseNumeroConfig(taxaHonorarios, 10),
    indice,
    taxaJurosParcelamentoPct: parseNumeroConfig(taxaJurosParcelamento, 1.5),
    quantidadeParcelas: Math.max(0, Math.trunc(Number(qtdParcelas) || 0)),
    dataCalculo,
  };
}

function coletarLinhasDebito(rodada) {
  const linhas = [...rodada.linhas.keys()].sort((a, b) => a - b);
  const out = [];
  for (const linha of linhas) {
    const venc = valorPorTipo(rodada, TIPOS_CALCULO.VENCIMENTO_TAXA, linha);
    const valorRaw = valorPorTipo(rodada, TIPOS_CALCULO.VALOR_TITULO, linha);
    if (!venc && !valorRaw) continue;
    const valor = parseValorMonetarioBr(valorRaw);
    if (valor == null) continue;
    const vencimento = venc ? parseDataBr(venc) : null;

    out.push({
      linha,
      vencimento,
      valor,
      chaveCodigo: valorPorTipo(rodada, TIPOS_CALCULO.DESCRICAO_NUM, linha) || null,
      chaveDescricao: valorPorTipo(rodada, TIPOS_CALCULO.DESCRICAO_TEXTUAL, linha) || null,
      datasEspeciais: {
        dataInicialAtual: valorPorTipo(rodada, TIPOS_CALCULO.DATA_INIC_ATUAL, linha) || '',
        dataFinalAtual: valorPorTipo(rodada, TIPOS_CALCULO.DATA_FIM_ATUAL, linha) || '',
        dataInicialJuros: valorPorTipo(rodada, TIPOS_CALCULO.DATA_INIC_JUROS, linha) || '',
        dataFinalJuros: valorPorTipo(rodada, TIPOS_CALCULO.DATA_FIM_JUROS, linha) || '',
        taxaJurosEspecial: valorPorTipo(rodada, TIPOS_CALCULO.TAXA_JUROS_LINHA, linha) || '',
      },
    });
  }
  return out;
}

function coletarLinhasCustas(rodada) {
  const linhas = [...rodada.linhas.keys()].sort((a, b) => a - b);
  const out = [];
  for (const linha of linhas) {
    const dataPag = valorPorTipo(rodada, TIPOS_CALCULO.DATA_PAG_CUSTAS, linha);
    const valorRaw = valorPorTipo(rodada, TIPOS_CALCULO.VALOR_CUSTAS, linha);
    if (!dataPag && !valorRaw) continue;
    const valor = parseValorMonetarioBr(valorRaw);
    const dataPagamento = parseDataBr(dataPag);
    if (!dataPagamento || valor == null) continue;
    out.push({ linha, dataPagamento, valor });
  }
  return out;
}

function somarComponentesTaxas(linhasCalc) {
  let somaValor = 0;
  let somaAtual = 0;
  let somaJuros = 0;
  let somaMulta = 0;
  let somaHonorarios = 0;
  let somaDias = 0;
  let countDias = 0;
  let qtdTitulos = 0;

  for (const l of linhasCalc) {
    if (l.vazio) continue;
    qtdTitulos += 1;
    somaValor += l.valor;
    somaAtual += l.atualMonet;
    somaJuros += l.juros;
    somaMulta += l.multa;
    somaHonorarios += l.honorarios;
    if (l.diasAtraso !== '') {
      somaDias += Number(l.diasAtraso) || 0;
      countDias += 1;
    }
  }

  const valorFinalTaxas = legacyTrunc(somaValor + somaAtual + somaJuros + somaMulta + somaHonorarios, 2);
  const diasMedios = countDias > 0 ? Math.floor(somaDias / countDias) : 0;

  return {
    somaValor,
    somaAtual,
    somaJuros,
    somaMulta,
    somaHonorarios,
    valorFinalTaxas,
    qtdTitulos,
    diasMedios,
  };
}

function somarCustas(linhasCustas) {
  let somaValor = 0;
  let somaAtual = 0;
  let somaJuros = 0;
  for (const c of linhasCustas) {
    somaValor += c.valor;
    somaAtual += c.atualMon;
    somaJuros += c.juros;
  }
  return legacyTrunc(somaValor + somaAtual + somaJuros, 2);
}

/**
 * Calculos_Parcelamento (não aceito).
 */
function calculosParcelamento(config, valorTotalAPagar, somaHonorarios, valorFinalCustas, valorFinalTaxas) {
  const n = config.quantidadeParcelas;
  const taxa = config.taxaJurosParcelamentoPct / 100;
  const parcelas = [];
  const hoje = config.dataCalculo;

  if (n > 1) {
    const valorParcela = legacyTrunc(pmt(taxa, n, valorTotalAPagar) * -1, 2);
    const honParcela = legacyTrunc(pmt(taxa, n, somaHonorarios) * -1, 2);
    for (let i = 1; i <= n; i++) {
      const venc = new Date(hoje.getFullYear(), hoje.getMonth() - 1 + i, hoje.getDate());
      parcelas.push({
        numero: i,
        dataVencimento: formatDataBr(venc),
        dataPagamento: null,
        valorParcela: formatBRL(valorParcela),
        honorariosParcela: formatBRL(honParcela),
        observacao: null,
      });
    }
    const valorTotalPago = legacyTrunc(n * valorParcela, 2);
    const valorHonorariosParcela = legacyTrunc(
      (((valorTotalPago - (valorFinalCustas + valorFinalTaxas)) / valorTotalPago) * somaHonorarios +
        somaHonorarios) /
        n,
      2,
    );
    const valorCustasParcela =
      valorFinalCustas > 0 && n > 0
        ? legacyTrunc(
            valorFinalCustas / n +
              (valorParcela - (valorFinalCustas + valorFinalTaxas) / n) / valorParcela * (valorFinalCustas / n),
            2
          )
        : 0;
    const custasApos = legacyTrunc(n * valorCustasParcela, 2);

    return {
      parcelas,
      valorFinalParcela: valorParcela,
      valorTotalPago,
      valorHonorariosParcela,
      valorCustasParcela,
      valorFinalCustasApos: custasApos,
    };
  }

  if (n === 1) {
    const valorParcela = legacyTrunc(pmt(taxa, n, valorTotalAPagar) * -1, 2);
    const venc = new Date(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
    const honParcela = legacyTrunc(
      (((valorParcela - (valorFinalCustas + valorFinalTaxas)) / valorParcela) * somaHonorarios +
        somaHonorarios) /
        n,
      2
    );
    parcelas.push({
      numero: 1,
      dataVencimento: formatDataBr(venc),
      dataPagamento: null,
      valorParcela: formatBRL(valorParcela),
      honorariosParcela: formatBRL(honParcela),
      observacao: null,
    });
    return {
      parcelas,
      valorFinalParcela: valorParcela,
      valorTotalPago: valorParcela,
      valorHonorariosParcela: honParcela,
      valorCustasParcela: valorFinalCustas,
      valorFinalCustasApos: valorFinalCustas,
    };
  }

  parcelas.push({
    numero: 1,
    dataVencimento: formatDataBr(hoje),
    dataPagamento: null,
    valorParcela: formatBRL(valorTotalAPagar),
    honorariosParcela: formatBRL(somaHonorarios),
    observacao: null,
  });
  return {
    parcelas,
    valorFinalParcela: valorTotalAPagar,
    valorTotalPago: valorTotalAPagar,
    valorHonorariosParcela: somaHonorarios,
    valorCustasParcela: valorFinalCustas,
    valorFinalCustasApos: valorFinalCustas,
  };
}

/**
 * @param {ReturnType<import('./calculos-dropbox-txt.mjs').carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 * @param {{ baseBanco?: string, dataCalculo?: Date }} [opts]
 */
export function recalcularRodadaTaxas(rodada, opts = {}) {
  const config = extrairConfigRodada(rodada);
  if (opts.dataCalculo) config.dataCalculo = opts.dataCalculo;

  const debitosEntrada = coletarLinhasDebito(rodada);
  const custasEntrada = coletarLinhasCustas(rodada);

  let dataMin = config.dataCalculo;
  let dataMax = config.dataCalculo;
  for (const d of debitosEntrada) {
    if (d.vencimento && d.vencimento < dataMin) dataMin = d.vencimento;
    if (d.vencimento && d.vencimento > dataMax) dataMax = d.vencimento;
  }
  for (const c of custasEntrada) {
    if (c.dataPagamento < dataMin) dataMin = c.dataPagamento;
    if (c.dataPagamento > dataMax) dataMax = c.dataPagamento;
  }

  const lerIndice = criarLeitorIndiceMensal(config.indice, dataMin, dataMax, {
    baseBanco: opts.baseBanco,
  });

  const linhasCalc = debitosEntrada.map((d, idx) => {
    const calc = calculoLinhaTaxas({
      vencimento: d.vencimento,
      valor: d.valor,
      dataCalculo: config.dataCalculo,
      indice: config.indice,
      taxaJurosPct: config.taxaJurosPct,
      taxaMultaPct: config.taxaMultaPct,
      honorariosTipo: config.honorariosTipo,
      taxaHonorariosPct: config.taxaHonorariosPct,
      datasEspeciais: d.datasEspeciais,
      lerIndice,
    });
    return {
      posicao: idx + 1,
      linha: d.linha,
      ...d,
      ...calc,
    };
  });

  const custasCalc = custasEntrada.map((c) => {
    const { atualMon, juros } = calculoLinhaCustas({
      dataPagamento: c.dataPagamento,
      valor: c.valor,
      dataCalculo: config.dataCalculo,
      indice: config.indice,
      taxaJurosPct: config.taxaJurosPct,
      lerIndice,
    });
    return { ...c, atualMon, juros };
  });

  const somas = somarComponentesTaxas(linhasCalc);
  const valorFinalCustas = somarCustas(custasCalc);
  const valorTotalAPagar = legacyTrunc(somas.valorFinalTaxas + valorFinalCustas, 2);

  const parc = calculosParcelamento(
    config,
    valorTotalAPagar,
    somas.somaHonorarios,
    valorFinalCustas,
    somas.valorFinalTaxas
  );

  const titulos = linhasCalc.map((l) => {
    const soValor = Boolean(l.somenteValor);
    return {
      dataVencimento: l.vencimento ? formatDataBr(l.vencimento) : '',
      valorInicial: formatBRL(l.valor),
      atualizacaoMonetaria: l.vazio || soValor ? '' : formatBRL(l.atualMonet),
      diasAtraso: l.vazio || soValor ? '' : String(l.diasAtraso),
      juros: l.vazio || soValor ? '' : formatBRL(l.juros),
      multa: l.vazio || soValor ? '' : formatBRL(l.multa),
      honorarios: l.vazio || soValor ? '' : formatBRL(l.honorarios),
      total: l.vazio ? '' : formatBRL(l.total),
      descricaoValor: l.chaveDescricao || '',
      datasEspeciais: l.datasEspeciais,
    };
  });

  const debitos = linhasCalc.map((l) => ({
    posicao: l.posicao,
    chaveCodigo: l.chaveCodigo,
    chaveDescricao: l.chaveDescricao,
    dataVencimento: l.vencimento ? formatDataBr(l.vencimento) : null,
    dataPagamento: null,
    valor: String(l.valor),
    dataInicialJuros: l.dataIniJuros || null,
    dataInicialAtualizacaoMonetaria: l.dataIniAtual || null,
  }));

  return {
    recalculado: true,
    config,
    titulos,
    debitos,
    parcelas: parc.parcelas,
    parcelamentoAceito: false,
    totais: {
      valorFinalTaxas: somas.valorFinalTaxas,
      valorFinalCustas,
      valorTotalAPagar,
      valorFinalParcela: parc.valorFinalParcela,
      valorTotalPago: parc.valorTotalPago,
      valorHonorariosParcela: parc.valorHonorariosParcela,
      valorCustasParcela: parc.valorCustasParcela,
      valorFinalCustasAposParcelamento: parc.valorFinalCustasApos,
      somaHonorarios: somas.somaHonorarios,
    },
    meta: {
      indice: config.indice,
      qtdParcelas: String(config.quantidadeParcelas),
      dataCalculo: formatDataBr(config.dataCalculo),
      taxaJuros: String(config.taxaJurosPct),
      taxaMulta: String(config.taxaMultaPct),
      taxaJurosParcelamento: String(config.taxaJurosParcelamentoPct),
    },
  };
}
