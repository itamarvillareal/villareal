/**
 * Reprocessa jobs com status ERRO de um CSV de carga-acerto-blocos.
 *
 * Uso:
 *   node scripts/retry-carga-acerto-erros.mjs
 *   node scripts/retry-carga-acerto-erros.mjs --csv=carga-acerto-blocos-1783888341434.csv --executar
 */

import './lib/load-vilareal-import-env.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const out = {
    csv: resolve('carga-acerto-blocos-1783888341434.csv'),
    executar: false,
    baseUrl: 'http://localhost:8080',
  };
  for (const a of argv.slice(2)) {
    if (a === '--executar') out.executar = true;
    else if (a.startsWith('--csv=')) out.csv = resolve(a.slice(6));
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else {
      console.error(`Argumento desconhecido: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

function parseCsvLine(line) {
  return line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
}

function codigosErro(csvPath) {
  const txt = readFileSync(csvPath, 'utf8');
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',');
  const idxCod = headers.indexOf('codigo');
  const idxStatus = headers.indexOf('status');
  if (idxCod < 0 || idxStatus < 0) throw new Error('CSV sem colunas codigo/status');
  const codigos = new Set();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols[idxStatus] === 'ERRO' && cols[idxCod]) codigos.add(cols[idxCod].trim());
  }
  return [...codigos].sort((a, b) => Number(a) - Number(b));
}

async function main() {
  const args = parseArgs(process.argv);
  const codigos = codigosErro(args.csv);
  console.log(`Reprocessando ${codigos.length} código(s) com ERRO em ${args.csv}`);

  const resultados = [];
  for (const codigo of codigos) {
    const cmd = [
      'scripts/carga-acerto-blocos-planilha.mjs',
      `--codigo=${codigo}`,
      '--forcar-auto',
      `--base-url=${args.baseUrl}`,
    ];
    if (args.executar) cmd.push('--executar');
    console.log(`\n>> node ${cmd.join(' ')}`);
    const r = spawnSync('node', cmd, {
      cwd: resolve('.'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const pareado = /PAREADO|FEITO|ja_pareado/.test(out);
    const erro = /status.*ERRO|ERRO:/i.test(out) || r.status !== 0;
    resultados.push({ codigo, ok: pareado && !erro, exit: r.status, tail: out.split('\n').slice(-4).join(' | ') });
    process.stdout.write(pareado ? '  OK\n' : `  ${erro ? 'ERRO' : '?'}\n`);
  }

  const outPath = resolve(`retry-carga-erros-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({ codigos: codigos.length, ok: resultados.filter((x) => x.ok).length, resultados }, null, 2));
  console.log(`\nResumo: ${resultados.filter((x) => x.ok).length}/${codigos.length} OK`);
  console.log(`Detalhe: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
