/**
 * Leitura de planilha de fatura (.xlsx), com suporte opcional a arquivo protegido por senha.
 */
import * as XLSX from 'xlsx';
import { Buffer as BufferPolyfill } from 'buffer';
import { parseFaturaCartaoItauWorkbook } from './faturaCartaoItauImport.js';
import { parseFaturaCartaoBtgWorkbook, planilhaPareceFaturaBtg } from './faturaCartaoBtgImport.js';

export class FaturaCartaoXlsxProtegidoError extends Error {
  constructor(message = 'Arquivo Excel protegido por senha.') {
    super(message);
    this.name = 'FaturaCartaoXlsxProtegidoError';
    this.precisaSenhaExcel = true;
  }
}

export class FaturaCartaoXlsxSenhaIncorretaError extends Error {
  constructor(message = 'Senha do Excel incorreta.') {
    super(message);
    this.name = 'FaturaCartaoXlsxSenhaIncorretaError';
    this.senhaExcelIncorreta = true;
  }
}

function ensureBufferGlobal() {
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = BufferPolyfill;
  }
}

/** Polyfills Node (Buffer, events) exigidos por officecrypto-tool/xml2js no browser. */
async function ensureOfficeCryptoBrowserEnv() {
  ensureBufferGlobal();
  await import('events');
}

/**
 * @param {Buffer|Uint8Array|ArrayBuffer} input
 * @param {{ password?: string|null }} [opts]
 * @returns {Promise<ArrayBuffer>}
 */
export async function descriptografarFaturaCartaoXlsxSeNecessario(input, opts = {}) {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input);
  let wb;
  try {
    wb = XLSX.read(bytes, { type: 'array', cellDates: true, cellNF: false });
    void wb;
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (!/password-protected|password protected|encrypted/i.test(msg)) throw e;
  }

  if (!opts.password) throw new FaturaCartaoXlsxProtegidoError();

  await ensureOfficeCryptoBrowserEnv();
  try {
    const mod = await import('officecrypto-tool');
    const officeCrypto = mod.default ?? mod;
    const decrypted = await officeCrypto.decrypt(bytes, { password: String(opts.password) });
    return decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/password is incorrect/i.test(msg)) {
      throw new FaturaCartaoXlsxSenhaIncorretaError(
        'Senha do Excel incorreta. No BTG, use o CPF do titular (somente números).',
      );
    }
    throw e;
  }
}

/**
 * @param {ArrayBuffer} buffer
 * @param {{ ignorarPagamento?: boolean, finalCartaoFiltro?: string|null }} [opts]
 */
export function parseFaturaCartaoXlsxArrayBuffer(buffer, opts = {}) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false });
  const sheetNames = wb.SheetNames || [];
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    if (!ws?.['!ref']) continue;
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    if (planilhaPareceFaturaBtg(matrix)) {
      return parseFaturaCartaoBtgWorkbook(wb, opts);
    }
  }
  return parseFaturaCartaoItauWorkbook(wb, opts);
}

/**
 * @param {Buffer|Uint8Array|ArrayBuffer} input
 * @param {{ password?: string|null, ignorarPagamento?: boolean, finalCartaoFiltro?: string|null }} [opts]
 */
export async function lerEParsearFaturaCartaoXlsx(input, opts = {}) {
  const password = opts.password ?? opts.senhaExcel ?? null;
  const buffer = await descriptografarFaturaCartaoXlsxSeNecessario(input, { ...opts, password });
  return parseFaturaCartaoXlsxArrayBuffer(buffer, opts);
}
