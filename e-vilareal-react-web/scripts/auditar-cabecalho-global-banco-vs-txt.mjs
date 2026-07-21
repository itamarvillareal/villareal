#!/usr/bin/env node
/**
 * Auditoria global de cabeçalho: todos os processos do banco ↔ txt (Dropbox).
 *
 * Campos críticos: numeroCnj, descricaoAcao, valorCausa, competencia, observacao, dataProtocolo.
 * Tolerante a mojibake do txt legado («�» casa com qualquer carácter no valor do banco).
 *
 * Uso:
 *   node scripts/auditar-cabecalho-global-banco-vs-txt.mjs                # VPS via SSH
 *   node scripts/auditar-cabecalho-global-banco-vs-txt.mjs --mysql-local
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { normCnj, normDate, normStr, normValor } from './lib/cabecalho-processo-txt-audit.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { lerCabecalhoProcessoTxt } from './lib/proc-processo-cabecalho-txt.mjs';

const execFileAsync = promisify(execFile);

const SQL = `
SELECT
  p.id,
  TRIM(c.codigo_cliente) AS codigo_cliente,
  p.numero_interno,
  p.numero_cnj,
  p.descricao_acao,
  p.competencia,
  p.observacao,
  p.valor_causa,
  p.data_protocolo,
  p.ativo
FROM processo p
INNER JOIN cliente c ON c.id = p.cliente_id
ORDER BY c.codigo_cliente, p.numero_interno
`.trim();

function parseArgs(argv) {
  const out = {
    base: resolverBaseBancoDados(),
    mysqlLocal: false,
    vpsHost: process.env.VPS_HOST || 'root@161.97.175.73',
    vpsSshKey: process.env.VPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'villareal_vps'),
    dbName: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    dbUser: process.env.VILAREAL_MYSQL_USER || 'root',
    dbPass: process.env.VILAREAL_MYSQL_PASSWORD || 'root',
    relatorio: null,
  };
  for (const a of argv) {
    if (a === '--mysql-local') out.mysqlLocal = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
  }
  return out;
}

async function carregarProcessosDb(opts) {
  const rows = [];
  if (opts.mysqlLocal) {
    const conn = await conectarMysqlVilareal();
    try {
      const [res] = await conn.query(SQL);
      for (const r of res) rows.push(r);
    } finally {
      await conn.end();
    }
    return rows;
  }
  const sshArgs = [];
  if (fs.existsSync(opts.vpsSshKey)) sshArgs.push('-i', opts.vpsSshKey, '-o', 'IdentitiesOnly=yes');
  sshArgs.push(
    opts.vpsHost,
    `mysql -u ${opts.dbUser} -p${opts.dbPass} -N -B -e "${SQL.replace(/"/g, '\\"')}" ${opts.dbName}`
  );
  const { stdout } = await execFileAsync('ssh', sshArgs, {
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'utf8',
  });
  const headers = [
    'id',
    'codigo_cliente',
    'numero_interno',
    'numero_cnj',
    'descricao_acao',
    'competencia',
    'observacao',
    'valor_causa',
    'data_protocolo',
    'ativo',
  ];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    const row = {};
    headers.forEach((h, i) => {
      const v = cols[i];
      row[h] = v === undefined || v === 'NULL' ? null : v;
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Compara texto do txt (pode ter «�» mojibake) com o do banco:
 * «�» no txt casa com 1+ caracteres no banco (acentos multi-byte corrompidos).
 */
function textoCompativelMojibake(txtVal, dbVal) {
  const a = normStr(txtVal);
  const b = normStr(dbVal);
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (!a.includes('\uFFFD')) return a.toUpperCase() === b.toUpperCase();
  const rx = new RegExp(
    `^${a
      .split('\uFFFD')
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.{1,2}')}$`,
    'iu'
  );
  return rx.test(b);
}

