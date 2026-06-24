#!/usr/bin/env node
/**
 * Gera SQL de correção (UPDATE processo_andamento) a partir do relatório JSON
 * ou das tabelas de diagnóstico na VPS.
 *
 * Uso:
 *   node scripts/gerar-sql-historico-usuario-reimport.mjs
 *   node scripts/gerar-sql-historico-usuario-reimport.mjs --relatorio=../tmp/historico-usuario-reimport-diagnostico.json
 *   node scripts/gerar-sql-historico-usuario-reimport.mjs --from-vps --saida=~/Downloads/fix.sql
 */

import './lib/load-vilareal-import-env.mjs';

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const out = {
    relatorio: path.join(
      process.env.HOME || '',
      'Dropbox',
      'tmp',
      'historico-usuario-reimport-diagnostico.json',
    ),
    saida: path.join(
      os.homedir(),
      'Downloads',
      `historico-usuario-reimport-vps-${new Date().toISOString().slice(0, 10)}.sql`,
    ),
    fromVps: false,
    vpsHost: process.env.VPS_HOST || 'root@161.97.175.73',
    vpsSshKey: process.env.VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'villareal_vps'),
    dbName: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    dbUser: process.env.VILAREAL_MYSQL_USER || 'root',
    dbPass: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
  };
  for (const a of argv) {
    if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--saida=')) out.saida = a.slice(8);
    else if (a === '--from-vps') out.fromVps = true;
  }
  return out;
}

function sqlEscape(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/** @param {any[]} rows @param {string} saida */
function escreverSql(rows, saida) {
  const lines = [
    '-- Correção seletiva: responsável do histórico (processo_andamento)',
    `-- Gerado: ${new Date().toISOString()}`,
    `-- Linhas: ${rows.length}`,
    'SET NAMES utf8mb4;',
    'START TRANSACTION;',
    '',
  ];

  for (const d of rows) {
    const uid = d.usuario_id_novo != null ? Number(d.usuario_id_novo) : null;
    const uidSql = uid != null && Number.isFinite(uid) ? String(uid) : 'NULL';
    const detSql = d.detalhe_novo != null && String(d.detalhe_novo).length ? sqlEscape(d.detalhe_novo) : 'NULL';
    lines.push(
      `UPDATE processo_andamento SET usuario_id = ${uidSql}, detalhe = ${detSql}, atualizado_em = CURRENT_TIMESTAMP(3) WHERE id = ${d.andamento_id};`,
    );
  }

  lines.push('', 'COMMIT;', '');
  fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
  fs.writeFileSync(saida, `${lines.join('\n')}\n`);
}

/** @param {ReturnType<typeof parseArgs>} opts */
async function carregarFromVps(opts) {
  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) {
    sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  }
  const sql = `SELECT andamento_id, usuario_id_novo, detalhe_novo FROM ${opts.dbName}.processo_andamento_usuario_reimport_diag WHERE precisa_atualizacao=1 ORDER BY andamento_id`;
  const { stdout } = await execFileAsync(
    'ssh',
    [...sshArgs, opts.vpsHost, `mysql -u ${opts.dbUser} -p${opts.dbPass} ${opts.dbName} -e ${JSON.stringify(sql)}`],
    { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' },
  );
  /** @type {any[]} */
  const rows = [];
  const lines = stdout.trim().split('\n');
  if (lines.length <= 1) return rows;
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const id = Number(line.slice(0, tab));
    const rest = line.slice(tab + 1);
    const tab2 = rest.indexOf('\t');
    const uidRaw = tab2 >= 0 ? rest.slice(0, tab2) : rest;
    const det = tab2 >= 0 ? rest.slice(tab2 + 1) : null;
    rows.push({
      andamento_id: id,
      usuario_id_novo: uidRaw === 'NULL' || uidRaw === '' ? null : Number(uidRaw),
      detalhe_novo: det === 'NULL' ? null : det,
    });
  }
  return rows;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  /** @type {any[]} */
  let rows = [];

  if (opts.fromVps) {
    rows = await carregarFromVps(opts);
  } else {
    if (!fs.existsSync(opts.relatorio)) {
      console.error(`Relatório não encontrado: ${opts.relatorio}`);
      console.error('Rode: node scripts/diagnosticar-historico-usuario-txt-vs-db.mjs');
      process.exit(1);
    }
    const rel = JSON.parse(fs.readFileSync(opts.relatorio, 'utf8'));
    rows = rel.andamentos_afetados ?? [];
  }

  if (!rows.length) {
    console.log('Nenhuma correção pendente.');
    process.exit(0);
  }

  escreverSql(rows, opts.saida);
  console.log(`SQL gravado: ${opts.saida} (${rows.length} UPDATE(s))`);
  console.log(`\nAplicar na VPS:\n  ssh ${opts.vpsHost} 'mysql -u ${opts.dbUser} -p*** ${opts.dbName}' < "${opts.saida}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
