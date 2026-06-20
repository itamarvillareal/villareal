/**
 * Importação de fatura de cartão BTG (Excel exportado do app / internet banking).
 * Valores mantêm o sinal da fatura (compra +, estorno/crédito −).
 */
import * as XLSX from 'xlsx';
import {
  parseValorFaturaCelula,
  parseDataFaturaCelula,
  extrairFinalCartaoFatura,
  somarLancamentosFatura,
  conferirTotalFatura,
  gerarIdEstavelFaturaCartao,
} from './faturaCartaoItauImport.js';

const MESES_PT = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @param {unknown[][]} matrix */
export function planilhaPareceFaturaBtg(matrix) {
  const limite = Math.min(matrix.length, 30);
  for (let r = 0; r < limite; r += 1) {
    const cells = (matrix[r] || []).map((c) => String(c ?? '').trim());
    if (cells.some((c) => /fatura\s+cart[aã]o\s+de\s+cr[eé]dito/i.test(c))) return true;
    if (cells.some((c) => /^total\s+de\s+compras\s+e\s+despesas$/i.test(c))) return true;
  }
  return false;
}

/** @param {unknown} v */
function parseMesAnoFaturaBtg(v) {
  const t = String(v ?? '').trim();
  const m = t.match(/^([A-Za-zçÇáéíóúãõ]+)\s*\/\s*(\d{4})$/i);
  if (!m) return null;
  const mes = MESES_PT[m[1].toLowerCase()];
  const ano = Number(m[2]);
  if (!mes || !Number.isFinite(ano)) return null;
  return { mes, ano };
}

/** @param {unknown[][]} matrix */
export function extrairResumoFaturaBtgMatrix(matrix) {
  let mesAnoFatura = null;
  let dataVencimento = null;
  let valorTotalFatura = null;
  let rotuloFatura = null;

  for (let r = 0; r < Math.min(matrix.length, 20); r += 1) {
    const row = matrix[r] || [];
    const cells = row.map((c) => String(c ?? '').trim());

    for (const cell of cells) {
      const parsedMesAno = parseMesAnoFaturaBtg(cell);
      if (parsedMesAno) {
        mesAnoFatura = parsedMesAno;
        rotuloFatura = cell;
      }
    }

    for (let c = 0; c < cells.length; c += 1) {
      if (/^vencimento$/i.test(cells[c])) {
        const raw = String(row[c + 2] ?? row[c + 1] ?? '').trim();
        const br = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
        if (br) {
          const ano =
            br[3] != null
              ? Number(br[3])
              : mesAnoFatura?.ano ?? new Date().getFullYear();
          dataVencimento = `${ano}-${pad2(br[2])}-${pad2(br[1])}`;
        }
      }
      if (/^total\s+da\s+fatura$/i.test(cells[c])) {
        for (let cc = c + 1; cc < row.length; cc += 1) {
          const v = parseValorFaturaCelula(row[cc]);
          if (v != null && v > 0) {
            valorTotalFatura = v;
            break;
          }
        }
      }
    }
  }

  return { rotuloFatura, dataVencimento, valorTotalFatura, mesAnoFatura };
}

/**
 * @param {unknown} v
 * @param {{ mesVencimento?: number|null, anoVencimento?: number|null }} ctx
 */
export function parseDataFaturaBtgCelula(v, ctx = {}) {
  const t = String(v ?? '').trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!br) return null;
  if (br[3]) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const mes = Number(br[2]);
  const anoBase = ctx.anoVencimento ?? new Date().getFullYear();
  const mesVenc = ctx.mesVencimento ?? 12;
  const ano = mes > mesVenc ? anoBase - 1 : anoBase;
  return `${ano}-${pad2(mes)}-${pad2(br[1])}`;
}

/** @param {string} descricao */
function extrairParcelamentoBtg(descricao) {
  const m = String(descricao ?? '').match(/\((\d+\/\d+)\)\s*$/);
  return m ? m[1] : '';
}

/** @param {string} descricao */
export function ehLinhaPagamentoFaturaBtg(descricao) {
  return /pagamento\s+de\s+fatura/i.test(String(descricao ?? '').trim());
}

/** @param {string} descricao */
function ehLinhaTotalResumoBtg(descricao) {
  return /^total\s+de\s/i.test(String(descricao ?? '').trim());
}

/**
 * Localiza linhas de cabeçalho «Data / Descrição / Valor» na planilha BTG.
 * @param {unknown[][]} matrix
 */
