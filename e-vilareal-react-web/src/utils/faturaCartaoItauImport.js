/**
 * Importação de fatura de cartão Itaú (Excel export «Fatura Paga» ou PDF).
 * Valores mantêm o sinal da fatura (compra +, estorno/pagamento −).
 */
import * as XLSX from 'xlsx';
import { extrairTextoPdfDeArquivo } from '../data/publicacoesPdfExtract.js';

const PAGAMENTO_FATURA_RE = /pagamento\s+efetuado/i;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @param {unknown} v */
export function parseDataFaturaCelula(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const whole = Math.floor(v);
    if (whole > 20000 && whole < 600000) {
      const utcMs = (whole - 25569) * 86400 * 1000;
      const d = new Date(utcMs);
      if (!Number.isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
      }
    }
  }
  const t = String(v).trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

/** @param {unknown} v */
export function parseValorFaturaCelula(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s) return null;
  s = s.replace(/^r\$/i, '');
  const neg = s.startsWith('-') || s.startsWith('(');
  const n = Number(s.replace(/[()]/g, '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return neg && n > 0 ? -n : n;
}

/** @param {unknown} v */
export function extrairFinalCartaoFatura(v) {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  return null;
}

export function ehLinhaPagamentoFatura(descricao) {
  return PAGAMENTO_FATURA_RE.test(String(descricao ?? '').trim());
}

/** @param {unknown[][]} matrix @param {number} [ateLinha] */
export function extrairResumoFaturaItauMatrix(matrix, ateLinha = 25) {
  const limite = Math.min(matrix.length, ateLinha);
  let rotuloFatura = null;
  let dataVencimento = null;
  let valorTotalFatura = null;

  for (let r = 0; r < limite; r += 1) {
    const row = matrix[r] || [];
    const cells = row.map((c) => String(c ?? '').trim());

    for (const cell of cells) {
      const mRotulo = cell.match(/fatura\s+paga\s*[-–]?\s*(.+)/i);
      if (mRotulo) rotuloFatura = mRotulo[1].trim();
    }

    for (let c = 0; c < cells.length; c += 1) {
      if (/^vencimento$/i.test(cells[c])) {
        for (let rr = r + 1; rr <= r + 3 && rr < limite; rr += 1) {
          const v = parseDataFaturaCelula((matrix[rr] || [])[c]);
          if (v) {
            dataVencimento = v;
            break;
          }
        }
      }
      if (cells[c] === 'Valor' && !cells.some((x) => /lan[cç]amento/i.test(x))) {
        for (let rr = r + 1; rr <= r + 3 && rr < limite; rr += 1) {
          const raw = (matrix[rr] || [])[c];
          const v = parseValorFaturaCelula(raw);
          if (v != null && v > 0) {
            valorTotalFatura = v;
            break;
          }
          const texto = String(raw ?? '');
          const mPagou = texto.match(/pagou\s+r\$\s*([\d.,]+)/i);
          if (mPagou) {
            const parsed = parseValorFaturaCelula(mPagou[1]);
            if (parsed != null && parsed > 0) {
              valorTotalFatura = parsed;
              break;
            }
          }
        }
      }
    }
  }

  return { rotuloFatura, dataVencimento, valorTotalFatura };
}

/**
 * @param {string} texto
 */
export function extrairResumoFaturaItauPdfText(texto) {
  const t = String(texto ?? '');
  let rotuloFatura = null;
  let dataVencimento = null;
  let valorTotalFatura = null;

  const mRotulo = t.match(/fatura\s+paga\s*[-–]?\s*([^\n\r]+)/i);
  if (mRotulo) rotuloFatura = mRotulo[1].trim();

  const mVenc =
    t.match(/Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/i) ||
    t.match(/vencimento\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i) ||
    t.match(/Com vencimento em:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (mVenc) dataVencimento = parseDataFaturaCelula(mVenc[1]);

  const mPagou =
    t.match(/voc[eê]\s+pagou\s+r\$\s*([\d.,]+)/i) ||
    t.match(/Total desta fatura\s+([\d.,]+)/i) ||
    t.match(/L Total dos lan[cç]amentos atuais\s+([\d.,]+)/i) ||
    t.match(/Lan[cç]amentos atuais\s+([\d.,]+)/i) ||
    t.match(/total\s+(?:da\s+)?fatura\s*[:\s]*r\$\s*([\d.,]+)/i) ||
    t.match(/O total da sua fatura [ée]:\s*R\$\s*([\d.,]+)/i);
  if (mPagou) valorTotalFatura = parseValorFaturaCelula(mPagou[1]);

  return { rotuloFatura, dataVencimento, valorTotalFatura };
}

/**
 * Infere ano de DD/MM com base no vencimento (fechamento Itaú ~30 dias antes).
 * @param {string} diaMes DD/MM
 * @param {string} dataVencimentoIso YYYY-MM-DD
 */
export function inferirDataIsoFaturaItau(diaMes, dataVencimentoIso) {
  const m = String(diaMes ?? '').match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m || !dataVencimentoIso) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const [vy, vm] = String(dataVencimentoIso).split('-').map(Number);
  if (!vy || !vm || !dia || !mes) return null;
  const year = mes > vm ? vy - 1 : vy;
  return `${year}-${pad2(mes)}-${pad2(dia)}`;
}

/** @param {string} line */
function linhaMetadadoFaturaItauCorreio(line) {
  const trimmed = String(line ?? '').trim();
  const mFinalInline = trimmed.match(/\(final\s+(\d{4})\)/i);
  if (mFinalInline) return { finalCartao: mFinalInline[1] };
  const mFinalSec = trimmed.match(/lan[cç]amentos no cart[aã]o \(final\s+(\d{4})\)/i);
  if (mFinalSec) return { finalCartao: mFinalSec[1] };
  const mTit = trimmed.match(/^(?:Titular|Adicional)\s+(\d{4})$/i);
  if (mTit) return { finalCartao: mTit[1] };
  return null;
}

/** @param {string} line */
function linhaIgnoradaFaturaItauCorreio(line) {
  const t = String(line ?? '').trim();
  if (!t) return true;
  if (/^DATA\s+(ESTABELECIMENTO|PRODUTOS)/i.test(t)) return true;
  if (/^Limites de cr[eé]dito|^Limite |^Encargos |^Juros |^Multa |^O limite |^Valor em R\$|^% |^Fique atento|^Continua\.\.\.|^Simula/i.test(t)) {
    return true;
  }
  if (/^(DIVERSOS|VEÍCULOS|VEICULOS|ALIMENT\.|SAÚDE|SAUDE|\.)/i.test(t)) return true;
  if (/^L\s*Total dos lan[cç]amentos atuais/i.test(t)) return true;
  if (/^Lan[cç]amentos no cart[aã]o \(final/i.test(t)) return true;
  if (/^Lan[cç]amentos produtos e servi[cç]os\s+[\d.,-]/i.test(t)) return true;
  if (/^Pr[oó]xima fatura\s|^Demais faturas\s|^Total para pr[oó]ximas faturas/i.test(t)) return true;
  if (/^Limites de cr[eé]dito|^Limite total|^Limite dispon|^Encargos cobrados|^Simula[cç][aã]o/i.test(t)) return true;
  return false;
}

/** @param {string} descricao */
export function ehParcelaProximaFaturaItau(descricao) {
  const d = String(descricao ?? '');
  if (/ANAP\d{2}\/\d{2}/i.test(d)) return true;
  if (/UNITINTAS\s+\d{2}\/\d{2}/i.test(d)) return true;
  if (/OAB\s+DF\*?\d*\s+\d{2}\/\d{2}/i.test(d)) return true;
  if (/AUTO POSTO IPANEMA\d{2}\/\d{3}/i.test(d)) return true;
  if (/MP \*CONSTRUCASADE\s+\d{2}\/\d{2}/i.test(d)) return true;
  if (/HAVAN ANAPOLIS\s+\d{2}\/\d{2}/i.test(d)) return true;
  return false;
}

/**
 * IOF / taxas avulsas no bloco internacional ou produtos (sem data DD/MM no início).
 * @param {string} line
 * @param {string} dataVencimentoIso
 */
export function parseTaxaAvulsaFaturaItauCorreio(line, dataVencimentoIso) {
  const t = String(line ?? '').trim();
  const mRepasse = t.match(/^Repasse de IOF em R\$\s*([\d.,]+)/i);
  if (mRepasse) {
    const valor = parseValorFaturaCelula(mRepasse[1]);
    if (valor == null) return null;
    return {
      dataIso: dataVencimentoIso,
      descricao: 'Repasse de IOF (internacional)',
      parcelamento: '',
      valor,
    };
  }
  return null;
}

/** Normaliza colagem de colunas no PDF Itaú (categoria+data, valor+data). */
export function normalizarLinhaPdfItauCorreio(line) {
  return String(line ?? '')
    .replace(/([A-Za-zÀ-ú])(\d{2}\/\d{2})/g, '$1 $2')
    .replace(/(\))(\d{2}\/\d{2})/g, '$1 $2')
    .replace(/,(\d{2})(\d{2}\/\d{2})/g, ',$1 $2');
}

/** @param {string} texto */
export function extrairTotaisCartaoItauPdf(texto) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const m of String(texto ?? '').matchAll(
    /Lan[cç]amentos no cart[aã]o \(final (\d{4})\)\s+(-?[\d.,]+)/gi,
  )) {
    const v = parseValorFaturaCelula(m[2]);
    if (v != null) map.set(m[1], v);
  }
  return map;
}

