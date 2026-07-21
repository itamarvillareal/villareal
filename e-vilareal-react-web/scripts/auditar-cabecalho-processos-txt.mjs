#!/usr/bin/env node
/**
 * Audita cabeçalho de processos (txt Dropbox ↔ MySQL VPS/local).
 *
 * Detecta divergências críticas (CNJ, valor, descrição…) e CNJ «emprestado»
 * de outro cliente/processo no txt.
 *
 * Uso:
 *   node scripts/auditar-cabecalho-processos-txt.mjs --cliente=149
 *   node scripts/auditar-cabecalho-processos-txt.mjs --cliente=149 --mysql-local
 *   node scripts/auditar-cabecalho-processos-txt.mjs --criticos --relatorio=tmp/audit-criticos.json
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  compararCabecalhoTxtVsDb,
  detectarContaminacaoCnj,
  indexarCnjTxtGlobal,
  montarSnapshotTxtCabecalho,
} from './lib/cabecalho-processo-txt-audit.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { listarProcessosComDadosCabecalhoTxt } from './lib/processos-dropbox-cliente.mjs';

const execFileAsync = promisify(execFile);

const SQL_PROCESSOS = `
SELECT
  p.id AS processo_id,
  p.numero_interno,
  p.numero_cnj,
  p.numero_processo_antigo,
  p.natureza_acao,
  p.descricao_acao,
  p.competencia,
  p.tramitacao,
  p.observacao,
  p.observacao_fase,
  p.valor_causa,
  p.data_protocolo,
  p.prazo_fatal,
  p.proxima_consulta,
  p.uf,
  p.cidade,
  p.unidade,
  p.fase,
  p.ativo
FROM processo p
INNER JOIN cliente c ON c.id = p.cliente_id
WHERE TRIM(c.codigo_cliente) IN (?, ?)
ORDER BY p.numero_interno
`.trim();

function parseArgs(argv) {
  const out = {
    cliente: null,
    /** @type {number[] | null} */
    clientes: null,
    base: resolverBaseBancoDados(),
    mysqlLocal: false,
    vpsHost: process.env.VPS_HOST || 'root@161.97.175.73',
    vpsSshKey: process.env.VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'villareal_vps'),
    dbName: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    dbUser: process.env.VILAREAL_MYSQL_USER || 'root',
    dbPass: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
    apenasCriticos: false,
    relatorio: null,
    indiceCnjGlobal: true,
  };
  for (const a of argv) {
    if (a.startsWith('--cliente=')) out.cliente = Math.trunc(Number(a.slice(10)));
    else if (a.startsWith('--clientes=')) {
      out.clientes = a
        .slice(11)
        .split(/[,\s;]+/)
        .map((x) => Math.trunc(Number(x)))
        .filter((n) => Number.isFinite(n) && n >= 1);
    } else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a === '--mysql-local') out.mysqlLocal = true;
    else if (a === '--criticos' || a === '--apenas-criticos') out.apenasCriticos = true;
    else if (a === '--sem-indice-cnj-global') out.indiceCnjGlobal = false;
  }
  return out;
}

/** @param {ReturnType<typeof parseArgs>} opts @param {string} cod8 */
async function carregarDbPorProc(opts, cod8) {
  /** @type {Map<number, Record<string, unknown>>} */
  const map = new Map();

  if (opts.mysqlLocal) {
    const conn = await conectarMysqlVilareal();
    try {
      const [rows] = await conn.query(SQL_PROCESSOS, [cod8, String(Number(cod8))]);
      for (const r of rows) map.set(Number(r.numero_interno), r);
    } finally {
      await conn.end();
    }
    return map;
  }

  const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const bound = SQL_PROCESSOS.replace(/\?/g, () => esc(cod8));
  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) {
    sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  }
  sshArgs.push(
    opts.vpsHost,
    `mysql -u ${opts.dbUser} -p${opts.dbPass} -N -B -e "${bound.replace(/"/g, '\\"')}" ${opts.dbName}`
  );
  const { stdout } = await execFileAsync('ssh', sshArgs, {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf8',
  });

  const headers = [
    'processo_id',
    'numero_interno',
    'numero_cnj',
    'numero_processo_antigo',
    'natureza_acao',
    'descricao_acao',
    'competencia',
    'tramitacao',
    'observacao',
    'observacao_fase',
    'valor_causa',
    'data_protocolo',
    'prazo_fatal',
    'proxima_consulta',
    'uf',
    'cidade',
    'unidade',
    'fase',
    'ativo',
  ];

  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    /** @type {Record<string, unknown>} */
    const row = {};
    headers.forEach((h, i) => {
      const val = cols[i];
      row[h] = val === undefined || val === 'NULL' ? null : val;
    });
    map.set(Number(row.numero_interno), row);
  }
  return map;
}

