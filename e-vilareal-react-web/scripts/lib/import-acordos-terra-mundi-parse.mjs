/**
 * Parser da planilha Acordos_Terra_Mundi.xlsx (Canal Gestão).
 */

import XLSX from 'xlsx';
import { parseValorMonetarioBr } from '../../src/utils/parseValorMonetarioBr.js';
import { parseDataLayout2026 } from './import-calculo-layout2026-parse.mjs';

const COD8 = '00000299';

function cel(row, idx) {
  if (!Array.isArray(row) || idx < 0) return null;
  return idx < row.length ? row[idx] : null;
}

function normDesc(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function classificarTaxa(desc) {
  const d = normDesc(desc);
  if (/honor/i.test(d)) return 'honorarios';
  if (/juro/.test(d)) return 'juros';
  if (/multa/.test(d)) return 'multa';
  if (/correc|atualiz/.test(d)) return 'atualizacao';
  return 'base';
}

/** R1201 → «1201 R»; A0203 → «0203 A» */
export function acordoUnidadeParaContatos(unidadeAcordo) {
  const u = String(unidadeAcordo ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
  const m = /^([ABRV])(\d{4})$/.exec(u);
  if (!m) return String(unidadeAcordo ?? '').trim().toUpperCase();
  return `${m[2]} ${m[1]}`;
}

/** R1201 → «Unidade 1201 R» */
export function acordoUnidadeParaProcessoDb(unidadeAcordo) {
  const u = String(unidadeAcordo ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
  const m = /^([ABRV])(\d{4})$/.exec(u);
  if (!m) return null;
  return `Unidade ${parseInt(m[2], 10)} ${m[1]}`;
}

export function unidadeContatosCompacta(unidadeContatos) {
  return String(unidadeContatos ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
}

export function isoParaDataBr(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return String(iso).trim();
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function parseDataAcordo(val) {
  const iso = parseDataLayout2026(val);
  return iso ? isoParaDataBr(iso) : null;
}

export function fmtMoedaApi(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function valorNumerico(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = parseValorMonetarioBr(raw);
  return n != null && Number.isFinite(n) ? n : null;
}

/**
 * @param {string} absPath
 */
export function parseAcordosWorkbook(absPath) {
  const wb = XLSX.readFile(absPath, { cellDates: true });
  const sheetAcordos = wb.Sheets.Acordos ?? wb.Sheets[wb.SheetNames.find((n) => /acordos/i.test(n)) ?? ''];
  const sheetComp = wb.Sheets.Composição ?? wb.Sheets['Composicao'];
  const sheetParc = wb.Sheets.Parcelas;
  if (!sheetAcordos || !sheetComp || !sheetParc) {
    throw new Error('Planilha deve conter abas Acordos, Composição e Parcelas');
  }

  const rowsAcordos = XLSX.utils.sheet_to_json(sheetAcordos, { header: 1, defval: null });
  const rowsComp = XLSX.utils.sheet_to_json(sheetComp, { header: 1, defval: null });
  const rowsParc = XLSX.utils.sheet_to_json(sheetParc, { header: 1, defval: null });

  /** @type {Map<number, object>} */
  const acordos = new Map();
  for (let i = 2; i < rowsAcordos.length; i += 1) {
    const row = rowsAcordos[i];
    const codRaw = cel(row, 0);
    if (codRaw == null || codRaw === '') continue;
    const cod = Math.trunc(Number(codRaw));
    if (!Number.isFinite(cod)) continue;
    const situacao = String(cel(row, 5) ?? '').trim();
    if (normDesc(situacao) === 'cancelado') continue;
    acordos.set(cod, {
      cod,
      unidade: String(cel(row, 1) ?? '').trim(),
      condomino: String(cel(row, 2) ?? '').trim(),
      dataAcordo: parseDataAcordo(cel(row, 3)),
      qtdParcelas: Math.trunc(Number(cel(row, 4))) || 1,
      valorAcordo: valorNumerico(cel(row, 6)),
      honorarios: valorNumerico(cel(row, 7)),
      tipoHonor: String(cel(row, 8) ?? '').trim(),
      statusPagto: String(cel(row, 10) ?? '').trim(),
      dataPagto: parseDataAcordo(cel(row, 11)),
    });
  }

  /** @type {Map<number, { descricao: string, valor: number, codReceita: string }[]>} */
  const composicao = new Map();
  for (let i = 2; i < rowsComp.length; i += 1) {
    const row = rowsComp[i];
    const cod = Math.trunc(Number(cel(row, 0)));
    if (!Number.isFinite(cod)) continue;
    const valor = valorNumerico(cel(row, 4));
    const descricao = String(cel(row, 3) ?? '').trim();
    if (!descricao || valor == null) continue;
    if (!composicao.has(cod)) composicao.set(cod, []);
    composicao.get(cod).push({
      codReceita: String(cel(row, 2) ?? '').trim(),
      descricao,
      valor,
    });
  }

  /** @type {Map<number, object[]>} */
  const parcelas = new Map();
  for (let i = 2; i < rowsParc.length; i += 1) {
    const row = rowsParc[i];
    const cod = Math.trunc(Number(cel(row, 0)));
    if (!Number.isFinite(cod)) continue;
    const numero = Math.trunc(Number(cel(row, 2))) || 1;
    const venc = parseDataAcordo(cel(row, 6));
    const pagRaw = cel(row, 7);
    const pagStr = String(pagRaw ?? '').trim();
    const dataPagamento = pagStr && pagStr !== '—' && pagStr !== '-' ? parseDataAcordo(pagRaw) : null;
    const valorParcela = valorNumerico(cel(row, 8));
    const situacao = String(cel(row, 10) ?? '').trim();
    if (!parcelas.has(cod)) parcelas.set(cod, []);
    parcelas.get(cod).push({
      numero,
      dataVencimento: venc,
      dataPagamento,
      valorParcela,
      situacao,
    });
  }
  for (const list of parcelas.values()) {
    list.sort((a, b) => a.numero - b.numero);
  }

  return { cod8: COD8, acordos, composicao, parcelas };
}

/**
 * Monta um título consolidado a partir da composição do acordo.
 * @param {{ descricao: string, valor: number }[]} linhas
 * @param {number} valorTotalEsperado
 * @param {number | null} honorTotal
 * @param {string | null} dataVencimento BR DD/MM/YYYY
 */
export function montarTituloConsolidado(linhas, valorTotalEsperado, honorTotal, dataVencimento) {
  let base = 0;
  let juros = 0;
  let multa = 0;
  let atualizacao = 0;
  let honor = 0;
  for (const l of linhas) {
    const cat = classificarTaxa(l.descricao);
    if (cat === 'honorarios') honor += l.valor;
    else if (cat === 'juros') juros += l.valor;
    else if (cat === 'multa') multa += l.valor;
    else if (cat === 'atualizacao') atualizacao += l.valor;
    else base += l.valor;
  }
  if (honorTotal != null && honorTotal > 0) honor = honorTotal;
  const totalCalc = base + juros + multa + atualizacao + honor;
  const total =
    valorTotalEsperado != null && valorTotalEsperado > 0 ? valorTotalEsperado : totalCalc;

  return {
    dataVencimento: dataVencimento ?? '',
    valorInicial: fmtMoedaApi(base),
    atualizacaoMonetaria: fmtMoedaApi(atualizacao),
    diasAtraso: '',
    juros: fmtMoedaApi(juros),
    multa: fmtMoedaApi(multa),
    honorarios: fmtMoedaApi(honor),
    total: fmtMoedaApi(total),
    descricaoValor: '',
    datasEspeciais: null,
  };
}

/**
 * @param {object[]} parcelasPlanilha
 * @param {number | null} honorTotal
 * @param {number} qtdParcelas
 */
export function montarParcelasPayload(parcelasPlanilha, honorTotal, qtdParcelas) {
  const list = parcelasPlanilha ?? [];
  const honorPorParcela =
    honorTotal != null && honorTotal > 0 && list.length
      ? honorTotal / list.length
      : null;

  return list.map((p) => {
    const out = {
      numero: p.numero,
      dataVencimento: p.dataVencimento ?? '',
      valorParcela: fmtMoedaApi(p.valorParcela ?? 0),
      observacao: null,
      dataPagamento: p.dataPagamento ?? null,
    };
    if (honorPorParcela != null) {
      out.honorariosParcela = fmtMoedaApi(honorPorParcela);
    }
    return out;
  });
}

/** @param {object} titulo */
export function totalTituloNum(titulo) {
  return valorNumerico(titulo?.total) ?? 0;
}

/**
 * Identifica título existente que corresponde ao acordo (total ≈ valor acordo).
 * @param {object[]} titulos
 * @param {number} valorAcordo
 */
export function encontrarTituloCorrespondente(titulos, valorAcordo) {
  if (!Array.isArray(titulos) || !titulos.length) return null;
  const eps = 0.05;
  const exato = titulos.find((t) => Math.abs(totalTituloNum(t) - valorAcordo) <= eps);
  if (exato) return exato;
  let best = null;
  let bestD = Infinity;
  for (const t of titulos) {
    const d = Math.abs(totalTituloNum(t) - valorAcordo);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/**
 * Split parcial: títulos não negociados vão para dim+1 (cópia literal).
 * @param {object[]} titulosExistentes
 * @param {object} tituloNegociado
 */
export function titulosSaldoAposSplit(titulosExistentes, tituloNegociado) {
  if (!Array.isArray(titulosExistentes)) return [];
  const vencNeg = String(tituloNegociado?.dataVencimento ?? '').trim();
  const totalNeg = totalTituloNum(tituloNegociado);
  return titulosExistentes.filter((t) => {
    const mesmoVenc = vencNeg && String(t.dataVencimento ?? '').trim() === vencNeg;
    const mesmoTotal = Math.abs(totalTituloNum(t) - totalNeg) <= 0.05;
    return !(mesmoVenc && mesmoTotal);
  });
}

export function defaultRodadaPayload() {
  return {
    pagina: 1,
    paginaParcelamento: 1,
    titulos: [],
    parcelas: [],
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: { autor: '', reu: '' },
    honorariosDataRecebimento: {},
    parcelamentoAceito: false,
    debitos: [],
  };
}

/**
 * @param {object} acordo
 * @param {{ descricao: string, valor: number }[]} comp
 * @param {object[]} parc
 * @param {object | null} rodadaExistente
 * @param {{ forcarSplit?: boolean }} [opts]
 */
export function montarPayloadRodadaAcordo(acordo, comp, parc, rodadaExistente, opts = {}) {
  const existente = rodadaExistente && typeof rodadaExistente === 'object' ? rodadaExistente : {};
  const base = { ...defaultRodadaPayload(), ...structuredClone(existente) };

  const titulosExistentes = Array.isArray(existente.titulos) ? existente.titulos : [];
  const refTitulo = encontrarTituloCorrespondente(titulosExistentes, acordo.valorAcordo ?? 0);
  const vencTitulo =
    refTitulo?.dataVencimento ??
    (titulosExistentes[0]?.dataVencimento || parc?.[0]?.dataVencimento || acordo.dataAcordo || '');

  const tituloNegociado = montarTituloConsolidado(
    comp ?? [],
    acordo.valorAcordo,
    acordo.honorarios,
    vencTitulo
  );

  const sumExistente = titulosExistentes.reduce((s, t) => s + totalTituloNum(t), 0);
  const parcial =
    opts.forcarSplit ||
    (titulosExistentes.length > 1 &&
      acordo.valorAcordo != null &&
      sumExistente > acordo.valorAcordo + 0.05 &&
      titulosSaldoAposSplit(titulosExistentes, tituloNegociado).length > 0);

  const parcelasPayload = montarParcelasPayload(parc, acordo.honorarios, acordo.qtdParcelas);
  const maxP = parcelasPayload.reduce((m, p) => Math.max(m, p.numero ?? 0), 0);

  const payload = {
    ...base,
    titulos: [tituloNegociado],
    parcelas: parcelasPayload,
    parcelamentoAceito: true,
    titulosGravadosAceito: [{ ...tituloNegociado }],
    quantidadeParcelasInformada: String(Math.max(maxP, acordo.qtdParcelas || 1)).padStart(2, '0'),
  };

  return {
    payload,
    parcial,
    saldoTitulos: parcial ? titulosSaldoAposSplit(titulosExistentes, tituloNegociado) : [],
    vencTitulo,
    refTitulo: refTitulo ? totalTituloNum(refTitulo) : null,
  };
}

export function montarPayloadDimSaldo(titulosSaldo, rodadaSaldoExistente) {
  const base = rodadaSaldoExistente
    ? { ...defaultRodadaPayload(), ...structuredClone(rodadaSaldoExistente) }
    : defaultRodadaPayload();
  return {
    ...base,
    titulos: titulosSaldo.map((t) => ({ ...t })),
    parcelas: [],
    parcelamentoAceito: false,
    titulosGravadosAceito: undefined,
  };
}