export function localizarCabecalhosLancamentosBtg(matrix) {
  /** @type {Array<{ headerRow: number, colData: number, colDescricao: number, colValor: number, colTipo: number|null, colFinalCartao: number|null }>} */
  const headers = [];
  for (let r = 0; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    const cells = row.map((c) => String(c ?? '').trim().toLowerCase());
    const idxData = cells.findIndex((c) => c === 'data');
    const idxDesc = cells.findIndex((c) => c === 'descrição' || c === 'descricao');
    const idxValor = cells.findIndex((c) => c === 'valor');
    if (idxData < 0 || idxDesc < 0 || idxValor < 0) continue;
    const idxTipo = cells.findIndex((c) => c.includes('tipo'));
    const idxFinal = cells.findIndex((c) => c.includes('final cart'));
    headers.push({
      headerRow: r,
      colData: idxData,
      colDescricao: idxDesc,
      colValor: idxValor,
      colTipo: idxTipo >= 0 ? idxTipo : null,
      colFinalCartao: idxFinal >= 0 ? idxFinal : null,
    });
  }
  return headers;
}

/**
 * @param {unknown[][]} matrix
 * @param {{ ignorarPagamento?: boolean, finalCartaoFiltro?: string|null, origem?: string }} [opts]
 */
export function parseMatrixFaturaBtg(matrix, opts = {}) {
  if (!planilhaPareceFaturaBtg(matrix)) {
    return { rows: [], meta: { erro: 'Planilha não reconhecida como fatura BTG.' } };
  }

  const ignorarPagamento = opts.ignorarPagamento !== false;
  const finalFiltro = opts.finalCartaoFiltro ? String(opts.finalCartaoFiltro).slice(-4) : null;
  const origem = opts.origem || 'XLSX_BTG';
  const resumo = extrairResumoFaturaBtgMatrix(matrix);
  const mesVencimento = resumo.mesAnoFatura?.mes ?? null;
  const anoVencimento =
    resumo.dataVencimento != null
      ? Number(String(resumo.dataVencimento).slice(0, 4))
      : resumo.mesAnoFatura?.ano ?? null;
  const ctxData = { mesVencimento, anoVencimento };

  const headers = localizarCabecalhosLancamentosBtg(matrix);
  if (!headers.length) {
    return { rows: [], meta: { erro: 'Cabeçalho de lançamentos BTG não encontrado.' } };
  }

  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  let ignoradosPagamento = 0;
  let ignoradosCartao = 0;
  let ignoradosResumo = 0;

  for (let h = 0; h < headers.length; h += 1) {
    const header = headers[h];
    const proxHeader = headers[h + 1]?.headerRow ?? matrix.length;
    for (let r = header.headerRow + 1; r < proxHeader; r += 1) {
      const row = matrix[r] || [];
      const descricao = String(row[header.colDescricao] ?? '').trim();
      const valor = parseValorFaturaCelula(row[header.colValor]);
      const dataIso =
        parseDataFaturaCelula(row[header.colData]) ||
        parseDataFaturaBtgCelula(row[header.colData], ctxData);

      if (!descricao && valor == null && !dataIso) continue;
      if (!dataIso || valor == null || !descricao) continue;
      if (ehLinhaTotalResumoBtg(descricao)) {
        ignoradosResumo += 1;
        continue;
      }
      if (ignorarPagamento && ehLinhaPagamentoFaturaBtg(descricao)) {
        ignoradosPagamento += 1;
        continue;
      }

      const parcelamento = extrairParcelamentoBtg(descricao);
      const tipoCompra =
        header.colTipo != null ? String(row[header.colTipo] ?? '').trim() : '';
      const finalCartao =
        header.colFinalCartao != null
          ? extrairFinalCartaoFatura(row[header.colFinalCartao])
          : null;

      if (finalFiltro && finalCartao && finalCartao !== finalFiltro) {
        ignoradosCartao += 1;
        continue;
      }

      const descricaoDetalhada = [tipoCompra, parcelamento, finalCartao ? `Cartão ****${finalCartao}` : '']
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
      ignoradosResumo,
      dataVencimento: resumo.dataVencimento,
      rotuloFatura: resumo.rotuloFatura,
      valorTotalBanco: resumo.valorTotalFatura,
      somaCalculada,
      conferenciaTotal: conferencia,
      formato: 'BTG',
    },
  };
}

/**
 * @param {import('xlsx').WorkBook} wb
 * @param {object} [opts]
 */
export function parseFaturaCartaoBtgWorkbook(wb, opts = {}) {
  const sheetNames = wb.SheetNames || [];
  let best = { rows: [], meta: { erro: 'Nenhuma aba com lançamentos BTG.' } };
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    if (!ws?.['!ref']) continue;
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const parsed = parseMatrixFaturaBtg(matrix, { ...opts, origem: 'XLSX_BTG' });
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
export function parseFaturaCartaoBtgXlsxArrayBuffer(buffer, opts = {}) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false });
  return parseFaturaCartaoBtgWorkbook(wb, opts);
}
