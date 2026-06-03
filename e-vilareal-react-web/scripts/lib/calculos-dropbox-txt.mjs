/**
 * Leitura de ficheiros txt de cálculo (Dropbox «Banco de Dados/Calculos»).
 * Espelha `Formulario = "Taxas Condominiais"` e `SubPasta` do Módulo2 VBA.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  readOneLineFile,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';
import {
  montarCamposRodadaProcessoDesdeTxt,
  montarDebitosETitulosDesdeTxt,
  montarPanelConfigDesdeTxt,
  montarParcelasDesdeTxt,
} from './calculos-dropbox-payload.mjs';

export const PASTA_CALCULOS = 'Calculos';
export const MEIO_FIXO_CALCULO = '1';

/** Tipos conhecidos no 3.º segmento do nome (após cod.dim). */
export const TIPOS_CALCULO = {
  VENCIMENTO_TAXA: 100,
  VALOR_TITULO: 101,
  DATA_PAG_CUSTAS: 102,
  VALOR_CUSTAS: 103,
  ATUAL_MONET_TAXA: 104,
  CALCULO_ACEITO: 105,
  JUROS_TAXA: 106,
  MULTA_TAXA: 107,
  HONORARIOS_TAXA: 108,
  DESCRICAO_NUM: 109,
  QTD_PARCELAS: 110,
  DATA_CALCULO: 111,
  ATUAL_MONET_CUSTAS: 112,
  JUROS_CUSTAS: 113,
  VALOR_FINAL_PARCELA: 114,
  TOTAL_PAGO: 115,
  HONORARIOS_PARCELA_CONSOL: 116,
  CUSTAS_PARCELA: 117,
  CUSTAS_APOS_PARC: 118,
  TOTAL_TAXAS: 119,
  TOTAL_CUSTAS: 120,
  TOTAL_A_PAGAR: 121,
  TAXA_JUROS_PARC: 122,
  VENCIMENTO_PARC: 123,
  VALOR_PARC: 124,
  HONORARIOS_PARC: 125,
  DATA_PAG_PARC: 139,
  OBS_PARC: 140,
  INDICE: 128,
  TAXA_HONORARIOS_GERAL: 129,
  HONORARIOS_FIXO_VAR: 130,
  TAXA_JUROS_GERAL: 131,
  TAXA_MULTA_GERAL: 132,
  DESCRICAO_TEXTUAL: 133,
  DATA_INIC_ATUAL: 141,
  DATA_INIC_JUROS: 142,
  TAXA_JUROS_LINHA: 143,
  DATA_FIM_ATUAL: 145,
  DATA_FIM_JUROS: 146,
  PERIODICIDADE: 149,
  TAXA_JUROS_PROC: 89,
  TAXA_MULTA_PROC: 94,
  TAXA_HONORARIOS_PROC: 95,
  HONORARIOS_FIXO_VAR_PROC: 96,
};

const TIPOS_COM_LINHA = new Set([
  TIPOS_CALCULO.VENCIMENTO_TAXA,
  TIPOS_CALCULO.VALOR_TITULO,
  TIPOS_CALCULO.DATA_PAG_CUSTAS,
  TIPOS_CALCULO.VALOR_CUSTAS,
  TIPOS_CALCULO.ATUAL_MONET_TAXA,
  TIPOS_CALCULO.JUROS_TAXA,
  TIPOS_CALCULO.MULTA_TAXA,
  TIPOS_CALCULO.HONORARIOS_TAXA,
  TIPOS_CALCULO.DESCRICAO_NUM,
  TIPOS_CALCULO.DESCRICAO_TEXTUAL,
  TIPOS_CALCULO.ATUAL_MONET_CUSTAS,
  TIPOS_CALCULO.JUROS_CUSTAS,
  TIPOS_CALCULO.VENCIMENTO_PARC,
  TIPOS_CALCULO.VALOR_PARC,
  TIPOS_CALCULO.HONORARIOS_PARC,
  TIPOS_CALCULO.DATA_PAG_PARC,
  TIPOS_CALCULO.OBS_PARC,
  TIPOS_CALCULO.DATA_INIC_ATUAL,
  TIPOS_CALCULO.DATA_INIC_JUROS,
  TIPOS_CALCULO.TAXA_JUROS_LINHA,
  TIPOS_CALCULO.DATA_FIM_ATUAL,
  TIPOS_CALCULO.DATA_FIM_JUROS,
  TIPOS_CALCULO.INDICE,
]);

