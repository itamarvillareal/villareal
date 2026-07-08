/**
 * Entrada + parcelamento do saldo (Tabela Price) — lógica pura reutilizável na tela Cálculos.
 */

import { formatBRL, parseBRL, normalizarTextoDataBRparaSalvar, sugerirProximaDataVencimento } from '../components/calculos/calculosTitulosGridUtils.js';
import { parseBRLToCentavos } from '../utils/moneyBr.js';

export const ENTRADA_MODOS = ['nenhuma', 'reais', 'percentual'];

export function trunc2(n) {
  return Math.trunc(Number(n) * 100) / 100;
}

/** Valor total da linha — coluna Valor já inclui honorários; honorariosParcela é só informativo. */
export function valorTotalLinhaPlanoPagamento(row) {
  return trunc2(parseBRL(row?.valorParcela));
}

export function normalizarEntradaModo(m) {
  const s = String(m ?? 'nenhuma').toLowerCase();
  return ENTRADA_MODOS.includes(s) ? s : 'nenhuma';
}

export function entradaModoAtivo(rodada) {
  const m = normalizarEntradaModo(rodada?.entradaParcelamentoModo);
  return m === 'reais' || m === 'percentual';
}

export function parseQuantidadeParcelasNumero(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (!d) return 0;
  return Math.min(9999, Math.max(0, Number(d)));
}

