#!/usr/bin/env node
/**
 * 1) Zera o histórico (todos os andamentos) dos processos em Diagnósticos → Consultas Realizadas na data.
 * 2) Reimporta cada processo com `import-real.mjs` (--substituir-historico).
 *
 * Uso:
 *   node scripts/zerar-e-reimportar-consultas-realizadas.mjs --data=18/05/2026
 *   node scripts/zerar-e-reimportar-consultas-realizadas.mjs --data=18/05/2026 --aplicar
 *   node scripts/zerar-e-reimportar-consultas-realizadas.mjs --data=18/05/2026 --aplicar --somente-zerar
 *   node scripts/zerar-e-reimportar-consultas-realizadas.mjs --data=18/05/2026 --aplicar --somente-importar
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';
import { resolverAliasHojeEmTexto } from '../src/services/hjDateAliasService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCRIPT_IMPORT_REAL = path.join(__dirname, 'import-real.mjs');

function hojeDdMmYyyy() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function slugDataBr(dataBr) {
  return String(dataBr).replace(/\//g, '-');
}

function listaPadraoPath(dataBr) {
  return path.join(ROOT, 'tmp', `consultas-realizadas-lista-${slugDataBr(dataBr)}.json`);
}

function parseArgs(argv) {
  const out = {
    data: hojeDdMmYyyy(),
    aplicar: false,
    somenteZerar: false,
    somenteImportar: false,
    limite: 0,
    lista: null,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a === '--somente-zerar') out.somenteZerar = true;
    else if (a === '--somente-importar') out.somenteImportar = true;
    else if (a.startsWith('--data=')) out.data = a.slice(7).trim();
    else if (a.startsWith('--limite=')) out.limite = Number(a.slice(9)) || 0;
    else if (a.startsWith('--lista=')) out.lista = path.resolve(a.slice(8));
  }
  return out;
}

function carregarListaArquivo(filePath) {
  const j = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const pares = Array.isArray(j.pares) ? j.pares : [];
  return pares
    .map((p) => ({ cod: Number(p.cod), proc: Number(p.proc) }))
    .filter((p) => p.cod >= 1 && p.proc >= 1);
}

function gravarListaArquivo(filePath, dataBr, pares, fonte) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ data: dataBr, geradoEm: new Date().toISOString(), fonte, pares }, null, 2)
  );
}

async function login(opts) {
  const r = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: String(opts.login).trim().toLowerCase(), senha: opts.senha }),
  });
  if (!r.ok) throw new Error(`Login ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const json = await r.json();
  if (!json.accessToken) throw new Error('Sem accessToken');
  return json.accessToken;
}

async function listarConsultasRealizadas(opts, token) {
  const data = resolverAliasHojeEmTexto(opts.data, 'br') ?? opts.data;
  const r = await fetch(
    `${opts.baseUrl}/api/processos/diagnostico/historico-data?data=${encodeURIComponent(data)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!r.ok) throw new Error(`historico-data ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const arr = await r.json();
  return { data, rows: Array.isArray(arr) ? arr : [] };
}

function paresUnicosProcessos(rows, dataBr) {
  /** @type {Map<string, { cod: number, proc: number }>} */
  const m = new Map();
  for (const r of rows) {
    if (String(r.data ?? '').trim() !== dataBr) continue;
    const cod = Number(String(r.codigoCliente ?? '').replace(/^0+/, '') || 0);
    const proc = Number(r.numeroInterno);
    if (!Number.isFinite(cod) || cod < 1 || !Number.isFinite(proc) || proc < 1) continue;
    m.set(`${cod}/${proc}`, { cod, proc });
  }
  return [...m.values()].sort((a, b) => a.cod - b.cod || a.proc - b.proc);
}

/** @param {import('mysql2/promise').Connection | import('./lib/mysql-vilareal.mjs').DockerMysqlAdapter} conn */
async function resolverProcessoIds(conn, pares) {
  /** @type {Array<{ cod: number, proc: number, processoId: number }>} */
  const out = [];
  const faltantes = [];
  for (const { cod, proc } of pares) {
    const cod8 = formatCod8(cod);
    const [rows] = await conn.query(
      `SELECT p.id AS processoId
       FROM processo p
       INNER JOIN cliente c ON c.pessoa_id = p.pessoa_id
       WHERE c.codigo_cliente = ? AND p.numero_interno = ?
       LIMIT 1`,
      [cod8, proc]
    );
    const id = Number(rows[0]?.processoId);
    if (Number.isFinite(id) && id >= 1) out.push({ cod, proc, processoId: id });
    else faltantes.push({ cod, proc });
  }
  return { resolvidos: out, faltantes };
}

