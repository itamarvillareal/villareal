import XLSX from 'xlsx';

import { parseDataPlanilha } from './extrato-bancos-planilha-parse.mjs';

const SHEET_EXTRATO = 'Extrato Consolidado';

/** Remove caracteres invisíveis (ex.: zero-width space em IDs do Excel). */
export function limparTextoCelula(v) {
  return String(v ?? '')
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .trim();
}

/** Valores no formato +R$2.418,40 ou -R$500,00 */
export function parseValorMoedaBr(v) {
  const s = limparTextoCelula(v);
  if (!s) return null;
  const neg = /^-/.test(s) || /\(-/.test(s);
  const digits = s.replace(/[^\d,.-]/g, '');
  if (!digits) return null;
  const normalized = digits.includes(',')
    ? digits.replace(/\./g, '').replace(',', '.')
    : digits;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : Math.abs(n);
}

function normalizarHeader(h) {
  return limparTextoCelula(h)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * @param {string} filePath
 * @param {{ sheet?: string }} [opts]
 * @returns {Array<{ numero: string, data: string, descricao: string, valor: number, descricaoDetalhada?: string }>}
 */
export function parse99PayConsolidadoXlsx(filePath, opts = {}) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName =
    opts.sheet ??
    wb.SheetNames.find((n) => normalizarHeader(n).includes('extrato consolidado')) ??
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Aba não encontrada: ${sheetName}`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  if (!rows.length) return [];

  const headerRow = rows[0].map((c) => normalizarHeader(c));
  const col = {
    numero: headerRow.findIndex((h) => h === 'n' || h === 'no' || h.startsWith('nº')),
    data: headerRow.findIndex((h) => h === 'data'),
    hora: headerRow.findIndex((h) => h === 'hora'),
    descricao: headerRow.findIndex((h) => h.includes('descric')),
    valor: headerRow.findIndex((h) => h === 'valor'),
    id: headerRow.findIndex((h) => h.includes('id') && h.includes('trans')),
  };

  if (col.data < 0 || col.descricao < 0 || col.valor < 0) {
    throw new Error(
      `Cabeçalho inesperado na aba «${sheetName}». Esperado: Data, Descrição, Valor. Encontrado: ${headerRow.join(' | ')}`,
    );
  }

  const out = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((c) => limparTextoCelula(c) === '')) continue;

    const dataBr = limparTextoCelula(row[col.data]);
    const iso = parseDataPlanilha(dataBr);
    if (!iso) continue;

    const valor = parseValorMoedaBr(row[col.valor]);
    if (valor == null || valor === 0) continue;

    const descricao = limparTextoCelula(row[col.descricao]) || 'Lançamento 99 Pay';
    const hora = col.hora >= 0 ? limparTextoCelula(row[col.hora]) : '';
    const idTx =
      col.id >= 0 ? limparTextoCelula(row[col.id]) : limparTextoCelula(row[col.numero]) || String(i);

    const [y, mo, d] = iso.split('-');
    const data = `${d}/${mo}/${y}`;

    out.push({
      numero: idTx.slice(0, 120) || `99pay-${i}`,
      data,
      descricao: descricao.slice(0, 500),
      descricaoDetalhada: hora ? `${descricao} (${hora})`.slice(0, 2000) : descricao,
      valor,
    });
  }

  return out;
}

export { SHEET_EXTRATO };