const TIPOS_POR_PROCESSO = new Set([
  TIPOS_CALCULO.CALCULO_ACEITO,
  TIPOS_CALCULO.QTD_PARCELAS,
  TIPOS_CALCULO.DATA_CALCULO,
  TIPOS_CALCULO.VALOR_FINAL_PARCELA,
  TIPOS_CALCULO.TOTAL_PAGO,
  TIPOS_CALCULO.HONORARIOS_PARCELA_CONSOL,
  TIPOS_CALCULO.CUSTAS_PARCELA,
  TIPOS_CALCULO.CUSTAS_APOS_PARC,
  TIPOS_CALCULO.TOTAL_TAXAS,
  TIPOS_CALCULO.TOTAL_CUSTAS,
  TIPOS_CALCULO.TOTAL_A_PAGAR,
  TIPOS_CALCULO.TAXA_JUROS_PARC,
  TIPOS_CALCULO.TAXA_JUROS_PROC,
  TIPOS_CALCULO.TAXA_MULTA_PROC,
  TIPOS_CALCULO.TAXA_HONORARIOS_PROC,
  TIPOS_CALCULO.HONORARIOS_FIXO_VAR_PROC,
]);

/** @param {number} codNum */
export function milharPastaCalculo(codNum) {
  const n = Math.trunc(Number(codNum));
  if (!Number.isFinite(n) || n < 1) return SEGMENTO_MIL;
  return n < 2000 ? SEGMENTO_MIL : '2000';
}

/**
 * Pasta do cliente sob Calculos/{milhar}/{centena}/.
 * @param {number} codNum
 */
export function pastaClienteCalculos(codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pasta = pastaNumeroClienteHistorico(codNum);
  return path.join(String(milharPastaCalculo(codNum)), String(cent), pasta);
}

/**
 * @param {number} codNum
 * @param {string} [baseBanco]
 */
export function dirCalculosCliente(codNum, baseBanco) {
  const base = baseBanco?.trim() || resolverBaseBancoDados();
  return path.join(base, PASTA_CALCULOS, pastaClienteCalculos(codNum));
}

/**
 * Analisa nome de ficheiro em Calculos.
 * @param {string} fileName
 * @returns {{
 *   cod8: string,
 *   codNum: number,
 *   dimensao: number,
 *   tipo: number,
 *   numeroProcesso: number,
 *   linha: number | null,
 *   sufixoParcela: string | null,
 * } | null}
 */
export function parseNomeArquivoCalculo(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split('.');
  if (parts.length < 4) return null;
  if (!/^\d{8}$/.test(parts[0])) return null;
  if (parts[3] !== MEIO_FIXO_CALCULO) return null;

  const cod8 = parts[0];
  const codNum = Number(cod8);
  const dimensao = Number(parts[1]);
  const tipo = Number(parts[2]);
  if (!Number.isFinite(codNum) || !Number.isFinite(dimensao) || !Number.isFinite(tipo)) return null;

  /** Config geral da dimensão: `{cod8}.{dim}.{tipo}.1.txt` (129 honorários %, 130 FIXO/VAR, …). */
  if (parts.length === 4) {
    return { cod8, codNum, dimensao, tipo, numeroProcesso: null, linha: null, sufixoParcela: null };
  }

  if (parts.length < 5) return null;

  const numeroProcesso = Number(parts[4]);
  if (!Number.isFinite(numeroProcesso) || numeroProcesso < 1) return null;

  let linha = null;
  let sufixoParcela = null;
  if (parts.length >= 6 && /^\d+$/.test(parts[5])) {
    const raw = parts[5];
    linha = Number(raw);
    sufixoParcela = raw.padStart(3, '0');
  }

  return { cod8, codNum, dimensao, tipo, numeroProcesso, linha, sufixoParcela };
}

