/**
 * Extração de texto de PDF no navegador (pdf.js). Texto selecionável — sem OCR.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extrairTextoPdfDeArquivo(file) {
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
    partes.push(lineBuf.join(''));
    partes.push('\n\n');
  }
  return partes.join('');
}
