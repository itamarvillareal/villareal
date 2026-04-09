/**
 * Extração de texto de PDF no navegador (pdf.js). Texto selecionável — sem OCR.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * @param {File} file
 * @param {{ ordenarItensPorPosicao?: boolean }} [opts]
 *   `ordenarItensPorPosicao` — ordena por Y (linha) e X (coluna) antes de juntar o texto.
 *   Útil em extratos bancários em tabela: evita “data + descrição” numa linha e valores na outra,
 *   e mantém a ordem Débito / Crédito / Saldo.
 * @returns {Promise<string>}
 */
export async function extrairTextoPdfDeArquivo(file, opts = {}) {
  const ordenar = opts.ordenarItensPorPosicao === true;
  const pdfjs = pdfjsLib;
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data, verbosity: 0 });
  const pdf = await loadingTask.promise;
  const num = pdf.numPages;
  const partes = [];
  for (let i = 1; i <= num; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const lineBuf = [];
    if (ordenar) {
      const items = [];
      for (const it of tc.items) {
        const s = 'str' in it ? it.str : '';
        if (!s) continue;
        const tr = it.transform;
        const x = tr && tr.length >= 6 ? tr[4] : 0;
        const y = tr && tr.length >= 6 ? tr[5] : 0;
        items.push({ s, x, y });
      }
      items.sort((a, b) => {
        const yA = Math.round(a.y / 4);
        const yB = Math.round(b.y / 4);
        if (yA !== yB) return yB - yA;
        return a.x - b.x;
      });
      let lastYKey = null;
      for (const { s, y } of items) {
        const yKey = Math.round(y / 4);
        if (lastYKey != null && yKey !== lastYKey) {
          lineBuf.push('\n');
        }
        lastYKey = yKey;
        lineBuf.push(s);
      }
    } else {
      let lastY = null;
      for (const it of tc.items) {
        const s = 'str' in it ? it.str : '';
        if (!s) continue;
        const tr = it.transform;
        const y = tr && tr.length >= 6 ? tr[5] : 0;
        if (lastY != null && Math.abs(y - lastY) > 3) {
          lineBuf.push('\n');
        }
        lastY = y;
        lineBuf.push(s);
      }
    }
    partes.push(lineBuf.join(''));
    partes.push('\n\n');
  }
  return partes.join('');
}