/**
 * @param {ReturnType<typeof parseNomeArquivoCalculo>} meta
 */
export function classificarEntradaCalculo(meta) {
  if (!meta) return 'desconhecido';
  if (TIPOS_COM_LINHA.has(meta.tipo)) {
    return meta.linha != null ? 'linha' : 'linha_sem_indice';
  }
  if (TIPOS_POR_PROCESSO.has(meta.tipo)) return 'processo';
  if (
    meta.tipo === TIPOS_CALCULO.TAXA_HONORARIOS_GERAL ||
    meta.tipo === TIPOS_CALCULO.HONORARIOS_FIXO_VAR ||
    meta.tipo === TIPOS_CALCULO.TAXA_JUROS_GERAL ||
    meta.tipo === TIPOS_CALCULO.TAXA_MULTA_GERAL ||
    meta.tipo === TIPOS_CALCULO.PERIODICIDADE
  ) {
    return 'dimensao';
  }
  return 'outro';
}

/** @param {number} codNum @param {number} proc @param {number} dim */
export function chaveRodadaCalculo(codNum, proc, dim) {
  return `${formatCod8(codNum)}|${proc}|${dim}`;
}

/**
 * Varre pasta do cliente e agrupa entradas por rodada.
 * @param {number} codNum
 * @param {{ baseBanco?: string, processoMin?: number, processoMax?: number }} [opts]
 */
export function carregarBundleCalculosCliente(codNum, opts = {}) {
  const dir = dirCalculosCliente(codNum, opts.baseBanco);
  const bundle = {
    codNum,
    cod8: formatCod8(codNum),
    dir,
    existe: false,
    porRodada: new Map(),
    /** `{dim} → Map<tipo, entrada>` — ficheiros `{cod8}.{dim}.{tipo}.1.txt` */
    configDimensao: new Map(),
    ficheirosIgnorados: [],
  };

  if (!fs.existsSync(dir)) return bundle;
  bundle.existe = true;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return bundle;
  }

  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.txt')) continue;
    const meta = parseNomeArquivoCalculo(ent.name);
    if (!meta || meta.codNum !== codNum) {
      bundle.ficheirosIgnorados.push(ent.name);
      continue;
    }
    if (meta.numeroProcesso != null) {
      if (opts.processoMin != null && meta.numeroProcesso < opts.processoMin) continue;
      if (opts.processoMax != null && meta.numeroProcesso > opts.processoMax) continue;
    }

    let valor = '';
    try {
      valor = readOneLineFile(path.join(dir, ent.name));
    } catch {
      valor = '';
    }
    const entrada = { ...meta, path: path.join(dir, ent.name), valor };

    if (meta.numeroProcesso == null) {
      if (!bundle.configDimensao.has(meta.dimensao)) {
        bundle.configDimensao.set(meta.dimensao, new Map());
      }
      bundle.configDimensao.get(meta.dimensao).set(String(meta.tipo), entrada);
      continue;
    }

    const key = chaveRodadaCalculo(codNum, meta.numeroProcesso, meta.dimensao);
    if (!bundle.porRodada.has(key)) {
      bundle.porRodada.set(key, {
        key,
        cod8: meta.cod8,
        numeroProcesso: meta.numeroProcesso,
        dimensao: meta.dimensao,
        porTipo: new Map(),
        linhas: new Map(),
        paths: [],
      });
    }
    const rodada = bundle.porRodada.get(key);
    rodada.paths.push(entrada.path);

    const categoria = classificarEntradaCalculo(meta);

    if (categoria === 'linha' && meta.linha != null) {
      if (!rodada.linhas.has(meta.linha)) {
        rodada.linhas.set(meta.linha, { linha: meta.linha, campos: new Map() });
      }
      rodada.linhas.get(meta.linha).campos.set(meta.tipo, entrada);
    } else {
      const chaveTipo = meta.linha != null ? `${meta.tipo}.${meta.linha}` : String(meta.tipo);
      rodada.porTipo.set(chaveTipo, entrada);
    }
  }

  enriquecerRodadasCalculoBundle(bundle);
  return bundle;
}

