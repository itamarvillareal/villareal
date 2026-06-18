/**
 * Planilha intermédia do import txt → planilha (limite Excel 32767 chars/célula).
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

/** Limite OOXML / Excel por célula (SheetJS valida ao gravar .xlsx). */
export const XLSX_MAX_CELL_CHARS = 32767;

export const SUFIXO_JSON_ROWS = '.historico-rows.json';

/**
 * @param {unknown[][]} rows
 */
export function linhasExcedemLimiteXlsx(rows) {
  return rows.some(
    (row) => Array.isArray(row) && row.some((c) => c != null && String(c).length > XLSX_MAX_CELL_CHARS)
  );
}

/**
 * @param {string} outPath
 * @param {unknown[][]} rows
 * @returns {string} caminho gravado (.xlsx, .xls ou .historico-rows.json)
 */
export function gravarPlanilhaHistorico(outPath, rows) {
  if (linhasExcedemLimiteXlsx(rows)) {
    const base = outPath.replace(/\.(xlsx?|historico-rows\.json)$/i, '');
    const jsonPath = `${base}${SUFIXO_JSON_ROWS}`;
    fs.writeFileSync(jsonPath, JSON.stringify(rows), 'utf8');
    return jsonPath;
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha2');
  const precisaXlsx = rows.some(
    (row) => Array.isArray(row) && row.some((c) => c != null && String(c).length > 255)
  );
  if (precisaXlsx) {
    const p = outPath.replace(/\.xls$/i, '.xlsx');
    const dest = p.endsWith('.xlsx') ? p : `${p}.xlsx`;
    XLSX.writeFile(wb, dest, { bookType: 'xlsx' });
    return dest;
  }
  const p = outPath.endsWith('.xls') ? outPath : outPath.replace(/\.xlsx?$/i, '') + '.xls';
  try {
    XLSX.writeFile(wb, p, { bookType: 'biff8' });
    return p;
  } catch {
    const alt = p.replace(/\.xls$/i, '.xlsx');
    XLSX.writeFile(wb, alt, { bookType: 'xlsx' });
    return alt;
  }
}

/**
 * @param {string} abs
 * @returns {boolean}
 */
export function isHistoricoRowsJson(abs) {
  return path.basename(abs).endsWith(SUFIXO_JSON_ROWS) || abs.endsWith(SUFIXO_JSON_ROWS);
}

/**
 * @param {string} abs
 * @returns {unknown[][]}
 */
export function lerMatrizHistoricoIntermedio(abs) {
  if (isHistoricoRowsJson(abs)) {
    const mat = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!Array.isArray(mat)) {
      throw new Error(`JSON inválido (esperado array de linhas): ${abs}`);
    }
    return mat;
  }
  const wb = XLSX.readFile(abs, { cellDates: true, dense: false });
  const sheetNome =
    wb.SheetNames.find((n) => n === 'Planilha2') ??
    wb.SheetNames.find((n) => /pasta2/i.test(n)) ??
    wb.SheetNames[0];
  const sh = wb.Sheets[sheetNome];
  if (!sh) {
    throw new Error(`Aba inválida em ${abs}. Abas: ${wb.SheetNames.join(', ')}`);
  }
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
}