function cnjCompativel(txtVal, dbVal) {
  const a = normCnj(txtVal);
  const b = normCnj(dbVal);
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  const da = a.replace(/\D/g, '');
  const db_ = b.replace(/\D/g, '');
  if (da && db_ && da.replace(/^0+/, '') === db_.replace(/^0+/, '')) return true;
  return textoCompativelMojibake(a, b);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('\n=== Auditoria global de cabeçalho — banco ↔ txt ===');
  console.log(`Fonte txt: ${opts.base}`);
  console.log(`Fonte DB:  ${opts.mysqlLocal ? 'mysql-local' : opts.vpsHost}\n`);

  const rows = await carregarProcessosDb(opts);
  console.log(`[db] ${rows.length} processos carregados\n`);

  /** @type {object[]} */
  const casos = [];
  let comTxt = 0;
  let processados = 0;

  /** @type {Map<string, ReturnType<typeof lerCabecalhoProcessoTxt>>} cache leve */
  for (const r of rows) {
    processados += 1;
    if (processados % 2000 === 0) console.log(`  … ${processados}/${rows.length}`);
    const codNum = Number(String(r.codigo_cliente).replace(/\D/g, ''));
    const ni = Number(r.numero_interno);
    if (!Number.isFinite(codNum) || codNum < 1 || !Number.isFinite(ni) || ni < 1) continue;

    let cab;
    try {
      cab = lerCabecalhoProcessoTxt(codNum, ni, { baseBanco: opts.base });
    } catch {
      continue;
    }
    if (!cab || Object.keys(cab.campos).length === 0) continue;
    comTxt += 1;

    /** @type {object[]} */
    const diffs = [];

    if (cab.campos.numeroCnj != null && !cnjCompativel(cab.campos.numeroCnj, r.numero_cnj)) {
      diffs.push({ campo: 'numeroCnj', txt: cab.campos.numeroCnj, db: r.numero_cnj });
    }
    if (
      cab.campos.descricaoAcao != null &&
      r.descricao_acao != null &&
      !textoCompativelMojibake(cab.campos.descricaoAcao, r.descricao_acao)
    ) {
      diffs.push({ campo: 'descricaoAcao', txt: cab.campos.descricaoAcao, db: r.descricao_acao });
    }
    if (
      cab.campos.competencia != null &&
      r.competencia != null &&
      !textoCompativelMojibake(cab.campos.competencia, r.competencia)
    ) {
      diffs.push({ campo: 'competencia', txt: cab.campos.competencia, db: r.competencia });
    }
    if (
      cab.campos.observacao != null &&
      r.observacao != null &&
      !textoCompativelMojibake(cab.campos.observacao, r.observacao)
    ) {
      diffs.push({ campo: 'observacao', txt: cab.campos.observacao, db: r.observacao });
    }
    const valTxt = normValor(cab.campos.valorCausa);
    const valDb = normValor(r.valor_causa);
    if (valTxt != null && valDb != null && valTxt !== valDb) {
      diffs.push({ campo: 'valorCausa', txt: valTxt, db: valDb });
    }
    const dtTxt = normDate(cab.campos.dataProtocolo);
    const dtDb = normDate(r.data_protocolo);
    if (dtTxt != null && dtDb != null && dtTxt !== dtDb) {
      diffs.push({ campo: 'dataProtocolo', txt: dtTxt, db: dtDb });
    }

    if (diffs.length === 0) continue;

    const camposGraves = new Set(['numeroCnj', 'valorCausa']);
    const nGraves = diffs.filter((d) => camposGraves.has(d.campo)).length;
    const severidade = nGraves > 0 || diffs.length >= 3 ? 'critico' : 'moderado';

    casos.push({
      processo: `${String(r.codigo_cliente).padStart(8, '0')}/${ni}`,
      id: Number(r.id),
      ativo: String(r.ativo) === '1' || r.ativo === 1 || r.ativo === true,
      severidade,
      nDiffs: diffs.length,
      diffs,
    });
  }

  casos.sort((a, b) => (b.severidade === 'critico' ? 1 : 0) - (a.severidade === 'critico' ? 1 : 0) || b.nDiffs - a.nDiffs);

  const criticos = casos.filter((c) => c.severidade === 'critico');
  console.log('\n--- Resultado ---');
  console.log(`  Processos no banco:         ${rows.length}`);
  console.log(`  Com cabeçalho txt:          ${comTxt}`);
  console.log(`  Com divergência:            ${casos.length}`);
  console.log(`  CRÍTICOS (CNJ/valor/3+ campos): ${criticos.length}\n`);
  for (const c of criticos) {
    console.log(`  ${c.processo} (id=${c.id}, ${c.ativo ? 'ATIVO' : 'inativo'}) — ${c.nDiffs} campo(s)`);
    for (const d of c.diffs) {
      const t = JSON.stringify(d.txt).slice(0, 70);
      const b = JSON.stringify(d.db).slice(0, 70);
      console.log(`    ${d.campo}: txt=${t} | db=${b}`);
    }
  }

  const relPath = opts.relatorio ?? path.join(process.cwd(), 'tmp', 'auditoria-cabecalho-global.json');
  fs.mkdirSync(path.dirname(relPath), { recursive: true });
  fs.writeFileSync(
    relPath,
    `${JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        totais: { processosDb: rows.length, comCabecalhoTxt: comTxt, divergentes: casos.length, criticos: criticos.length },
        casos,
      },
      null,
      2
    )}\n`
  );
  console.log(`\nRelatório: ${relPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
