#!/usr/bin/env node
/**
 * Relatório: rodadas de cálculo desalinhadas (txt Dropbox vs calculo_rodada na VPS).
 *
 * Critério (mesma situação do 578/134):
 *   - débitos/títulos no banco ≠ quantidade no txt
 *   - titulosGravadosAceito ausente/incompleto quando txt tem snapshot
 *   - titulos[] e debitos[] desalinhados no payload
 *   - rodada ausente no banco mas com débitos no txt
 *
 * Uso:
 *   node scripts/diagnosticar-calculos-txt-vs-db.mjs
 *   node scripts/diagnosticar-calculos-txt-vs-db.mjs --cliente=578 --processo=134
 *   node scripts/diagnosticar-calculos-txt-vs-db.mjs --relatorio=../tmp/calculos-reimport.json --csv=../tmp/calculos-reimport.csv
 *   node scripts/diagnosticar-calculos-txt-vs-db.mjs --gravar-vps
 *
 * VPS MySQL: SSH root@161.97.175.73 (root/root) ou VILAREAL_MYSQL_* com túnel 3308.
 */

import './lib/load-vilareal-import-env.mjs';

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';
import {
  chaveParCodigoProcesso,
  diagnosticarRodadaTxtVsDb,
  listarCodigosClientesComPastaCalculos,
  scanExpectativasCalculosTxtCliente,
} from './lib/calculos-txt-scan-rapido.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const out = {
    cliente: null,
    processo: null,
    base: resolverBaseBancoDados(),
    relatorio: null,
    csv: null,
    gravarVps: false,
    mysqlLocal: false,
    vpsHost: process.env.VPS_HOST || 'root@161.97.175.73',
    vpsSshKey: process.env.VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'villareal_vps'),
    dbName: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    dbUser: process.env.VILAREAL_MYSQL_USER || 'root',
    dbPass: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
    usarMysqlLocal: false,
  };
  for (const a of argv) {
    if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a.startsWith('--processo=')) out.processo = Number(a.slice(11));
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--csv=')) out.csv = a.slice(6);
    else if (a === '--gravar-vps') out.gravarVps = true;
    else if (a === '--mysql-local') out.mysqlLocal = true;
  }
  out.usarMysqlLocal = out.mysqlLocal;
  return out;
}

const SQL_EXPORT_DB = `
SELECT
  TRIM(codigo_cliente) AS codigo_cliente,
  numero_processo,
  dimensao,
  id,
  parcelamento_aceito,
  COALESCE(JSON_LENGTH(payload_json, '$.titulos'), 0) AS titulos,
  COALESCE(JSON_LENGTH(payload_json, '$.debitos'), 0) AS debitos,
  COALESCE(JSON_LENGTH(payload_json, '$.titulosGravadosAceito'), 0) AS gravados
FROM calculo_rodada
`.trim();

/** @returns {Promise<Map<string, { exists: true, id: number, titulos: number, debitos: number, gravados: number, aceito: boolean }>>} */
async function carregarEstadoDbVps(opts) {
  /** @type {Map<string, any>} */
  const map = new Map();

  if (opts.usarMysqlLocal) {
    const conn = await conectarMysqlVilareal();
    try {
      const [rows] = await conn.query(SQL_EXPORT_DB);
      for (const r of rows) {
        ingestRow(map, r);
      }
    } finally {
      await conn.end();
    }
    return map;
  }

  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) {
    sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  }
  sshArgs.push(opts.vpsHost, `mysql -u ${opts.dbUser} -p${opts.dbPass} -N -B -e "${SQL_EXPORT_DB.replace(/\n/g, ' ')}" ${opts.dbName}`);

  const { stdout } = await execFileAsync('ssh', sshArgs, {
    maxBuffer: 128 * 1024 * 1024,
    encoding: 'utf8',
  });

  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 8) continue;
    ingestRow(map, {
      codigo_cliente: cols[0],
      numero_processo: cols[1],
      dimensao: cols[2],
      id: cols[3],
      parcelamento_aceito: cols[4],
      titulos: cols[5],
      debitos: cols[6],
      gravados: cols[7],
    });
  }
  return map;
}

