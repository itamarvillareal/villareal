/**
 * Gera src/data/clientesCadastradosMock.js a partir de clientes_cadastrados.pdf
 * Coluna 1 = Cod Cliente, Coluna 2 = número da pessoa.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, '..', 'src', 'data', 'clientesCadastradosMock.js');
const pdfPath =
  process.argv[2] || path.join(process.env.USERPROFILE || '', 'Desktop', 'clientes_cadastrados.pdf');

if (!fs.existsSync(pdfPath)) {
  console.error('PDF não encontrado:', pdfPath);
  process.exit(1);
}

const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
const { text } = await parser.getText();
await parser.destroy();

const map = {};
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || /--\s*\d+\s+of\s+\d+/i.test(line)) continue;
  if (/^ID_PESSOA/i.test(line)) continue;
  const m2 = line.match(/^(\d+)\s+(\d+)$/);
  if (m2) {
    const cod = parseInt(m2[1], 10);
    const pessoa = parseInt(m2[2], 10);
    if (cod >= 1 && cod <= 999999) map[cod] = pessoa;
  }
}

const entries = Object.entries(map)
  .map(([k, v]) => [parseInt(k, 10), v])
  .sort((a, b) => a[0] - b[0]);
const maxCod = entries.length ? entries[entries.length - 1][0] : 0;

const objStr = JSON.stringify(map, null, 2);
const js = `/**
 * Cod Cliente → número da pessoa (PDF clientes_cadastrados).
 * Regenerar: npm run generate:mock-clientes-cadastrados
 */
export const CLIENTE_PARA_PESSOA = ${objStr};

export const MAX_COD_CLIENTE_MOCK = ${maxCod};

/** @returns {number|null} */
export function getIdPessoaPorCodCliente(codCliente) {
  const n = parseInt(String(codCliente ?? '').replace(/^0+/, '') || '0', 10);
  if (!Number.isFinite(n) || n < 1) return null;
  const id = CLIENTE_PARA_PESSOA[n];
  return id != null ? id : null;
}
`;

fs.writeFileSync(outFile, js, 'utf8');
console.log('Registros:', entries.length, 'max cod', maxCod, '→', outFile);