/** @param {ReturnType<typeof parseArgs>} opts @param {number} codNum */
async function auditarCliente(opts, codNum, indiceCnj) {
  const cod8 = formatCod8(codNum);
  const procsTxt = listarProcessosComDadosCabecalhoTxt(opts.base, codNum);
  const dbMap = await carregarDbPorProc(opts, cod8);
  /** @type {object[]} */
  const linhas = [];

  for (const proc of procsTxt) {
    const txt = montarSnapshotTxtCabecalho(codNum, proc, opts.base);
    const db = dbMap.get(proc) ?? null;
    if (!txt.temCabecalhoTxt) continue;

    if (!db) {
      linhas.push({
        codigo_cliente: cod8,
        proc,
        situacao: 'so_txt',
        severidadeMax: 'aviso',
        divergencias: [],
      });
      continue;
    }

    const cmp = compararCabecalhoTxtVsDb(txt, db);
    const contaminacao = detectarContaminacaoCnj(db.numero_cnj, cod8, proc, indiceCnj);
    /** @type {object[]} */
    const extras = [];
    if (contaminacao) {
      extras.push({
        campo: 'numeroCnj',
        txt: txt.campos.numeroCnj ?? null,
        db: db.numero_cnj,
        severidade: 'critico',
        contaminacao,
      });
    }

    const divergencias = [...cmp.divergencias, ...extras];
    let severidadeMax = cmp.severidadeMax;
    if (contaminacao) severidadeMax = 'critico';
    const situacao = divergencias.length === 0 ? 'ok' : 'divergente';

    linhas.push({
      codigo_cliente: cod8,
      proc,
      situacao,
      severidadeMax,
      processo_id: db.processo_id,
      divergencias,
      txt: {
        numeroCnj: txt.campos.numeroCnj ?? null,
        descricaoAcao: txt.campos.descricaoAcao ?? null,
        valorCausa: txt.campos.valorCausa ?? null,
        observacao: txt.campos.observacao ?? null,
      },
      db: {
        numero_cnj: db.numero_cnj,
        descricao_acao: db.descricao_acao,
        valor_causa: db.valor_causa,
        observacao: db.observacao,
        observacao_fase: db.observacao_fase,
      },
      contaminacao,
    });
  }

  const criticos = linhas.filter((l) => l.severidadeMax === 'critico');
  return {
    codigo_cliente: cod8,
    processos_txt: procsTxt.length,
    processos_vps: dbMap.size,
    ok: linhas.filter((l) => l.situacao === 'ok').length,
    divergentes: linhas.filter((l) => l.situacao === 'divergente').length,
    criticos: criticos.length,
    lista_criticos: criticos.map((l) => l.proc),
    linhas: opts.apenasCriticos ? linhas.filter((l) => l.severidadeMax === 'critico' || l.situacao === 'so_txt') : linhas,
  };
}

/** @param {ReturnType<typeof parseArgs>} opts @param {number} codNum @param {Map<string, object>} indiceCnj */
async function carregarCriticosCliente(opts, codNum, indiceCnj) {
  const cod8 = formatCod8(codNum);
  const dbMap = await carregarDbPorProc(opts, cod8);
  const procsTxt = listarProcessosComDadosCabecalhoTxt(opts.base, codNum);
  /** @type {number[]} */
  const criticos = [];
  for (const proc of procsTxt) {
    const txt = montarSnapshotTxtCabecalho(codNum, proc, opts.base);
    const db = dbMap.get(proc);
    if (!txt.temCabecalhoTxt || !db) continue;
    const cmp = compararCabecalhoTxtVsDb(txt, db);
    const contaminacao = detectarContaminacaoCnj(db.numero_cnj, cod8, proc, indiceCnj);
    if (cmp.severidadeMax === 'critico' || contaminacao) criticos.push(proc);
  }
  return criticos;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const clientes =
    opts.clientes ??
    (opts.cliente != null ? [opts.cliente] : null);
  if (!clientes?.length) {
    console.error('Uso: node scripts/auditar-cabecalho-processos-txt.mjs --cliente=N [--criticos]');
    process.exit(1);
  }

  console.log('\n=== Auditoria cabeçalho txt ↔ banco ===');
  console.log(`Fonte txt: ${opts.base}`);
  console.log(`Fonte DB:  ${opts.mysqlLocal ? 'mysql-local' : opts.vpsHost}`);
  console.log('');

  const indiceCnj = opts.indiceCnjGlobal ? indexarCnjTxtGlobal(opts.base) : new Map();
  if (opts.indiceCnjGlobal) {
    console.log(`[índice CNJ txt] ${indiceCnj.size} ficheiros 5.1 indexados\n`);
  }

  /** @type {object[]} */
  const relatorios = [];
  let totalCriticos = 0;

  for (const codNum of clientes) {
    const rel = await auditarCliente(opts, codNum, indiceCnj);
    relatorios.push(rel);
    totalCriticos += rel.criticos;
    console.log(
      `Cliente ${rel.codigo_cliente}: ${rel.divergentes} divergente(s), ${rel.criticos} crítico(s) [${rel.lista_criticos.join(', ') || '—'}]`
    );
    for (const l of rel.linhas) {
      if (l.severidadeMax !== 'critico') continue;
      console.log(`  proc ${l.proc} (id=${l.processo_id ?? '—'})`);
      if (l.contaminacao) {
        console.log(
          `    CNJ no banco pertence ao txt ${l.contaminacao.donoTxt} (${path.basename(l.contaminacao.arquivo)})`
        );
      }
      for (const d of l.divergencias.filter((x) => x.severidade === 'critico')) {
        console.log(`    ${d.campo}: txt=${JSON.stringify(d.txt)} | db=${JSON.stringify(d.db)}`);
      }
    }
  }

  const payload = {
    geradoEm: new Date().toISOString(),
    opts: {
      base: opts.base,
      mysqlLocal: opts.mysqlLocal,
      vpsHost: opts.vpsHost,
      apenasCriticos: opts.apenasCriticos,
    },
    totalCriticos,
    clientes: relatorios,
  };

  const relPath =
    opts.relatorio ??
    path.join(process.cwd(), 'tmp', `auditoria-cabecalho-${clientes.length === 1 ? formatCod8(clientes[0]) : 'lote'}.json`);
  fs.mkdirSync(path.dirname(relPath), { recursive: true });
  fs.writeFileSync(relPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`\nRelatório: ${relPath}`);
  console.log(`Total críticos: ${totalCriticos}\n`);
  process.exit(totalCriticos > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
