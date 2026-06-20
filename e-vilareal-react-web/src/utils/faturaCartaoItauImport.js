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

  const mVenc = t.match(/vencimento\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (mVenc) dataVencimento = parseDataFaturaCelula(mVenc[1]);

  const mPagou =
    t.match(/voc[eê]\s+pagou\s+r\$\s*([\d.,]+)/i) ||
    t.match(/total\s+(?:da\s+)?fatura\s*[:\s]*r\$\s*([\d.,]+)/i);
  if (mPagou) valorTotalFatura = parseValorFaturaCelula(mPagou[1]);

  return { rotuloFatura, dataVencimento, valorTotalFatura };
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

  if (!rows.length && !inLancamentos) {
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
      origem: 'PDF',
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
      const { rows, meta } = parseFaturaCartaoItauXlsxArrayBuffer(buffer, opts);
      if (!rows.length) {
        return {
          ok: false,
          message: meta?.erro || 'Planilha sem lançamentos reconhecidos (exporte «Fatura Paga» do Itaú).',
        };
      }
      return { ok: true, origem: 'XLSX', rows, meta };
    } catch (e) {
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
    message: 'Formato não suportado. Use .xlsx (recomendado) ou .pdf da fatura Itaú.',
  };
}