/** @param {Map<string, any>} map @param {Record<string, unknown>} r */
function ingestRow(map, r) {
  const cod8 = String(r.codigo_cliente ?? '').padStart(8, '0');
  const proc = Number(r.numero_processo);
  const dim = Number(r.dimensao);
  if (!cod8 || !Number.isFinite(proc) || !Number.isFinite(dim)) return;
  const key = `${cod8}|${proc}|${dim}`;
  map.set(key, {
    exists: true,
    id: Number(r.id) || null,
    titulos: Number(r.titulos) || 0,
    debitos: Number(r.debitos) || 0,
    gravados: Number(r.gravados) || 0,
    aceito: String(r.parcelamento_aceito) === '1' || r.parcelamento_aceito === 1 || r.parcelamento_aceito === true,
  });
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** @param {Awaited<ReturnType<typeof montarRelatorio>>} rel */
function escreverCsv(rel, csvPath) {
  const lines = [
    [
      'codigo_cliente',
      'numero_processo',
      'dimensao',
      'precisa_atualizacao',
      'motivos',
      'esperado_debitos',
      'db_debitos',
      'esperado_titulos',
      'db_titulos',
      'esperado_gravados',
      'db_gravados',
      'db_row_existe',
    ].join(','),
  ];
  for (const d of rel.dimensoes) {
    lines.push(
      [
        d.codigo_cliente,
        d.numero_processo,
        d.dimensao,
        d.precisa_atualizacao ? 1 : 0,
        d.motivos.join('|'),
        d.esperado_debitos,
        d.db_debitos ?? '',
        d.esperado_titulos,
        d.db_titulos ?? '',
        d.esperado_gravados,
        d.db_gravados ?? '',
        d.db_row_existe ? 1 : 0,
      ].map(csvEscape).join(','),
    );
  }
  fs.mkdirSync(path.dirname(path.resolve(csvPath)), { recursive: true });
  fs.writeFileSync(csvPath, `${lines.join('\n')}\n`);
}

/**
 * @param {ReturnType<typeof parseArgs>} opts
 * @param {Map<string, any>} dbMap
 */
function montarRelatorio(opts, dbMap) {
  const clientes =
    opts.cliente != null
      ? [Math.trunc(opts.cliente)]
      : listarCodigosClientesComPastaCalculos(opts.base);

  /** @type {Array<Record<string, unknown>>} */
  const dimensoes = [];
  /** @type {Map<string, { codigo_cliente: string, numero_processo: number, dims_txt: number, dims_com_debitos: number, dims_afetadas: number, motivos: Set<string>, precisa: boolean }>} */
  const pares = new Map();

  for (const cod of clientes) {
    const expectativas = scanExpectativasCalculosTxtCliente(cod, opts.base);
    for (const [key, exp] of expectativas) {
      if (opts.processo != null && exp.numeroProcesso !== opts.processo) continue;
      if (exp.esperadoDebitos <= 0) continue;

      const db = dbMap.get(key) ?? { exists: false };
      const { motivos, precisaAtualizacao } = diagnosticarRodadaTxtVsDb(exp, db);

      const row = {
        key,
        codigo_cliente: exp.cod8,
        numero_processo: exp.numeroProcesso,
        dimensao: exp.dimensao,
        esperado_debitos: exp.esperadoDebitos,
        esperado_titulos: exp.esperadoTitulos,
        esperado_gravados: exp.esperadoGravados,
        txt_aceito: exp.txtAceito,
        txt_snapshot: exp.txtSnapshot,
        db_row_existe: Boolean(db.exists),
        db_calculo_rodada_id: db.exists ? db.id : null,
        db_titulos: db.exists ? db.titulos : null,
        db_debitos: db.exists ? db.debitos : null,
        db_gravados: db.exists ? db.gravados : null,
        db_parcelamento_aceito: db.exists ? db.aceito : null,
        motivos,
        precisa_atualizacao: precisaAtualizacao,
      };
      dimensoes.push(row);

      const parKey = chaveParCodigoProcesso(exp.cod8, exp.numeroProcesso);
      if (!pares.has(parKey)) {
        pares.set(parKey, {
          codigo_cliente: exp.cod8,
          numero_processo: exp.numeroProcesso,
          dims_txt: 0,
          dims_com_debitos: 0,
          dims_afetadas: 0,
          motivos: new Set(),
          precisa: false,
        });
      }
      const par = pares.get(parKey);
      par.dims_txt += 1;
      par.dims_com_debitos += 1;
      for (const m of motivos) par.motivos.add(m);
      if (precisaAtualizacao) {
        par.dims_afetadas += 1;
        par.precisa = true;
      }
    }
  }

  dimensoes.sort((a, b) => {
    const c = String(a.codigo_cliente).localeCompare(String(b.codigo_cliente));
    if (c !== 0) return c;
    const p = Number(a.numero_processo) - Number(b.numero_processo);
    if (p !== 0) return p;
    return Number(a.dimensao) - Number(b.dimensao);
  });

  const paresArr = [...pares.values()]
    .filter((p) => p.precisa)
    .map((p) => ({
      codigo_cliente: p.codigo_cliente,
      numero_processo: p.numero_processo,
      dims_txt: p.dims_txt,
      dims_com_debitos: p.dims_com_debitos,
      dims_afetadas: p.dims_afetadas,
      motivos_resumo: [...p.motivos].sort(),
      precisa_atualizacao: true,
    }))
    .sort((a, b) => {
      const c = a.codigo_cliente.localeCompare(b.codigo_cliente);
      if (c !== 0) return c;
      return a.numero_processo - b.numero_processo;
    });

  const dimsAfetadas = dimensoes.filter((d) => d.precisa_atualizacao);

  return {
    geradoEm: new Date().toISOString(),
    baseTxt: opts.base,
    fonteDb: opts.usarMysqlLocal ? 'mysql_local' : `ssh:${opts.vpsHost}`,
    tabelaAlvo: 'calculo_rodada',
    tabelasDiagnostico: ['calculo_rodada_reimport_diag', 'calculo_rodada_reimport_par'],
    resumo: {
      clientes_txt: clientes.length,
      dimensoes_txt_com_debitos: dimensoes.length,
      dimensoes_precisam_atualizacao: dimsAfetadas.length,
      pares_precisam_atualizacao: paresArr.length,
      motivos: contarMotivos(dimsAfetadas),
    },
    pares: paresArr,
    dimensoes: dimensoes,
    dimensoes_afetadas: dimsAfetadas,
  };
}

/** @param {Array<{ motivos: string[] }>} rows */
function contarMotivos(rows) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const r of rows) {
    for (const m of r.motivos) out[m] = (out[m] || 0) + 1;
  }
  return out;
}

