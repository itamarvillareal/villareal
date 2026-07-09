/**
 * Extração de texto de PDF para scripts Node (import CLI).
 */
import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * @param {string|Buffer|Uint8Array} input
 * @param {{ ordenarItensPorPosicao?: boolean, password?: string|null }} [opts]
 * @returns {Promise<{ texto: string, numPages: number }>}
 */
export async function extrairTextoPdfDeBuffer(input, opts = {}) {
  const ordenar = opts.ordenarItensPorPosicao !== false;
  // pdf.js transfere o ArrayBuffer interno — clonar evita esvaziar o buffer do caller.
  const data =
    input instanceof Uint8Array
      ? Uint8Array.from(input)
      : new Uint8Array(fs.readFileSync(input));
  const pdf = await pdfjsLib.getDocument({
    data,
    password: opts.password || undefined,
    verbosity: 0,
  }).promise;
  const partes = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const lineBuf = [];

    if (ordenar) {
      const items = [];
      for (const it of tc.items) {
        const s = 'str' in it ? it.str : '';
        if (!s) continue;
        const tr = it.transform;
        items.push({ s, x: tr?.[4] ?? 0, y: tr?.[5] ?? 0 });
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
        if (lastYKey != null && yKey !== lastYKey) lineBuf.push('\n');
        lastYKey = yKey;
        lineBuf.push(s);
      }
    } else {
      let lastY = null;
      for (const it of tc.items) {
        const s = 'str' in it ? it.str : '';
        if (!s) continue;
        const tr = it.transform;
        const y = tr?.[5] ?? 0;
        if (lastY != null && Math.abs(y - lastY) > 3) lineBuf.push('\n');
        lastY = y;
        lineBuf.push(s);
      }
    }

    partes.push(lineBuf.join(''));
    partes.push('\n\n');
  }

  return { texto: partes.join(''), numPages: pdf.numPages };
}
