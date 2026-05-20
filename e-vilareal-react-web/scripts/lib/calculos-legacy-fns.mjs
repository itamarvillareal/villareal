/**
 * Funções financeiras do Módulo3 VBA (Taxas Condominiais).
 * Fidelidade ao legado — ver docs/legacy-calculo-vba-spec.md
 */

import { criarLeitorIndiceMensal, vbaMesContador } from './calculos-indices-dropbox.mjs';

/** VBA: string vazia em soma vira 0 via (+1)-N. */
export function vbaCoerceNum(v) {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Equivalente a Arredondamento — truncamento após vírgula (não arredonda).
 * @param {number} numero
 * @param {number} decimais
 */
export function legacyTrunc(numero, decimais = 2) {
  const v = Number(numero);
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** decimais;
  return Math.trunc(v * f) / f;
}

/** @param {string|Date|null} v */
export function parseDataBr(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDataBr(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatBRL(n) {
  const v = Number(n) || 0;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function hojeDate() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/**
 * @param {Date} a
 * @param {Date} b
 */
export function diffDiasCorridos(a, b) {
  if (!a || !b) return 0;
  const ms = 86400000;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / ms));
}

/**
 * Atualizacao_Monet — retorna valor atualizado total (ou 0 se NENHUM).
 * @param {number} valor
 * @param {Date} vencimento
 * @param {Date} dataFinal
 * @param {string} indice
 * @param {(i: number) => number} lerIndice
 */
export function atualizacaoMonet(valor, vencimento, dataFinal, indice, lerIndice) {
  const idx = String(indice ?? '').trim().toUpperCase();
  if (!idx) return atualizacaoMonet(valor, vencimento, dataFinal, 'INPC', lerIndice);
  if (idx === 'NENHUM') return 0;

  const valorCalculo = Number(valor) || 0;
  if (!vencimento || !dataFinal || !valorCalculo) return 0;

  const a = vbaMesContador(vencimento.getFullYear(), vencimento.getMonth() + 1);
  const b = vbaMesContador(dataFinal.getFullYear(), dataFinal.getMonth() + 1);

  let calculo = valorCalculo;
  for (let i = a; i <= b; i++) {
    const s = lerIndice(i);
    calculo = calculo + calculo * (s / 100);
  }
  return legacyTrunc(calculo, 2);
}

/**
 * Calcula_Juros — atualiza por índice mês a mês, depois aplica taxa * meses.
 */
export function calculaJuros(valor, dataInicial, dataFinal, txJuros, lerIndice) {
  if (!dataInicial || !dataFinal || !valor) return 0;

  const a = vbaMesContador(dataInicial.getFullYear(), dataInicial.getMonth() + 1);
  const b = vbaMesContador(dataFinal.getFullYear(), dataFinal.getMonth() + 1);
  let calculo = Number(valor) || 0;
  const taxaJuros = Number(txJuros) / 100;

  for (let i = a; i <= b; i++) {
    const s = lerIndice(i);
    calculo = calculo + calculo * (s / 100);
  }

  let mesesJuros = b - a;
  if (dataFinal.getDate() > dataInicial.getDate()) mesesJuros += 1;

  const valorJuros = calculo * taxaJuros * mesesJuros;
  return legacyTrunc(valorJuros, 2);
}

/**
 * Calcula_Juros_BrCond — taxa fixa 1% (ignora Tx_Juros no VBA colado).
 */
export function calculaJurosBrCond(valor, dataInicial, dataFinal, lerIndice, indiceNome) {
  if (!dataInicial || !dataFinal || !valor) return 0;
  const atualizado = atualizacaoMonet(valor, dataInicial, dataFinal, indiceNome, lerIndice);
  const dias = diffDiasCorridos(dataInicial, dataFinal);
  const taxaJuros = 1;
  const fator = legacyTrunc((taxaJuros / 30) * dias, 4);
  return legacyTrunc((fator * atualizado) / 100, 2);
}

/** Excel/VBA PMT — pv positivo, retorno com sinal do Excel; use * -1 como no VBA. */
export function pmt(rate, nper, pv) {
  if (nper <= 0) return 0;
  if (!rate) return -pv / nper;
  const f = (1 + rate) ** nper;
  return (-pv * rate * f) / (f - 1);
}

/**
 * Resolve datas efetivas (datas especiais) — retorna { dataIni, dataFim, destacar }.
 */
export function resolverDatasEspeciais(vencimento, dataCalculo, esp) {
  const iniA = esp.dataInicialAtual ? parseDataBr(esp.dataInicialAtual) : null;
  const fimA = esp.dataFinalAtual ? parseDataBr(esp.dataFinalAtual) : null;
  const iniJ = esp.dataInicialJuros ? parseDataBr(esp.dataInicialJuros) : null;
  const fimJ = esp.dataFinalJuros ? parseDataBr(esp.dataFinalJuros) : null;

  let dataIniAtual = vencimento;
  let dataFimAtual = dataCalculo;
  let destacar = false;

  if (!iniA && fimA) {
    dataIniAtual = vencimento;
    dataFimAtual = fimA;
    destacar = true;
  } else if (iniA && !fimA) {
    dataIniAtual = iniA;
    dataFimAtual = dataCalculo;
    destacar = true;
  } else if (iniA && fimA) {
    dataIniAtual = iniA;
    dataFimAtual = fimA;
    destacar = true;
  }

  let dataIniJuros = vencimento;
  let dataFimJuros = dataCalculo;

  if (!iniJ && fimJ) {
    dataIniJuros = vencimento;
    dataFimJuros = fimJ;
    destacar = true;
  } else if (iniJ && !fimJ) {
    dataIniJuros = iniJ;
    dataFimJuros = dataCalculo;
    destacar = true;
  } else if (iniJ && fimJ) {
    dataIniJuros = iniJ;
    dataFimJuros = fimJ;
    destacar = true;
  }

  const taxaJurosLinha =
    esp.taxaJurosEspecial != null && String(esp.taxaJurosEspecial).trim() !== ''
      ? Number(String(esp.taxaJurosEspecial).replace(',', '.'))
      : null;

  return {
    dataIniAtual,
    dataFimAtual,
    dataIniJuros,
    dataFimJuros,
    taxaJurosLinha,
    destacar,
  };
}

/**
 * Calculo_Linha_Taxas + componentes.
 * @param {object} p
 */
export function calculoLinhaTaxas(p) {
  const {
    vencimento,
    valor,
    dataCalculo,
    indice,
    taxaJurosPct,
    taxaMultaPct,
    honorariosTipo,
    taxaHonorariosPct,
    datasEspeciais,
    lerIndice,
  } = p;

  if (valor == null || valor === '') {
    return {
      vazio: true,
      atualMonet: '',
      diasAtraso: '',
      juros: '',
      multa: '',
      honorarios: '',
      dataIniAtual: '',
      dataIniJuros: '',
    };
  }

  const principal = Number(valor) || 0;

  /** Linha só com valor (crédito/ajuste) — sem vencimento no txt, como no Excel legado. */
  if (!vencimento) {
    return {
      vazio: false,
      somenteValor: true,
      atualMonet: 0,
      diasAtraso: '',
      juros: 0,
      multa: 0,
      honorarios: 0,
      total: legacyTrunc(principal, 2),
      destacar: false,
      dataIniAtual: '',
      dataIniJuros: '',
    };
  }
  const esp = datasEspeciais ?? {};
  const {
    dataIniAtual,
    dataFimAtual,
    dataIniJuros,
    dataFimJuros,
    taxaJurosLinha,
    destacar,
  } = resolverDatasEspeciais(vencimento, dataCalculo, esp);

  const atualizadoTotal = atualizacaoMonet(principal, dataIniAtual, dataFimAtual, indice, lerIndice);
  let atualMonet = legacyTrunc(atualizadoTotal - principal, 2);
  if (atualMonet < 0) atualMonet = 0;

  const diasAtraso = diffDiasCorridos(vencimento, dataCalculo);
  const txJuros = taxaJurosLinha != null && Number.isFinite(taxaJurosLinha) ? taxaJurosLinha : taxaJurosPct;

  const juros = calculaJuros(principal, dataIniJuros, dataFimJuros, txJuros, lerIndice);

  let multa = 0;
  if (vencimento < dataCalculo) {
    const baseMulta =
      vbaCoerceNum(atualMonet) +
      1 +
      vbaCoerceNum(principal) +
      (vbaCoerceNum(juros) + 1) -
      2;
    multa = legacyTrunc(baseMulta * (taxaMultaPct / 100), 2);
  }

  let honorariosBase =
    vbaCoerceNum(atualMonet) +
    1 +
    vbaCoerceNum(principal) +
    (vbaCoerceNum(juros) + 1) +
    (vbaCoerceNum(multa) + 1) -
    3;

  let taxaHon = taxaHonorariosPct;
  if (String(honorariosTipo).toUpperCase() === 'VARIAVEL') {
    if (diasAtraso > 60) taxaHon = 20;
    else if (diasAtraso > 30) taxaHon = 10;
    else taxaHon = 0;
  }

  const honorarios = legacyTrunc(honorariosBase * (taxaHon / 100), 2);
  const total = legacyTrunc(principal + atualMonet + juros + multa + honorarios, 2);

  return {
    vazio: false,
    atualMonet,
    diasAtraso,
    juros,
    multa,
    honorarios,
    total,
    destacar,
    dataIniAtual: formatDataBr(dataIniAtual),
    dataIniJuros: formatDataBr(dataIniJuros),
  };
}

/**
 * Calculo_Linha_Custas_Judiciais
 */
export function calculoLinhaCustas(p) {
  const { dataPagamento, valor, dataCalculo, indice, taxaJurosPct, lerIndice } = p;
  if (!dataPagamento || valor == null || valor === '') {
    return { atualMon: '', juros: '' };
  }
  const principal = Number(valor) || 0;
  const atualizado = atualizacaoMonet(principal, dataPagamento, dataCalculo, indice, lerIndice);
  const atualMon = legacyTrunc(atualizado - principal, 2);
  const juros = calculaJuros(principal, dataPagamento, dataCalculo, taxaJurosPct, lerIndice);
  return { atualMon, juros };
}

/**
 * Cria leitor de índice para intervalo cobrindo taxas e custas.
 */
export function criarContextoIndices(indice, dataMin, dataMax, opts) {
  const ini = dataMin || hojeDate();
  const fim = dataMax || hojeDate();
  const ler = criarLeitorIndiceMensal(indice, ini, fim, opts);
  return (v, di, df) => atualizacaoMonet(v, di, df, indice, ler);
}

export { criarLeitorIndiceMensal };
