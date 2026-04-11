#!/usr/bin/env node
/**
 * Importa débitos de planilha Excel para o mapa de rodadas de Cálculos (localStorage key vilareal.calculos.rodadas.v1).
 *
 * Layout (linha 1 = cabeçalho, dados da linha 2):
 *   A: código cliente, B: vencimento 1ª parcela, C: valor 1ª parcela, G: nº processo, H: dimensão
 *
 * Uso:
 *   node scripts/import-debitos-calculos-planilha.mjs "caminho/debitos.xlsx" --merge-from=rodadas.json --out=saida.json
 *
 * --merge-from opcional: JSON exportado da chave vilareal.calculos.rodadas.v1 (objeto chave→rodada).
 * --out opcional: escreve o JSON mesclado; sem --out imprime no stdout.
 * --dry-run: só imprime estatísticas, não grava.
 *
 * --devtools-snippet: gera ficheiro .js para colar na consola do browser (F12) na origem da app — grava no localStorage e recarrega.
 *   Caminho: --snippet-out=caminho.js ou, com --out=foo.json, cria foo.paste-console.js junto ao JSON.
 *
 * npm:
 *   npm run import:debitos-calculos
 *   npm run import:debitos-calculos:devtools
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';
import { mergeDebitosCalculosMultiSheet } from '../src/utils/mergeDebitosCalculosPlanilha.js';

const STORAGE_KEY = 'vilareal.calculos.rodadas.v1';

function parseArgs(argv) {
  const out = {
    file: null,
    mergeFrom: null,
    outPath: null,
    dryRun: false,
    devtoolsSnippet: false,
    snippetOut: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--devtools-snippet') out.devtoolsSnippet = true;
    else if (a.startsWith('--merge-from=')) out.mergeFrom = a.slice(13).trim();
    else if (a.startsWith('--out=')) out.outPath = a.slice(6).trim();
    else if (a.startsWith('--snippet-out=')) out.snippetOut = a.slice(14).trim();
    else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  return out;
}

function loadJsonFile(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

/** Ficheiro a colar na consola (Chrome F12 → Console) na mesma origem que a app. */
function buildDevToolsPasteSnippet(rodadas) {
  const literal = JSON.stringify(rodadas);
  return (
    `// vilareal — Cole ISTO na consola (F12 → Console) com a app aberta na mesma origem (ex.: http://localhost:5173)\n` +
    `(() => {\n` +
    `  const rodadas = ${literal};\n` +
    `  try {\n` +
    `    localStorage.setItem('${STORAGE_KEY}', JSON.stringify(rodadas));\n` +
    `    console.info('[vilareal] gravadas', Object.keys(rodadas).length, 'rodada(s) em ${STORAGE_KEY}');\n` +
    `    location.reload();\n` +
    `  } catch (e) {\n` +
    `    console.error('[vilareal] gravação falhou (p.ex. quota ou dados demasiado grandes):', e);\n` +
    `  }\n` +
    `})();\n`
  );
}

function writeSnippetFile(rodadas, snippetPathAbs) {
  const snippet = buildDevToolsPasteSnippet(rodadas);
  fs.writeFileSync(snippetPathAbs, snippet, 'utf8');
  console.error(`[debitos-calculos] snippet DevTools: ${snippetPathAbs}`);
  console.error(
    '  → Abra http://localhost:5173 (ou a origem que usar), F12 → Console, cole o conteúdo do ficheiro e Enter.\n' +
      '  → macOS: pbcopy < "' +
      snippetPathAbs +
      '"  depois Cmd+V na consola.'
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error(
      'Uso: node scripts/import-debitos-calculos-planilha.mjs <ficheiro.xlsx> [--merge-from=rodadas.json] [--out=saida.json] [--dry-run] [--devtools-snippet] [--snippet-out=snippet.js]'
    );
    process.exit(1);
  }

  const abs = path.isAbsolute(args.file) ? args.file : path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(abs)) {
    console.error(`Ficheiro não encontrado: ${abs}`);
    process.exit(1);
  }

  let base = {};
  if (args.mergeFrom) {
    const mp = path.isAbsolute(args.mergeFrom) ? args.mergeFrom : path.resolve(process.cwd(), args.mergeFrom);
    if (!fs.existsSync(mp)) {
      console.error(`--merge-from não encontrado: ${mp}`);
      process.exit(1);
    }
    base = loadJsonFile(mp);
    if (!base || typeof base !== 'object' || Array.isArray(base)) {
      console.error('--merge-from deve ser um objeto JSON (mapa rodadaKey → estado).');
      process.exit(1);
    }
  }

  const wb = XLSX.readFile(abs, { cellDates: false });
  const matrices = wb.SheetNames.map((name) =>
    XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
  );

  const { nextRodadas, stats } = mergeDebitosCalculosMultiSheet(base, matrices);

  console.error(
    `[debitos-calculos] folhas: ${wb.SheetNames.length} (${wb.SheetNames.join(', ')}) | linhas de dados: ${stats.linhasLidas} | aplicadas: ${stats.aplicadas} | ignoradas: ${stats.ignoradas}`
  );
  if (stats.avisos.length) {
    for (const line of stats.avisos.slice(0, 50)) console.error(`  ${line}`);
    if (stats.avisos.length > 50) console.error(`  … (+${stats.avisos.length - 50} avisos)`);
  }

  const json = `${JSON.stringify(nextRodadas)}\n`;

  if (args.dryRun) {
    console.error('[debitos-calculos] --dry-run: não escreveu ficheiros.');
    return;
  }

  let outp = null;
  if (args.outPath) {
    outp = path.isAbsolute(args.outPath) ? args.outPath : path.resolve(process.cwd(), args.outPath);
    fs.writeFileSync(outp, json, 'utf8');
    console.error(`[debitos-calculos] escrito: ${outp}`);
  } else {
    process.stdout.write(json);
  }

  if (args.devtoolsSnippet) {
    let snippetAbs;
    if (args.snippetOut != null && String(args.snippetOut).trim() !== '') {
      snippetAbs = path.isAbsolute(args.snippetOut)
        ? args.snippetOut
        : path.resolve(process.cwd(), args.snippetOut);
    } else if (outp) {
      snippetAbs = `${outp}.paste-console.js`;
    } else {
      snippetAbs = path.resolve(process.cwd(), 'vilareal-calculos-devtools-paste.js');
    }
    writeSnippetFile(nextRodadas, snippetAbs);
  }
}

main();
