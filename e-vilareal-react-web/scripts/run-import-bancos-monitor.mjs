#!/usr/bin/env node
/**
 * Executa import banco a banco (equivalente a --todos-bancos, pula Itaú)
 * com monitoramento; pausa se taxa POST_erro > 5%.
 */
import './lib/load-vilareal-import-env.mjs';

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BANCOS_IMPORT_PLANILHA,
  NUMERO_PARA_BANCO,
} from './lib/extrato-bancos-planilha-constantes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE =
  process.argv[2] || '/Users/itamar/Downloads/Extratos Bancos - Itamar.xls';
const PROGRESS = process.argv[3] || path.join(ROOT, '.import-bancos-progress.jsonl');
const START_FROM = process.argv[4] || '';

const numeroPorNome = Object.fromEntries(
  Object.entries(NUMERO_PARA_BANCO).map(([k, v]) => [v, Number(k)]),
);

const bancos = BANCOS_IMPORT_PLANILHA.filter((b) => b !== 'Itaú');
let startIdx = 0;
if (START_FROM) {
  const i = bancos.indexOf(START_FROM);
  if (i >= 0) startIdx = i;
}

const results = [];
const tTotal0 = Date.now();

for (let i = startIdx; i < bancos.length; i += 1) {
  const banco = bancos[i];
  const numeroBanco = numeroPorNome[banco] ?? null;
  console.log(`\n[${i + 1}/${bancos.length}] Importando ${banco} (nº${numeroBanco})…`);
  const t0 = Date.now();

  const r = spawnSync(
    process.execPath,
    [
      path.join(__dirname, 'import-extrato-bancos-planilha.mjs'),
      FILE,
      `--banco=${banco}`,
      '--substituir',
      '--login=itamar',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env },
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const m = out.match(/lidas=(\d+)\s+POST ok=(\d+)\s+erros=(\d+)/);
  const lidas = m ? Number(m[1]) : 0;
  const postOk = m ? Number(m[2]) : 0;
  const postErro = m ? Number(m[3]) : 0;
  const seg = Math.round((Date.now() - t0) / 1000);
  const taxa = lidas > 0 ? postErro / lidas : postErro > 0 ? 1 : 0;

  const row = {
    banco,
    numeroBanco,
    linhas_enviadas: lidas,
    POST_ok: postOk,
    POST_erro: postErro,
    tempo_segundos: seg,
    exitCode: r.status,
    taxa_erro: taxa,
  };
  results.push(row);
  fs.appendFileSync(PROGRESS, `${JSON.stringify(row)}\n`);

  console.log(
    `  → lidas=${lidas} ok=${postOk} erros=${postErro} (${seg}s, taxa ${(taxa * 100).toFixed(2)}%)`,
  );

  if (taxa > 0.05) {
    console.error(`\n⛔ PAUSA: ${banco} com taxa de erro ${(taxa * 100).toFixed(2)}% (> 5%)`);
    const errLines = out.match(/Amostra erros POST:[\s\S]*/)?.[0] || out.slice(-2000);
    console.error(errLines);
    console.error(`\nPróximo banco: ${bancos[i + 1] || '(fim)'}`);
    console.error(`Retomar: node scripts/run-import-bancos-monitor.mjs "${FILE}" "${PROGRESS}" "${bancos[i + 1] || ''}"`);
    break;
  }

  if (r.status !== 0 && postErro === 0 && lidas === 0) {
    console.error(`\n⛔ PAUSA: falha de execução (exit ${r.status})`);
    console.error(out.slice(-1500));
    break;
  }
}

const total = results.reduce(
  (a, r) => ({
    linhas: a.linhas + r.linhas_enviadas,
    ok: a.ok + r.POST_ok,
    erro: a.erro + r.POST_erro,
    seg: a.seg + r.tempo_segundos,
  }),
  { linhas: 0, ok: 0, erro: 0, seg: 0 },
);
total.seg_total = Math.round((Date.now() - tTotal0) / 1000);

console.log('\n=== RESUMO ===');
console.log(JSON.stringify({ results, total }, null, 2));
