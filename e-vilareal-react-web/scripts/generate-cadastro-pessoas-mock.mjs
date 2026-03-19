/**
 * Gera src/data/cadastroPessoasMock.js a partir do PDF "Cadastro de pessoas".
 * Uso: node scripts/generate-cadastro-pessoas-mock.mjs "C:\\caminho\\Cadastro de pessoas.pdf"
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outFile = path.join(root, 'src', 'data', 'cadastroPessoasMock.js');

const pdfPath =
  process.argv[2] || path.join(process.env.USERPROFILE || '', 'Desktop', 'Cadastro de pessoas.pdf');

function looksLikeDoc(s) {
  if (!s || !/^[\d.\-/]+$/.test(s)) return false;
  const n = s.replace(/\D/g, '').length;
  return n === 11 || n === 14;
}

function parsePessoaLine(line) {
  const t = line.trim();
  if (!t || /^--\s*\d+\s+of\s+\d+\s*--$/i.test(t)) return null;

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;

  const codigo = parseInt(parts[0], 10);
  if (!Number.isFinite(codigo) || codigo < 1) return null;

  let i = parts.length - 1;
  let docRaw = '';
  if (looksLikeDoc(parts[i])) {
    docRaw = parts[i];
    i--;
  }
  const genero = parts[i];
  if (!/^(M|F|PJ)$/.test(genero)) return null;
  i--;
  if (i < 1) return null;
  const nome = parts.slice(1, i + 1).join(' ').trim();
  if (!nome) return null;

  return { codigo, nome, genero, doc: docRaw };
}

if (!fs.existsSync(pdfPath)) {
  console.error('PDF não encontrado:', pdfPath);
  console.error('Passe o caminho: node scripts/generate-cadastro-pessoas-mock.mjs \"<arquivo.pdf>\"');
  process.exit(1);
}

const buf = fs.readFileSync(pdfPath);
const parser = new PDFParse({ data: buf });
const { text } = await parser.getText();
await parser.destroy();

const lines = text.split(/\r?\n/);
const registros = [];
const visto = new Set();

for (const raw of lines) {
  const row = parsePessoaLine(raw);
  if (!row) continue;
  if (visto.has(row.codigo)) continue;
  visto.add(row.codigo);

  const cpfDigits = row.doc.replace(/\D/g, '');
  registros.push({
    id: row.codigo,
    nome: row.nome.replace(/\s+/g, ' ').trim(),
    cpf: cpfDigits || `000000000${String(row.codigo).slice(-5)}`.slice(-11),
    email: `pessoa${row.codigo}@mock.vilareal.local`,
    telefone: null,
    dataNascimento: null,
    ativo: true,
  });
}

registros.sort((a, b) => a.id - b.id);

const header = `/* Gerado por scripts/generate-cadastro-pessoas-mock.mjs — não editar à mão */
export const CADASTRO_PESSOAS_MOCK = `;
const body = JSON.stringify(registros, null, 2);
const footer = `;

export function getCadastroPessoasMock(apenasAtivos) {
  const list = apenasAtivos ? CADASTRO_PESSOAS_MOCK.filter((p) => p.ativo) : [...CADASTRO_PESSOAS_MOCK];
  return list;
}
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, header + body + footer, 'utf8');
console.log('Escrito:', outFile, '| registros:', registros.length);