/** @param {ReturnType<typeof montarRelatorio>} rel @param {ReturnType<typeof parseArgs>} opts */
async function gravarDiagnosticoVps(rel, opts) {
  const conn = opts.usarMysqlLocal ? await conectarMysqlVilareal() : null;

  const runSql = async (sql) => {
    if (conn) {
      await conn.query(sql);
      return;
    }
    const sshArgs = [];
    if (fs.existsSync(opts.vpsSshKey)) {
      sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
    }
    sshArgs.push(opts.vpsHost, `mysql -u ${opts.dbUser} -p${opts.dbPass} ${opts.dbName} -e ${JSON.stringify(sql)}`);
    await execFileAsync('ssh', sshArgs, { maxBuffer: 64 * 1024 * 1024 });
  };

  await runSql('TRUNCATE TABLE calculo_rodada_reimport_diag');
  await runSql('TRUNCATE TABLE calculo_rodada_reimport_par');

  if (conn) {
    for (const d of rel.dimensoes_afetadas) {
      await conn.query(
        `INSERT INTO calculo_rodada_reimport_diag (
          codigo_cliente, numero_processo, dimensao,
          esperado_debitos, esperado_titulos, esperado_gravados,
          txt_aceito, txt_snapshot,
          db_row_existe, db_calculo_rodada_id,
          db_titulos, db_debitos, db_gravados, db_parcelamento_aceito,
          motivos, precisa_atualizacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), 1)`,
        [
          d.codigo_cliente,
          d.numero_processo,
          d.dimensao,
          d.esperado_debitos,
          d.esperado_titulos,
          d.esperado_gravados,
          d.txt_aceito ? 1 : 0,
          d.txt_snapshot ? 1 : 0,
          d.db_row_existe ? 1 : 0,
          d.db_calculo_rodada_id,
          d.db_titulos,
          d.db_debitos,
          d.db_gravados,
          d.db_parcelamento_aceito == null ? null : d.db_parcelamento_aceito ? 1 : 0,
          JSON.stringify(d.motivos),
        ],
      );
    }
    for (const p of rel.pares) {
      await conn.query(
        `INSERT INTO calculo_rodada_reimport_par (
          codigo_cliente, numero_processo, dims_txt, dims_com_debitos, dims_afetadas,
          motivos_resumo, precisa_atualizacao
        ) VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), 1)`,
        [
          p.codigo_cliente,
          p.numero_processo,
          p.dims_txt,
          p.dims_com_debitos,
          p.dims_afetadas,
          JSON.stringify(p.motivos_resumo),
        ],
      );
    }
    await conn.end();
    return;
  }

  // SSH batch via temp SQL file
  const chunks = ['SET NAMES utf8mb4;', 'START TRANSACTION;'];
  for (const d of rel.dimensoes_afetadas) {
    const motivos = JSON.stringify(d.motivos).replace(/'/g, "''");
    chunks.push(`INSERT INTO calculo_rodada_reimport_diag (
      codigo_cliente, numero_processo, dimensao,
      esperado_debitos, esperado_titulos, esperado_gravados,
      txt_aceito, txt_snapshot, db_row_existe, db_calculo_rodada_id,
      db_titulos, db_debitos, db_gravados, db_parcelamento_aceito,
      motivos, precisa_atualizacao
    ) VALUES (
      '${d.codigo_cliente}', ${d.numero_processo}, ${d.dimensao},
      ${d.esperado_debitos}, ${d.esperado_titulos}, ${d.esperado_gravados},
      ${d.txt_aceito ? 1 : 0}, ${d.txt_snapshot ? 1 : 0},
      ${d.db_row_existe ? 1 : 0},
      ${d.db_calculo_rodada_id ?? 'NULL'},
      ${d.db_titulos ?? 'NULL'}, ${d.db_debitos ?? 'NULL'}, ${d.db_gravados ?? 'NULL'},
      ${d.db_parcelamento_aceito == null ? 'NULL' : d.db_parcelamento_aceito ? 1 : 0},
      '${motivos}', 1
    );`);
  }
  for (const p of rel.pares) {
    const motivos = JSON.stringify(p.motivos_resumo).replace(/'/g, "''");
    chunks.push(`INSERT INTO calculo_rodada_reimport_par (
      codigo_cliente, numero_processo, dims_txt, dims_com_debitos, dims_afetadas,
      motivos_resumo, precisa_atualizacao
    ) VALUES (
      '${p.codigo_cliente}', ${p.numero_processo}, ${p.dims_txt}, ${p.dims_com_debitos}, ${p.dims_afetadas},
      '${motivos}', 1
    );`);
  }
  chunks.push('COMMIT;');

  const tmp = path.join(os.tmpdir(), `vilareal-calculos-diag-${Date.now()}.sql`);
  fs.writeFileSync(tmp, chunks.join('\n'));
  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) {
    sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  }
  const remote = `/tmp/vilareal-calculos-diag-${Date.now()}.sql`;
  await execFileAsync('scp', [...sshArgs, tmp, `${opts.vpsHost}:${remote}`]);
  await execFileAsync('ssh', [...sshArgs, opts.vpsHost, `mysql -u ${opts.dbUser} -p${opts.dbPass} ${opts.dbName} < ${remote} && rm -f ${remote}`]);
  fs.unlinkSync(tmp);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('[diagnostico-calculos] carregando calculo_rodada da VPS…');
  const dbMap = await carregarEstadoDbVps(opts);
  console.log(`[diagnostico-calculos] linhas no banco: ${dbMap.size}`);

  console.log('[diagnostico-calculos] varrendo txt…');
  const rel = montarRelatorio(opts, dbMap);

  console.log('\n=== RESUMO ===');
  console.log(`Tabela a atualizar: ${rel.tabelaAlvo}`);
  console.log(`Dimensões txt com débitos: ${rel.resumo.dimensoes_txt_com_debitos}`);
  console.log(`Dimensões desalinhadas: ${rel.resumo.dimensoes_precisam_atualizacao}`);
  console.log(`Pares (cliente+proc) afetados: ${rel.resumo.pares_precisam_atualizacao}`);
  console.log('Motivos:', rel.resumo.motivos);

  if (rel.pares.length) {
    console.log('\nPrimeiros 30 pares afetados:');
    for (const p of rel.pares.slice(0, 30)) {
      console.log(
        `  ${p.codigo_cliente} proc ${p.numero_processo} — ${p.dims_afetadas}/${p.dims_com_debitos} dim(s) [${p.motivos_resumo.join(', ')}]`,
      );
    }
    if (rel.pares.length > 30) console.log(`  … +${rel.pares.length - 30} pares`);
  }

  const defaultDir = path.join(opts.base, '..', 'tmp');
  const relPath = opts.relatorio || path.join(defaultDir, 'calculos-reimport-diagnostico.json');
  fs.mkdirSync(path.dirname(path.resolve(relPath)), { recursive: true });
  fs.writeFileSync(relPath, `${JSON.stringify(rel, null, 2)}\n`);
  console.log(`\nRelatório JSON: ${relPath}`);

  const csvPath = opts.csv || path.join(defaultDir, 'calculos-reimport-diagnostico.csv');
  escreverCsv(rel, csvPath);
  console.log(`Relatório CSV: ${csvPath}`);

  if (opts.gravarVps) {
    console.log('\n[diagnostico-calculos] gravando tabelas calculo_rodada_reimport_* na VPS…');
    await gravarDiagnosticoVps(rel, opts);
    console.log('[diagnostico-calculos] diagnóstico gravado na VPS.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
