#!/usr/bin/env node
/**
 * Gera SQL INSERT para `vilareal.calculo_rodada` a partir de `debitos.xlsx`,
 * usando a mesma lógica que o front (`mergeDebitosCalculosPlanilha.js`).
 *
 * Uso:
 *   node scripts/emit-calculo-rodada-sql-from-debitos-xlsx.mjs "/caminho/debitos.xlsx" > import_calculo_rodada.sql
 *   npm run -s emit:sql:calculo-rodada-debitos > import.sql   # -s evita lixo do npm no stdout ao redirecionar
 *   node scripts/emit-calculo-rodada-sql-from-debitos-xlsx.mjs "/caminho/debitos.xlsx" --limit=3   # só N rodadas (teste)
 *
 * O script emite `DELETE FROM calculo_rodada;` após `SET NAMES` para import idempotente
 * (executar com `mysql … vilareal < ficheiro.sql` na base certa).
 *
 * O payload vai em base64 + CAST(... AS JSON) para evitar problemas de escape.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';
import { mergeDebitosCalculosMultiSheet } from '../src/utils/mergeDebitosCalculosPlanilha.js';

/** Evita crash (EPIPE) quando o consumidor fecha cedo (ex.: `| head`). */
process.stdout.on('error', (err) => {
  if (err && err.code === 'EPIPE') process.exit(0);
});

function parseKey(key) {
  const parts = String(key).split(':');
  if (parts.length !== 3) return null;
  const [codigo_cliente, procStr, dimStr] = parts;
  const numero_processo = Number(procStr);
  const dimensao = Number(dimStr);
  if (!/^\d{8}$/.test(codigo_cliente) || !Number.isFinite(numero_processo) || numero_processo < 1) return null;
  if (!Number.isFinite(dimensao) || dimensao < 0) return null;
  return { codigo_cliente, numero_processo, dimensao };
}

function sqlRow(codigo_cliente, numero_processo, dimensao, payloadObj) {
  const json = JSON.stringify(payloadObj);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  return (
    `('${codigo_cliente}', ${numero_processo}, ${dimensao}, CAST(CONVERT(FROM_BASE64('${b64}') USING utf8mb4) AS JSON))`
  );
}

const BATCH = 40;

function main() {
  let limit = Infinity;
  const posArgs = [];
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--limit=')) {
      const n = Number(a.slice(8));
      limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
    } else if (!a.startsWith('-')) posArgs.push(a);
  }
  const file = posArgs[0];
  if (!file) {
    console.error(
      'Uso: node scripts/emit-calculo-rodada-sql-from-debitos-xlsx.mjs <ficheiro.xlsx> [--limit=N] > saida.sql'
    );
    process.exit(1);
  }
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error(`Ficheiro não encontrado: ${abs}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(abs, { cellDates: false });
  const matrices = wb.SheetNames.map((name) =>
    XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
  );
  const { nextRodadas, stats } = mergeDebitosCalculosMultiSheet({}, matrices);

  console.error(
    `[emit-sql] folhas: ${wb.SheetNames.length} | linhas: ${stats.linhasLidas} | aplicadas: ${stats.aplicadas} | ignoradas: ${stats.ignoradas} | rodadas únicas: ${Object.keys(nextRodadas).length}`
  );

  const keys = Object.keys(nextRodadas).sort().slice(0, limit);
  const rows = [];
  for (const key of keys) {
    const parsed = parseKey(key);
    if (!parsed) {
      console.error(`[emit-sql] chave inválida (ignorada): ${key}`);
      continue;
    }
    rows.push(sqlRow(parsed.codigo_cliente, parsed.numero_processo, parsed.dimensao, nextRodadas[key]));
  }

  process.stdout.write(`SET NAMES utf8mb4;\nDELETE FROM calculo_rodada;\n`);
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    process.stdout.write(
      `INSERT INTO calculo_rodada (codigo_cliente, numero_processo, dimensao, payload_json) VALUES\n${chunk.join(',\n')};\n`
    );
  }
}

main();
