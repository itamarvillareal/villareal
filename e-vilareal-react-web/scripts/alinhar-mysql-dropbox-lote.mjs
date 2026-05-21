#!/usr/bin/env node
/**
 * Remove processos MySQL (e dependentes) que não existem nos txt Dropbox do cliente.
 *
 *   node scripts/alinhar-mysql-dropbox-lote.mjs --dry-run
 *   node scripts/alinhar-mysql-dropbox-lote.mjs --aplicar
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import {
  listarProcessosDropboxCliente,
  removerProcessosForaDropboxMysql,
} from './lib/processos-dropbox-cliente.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const out = {
    aplicar: false,
    relatorio: path.join(ROOT, 'tmp/alinhar-mysql-dropbox-lote.json'),
    clienteMin: 1,
    clienteMax: 999,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max=')) out.clienteMax = Math.min(999, Number(a.slice(14)) || 999);
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const base = resolverBaseBancoDados();
  const conn = await conectarMysqlVilareal();

  const [clientes] = await conn.query(
    `SELECT c.codigo_cliente, c.pessoa_id FROM cliente c ORDER BY c.codigo_cliente`
  );

  /** @type {object[]} */
  const detalhe = [];
  let removidos = 0;
  let clientesAfetados = 0;

  for (const row of clientes) {
    const cod8 = String(row.codigo_cliente ?? '').trim();
    const codNum = Number.parseInt(cod8, 10);
    const pessoaId = Number(row.pessoa_id);
    if (!Number.isFinite(codNum) || codNum < opts.clienteMin || codNum > opts.clienteMax) continue;
    if (!Number.isFinite(pessoaId) || pessoaId < 1) continue;

    const dropbox = listarProcessosDropboxCliente(base, codNum);
    if (!opts.aplicar) {
      const nums = dropbox.filter((n) => Number.isFinite(n) && n >= 0);
      let fora = 0;
      if (nums.length === 0) {
        const [[c]] = await conn.query(`SELECT COUNT(*) AS n FROM processo WHERE pessoa_id = ?`, [pessoaId]);
        fora = Number(c?.n ?? 0);
      } else {
        const ph = nums.map(() => '?').join(',');
        const [f] = await conn.query(
          `SELECT COUNT(*) AS n FROM processo WHERE pessoa_id = ? AND numero_interno NOT IN (${ph})`,
          [pessoaId, ...nums]
        );
        fora = Number(f[0]?.n ?? 0);
      }
      if (fora > 0) {
        clientesAfetados += 1;
        removidos += fora;
        detalhe.push({ cliente: codNum, removidos: fora, dropbox: dropbox.length });
      }
      continue;
    }

    const r = await removerProcessosForaDropboxMysql(conn, pessoaId, dropbox);
    if ((r.removidos ?? 0) > 0) {
      clientesAfetados += 1;
      removidos += r.removidos;
      detalhe.push({
        cliente: codNum,
        removidos: r.removidos,
        numerosRemovidos: r.numerosRemovidos,
        processosMysql: r.processosMysql,
        dropbox: dropbox.length,
      });
    }
  }

  await conn.end();

  const relatorio = {
    modo: opts.aplicar ? 'aplicar' : 'dry-run',
    faixa: `${opts.clienteMin}..${opts.clienteMax}`,
    clientesCadastrados: clientes.length,
    clientesAfetados,
    processosRemovidos: removidos,
    detalhe: detalhe.slice(0, 200),
  };

  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8');

  console.log(`\n=== alinhar-mysql-dropbox-lote (${relatorio.modo}) ===\n`);
  console.log(`Clientes com processos fora Dropbox: ${clientesAfetados}`);
  console.log(`Processos ${opts.aplicar ? 'removidos' : 'a remover'}: ${removidos}`);
  console.log(`Relatório: ${opts.relatorio}\n`);

  if (!opts.aplicar) {
    console.log('Use --aplicar para executar a limpeza.\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