/** PDF MC multi-cartão (9507/5246/3611) — layout em colunas com subtotais por final. */
export function pdfItauUsaSelecaoSubtotal(texto) {
  const totais = extrairTotaisCartaoItauPdf(texto);
  if (totais.size > 1) return true;
  for (const final of totais.keys()) {
    if (final === '9507' || final === '5246' || final === '3611') return true;
  }
  return /5536\.XXXX\.XXXX\.5246/i.test(String(texto ?? ''));
}

/**
 * Seleciona subconjunto de lançamentos cuja soma confere com o total do banco (DP).
 * @param {Array<{ valor: number }>} rows
 * @param {number} target
 * @param {number} [tolerancia]
 */
export function selecionarLancamentosPorSubtotal(rows, target, tolerancia = 0.03) {
  const dedup = deduplicarCandidatosItau(rows);
  if (!dedup.length || target == null || !Number.isFinite(Number(target))) return null;

  const cents = Math.round(Number(target) * 100);
  const tolCents = Math.round(tolerancia * 100);
  const items = dedup.map((r, i) => ({ i, c: Math.round((Number(r.valor) || 0) * 100) }));

  /** @type {Map<number, number[]>} */
  const dp = new Map();
  dp.set(0, []);
  for (let i = 0; i < items.length; i += 1) {
    const next = new Map(dp);
    for (const [s, picked] of dp) {
      const ns = s + items[i].c;
      if (!next.has(ns)) next.set(ns, [...picked, i]);
    }
    for (const [k, v] of next) dp.set(k, v);
  }

  for (let d = 0; d <= tolCents; d += 1) {
    if (dp.has(cents - d)) return dp.get(cents - d).map((j) => dedup[items[j].i]);
    if (dp.has(cents + d)) return dp.get(cents + d).map((j) => dedup[items[j].i]);
  }
  return null;
}