/** Converte texto percentual (pt-BR) em número. */
export function parsePercentualBR(str) {
  const t = String(str ?? '')
    .trim()
    .replace(/%/g, '')
    .trim();
  if (!t) return NaN;
  const normalized = t.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Valor de cada parcela (prestação fixa) — taxa composta ao mês (Tabela Price).
 * @param {number} pvCentavos
 */
export function calcularParcelaPrecoMensalPriceCentavos(pvCentavos, taxaPercentAoMes, nParcelas) {
  const pv = Math.max(0, Math.floor(Number(pvCentavos) || 0));
  const n = Math.max(0, Math.floor(Number(nParcelas) || 0));
  if (n <= 0 || pv <= 0) return 0;
  const i = Number(taxaPercentAoMes) / 100;
  if (!Number.isFinite(i) || i < 0) return 0;
  let pmt;
  if (i === 0 || i < 1e-14) {
    pmt = pv / n;
  } else {
    pmt = (pv * i * (1 + i) ** n) / ((1 + i) ** n - 1);
  }
  return Math.trunc(pmt);
}

export function calcularParcelaPrecoMensalPrice(pv, taxaPercentAoMes, nParcelas) {
  const cent = calcularParcelaPrecoMensalPriceCentavos(
    Math.round(trunc2(Number(pv) || 0) * 100),
    taxaPercentAoMes,
    nParcelas
  );
  return cent / 100;
}

/**
 * @param {number} debitoTotalCentavos — total da aba Títulos (inclui honorários)
 * @param {number} honorariosCentavos
 * @param {number} entradaCentavos
 */
export function rateioEntradaESaldos(debitoTotalCentavos, honorariosCentavos, entradaCentavos) {
  const total = Math.max(0, Math.floor(debitoTotalCentavos));
  const hon = Math.max(0, Math.min(total, Math.floor(honorariosCentavos)));
  const entrada = Math.max(0, Math.min(total, Math.floor(entradaCentavos)));
  if (total <= 0 || entrada <= 0) {
    return {
      entradaPrincipalCentavos: 0,
      entradaHonorariosCentavos: 0,
      saldoPrincipalCentavos: Math.max(0, total - hon),
      saldoHonorariosCentavos: hon,
    };
  }
  const entradaHonor = Math.round((hon * entrada) / total);
  const entradaPrinc = entrada - entradaHonor;
  const saldoHon = hon - entradaHonor;
  const saldoPrinc = total - hon - (entrada - entradaHonor);
  return {
    entradaPrincipalCentavos: entradaPrinc,
    entradaHonorariosCentavos: entradaHonor,
    saldoPrincipalCentavos: Math.max(0, saldoPrinc),
    saldoHonorariosCentavos: Math.max(0, saldoHon),
  };
}

/**
 * @returns {{ entradaCentavos: number, erro?: string }}
 */
export function calcularEntradaCentavos({ modo, valorReaisStr, percentualStr, debitoTotalCentavos }) {
  const total = Math.max(0, Math.floor(debitoTotalCentavos));
  const m = normalizarEntradaModo(modo);
  if (m === 'nenhuma' || total <= 0) return { entradaCentavos: 0 };
  if (m === 'reais') {
    const c = parseBRLToCentavos(valorReaisStr);
    if (c == null || c <= 0) return { entradaCentavos: 0, erro: 'Informe um valor de entrada maior que zero.' };
    if (c >= total) return { entradaCentavos: 0, erro: 'A entrada deve ser menor que o débito total.' };
    return { entradaCentavos: c };
  }
  const pct = parsePercentualBR(percentualStr);
  if (!Number.isFinite(pct) || pct <= 0) {
    return { entradaCentavos: 0, erro: 'Informe um percentual de entrada maior que zero.' };
  }
  if (pct >= 100) return { entradaCentavos: 0, erro: 'O percentual de entrada deve ser menor que 100%.' };
  const entrada = Math.min(total - 1, Math.round((total * pct) / 100));
  if (entrada <= 0) return { entradaCentavos: 0, erro: 'Entrada calculada inválida.' };
  return { entradaCentavos: entrada };
}

/**
 * Heurística: cálculo aceito + (entrada configurada ou N≥1 com parcelas preenchidas).
 */
export function temPlanoPagamento(rodada) {
  if (!rodada || typeof rodada !== 'object') return false;
  if (entradaModoAtivo(rodada)) return true;
  const n = parseQuantidadeParcelasNumero(rodada.quantidadeParcelasInformada);
  if (n < 1) return false;
  const parcelas = Array.isArray(rodada.parcelas) ? rodada.parcelas : [];
  for (let i = 0; i < Math.min(n, parcelas.length); i++) {
    const p = parcelas[i];
    if (parseBRLToCentavos(p?.valorParcela) > 0 || parseBRLToCentavos(p?.honorariosParcela) > 0) {
      return true;
    }
  }
  return false;
}

/** Índices das linhas do plano com valor (entrada + N parcelas). */
export function indicesLinhasPlanoPagamento(rodada) {
  const n = parseQuantidadeParcelasNumero(rodada?.quantidadeParcelasInformada);
  const temEnt = entradaModoAtivo(rodada);
  const out = [];
  if (temEnt) out.push(0);
  for (let i = 0; i < n; i++) out.push(temEnt ? i + 1 : i);
  return out;
}

export function rotuloLinhaPlanoPagamento(row, globalIdx, temEntrada) {
  if (row?.tipo === 'entrada' || (temEntrada && globalIdx === 0)) return 'Entrada';
  const num = temEntrada ? globalIdx : globalIdx + 1;
  return `Parcela ${String(num).padStart(2, '0')}:`;
}

/** Índice global da linha «Parcela 01» (não confundir com Entrada). */
export function indiceGlobalPrimeiraParcela(temEntrada) {
  return temEntrada ? 1 : 0;
}

/**
 * Gera vencimentos das parcelas 02…N a partir da data da Parcela 01 (mesmo dia, meses subsequentes).
 * @returns {Array<{ globalIdx: number, dataVencimento: string }>}
 */
export function gerarDatasParcelasSubsequentes(dataBaseBr, indicePrimeira, quantidadeParcelas, temEntrada) {
  const primeira = indiceGlobalPrimeiraParcela(temEntrada);
  if (indicePrimeira !== primeira) return [];
  const n = Math.max(0, Math.floor(Number(quantidadeParcelas) || 0));
  if (n <= 1) return [];
  let prev = normalizarTextoDataBRparaSalvar(dataBaseBr);
  if (!prev) return [];
  const out = [];
  for (let i = 1; i < n; i++) {
    const next = sugerirProximaDataVencimento(prev, 'mensal');
    if (!next) break;
    out.push({ globalIdx: primeira + i, dataVencimento: next });
    prev = next;
  }
  return out;
}

/**
 * Monta linhas do plano (entrada opcional + N parcelas Price).
 * @param {object} p
 * @param {{ total: string, honorarios: string }} p.resumoDebito — resumo calcularResumoTitulosGrade
 * @param {string} p.dataBaseParcelas — data de referência para 1ª parcela (+1 mês)
 * @param {(dataBase: string, idx: number) => string} p.gerarDataParcela
 */
export function montarLinhasPlanoPagamento({
  resumoDebito,
  entradaModo,
  entradaValor,
  entradaPercentual,
  dataEntrada,
  nParcelas,
  taxaPercent,
  dataBaseParcelas,
  gerarDataParcela,
}) {
  const debitoTotalCent = parseBRLToCentavos(resumoDebito?.total) ?? 0;
  const honorCent = parseBRLToCentavos(resumoDebito?.honorarios) ?? 0;
  const nParc = Math.max(0, Math.floor(Number(nParcelas) || 0));
  const taxaM = Number.isFinite(Number(taxaPercent)) ? Number(taxaPercent) : parsePercentualBR(taxaPercent);
  const taxa = Number.isFinite(taxaM) ? taxaM : 0;

  const temEntrada = normalizarEntradaModo(entradaModo) !== 'nenhuma';
  const { entradaCentavos, erro: erroEntrada } = temEntrada
    ? calcularEntradaCentavos({
        modo: entradaModo,
        valorReaisStr: entradaValor,
        percentualStr: entradaPercentual,
        debitoTotalCentavos: debitoTotalCent,
      })
    : { entradaCentavos: 0 };

  if (temEntrada && erroEntrada) {
    return { linhas: [], erro: erroEntrada, temEntrada: true };
  }

  const rateio =
    temEntrada && entradaCentavos > 0
      ? rateioEntradaESaldos(debitoTotalCent, honorCent, entradaCentavos)
      : rateioEntradaESaldos(debitoTotalCent, honorCent, 0);

  const pmtPrinc =
    nParc > 0 && rateio.saldoPrincipalCentavos > 0
      ? calcularParcelaPrecoMensalPriceCentavos(rateio.saldoPrincipalCentavos, taxa, nParc)
      : 0;
  const pmtHon =
    nParc > 0 && rateio.saldoHonorariosCentavos > 0
      ? calcularParcelaPrecoMensalPriceCentavos(rateio.saldoHonorariosCentavos, taxa, nParc)
      : 0;

  /** Coluna Valor = prestação total (principal + honorários com juros Price); Honor. Parc. é só informativo. */
  const pmtTotal = pmtPrinc + pmtHon;
  const valorFmt = pmtTotal > 0 ? formatBRL(pmtTotal / 100) : '';
  const honorFmt = pmtHon > 0 ? formatBRL(pmtHon / 100) : '';

  const linhas = [];
  const dataEnt = String(dataEntrada ?? '').trim();
  const dataBase = String(dataBaseParcelas ?? '').trim();

  if (temEntrada && entradaCentavos > 0) {
    linhas.push({
      tipo: 'entrada',
      dataVencimento: dataEnt,
      dataPagamento: dataEnt,
      valorParcela: formatBRL(entradaCentavos / 100),
      honorariosParcela: formatBRL(rateio.entradaHonorariosCentavos / 100),
      observacao: '',
    });
  }

  for (let i = 0; i < nParc; i++) {
    const dataParc = gerarDataParcela ? gerarDataParcela(dataBase, i) : '';
    linhas.push({
      tipo: 'parcela',
      dataVencimento: dataParc,
      dataPagamento: dataParc,
      valorParcela: valorFmt,
      honorariosParcela: honorFmt,
      observacao: '',
    });
  }

  return {
    linhas,
    temEntrada: temEntrada && entradaCentavos > 0,
    entradaCentavos,
    debitoTotalCentavos: debitoTotalCent,
    saldoCentavos: Math.max(0, debitoTotalCent - entradaCentavos),
    rateio,
    erro: null,
  };
}

/**
 * Rodadas salvas antes do fix guardavam valorParcela só com principal; honorários iam à parte.
 * Se valor + honor = total Price gerado, atualiza a linha sem mexer em datas/pagamentos.
 */
export function aplicarMigracaoValorParcelaTotal(linhasSalvas, linhasGeradas) {
  if (!Array.isArray(linhasSalvas) || !Array.isArray(linhasGeradas)) return linhasSalvas;
  let changed = false;
  const out = linhasSalvas.map((p, i) => {
    const g = linhasGeradas[i];
    if (!p || !g) return p;
    const vp = parseBRL(p.valorParcela);
    const hon = parseBRL(p.honorariosParcela);
    const esperado = parseBRL(g.valorParcela);
    if (hon > 0 && esperado > 0 && trunc2(vp + hon) === trunc2(esperado) && trunc2(vp) !== trunc2(esperado)) {
      changed = true;
      return {
        ...p,
        valorParcela: g.valorParcela,
        honorariosParcela: g.honorariosParcela || p.honorariosParcela,
      };
    }
    return p;
  });
  return changed ? out : linhasSalvas;
}

/**
 * Soma valores do plano (entrada + N parcelas).
 * Coluna valorParcela = total pago; honorariosParcela é apenas informativo (não somar).
 */
export function calcularResumoPlanoPagamento(linhas, nParcelas, temEntrada) {
  const nParc = Math.max(0, Math.floor(Number(nParcelas) || 0));
  const start = temEntrada ? 1 : 0;
  let valorParcelasTotal = 0;
  let valorHonorariosParcelas = 0;
  let entradaTotal = 0;
  let honEntrada = 0;
  if (temEntrada && linhas[0]) {
    entradaTotal = parseBRL(linhas[0].valorParcela);
    honEntrada = parseBRL(linhas[0].honorariosParcela);
  }
  for (let i = 0; i < nParc; i++) {
    const row = linhas[start + i];
    if (!row) break;
    valorParcelasTotal += parseBRL(row.valorParcela);
    valorHonorariosParcelas += parseBRL(row.honorariosParcela);
  }
  valorParcelasTotal = trunc2(valorParcelasTotal);
  valorHonorariosParcelas = trunc2(valorHonorariosParcelas);
  entradaTotal = trunc2(entradaTotal);
  const valorFinalParcelas = valorParcelasTotal;
  const valorTotalPagar = trunc2(entradaTotal + valorFinalParcelas);
  return {
    parcelasComValor: nParc,
    temEntrada,
    entradaTotal: formatBRL(entradaTotal),
    valorFinalParcelas: formatBRL(valorFinalParcelas),
    valorFinalParcelasPrincipal: formatBRL(valorFinalParcelas),
    valorTotalPagar: formatBRL(valorTotalPagar),
    valorFinalHonorarios: formatBRL(trunc2(honEntrada + valorHonorariosParcelas)),
    valorHonorariosParcela: nParc > 0 ? formatBRL(trunc2(valorHonorariosParcelas / nParc)) : formatBRL(0),
    valorCustasParcela: formatBRL(0),
    valorFinalCustas: formatBRL(0),
  };
}
