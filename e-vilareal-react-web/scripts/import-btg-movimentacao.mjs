#!/usr/bin/env node
/**
 * Importa exports xlsx de Movimentação BTG para a API (financeiro/investimentos).
 *
 * Uso:
 *   node scripts/import-btg-movimentacao.mjs [arquivo ou pasta] [--numero-banco=21]
 *   API_BASE=http://localhost:8080 node scripts/import-btg-movimentacao.mjs "~/Dropbox/pasta sem título 2"
 */
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = (process.env.API_BASE || 'http://localhost:8080').replace(/\/$/, '');

function parseArgs(argv) {
  let numeroBanco = null;
  const paths = [];
  for (const a of argv) {
    if (a.startsWith('--numero-banco=')) {
      numeroBanco = Number(a.split('=')[1]);
    } else {
      paths.push(a);
    }
  }
  return { paths, numeroBanco };
}

function resolveFiles(inputs) {
  const files = [];
  for (const input of inputs) {
    const p = input.replace(/^~/, process.env.HOME || '');
    if (!fs.existsSync(p)) {
      console.warn('Ignorado (não existe):', p);
      continue;
    }
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p)) {
        if (/movimentacao.*\.xlsx$/i.test(name)) {
          files.push(path.join(p, name));
        }
      }
    } else if (/\.xlsx$/i.test(p)) {
      files.push(p);
    }
  }
  return [...new Set(files)].sort();
}

async function importFile(filePath, numeroBanco) {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([buf]), path.basename(filePath));
  const q = numeroBanco != null ? `?numeroBanco=${numeroBanco}` : '';
  const res = await fetch(`${API_BASE}/api/financeiro/investimentos/import${q}`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path.basename(filePath)}: ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

const { paths, numeroBanco } = parseArgs(process.argv.slice(2));
const defaultDir = path.join(process.env.HOME || '', 'Dropbox/pasta sem título 2');
const inputs = paths.length ? paths : [defaultDir];
const files = resolveFiles(inputs);

if (!files.length) {
  console.error('Nenhum xlsx movimentacao encontrado.');
  process.exit(1);
}

console.log(`API: ${API_BASE} | arquivos: ${files.length}`);
for (const f of files) {
  try {
    const r = await importFile(f, numeroBanco);
    console.log(
      `✓ ${path.basename(f)} → ${r.bancoNome} (${r.numeroBanco}) | ${r.linhasCdb} ops | ${r.linhasVinculadas} vinculadas`,
    );
  } catch (e) {
    console.error('✗', e.message);
  }
}
