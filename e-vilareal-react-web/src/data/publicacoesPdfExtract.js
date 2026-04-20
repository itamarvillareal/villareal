/**
 * Extração de texto de PDF no navegador (pdf.js). Camada nativa — sem OCR.
 * PDFs só com imagem (escaneados) precisam de {@link extrairTextoParaImportacaoPublicacoes}.
 *
 * O worker NÃO usa import com ?url (hash em /assets/): após deploy, referências
 * antigas a pdf.worker.min-XXXX.mjs podem 404. Usa a mesma origem fixa que
 * documentOcrService (unpkg, versão alinhada a package.json / pdfjs-dist).
 */
import * as pdfjsLib from 'pdfjs-dist';
import { rodarOcrPdfTodasPaginas } from '../services/documentOcrService.js';

const PDFJS_WORKER_UNPKG = 'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_UNPKG;

/** Conteúdo “real” mínimo por página para não acionar OCR em PDF já textual. */
const MIN_CHARS_NON_SPACE_POR_PAGINA = 14;
const MIN_CHARS_NON_SPACE_TOTAL = 72;

/**
 * @param {File} file
 * @param {{ ordenarItensPorPosicao?: boolean }} [opts]
 * @returns {Promise<{ texto: string, numPages: number }>}
 */
async function extrairTextoPdfInterno(file, opts = {}) {
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
  const texto = partes.join('');
  return { texto, numPages: num };
}

/**
 * @param {File} file
 * @param {{ ordenarItensPorPosicao?: boolean }} [opts]
 *   `ordenarItensPorPosicao` — ordena por Y (linha) e X (coluna) antes de juntar o texto.
 *   Útil em extratos bancários em tabela: evita “data + descrição” numa linha e valores na outra,
 *   e mantém a ordem Débito / Crédito / Saldo.
 * @returns {Promise<string>}
 */
export async function extrairTextoPdfDeArquivo(file, opts = {}) {
  const { texto } = await extrairTextoPdfInterno(file, opts);
  return texto;
}

/**
 * Texto nativo do PDF + número de páginas (métricas, decidir OCR).
 * @returns {Promise<{ texto: string, numPages: number }>}
 */
export async function extrairTextoPdfDeArquivoComMeta(file, opts = {}) {
  return extrairTextoPdfInterno(file, opts);
}

/**
 * Para importação em Publicações: tenta pdf.js; se pouco texto (PDF escaneado), usa OCR em todas as páginas.
 *
 * @returns {Promise<{ texto: string, fonte: 'pdf_texto' | 'ocr', numPages: number }>}
 */
export async function extrairTextoParaImportacaoPublicacoes(file) {
  const { texto, numPages } = await extrairTextoPdfInterno(file, {});
  const nonSpace = texto.replace(/\s/g, '').length;
  const threshold = Math.max(MIN_CHARS_NON_SPACE_TOTAL, MIN_CHARS_NON_SPACE_POR_PAGINA * Math.max(1, numPages));
  if (nonSpace >= threshold) {
    return { texto, fonte: 'pdf_texto', numPages };
  }
  try {
    const ocrTexto = await rodarOcrPdfTodasPaginas(file);
    const ocrNonSpace = ocrTexto.replace(/\s/g, '').length;
    if (ocrNonSpace > nonSpace) {
      return { texto: ocrTexto, fonte: 'ocr', numPages };
    }
  } catch {
    /* mantém texto nativo; UI pode mostrar pouca extração */
  }
  return { texto, fonte: 'pdf_texto', numPages };
}