/** Anexa config da dimensão e taxas do processo gravadas noutra dimensão (ex.: `.95` em dim 1, títulos em dim 0). */
export function enriquecerRodadasCalculoBundle(bundle) {
  for (const rodada of bundle.porRodada.values()) {
    rodada.configDimensao = bundle.configDimensao.get(rodada.dimensao) ?? new Map();
    if (rodada.dimensao === 0) {
      const irma = bundle.porRodada.get(
        chaveRodadaCalculo(bundle.codNum, rodada.numeroProcesso, 1),
      );
      if (irma) rodada.processConfigIrmao = irma;
    }
  }
}

/**
 * Lê flag de aceite (105.1.{proc} = SIM, sem sufixo .NNN).
 * @param {ReturnType<typeof carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 */
export function rodadaCalculoAceito(rodada) {
  const ent = rodada.porTipo.get(String(TIPOS_CALCULO.CALCULO_ACEITO));
  return String(ent?.valor ?? '')
    .trim()
    .toUpperCase() === 'SIM';
}

/**
 * Usar valores gravados nos txt (104–108, totais 119+) em vez de recalcular.
 * No legado, `.105.1.{proc}.{NNN}` guarda dias de atraso — não confundir com aceite global.
 */
export function rodadaTemSnapshotGravadoTxt(rodada) {
  if (rodadaCalculoAceito(rodada)) return true;
  for (const tipo of [
    TIPOS_CALCULO.TOTAL_TAXAS,
    TIPOS_CALCULO.TOTAL_A_PAGAR,
    TIPOS_CALCULO.VALOR_FINAL_PARCELA,
  ]) {
    const v = rodada.porTipo.get(String(tipo))?.valor;
    if (v && String(v).trim()) return true;
  }
  for (const row of rodada.linhas.values()) {
    const j = row.campos.get(TIPOS_CALCULO.JUROS_TAXA)?.valor;
    if (j != null && String(j).trim() !== '') return true;
  }
  return false;
}

/** Tipos de config geral da dimensão (`{cod8}.{dim}.{tipo}.1.txt`). */
export const TIPOS_CONFIG_DIMENSAO = [
  TIPOS_CALCULO.TAXA_HONORARIOS_GERAL,
  TIPOS_CALCULO.HONORARIOS_FIXO_VAR,
  TIPOS_CALCULO.TAXA_JUROS_GERAL,
  TIPOS_CALCULO.TAXA_MULTA_GERAL,
  TIPOS_CALCULO.PERIODICIDADE,
];

/**
 * Resumo das configs `{cod8}.{dim}.{tipo}.1.txt` carregadas para o cliente.
 * @param {ReturnType<typeof carregarBundleCalculosCliente>} bundle
 */
export function resumirConfigDimensaoBundle(bundle) {
  const porDim = {};
  for (const [dim, mapa] of bundle.configDimensao.entries()) {
    porDim[dim] = [...mapa.keys()].sort((a, b) => Number(a) - Number(b));
  }
  return porDim;
}

/**
 * Diagnóstico de fidelidade ao txt — usado pelo import antes do PUT.
 * @param {ReturnType<typeof carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 * @param {Awaited<ReturnType<typeof montarPayloadRodadaComRecalculo>>} payload
 */