/** @param {Array<{ dataIso?: string, valor?: number, descricao?: string, finalCartao?: string|null }>} rows */
function deduplicarCandidatosItau(rows) {
  /** @type {Map<string, Record<string, unknown>>} */
  const map = new Map();
  for (const r of rows ?? []) {
    const k = [
      r.dataIso,
      Number(r.valor).toFixed(2),
      String(r.descricao ?? '').slice(0, 40),
      r.finalCartao ?? '',
    ].join('|');
    if (!map.has(k)) map.set(k, r);
  }
  return [...map.values()];
}

/**
 * Coleta candidatos a lançamento no bloco DD/MM (com normalização de colunas).
 * @param {string} bloco
 * @param {string} dataVencimento
 * @param {{ ignorarPagamento?: boolean }} [opts]
 */
function coletarCandidatosItauCorreio(bloco, dataVencimento, opts = {}) {
  const ignorarPagamento = opts.ignorarPagamento !== false;
  /** @type {Array<Record<string, unknown>>} */
  const candidatos = [];
  let finalCartaoContext = extrairFinalCartaoDoBloco(bloco, null);

  for (const raw of bloco.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    if (/^Limites de cr[eé]dito|^Simula[cç][aã]o de Compras|^DATA\s+/i.test(raw)) continue;

    const ctx = linhaContextoCartaoItauCorreio(raw);
    if (ctx?.finalCartao) {
      finalCartaoContext = ctx.finalCartao;
      if (/^Titular\s+|^Adicional\s+/i.test(raw)) continue;
    }

    const line = normalizarLinhaPdfItauCorreio(raw);
    const taxa = parseTaxaAvulsaFaturaItauCorreio(line, dataVencimento);
    const parsedList = taxa
      ? [{ ...taxa, finalCartao: finalCartaoContext }]
      : extrairTodosLancamentosLinha(line, dataVencimento, finalCartaoContext);

    for (const parsed of parsedList) {
      if (ignorarPagamento && ehLinhaPagamentoFatura(parsed.descricao)) continue;
      candidatos.push(parsed);
    }
  }
  return candidatos;
}

function candidatosParaRows(candidatos, dataVencimento, opts = {}) {
  const finalFiltro = opts.finalCartaoFiltro ? String(opts.finalCartaoFiltro).slice(-4) : null;
  /** @type {Map<string, Record<string, unknown>>} */
  const rowMap = new Map();
  candidatos.forEach((parsed, idx) => {
    const finalCartao = parsed.finalCartao || null;
    if (finalFiltro && finalCartao && finalCartao !== finalFiltro) return;
    const row = {
      dataIso: parsed.dataIso,
      descricao: String(parsed.descricao).slice(0, 500),
      descricaoDetalhada: [parsed.parcelamento, finalCartao ? `Cartão ****${finalCartao}` : '']
        .filter(Boolean)
        .join(' · ')
        .slice(0, 2000),
      valor: parsed.valor,
      parcelamento: parsed.parcelamento || '',
      finalCartao,
      numeroLancamento: gerarIdEstavelFaturaCartao({
        dataIso: parsed.dataIso,
        valor: parsed.valor,
        descricao: parsed.descricao,
        parcelamento: parsed.parcelamento || '',
        finalCartao: finalCartao || '',
        linha: idx + 1,
        origem: 'PDF',
      }),
      linhaOrigem: idx + 1,
    };
    rowMap.set(row.numeroLancamento, row);
  });
  return [...rowMap.values()];
}

/** @param {string} line */
function linhaContextoCartaoItauCorreio(line) {
  const t = String(line ?? '').trim();
  const mFinal = t.match(/\(final\s+(\d{4})\)/i);
  if (mFinal) return { finalCartao: mFinal[1] };
  const mTit = t.match(/^Titular\s+(\d{4})$/i);
  if (mTit) return { finalCartao: mTit[1] };
  const mAd = t.match(/^Adicional\s+(\d{4})$/i);
  if (mAd) return { finalCartao: mAd[1] };
  return null;
}

/**
 * Lançamento embutido no cabeçalho «ITAMAR … (final 4941) DD/MM descrição valor».
 * @param {string} line
 * @param {string} dataVencimentoIso
 * @param {string|null} [finalCartaoContext]
 */
export function parseHeaderLancamentoItauCorreio(line, dataVencimentoIso, finalCartaoContext = null) {
  const m = String(line ?? '').match(
    /\(final\s+(\d{4})\)\s*(\d{2}\/\d{2})\s+(.+?)\s+(-?\s*(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})\s*$/i,
  );
  if (!m) return null;
  const valor = parseValorFaturaCelula(String(m[4]).replace(/\s/g, ''));
  const dataIso = inferirDataIsoFaturaItau(m[2], dataVencimentoIso);
  const descricao = m[3].trim();
  if (!dataIso || valor == null || !descricao || ehLinhaPagamentoFatura(descricao)) return null;
  return {
    dataIso,
    descricao,
    parcelamento: '',
    valor,
    finalCartao: m[1] || finalCartaoContext,
  };
}

/**
 * Linha DD/MM do PDF tradicional Itaú (correio / app «abrir PDF»).
 * @param {string} line
 * @param {string} dataVencimentoIso
 * @param {string|null} [finalCartaoContext]
 */