/** @param {import('mysql2/promise').Connection | import('./lib/mysql-vilareal.mjs').DockerMysqlAdapter} conn */
async function zerarHistoricoProcessos(conn, processoIds, dryRun) {
  if (processoIds.length === 0) return { andamentos: 0, prazos: 0 };
  const placeholders = processoIds.map(() => '?').join(',');

  const [cntRows] = await conn.query(
    `SELECT COUNT(*) AS n FROM processo_andamento WHERE processo_id IN (${placeholders})`,
    processoIds
  );
  const nAnd = Number(cntRows[0]?.n ?? 0);

  const [cntPrazo] = await conn.query(
    `SELECT COUNT(*) AS n FROM processo_prazo WHERE andamento_id IN (
       SELECT id FROM processo_andamento WHERE processo_id IN (${placeholders})
     )`,
    processoIds
  );
  const nPrazo = Number(cntPrazo[0]?.n ?? 0);

  if (dryRun) return { andamentos: nAnd, prazos: nPrazo };

  await conn.query(
    `UPDATE processo_prazo SET andamento_id = NULL
     WHERE andamento_id IN (SELECT id FROM processo_andamento WHERE processo_id IN (${placeholders}))`,
    processoIds
  );
  const [del] = await conn.query(
    `DELETE FROM processo_andamento WHERE processo_id IN (${placeholders})`,
    processoIds
  );
  return { andamentos: del.affectedRows ?? nAnd, prazos: nPrazo };
}

function executarImportReal(opts, cod, proc) {
  const args = [
    SCRIPT_IMPORT_REAL,
    `--cliente=${cod}`,
    `--processo=${proc}`,
    '--aplicar',
    '--sem-corrigir-historico',
  ];
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  const r = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA');
    process.exit(1);
  }

  console.log('\n=== zerar-e-reimportar-consultas-realizadas ===\n');
  console.log(`Data: ${opts.data}`);
  console.log(`Modo: ${opts.aplicar ? 'aplicar' : 'dry-run'}`);
  console.log(`API: ${opts.baseUrl}\n`);

  const dataBr = resolverAliasHojeEmTexto(opts.data, 'br') ?? opts.data;
  const listaPath = opts.lista ?? listaPadraoPath(dataBr);

  let pares = [];
  let linhasDiag = 0;

  if (opts.lista || (opts.somenteImportar && fs.existsSync(listaPath))) {
    pares = carregarListaArquivo(opts.lista ?? listaPath);
    console.log(`Lista: ${opts.lista ?? listaPath}`);
  } else {
    const token = await login(opts);
    const { data: dataBrApi, rows } = await listarConsultasRealizadas(opts, token);
    linhasDiag = rows.length;
    pares = paresUnicosProcessos(rows, dataBrApi);
    if (pares.length > 0) {
      gravarListaArquivo(listaPath, dataBrApi, pares, 'api/historico-data');
      console.log(`Lista gravada: ${listaPath}`);
    }
  }

  if (opts.limite > 0) pares = pares.slice(0, opts.limite);

  console.log(`Linhas diagnóstico: ${linhasDiag}`);
  console.log(`Processos únicos (${dataBr}): ${pares.length}\n`);

  if (pares.length === 0) {
    console.error(
      'Nenhum processo na lista. Obtenha a lista antes de zerar (API) ou use --lista=tmp/consultas-realizadas-lista-….json'
    );
    process.exit(2);
  }

  const conn = await conectarMysqlVilareal();
  const logPath = path.join(ROOT, 'tmp/zerar-reimportar-consultas-realizadas.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logPath, msg + '\n');
  };
  fs.writeFileSync(
    logPath,
    `=== ${new Date().toISOString()} data=${dataBr} processos=${pares.length} aplicar=${opts.aplicar} ===\n`
  );

  try {
    const { resolvidos, faltantes } = await resolverProcessoIds(conn, pares);
    if (faltantes.length) {
      log(`[aviso] ${faltantes.length} par(es) sem processo na base — ignorados na etapa zerar`);
      for (const f of faltantes.slice(0, 20)) log(`  cliente ${f.cod} proc ${f.proc}`);
      if (faltantes.length > 20) log('  …');
    }

    const processoIds = resolvidos.map((r) => r.processoId);

    if (!opts.somenteImportar) {
      log('\n--- Etapa 1: zerar histórico ---\n');
      const z = await zerarHistoricoProcessos(conn, processoIds, !opts.aplicar);
      log(
        opts.aplicar
          ? `Andamentos apagados: ${z.andamentos} (${processoIds.length} processo(s))`
          : `[dry-run] Andamentos a apagar: ${z.andamentos} (${processoIds.length} processo(s))`
      );
    }

    if (!opts.somenteZerar) {
      log('\n--- Etapa 2: import-real ---\n');
      const totais = { ok: 0, falha: 0 };
      const alvo = resolvidos.map(({ cod, proc }) => ({ cod, proc }));

      for (let i = 0; i < alvo.length; i += 1) {
        const { cod, proc } = alvo[i];
        log(`\n[${i + 1}/${alvo.length}] import-real cliente ${cod} processo ${proc}`);
        if (!opts.aplicar) {
          log('  (dry-run — omitido)');
          continue;
        }
        const { code, stdout, stderr } = executarImportReal(opts, cod, proc);
        const tail = (stdout + stderr).trim().split('\n').slice(-6).join('\n');
        if (tail) log(tail);
        if (code === 0) totais.ok += 1;
        else {
          totais.falha += 1;
          log(`  ERRO exit ${code}`);
        }
      }
      log(`\n=== import-real: ok=${totais.ok} falha=${totais.falha} ===`);
      if (opts.aplicar && totais.falha > 0) process.exit(2);
    }
  } finally {
    await conn.end();
  }

  log(`\nLog: ${logPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