export function diagnosticarRodadaImport(rodada, payload) {
  const aceito = rodadaCalculoAceito(rodada);
  const temSnapshotGravado = rodadaTemSnapshotGravadoTxt(rodada);
  const recalculado = Boolean(payload?.meta?.recalculado);
  const cfgDim = rodada.configDimensao ?? new Map();
  const avisos = [];

  if (temSnapshotGravado && recalculado) {
    avisos.push(
      'txt tem totais/juros gravados mas o payload foi recalculado — import não fiel ao legado',
    );
  }

  const honDim = cfgDim.get(String(TIPOS_CALCULO.TAXA_HONORARIOS_GERAL))?.valor;
  const honProc =
    rodada.porTipo.get(String(TIPOS_CALCULO.TAXA_HONORARIOS_PROC))?.valor ??
    rodada.processConfigIrmao?.porTipo.get(String(TIPOS_CALCULO.TAXA_HONORARIOS_PROC))?.valor;
  const honPainel = payload?.panelConfig?.honorariosValor ?? '';

  if (
    honDim != null &&
    String(honDim).trim() !== '' &&
    !honProc &&
    payload?.panelConfig?.honorariosTipo === 'fixos' &&
    String(honDim).trim() === '0' &&
    honPainel !== '0 %'
  ) {
    avisos.push(
      `honorários da dimensão são ${String(honDim).trim()}% mas o painel ficou «${honPainel}»`,
    );
  }

  const totalTxt = rodada.porTipo.get(String(TIPOS_CALCULO.TOTAL_TAXAS))?.valor;
  const totalPayload = payload?.totaisImportados?.valorFinalTaxas;
  if (
    !recalculado &&
    totalTxt &&
    String(totalTxt).trim() &&
    totalPayload &&
    String(totalTxt).trim() !== String(totalPayload).trim()
  ) {
    avisos.push('total taxas do payload difere do txt tipo 119');
  }

  if (rodada.dimensao === 0 && !cfgDim.size) {
    const irma = rodada.processConfigIrmao;
    const temTaxaIrma =
      irma &&
      (irma.porTipo.get(String(TIPOS_CALCULO.TAXA_HONORARIOS_PROC)) ||
        irma.porTipo.get(String(TIPOS_CALCULO.TAXA_JUROS_PROC)));
    if (temTaxaIrma && honPainel === '10 %') {
      avisos.push('taxas do processo na dim 1 não herdadas pela dim 0');
    }
  }

  return {
    aceito,
    temSnapshotGravado,
    recalculado,
    modo: recalculado ? 'recalcular' : 'snapshot',
    honorariosPainel: honPainel || null,
    dataCalculo: payload?.dataCalculoRodada ?? null,
    totalTaxas: totalPayload ?? null,
    configDimensaoTipos: [...cfgDim.keys()].sort(),
    avisos,
  };
}

/** @deprecated Use diagnosticarRodadaImport */
export const analisarRodadaImportCalculo = diagnosticarRodadaImport;

export function valorPorTipoLinha(rodada, tipo, linha) {
  const row = rodada.linhas.get(linha);
  const v = row?.campos.get(tipo)?.valor;
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const ent = rodada.porTipo.get(`${tipo}.${linha}`);
  return ent?.valor != null ? String(ent.valor).trim() : '';
}

/**
 * Monta payload no formato dos imports de planilha (fase 1).
 * @param {ReturnType<typeof carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 */
/**
 * @param {ReturnType<typeof carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 * @param {{ recalcularSeNaoAceito?: boolean }} [opts] — recálculo é feito em `montarPayloadRodadaComRecalculo`
 */
export function montarPayloadRodadaPlanilha(rodada, opts = {}) {
  if (opts.recalcularSeNaoAceito) {
    throw new Error('Use montarPayloadRodadaComRecalculo() para recálculo (evita dependência circular).');
  }
  const aceito = rodadaCalculoAceito(rodada);
  return montarPayloadRodadaPlanilhaSnapshot(rodada, { aceito });
}

/**
 * Snapshot dos txt ou recálculo Módulo3 quando 105.1 ≠ SIM.
 * @param {ReturnType<typeof carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 * @param {{ baseBanco?: string, recalcularSeNaoAceito?: boolean }} [opts]
 */