export function parseLinhaTextoFaturaItauCorreio(line, dataVencimentoIso, finalCartaoContext = null) {
  let trimmed = String(line ?? '').trim();
  if (linhaIgnoradaFaturaItauCorreio(trimmed)) return null;

  trimmed = trimmed
    .replace(/\s+Limite total.*$/i, '')
    .replace(/\s+Limite dispon[ií]vel.*$/i, '')
    .replace(/\s+Limite m[aá]ximo.*$/i, '')
    .replace(/\s+Desse total.*$/i, '')
    .replace(/\s+nossos canais.*$/i, '')
    .replace(/\s+Encargos cobrados.*$/i, '')
    .trim();

  const mDate = trimmed.match(/^(\d{2}\/\d{2})\s+(.+)$/);
  if (!mDate) return null;

  const rest = mDate[2].trim();
  const matches = [...rest.matchAll(/(-?\s*(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})/g)];
  if (!matches.length) return null;
  const firstVal = matches[0];
  const valor = parseValorFaturaCelula(String(firstVal[1]).replace(/\s/g, ''));
  if (valor == null) return null;

  let middle = rest.slice(0, firstVal.index).trim();
  if (!middle) return null;

  let parcelamento = '';
  const mParc = middle.match(/\s(Parcela\s+\d+\s+de\s+\d+)\s*$/i);
  if (mParc) {
    parcelamento = mParc[1];
    middle = middle.slice(0, middle.length - mParc[0].length).trim();
  }

  const dataIso = inferirDataIsoFaturaItau(mDate[1], dataVencimentoIso);
  if (!dataIso || !middle) return null;

  return {
    dataIso,
    descricao: middle,
    parcelamento,
    valor,
    finalCartao: finalCartaoContext,
  };
}

/**
 * Extrai zero ou mais lançamentos DD/MM de uma linha (layout Itaú em colunas).
 * @param {string} line
 * @param {string} dataVencimentoIso
 * @param {string|null} [finalCartaoContext]
 */
export function extrairTodosLancamentosLinha(line, dataVencimentoIso, finalCartaoContext = null) {
  /** @type {Array<{ dataIso: string, descricao: string, parcelamento: string, valor: number, finalCartao: string|null }>} */
  const results = [];
  let rest = String(line ?? '').trim();
  rest = rest
    .replace(/^Lan[cç]amentos no cart[aã]o \(final \d{4}\)\s*/i, '')
    .replace(/^Lan[cç]amentos produtos e servi[cç]os\s*/i, '');
  if (!rest || linhaIgnoradaFaturaItauCorreio(rest)) return results;

  rest = normalizarLinhaPdfItauCorreio(rest);

  const headerParsed = parseHeaderLancamentoItauCorreio(rest, dataVencimentoIso, finalCartaoContext);
  if (headerParsed) {
    results.push(headerParsed);
    return results;
  }

  rest = rest
    .replace(/\s+Limite total.*$/i, '')
    .replace(/\s+Limite dispon[ií]vel.*$/i, '')
    .replace(/\s+Limite m[aá]ximo.*$/i, '')
    .replace(/\s+Desse total.*$/i, '')
    .replace(/\s+nossos canais.*$/i, '')
    .replace(/\s+Encargos cobrados.*$/i, '')
    .replace(/\s+L Total dos lan[cç]amentos atuais.*$/i, '')
    .replace(/\s+Lan[cç]amentos no cart[aã]o \(final \d{4}\).*/i, '')
    .replace(/\s+Lan[cç]amentos produtos e servi[cç]os\s+[\d.,]+.*$/i, '')
    .replace(/(\d{2},\d{2})Limite total de cr[eé]dito.*$/i, '$1')
    .replace(/(\d{2},\d{2})Limite total utilizado.*$/i, '$1')
    .replace(/(\d{2},\d{2})O limite total.*$/i, '$1')
    .trim();

  while (rest.length > 0) {
    const m = rest.match(/(?:^|\s)(\d{2}\/\d{2})\s+/);
    if (!m || m.index === undefined) break;

    const diaMes = m[1];
    const start = m.index + m[0].length;
    const afterDate = rest.slice(start);
    const valMatch = afterDate.match(/(-?\s*(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})/);
    if (!valMatch || valMatch.index === undefined) {
      rest = rest.slice(m.index + m[0].length);
      continue;
    }

    let middle = afterDate.slice(0, valMatch.index).trim();
    middle = middle
      .replace(/\s+(?:Limites de cr[eé]dito|Valor em R\$|L Total|Lan[cç]amentos no cart[aã]o).*$/i, '')
      .trim();

    if (!middle || middle.length < 2 || /^(DATA|Valor em)/i.test(middle)) {
      rest = rest.slice(start + valMatch.index + valMatch[0].length);
      continue;
    }

    const valor = parseValorFaturaCelula(String(valMatch[1]).replace(/\s/g, ''));
    const dataIso = inferirDataIsoFaturaItau(diaMes, dataVencimentoIso);
    if (dataIso && valor != null && !ehLinhaPagamentoFatura(middle)) {
      let parcelamento = '';
      const mParc = middle.match(/\s(Parcela\s+\d+\s+de\s+\d+)\s*$/i);
      if (mParc) {
        parcelamento = mParc[1];
        middle = middle.slice(0, middle.length - mParc[0].length).trim();
      }
      results.push({
        dataIso,
        descricao: middle,
        parcelamento,
        valor,
        finalCartao: finalCartaoContext,
      });
    }

    rest = rest.slice(start + valMatch.index + valMatch[0].length);
  }

  return results;
}

