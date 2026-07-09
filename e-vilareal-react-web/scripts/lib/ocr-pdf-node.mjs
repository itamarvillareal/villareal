/**
 * OCR de PDF via ocrmypdf (mesmas flags do backend OcrService).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { extrairTextoPdfDeBuffer } from './extrair-texto-pdf-node.mjs';

const MIN_CARACTERES = 32;

export function precisaOcr(texto, min = MIN_CARACTERES) {
  const t = String(texto ?? '').replace(/\s+/g, '');
  return t.length < min;
}

function executarOcrmypdf(inputPath, outputPath, { language = 'por', timeoutMs = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '--language',
      language,
      '--skip-text',
      '--deskew',
      '--clean',
      '--rotate-pages',
      '--optimize',
      '0',
      inputPath,
      outputPath,
    ];
    const proc = spawn('ocrmypdf', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d;
    });
    proc.stderr.on('data', (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ocrmypdf timeout ${timeoutMs}ms`));
    }, timeoutMs);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ocrmypdf exit ${code}: ${(stderr || stdout).slice(0, 400)}`));
        return;
      }
      resolve({ stdout, stderr });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * @param {string} pdfPath
 * @returns {Promise<{ texto: string, numPages: number, ocrAplicado: boolean, erro: string|null }>}
 */
export async function extrairTextoPdfComOcr(pdfPath) {
  const fileBytes = fs.readFileSync(pdfPath);
  let { texto, numPages } = await extrairTextoPdfDeBuffer(fileBytes);
  if (!precisaOcr(texto)) {
    return { texto, numPages, ocrAplicado: false, erro: null };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vilareal-ocr-'));
  const input = path.join(tmpDir, 'in.pdf');
  const output = path.join(tmpDir, 'out.pdf');
  try {
    fs.writeFileSync(input, fileBytes);
    await executarOcrmypdf(input, output);
    const ocrBuf = new Uint8Array(fs.readFileSync(output));
    const depois = await extrairTextoPdfDeBuffer(ocrBuf);
    if (precisaOcr(depois.texto)) {
      return {
        texto: depois.texto,
        numPages: depois.numPages,
        ocrAplicado: true,
        erro: 'OCR aplicado mas texto ainda insuficiente',
      };
    }
    return {
      texto: depois.texto,
      numPages: depois.numPages,
      ocrAplicado: true,
      erro: null,
    };
  } catch (err) {
    return {
      texto,
      numPages,
      ocrAplicado: false,
      erro: err?.message || String(err),
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