export async function montarPayloadRodadaComRecalculo(rodada, opts = {}) {
  const aceito = rodadaCalculoAceito(rodada);
  const snapshot = aceito || rodadaTemSnapshotGravadoTxt(rodada);
  const recalcular = opts.recalcularSeNaoAceito !== false && !snapshot;

  if (!recalcular) {
    return montarPayloadRodadaPlanilhaSnapshot(rodada, { aceito });
  }

  const { recalcularRodadaTaxas } = await import('./calculos-recalcular-rodada.mjs');
  try {
    const rec = recalcularRodadaTaxas(rodada, { baseBanco: opts.baseBanco });
    const procCampos = montarCamposRodadaProcessoDesdeTxt(rodada);
    const { parcelas: parcelasTxt } = montarParcelasDesdeTxt(rodada);
    return {
      parcelamentoAceito: false,
      parcelas: parcelasTxt.length ? parcelasTxt : rec.parcelas,
      debitos: rec.debitos,
      titulos: rec.titulos,
      totais: rec.totais,
      panelConfig: montarPanelConfigDesdeTxt(rodada),
      quantidadeParcelasInformada: procCampos.quantidadeParcelasInformada,
      taxaJurosParcelamento: procCampos.taxaJurosParcelamento,
      dataCalculoRodada: procCampos.dataCalculoRodada,
      totaisImportados: procCampos.totaisImportados,
      meta: { ...rec.meta, aceito: false, recalculado: true },
    };
  } catch (err) {
    return montarPayloadRodadaPlanilhaSnapshot(rodada, {
      aceito: false,
      erroRecalculo: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Importa valores gravados nos txt (rodada aceita ou fallback).
 * @param {ReturnType<typeof carregarBundleCalculosCliente>['porRodada'] extends Map<string, infer R> ? R : never} rodada
 * @param {{ aceito: boolean, erroRecalculo?: string }} ctx
 */
function montarPayloadRodadaPlanilhaSnapshot(rodada, ctx) {
  const aceito = ctx.aceito;
  const { debitos, titulos } = montarDebitosETitulosDesdeTxt(rodada);
  const { parcelas, maxNumeroParcela } = montarParcelasDesdeTxt(rodada);
  const procCampos = montarCamposRodadaProcessoDesdeTxt(rodada);
  const panelConfig = montarPanelConfigDesdeTxt(rodada);

  let quantidadeParcelasInformada = procCampos.quantidadeParcelasInformada;
  if (maxNumeroParcela > 0) {
    const qtdNum = Math.max(Number(quantidadeParcelasInformada) || 0, maxNumeroParcela);
    quantidadeParcelasInformada = String(qtdNum).padStart(2, '0');
  }

  return {
    parcelamentoAceito: aceito,
    parcelas,
    debitos,
    titulos,
    /** Cópia imutável dos títulos aceitos (txt/Excel) — a UI não deve recalcular por cima. */
    titulosGravadosAceito: aceito && titulos.length ? titulos.map((t) => ({ ...t })) : undefined,
    panelConfig,
    quantidadeParcelasInformada,
    taxaJurosParcelamento: procCampos.taxaJurosParcelamento,
    dataCalculoRodada: procCampos.dataCalculoRodada,
    totaisImportados: procCampos.totaisImportados,
    meta: {
      aceito,
      recalculado: false,
      erroRecalculo: ctx.erroRecalculo ?? null,
      qtdParcelas: rodada.porTipo.get(String(TIPOS_CALCULO.QTD_PARCELAS))?.valor ?? null,
      dataCalculo: rodada.porTipo.get(String(TIPOS_CALCULO.DATA_CALCULO))?.valor ?? null,
      indice: rodada.porTipo.get(`${TIPOS_CALCULO.INDICE}.1`)?.valor ?? rodada.porTipo.get(String(TIPOS_CALCULO.INDICE))?.valor ?? null,
    },
  };
}