/** @param {string} bloco @param {string|null} finalCartaoDefault */
function extrairFinalCartaoDoBloco(bloco, finalCartaoDefault = null) {
  const finals = [...bloco.matchAll(/\(final\s+(\d{4})\)/gi)].map((m) => m[1]);
  if (finals.length) return finals[finals.length - 1];
  return finalCartaoDefault;
}

/**
 * Parser do PDF tradicional Itaú (formato correio: DD/MM + descrição + valor).
 * @param {string} texto
 * @param {{ ignorarPagamento?: boolean, finalCartaoFiltro?: string|null }} [opts]
 */
export function parseFaturaCartaoItauPdfTextCorreio(texto, opts = {}) {
  const ignorarPagamento = opts.ignorarPagamento !== false;
  const finalFiltro = opts.finalCartaoFiltro ? String(opts.finalCartaoFiltro).slice(-4) : null;
  const resumo = extrairResumoFaturaItauPdfText(texto);
  const dataVencimento = resumo.dataVencimento;
  if (!dataVencimento) {
    return {
      rows: [],
      meta: {
        totalLinhas: 0,
        ignoradosPagamento: 0,
        origem: 'PDF_CORREIO',
        erro: 'Vencimento não encontrado no PDF.',
        conferenciaTotal: conferirTotalFatura({ somaCalculada: 0, valorTotalBanco: null }),
      },
    };
  }

  const startIdx = texto.search(/lan[cç]amentos:\s*(?:compras|produtos)/i);
  const from = startIdx >= 0 ? startIdx : 0;
  const tail = texto.slice(from);
  const endCont = tail.search(/Continua\.\.\.|Simula[cç][aã]o de Compras/i);
  const bloco = startIdx >= 0 ? tail.slice(0, endCont >= 0 ? endCont : tail.length) : texto;

  // PDF MC multi-cartão: seleção por subtotal (layout colunas embaralhado).
  if (
    pdfItauUsaSelecaoSubtotal(texto) &&
    resumo.valorTotalFatura != null &&
    !finalFiltro
  ) {
    const candidatos = coletarCandidatosItauCorreio(bloco, dataVencimento, opts);
    const selecionados = selecionarLancamentosPorSubtotal(candidatos, resumo.valorTotalFatura);
    if (selecionados?.length) {
      const rows = candidatosParaRows(selecionados, dataVencimento, opts);
      const somaCalculada = somarLancamentosFatura(rows);
      return {
        rows,
        meta: {
          totalLinhas: rows.length,
          ignoradosPagamento: 0,
          origem: 'PDF_CORREIO',
          dataVencimento,
          rotuloFatura: resumo.rotuloFatura,
          valorTotalBanco: resumo.valorTotalFatura,
          somaCalculada,
          conferenciaTotal: conferirTotalFatura({ somaCalculada, valorTotalBanco: resumo.valorTotalFatura }),
          modoParse: 'SUBTOTAL_MC',
        },
      };
    }
  }

  let finalCartaoContext = extrairFinalCartaoDoBloco(bloco, null);

  /** @type {Map<string, Record<string, unknown>>} */
  const rowMap = new Map();
  let ignoradosPagamento = 0;
  /** @type {'antes' | 'proximas' | 'apos'} */
  let zona = 'antes';

  const blocoLines = bloco.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < blocoLines.length; i += 1) {
    const line = blocoLines[i];
    if (/^Compras parceladas\s*[-–]\s*pr[oó]ximas faturas/i.test(line)) {
      zona = 'proximas';
      continue;
    }
    if (/^Total para pr[oó]ximas faturas/i.test(line)) {
      zona = 'apos';
      continue;
    }
    if (/^Limites de cr[eé]dito|^Simula[cç][aã]o de Compras/i.test(line)) continue;

    const ctx = linhaContextoCartaoItauCorreio(line);
    if (ctx?.finalCartao) {
      finalCartaoContext = ctx.finalCartao;
      if (/^Titular\s+|^Adicional\s+/i.test(line)) continue;
    }

    const taxa = parseTaxaAvulsaFaturaItauCorreio(line, dataVencimento);
    const parsedList = taxa
      ? [{ ...taxa, finalCartao: finalCartaoContext }]
      : extrairTodosLancamentosLinha(line, dataVencimento, finalCartaoContext);

    const nextLine = blocoLines[i + 1] ?? '';
    const nextCtx = linhaContextoCartaoItauCorreio(nextLine);
    const finalFromNext =
      nextCtx?.finalCartao && /^Titular\s+|^Adicional\s+/i.test(nextLine) ? nextCtx.finalCartao : null;

    for (const parsed of parsedList) {
      if (zona === 'proximas' && ehParcelaProximaFaturaItau(parsed.descricao)) continue;
      if (ignorarPagamento && ehLinhaPagamentoFatura(parsed.descricao)) {
        ignoradosPagamento += 1;
        continue;
      }
      const finalCartao = parsed.finalCartao || finalFromNext || finalCartaoContext;
      if (finalFiltro && finalCartao && finalCartao !== finalFiltro) continue;

      const row = {
        dataIso: parsed.dataIso,
        descricao: parsed.descricao.slice(0, 500),
        descricaoDetalhada: [parsed.parcelamento, finalCartao ? `Cartão ****${finalCartao}` : '']
          .filter(Boolean)
          .join(' · ')
          .slice(0, 2000),
        valor: parsed.valor,
        parcelamento: parsed.parcelamento,
        finalCartao,
        numeroLancamento: gerarIdEstavelFaturaCartao({
          dataIso: parsed.dataIso,
          valor: parsed.valor,
          descricao: parsed.descricao,
          parcelamento: parsed.parcelamento,
          finalCartao: finalCartao || '',
          linha: i + 1,
          origem: 'PDF',
        }),
        linhaOrigem: i + 1,
      };
      rowMap.set(row.numeroLancamento, row);
    }
  }

  const rows = [...rowMap.values()];
  const somaCalculada = somarLancamentosFatura(rows);
  const conferencia = conferirTotalFatura({
    somaCalculada,
    valorTotalBanco: resumo.valorTotalFatura,
  });

  return {
    rows,
    meta: {
      totalLinhas: rows.length,
      ignoradosPagamento,
      origem: 'PDF_CORREIO',
      dataVencimento,
      rotuloFatura: resumo.rotuloFatura,
      valorTotalBanco: resumo.valorTotalFatura,
      somaCalculada,
      conferenciaTotal: conferencia,
    },
  };
}

/** @param {Array<{ valor?: number }>} rows */
export function somarLancamentosFatura(rows) {
  return (rows ?? []).reduce((s, r) => s + (Number(r.valor) || 0), 0);
}

/**
 * @param {{ somaCalculada: number, valorTotalBanco?: number|null, tolerancia?: number }} p
 */
export function conferirTotalFatura({ somaCalculada, valorTotalBanco, tolerancia = 0.02 }) {
  const soma = Math.round((Number(somaCalculada) || 0) * 100) / 100;
  if (valorTotalBanco == null || !Number.isFinite(Number(valorTotalBanco))) {
    return {
      ok: null,
      somaCalculada: soma,
      valorTotalBanco: null,
      diferenca: null,
      mensagem: 'Total cobrado pelo banco não encontrado no arquivo.',
    };
  }
  const totalBanco = Math.round(Number(valorTotalBanco) * 100) / 100;
  const diferenca = Math.round((soma - totalBanco) * 100) / 100;
  const ok = Math.abs(diferenca) <= tolerancia;
  return {
    ok,
    somaCalculada: soma,
    valorTotalBanco: totalBanco,
    diferenca,
    mensagem: ok
      ? 'Total confere com o valor cobrado pelo banco.'
      : `Diferença de R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',')} em relação ao banco.`,
  };
}

/** Mensagem legível ao final da importação sobre conferência de total. */
export function mensagemResultadoConferenciaFatura(conferencia) {
  if (!conferencia) {
    return 'Não foi possível conferir o total da fatura com o valor importado.';
  }
  const fmt = (n) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
  const soma = fmt(conferencia.somaCalculada);
  const banco = conferencia.valorTotalBanco != null ? fmt(conferencia.valorTotalBanco) : null;

  if (conferencia.ok === true && banco) {
    return `Conferência OK: o total importado (${soma}) confere com o valor da fatura (${banco}).`;
  }
  if (conferencia.ok === false && banco) {
    const dif = fmt(Math.abs(Number(conferencia.diferenca) || 0));
    return `Conferência com divergência: total importado ${soma}, valor da fatura ${banco} (diferença ${dif}).`;
  }
  return (
    conferencia.mensagem ||
    (banco
      ? `Total importado: ${soma}. Valor da fatura no arquivo: ${banco}. Conferência não conclusiva.`
      : `Total importado: ${soma}. Valor total da fatura não encontrado no arquivo para conferência.`)
  );
}

/**
 * @param {object} p
 * @returns {string}
 */
export function gerarIdEstavelFaturaCartao({
  dataIso,
  valor,
  descricao,
  parcelamento = '',
  finalCartao = '',
  linha = 0,
  origem = 'XLSX',
}) {
  const cents = Math.round((Number(valor) || 0) * 100);
  const base = [
    origem,
    dataIso,
    cents,
    String(descricao).trim().slice(0, 80),
    String(parcelamento).trim(),
    finalCartao,
    linha,
  ].join('|');
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  return `FAT-${dataIso?.replace(/-/g, '') || '00000000'}-${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Localiza cabeçalho «Lançamentos» (Data + Lançamento + Valor).
 * @param {unknown[][]} matrix
 */
export function localizarCabecalhoLancamentosItau(matrix) {
  for (let r = 0; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    const cells = row.map((c) => String(c ?? '').trim().toLowerCase());
    const idxData = cells.findIndex((c) => c === 'data');
    const idxLanc = cells.findIndex((c) => c.includes('lançamento') || c.includes('lancamento'));
    const idxValor = cells.findIndex((c) => c === 'valor');
    if (idxData >= 0 && idxLanc >= 0 && idxValor >= 0) {
      const idxParc = cells.findIndex((c) => c.includes('parcel'));
      const idxCartao = cells.findIndex((c) => c.includes('número do cartão') || c.includes('numero do cartao'));
      return {
        headerRow: r,
        colData: idxData,
        colLancamento: idxLanc,
        colParcelamento: idxParc >= 0 ? idxParc : null,
        colValor: idxValor,
        colFinalCartao: idxCartao >= 0 ? idxCartao : null,
      };
    }
  }
  return null;
}

/**
 * @param {unknown[][]} matrix
 * @param {{ ignorarPagamento?: boolean, finalCartaoFiltro?: string|null, origem?: string }} [opts]
 */
export function parseMatrixFaturaItau(matrix, opts = {}) {
  const ignorarPagamento = opts.ignorarPagamento !== false;
  const finalFiltro = opts.finalCartaoFiltro ? String(opts.finalCartaoFiltro).slice(-4) : null;
  const origem = opts.origem || 'XLSX';
  const header = localizarCabecalhoLancamentosItau(matrix);
  if (!header) return { rows: [], meta: { erro: 'Cabeçalho de lançamentos não encontrado.' } };

  const resumo = extrairResumoFaturaItauMatrix(matrix, header.headerRow);

  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  let ignoradosPagamento = 0;
  let ignoradosCartao = 0;

  for (let r = header.headerRow + 1; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    const dataIso = parseDataFaturaCelula(row[header.colData]);
    const descricao = String(row[header.colLancamento] ?? '').trim();
    const parcelamento =
      header.colParcelamento != null ? String(row[header.colParcelamento] ?? '').trim() : '';
    const valor = parseValorFaturaCelula(row[header.colValor]);
    const finalCartao =
      header.colFinalCartao != null ? extrairFinalCartaoFatura(row[header.colFinalCartao]) : null;

    if (!dataIso && !descricao && valor == null) continue;
    if (!dataIso || valor == null || !descricao) continue;

    if (ignorarPagamento && ehLinhaPagamentoFatura(descricao)) {
      ignoradosPagamento += 1;
      continue;
    }
    if (finalFiltro && finalCartao && finalCartao !== finalFiltro) {
      ignoradosCartao += 1;
      continue;
    }

    const descricaoDetalhada = [parcelamento, finalCartao ? `Cartão ****${finalCartao}` : '']
      .filter(Boolean)
      .join(' · ');

    rows.push({
      dataIso,
      descricao: descricao.slice(0, 500),
      descricaoDetalhada: descricaoDetalhada.slice(0, 2000),
      valor,
      parcelamento,
      finalCartao,
      numeroLancamento: gerarIdEstavelFaturaCartao({
        dataIso,
        valor,
        descricao,
        parcelamento,
        finalCartao: finalCartao || '',
        linha: r + 1,
        origem,
      }),
      linhaOrigem: r + 1,
    });
  }

  const somaCalculada = somarLancamentosFatura(rows);
  const conferencia = conferirTotalFatura({
    somaCalculada,
    valorTotalBanco: resumo.valorTotalFatura,
  });

  return {
    rows,
    meta: {
      totalLinhas: rows.length,
      ignoradosPagamento,
      ignoradosCartao,
      headerRow: header.headerRow + 1,
      dataVencimento: resumo.dataVencimento,
      rotuloFatura: resumo.rotuloFatura,
      valorTotalBanco: resumo.valorTotalFatura,
      somaCalculada,
      conferenciaTotal: conferencia,
    },
  };
}

/**
 * @param {import('xlsx').WorkBook} wb
 * @param {{ ignorarPagamento?: boolean, finalCartaoFiltro?: string|null }} [opts]
 */
export function parseFaturaCartaoItauWorkbook(wb, opts = {}) {
  const sheetNames = wb.SheetNames || [];
  let best = { rows: [], meta: { erro: 'Nenhuma aba com lançamentos.' } };
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    if (!ws?.['!ref']) continue;
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const parsed = parseMatrixFaturaItau(matrix, { ...opts, origem: 'XLSX' });
    if (parsed.rows.length > best.rows.length) {
      best = { ...parsed, meta: { ...parsed.meta, sheetName: name } };
    }
  }
  return best;
}

/**
 * @param {ArrayBuffer} buffer
 * @param {object} [opts]
 */
export function parseFaturaCartaoItauXlsxArrayBuffer(buffer, opts = {}) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false });
  return parseFaturaCartaoItauWorkbook(wb, opts);
}

/**
 * Parser de texto extraído do PDF Itaú «Fatura Paga».
 * @param {string} texto
 * @param {{ ignorarPagamento?: boolean, finalCartaoFiltro?: string|null }} [opts]
 */
export function parseFaturaCartaoItauPdfText(texto, opts = {}) {
  const ignorarPagamento = opts.ignorarPagamento !== false;
  const finalFiltro = opts.finalCartaoFiltro ? String(opts.finalCartaoFiltro).slice(-4) : null;
  const lines = String(texto ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let inLancamentos = false;
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  let ignoradosPagamento = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^lan[cç]amentos$/i.test(line) || /lan[cç]amentos da fatura/i.test(line)) {
      inLancamentos = true;
      continue;
    }
    if (!inLancamentos) continue;
    if (/^total|^resumo|^pagamento m[ií]nimo/i.test(line)) break;

    const parsed = parseLinhaTextoFaturaItau(line);
    if (!parsed) continue;

    if (ignorarPagamento && ehLinhaPagamentoFatura(parsed.descricao)) {
      ignoradosPagamento += 1;
      continue;
    }
    if (finalFiltro && parsed.finalCartao && parsed.finalCartao !== finalFiltro) continue;

    rows.push({
      dataIso: parsed.dataIso,
      descricao: parsed.descricao.slice(0, 500),
      descricaoDetalhada: [parsed.parcelamento, parsed.finalCartao ? `Cartão ****${parsed.finalCartao}` : '']
        .filter(Boolean)
        .join(' · ')
        .slice(0, 2000),
      valor: parsed.valor,
      parcelamento: parsed.parcelamento,
      finalCartao: parsed.finalCartao,
      numeroLancamento: gerarIdEstavelFaturaCartao({
        dataIso: parsed.dataIso,
        valor: parsed.valor,
        descricao: parsed.descricao,
        parcelamento: parsed.parcelamento,
        finalCartao: parsed.finalCartao || '',
        linha: i + 1,
        origem: 'PDF',
      }),
      linhaOrigem: i + 1,
    });
  }

  if (!rows.length) {
    const correio = parseFaturaCartaoItauPdfTextCorreio(texto, opts);
    if (correio.rows.length) return correio;

    if (!inLancamentos) {
      for (let i = 0; i < lines.length; i += 1) {
        const parsed = parseLinhaTextoFaturaItau(lines[i]);
        if (!parsed) continue;
        if (ignorarPagamento && ehLinhaPagamentoFatura(parsed.descricao)) continue;
        rows.push({
          dataIso: parsed.dataIso,
          descricao: parsed.descricao.slice(0, 500),
          descricaoDetalhada: parsed.parcelamento || '',
          valor: parsed.valor,
          parcelamento: parsed.parcelamento,
          finalCartao: parsed.finalCartao,
          numeroLancamento: gerarIdEstavelFaturaCartao({
            dataIso: parsed.dataIso,
            valor: parsed.valor,
            descricao: parsed.descricao,
            parcelamento: parsed.parcelamento,
            finalCartao: parsed.finalCartao || '',
            linha: i + 1,
            origem: 'PDF',
          }),
          linhaOrigem: i + 1,
        });
      }
    }
  }

  const resumo = extrairResumoFaturaItauPdfText(texto);
  const somaCalculada = somarLancamentosFatura(rows);
  const conferencia = conferirTotalFatura({
    somaCalculada,
    valorTotalBanco: resumo.valorTotalFatura,
  });

  return {
    rows,
    meta: {
      totalLinhas: rows.length,
      ignoradosPagamento,
      origem: rows.length ? 'PDF' : 'PDF',
      dataVencimento: resumo.dataVencimento,
      rotuloFatura: resumo.rotuloFatura,
      valorTotalBanco: resumo.valorTotalFatura,
      somaCalculada,
      conferenciaTotal: conferencia,
    },
  };
}

/** @param {string} line */
export function parseLinhaTextoFaturaItau(line) {
  const trimmed = String(line ?? '').trim();
  const mDate = trimmed.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
  if (!mDate) return null;

  let rest = mDate[2].trim();
  let finalCartao = null;
  const mCard = rest.match(/\*{2,}(\d{4})\s*$/);
  if (mCard) {
    finalCartao = mCard[1];
    rest = rest.slice(0, rest.length - mCard[0].length).trim();
  }

  const mVal = rest.match(/\s(-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})\s*$/);
  if (!mVal) return null;
  const valor = parseValorFaturaCelula(mVal[1]);
  if (valor == null) return null;

  let middle = rest.slice(0, rest.length - mVal[0].length).trim();
  let parcelamento = '';
  const mParc = middle.match(/\s(Parcela\s+\d+\s+de\s+\d+)\s*$/i);
  if (mParc) {
    parcelamento = mParc[1];
    middle = middle.slice(0, middle.length - mParc[0].length).trim();
  }

  const dataIso = parseDataFaturaCelula(mDate[1]);
  if (!dataIso || !middle) return null;

  return {
    dataIso,
    descricao: middle,
    parcelamento,
    valor,
    finalCartao,
  };
}

export function arquivoFaturaCartaoEhExcel(file) {
  const n = String(file?.name ?? '').toLowerCase();
  return n.endsWith('.xlsx') || n.endsWith('.xls');
}

export function arquivoFaturaCartaoEhPdf(file) {
  return String(file?.name ?? '').toLowerCase().endsWith('.pdf');
}

/**
 * @param {File} file
 * @param {{ finalCartaoFiltro?: string|null, ignorarPagamento?: boolean }} [opts]
 */
export async function parseArquivoFaturaCartao(file, opts = {}) {
  if (!file) return { ok: false, message: 'Nenhum arquivo selecionado.' };

  if (arquivoFaturaCartaoEhExcel(file)) {
    try {
      const buffer = await file.arrayBuffer();
      const { lerEParsearFaturaCartaoXlsx, FaturaCartaoXlsxProtegidoError } = await import(
        './faturaCartaoXlsx.js'
      );
      const { rows, meta } = await lerEParsearFaturaCartaoXlsx(buffer, {
        ...opts,
        password: opts.senhaExcel ?? opts.password ?? null,
      });
      if (!rows.length) {
        return {
          ok: false,
          message:
            meta?.erro ||
            'Planilha sem lançamentos reconhecidos (Itaú «Fatura Paga» ou Excel BTG).',
        };
      }
      const origem = meta?.formato === 'BTG' ? 'XLSX_BTG' : 'XLSX';
      return { ok: true, origem, rows, meta };
    } catch (e) {
      if (e?.precisaSenhaExcel) {
        return {
          ok: false,
          precisaSenhaExcel: true,
          message: 'Arquivo Excel protegido por senha. Informe a senha (geralmente o CPF).',
        };
      }
      if (e?.senhaExcelIncorreta) {
        return {
          ok: false,
          senhaExcelIncorreta: true,
          message: e.message || 'Senha do Excel incorreta.',
        };
      }
      return { ok: false, message: e?.message || String(e) };
    }
  }

  if (arquivoFaturaCartaoEhPdf(file)) {
    try {
      const { texto } = await extrairTextoPdfDeArquivo(file);
      const { rows, meta } = parseFaturaCartaoItauPdfText(texto, opts);
      if (!rows.length) {
        return {
          ok: false,
          message:
            'PDF sem lançamentos reconhecidos. Prefira o Excel exportado pelo banco (mais confiável).',
        };
      }
      return { ok: true, origem: 'PDF', rows, meta };
    } catch (e) {
      return { ok: false, message: e?.message || String(e) };
    }
  }

  return {
    ok: false,
    message: 'Formato não suportado. Use .xlsx (Itaú ou BTG) ou .pdf da fatura Itaú.',
  };
}
