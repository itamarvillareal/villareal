#!/usr/bin/env node
/**
 * Atualização do cadastro completo via `import-real` (1..999 clientes).
 *
 * Por cliente o import-real sincroniza:
 *   pessoa 151.1.0 → histórico → status → cabeçalho/fase/imóvel → partes 90/95 → cálculos
 *
 * Uso:
 *   node scripts/import-real-cadastro-completo.mjs --dry-run
 *   node scripts/import-real-cadastro-completo.mjs --aplicar
 *   node scripts/import-real-cadastro-completo.mjs --aplicar --retomar
 *   node scripts/import-real-cadastro-completo.mjs --aplicar --retomar --pular-clientes=728
 *   node scripts/import-real-cadastro-completo.mjs --aplicar --zerar --substituir-historico
 *
 * Credenciais: `.env.import.local`
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { resolverBaseUrlImport } from './lib/vilareal-import-api-base.mjs';
import { listarProcessosDropboxCliente } from './lib/processos-dropbox-cliente.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import {
  formatCod8,
  formatProcNomeArquivo,
  lerMaxIndiceHistorico,
} from './lib/historico-local-txt-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_IMPORT_REAL = path.join(__dirname, 'import-real.mjs');
const PROGRESSO_PADRAO = path.join(process.cwd(), 'tmp/import-real-cadastro-progress.jsonl');
const RELATORIO_PADRAO = path.join(process.cwd(), 'tmp/import-real-cadastro-relatorio.json');

function parseArgs(argv) {
  const out = {
    base: resolverBaseBancoDados(),
    baseUrl: resolverBaseUrlImport(),
    clienteMin: 1,
    clienteMax: 999,
    dryRun: true,
    aplicar: false,
    retomar: false,
    zerar: false,
    substituirHistorico: false,
    progresso: PROGRESSO_PADRAO,
    relatorio: RELATORIO_PADRAO,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    pularClientes: new Set(),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--retomar') out.retomar = true;
    else if (a === '--zerar') out.zerar = true;
    else if (a === '--substituir-historico') out.substituirHistorico = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max=')) {
      out.clienteMax = Math.min(999, Number(a.slice(14)) || 999);
    } else if (a.startsWith('--progresso=')) out.progresso = path.resolve(a.slice(12));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--pular-clientes=')) {
      for (const parte of a.slice(17).split(',')) {
        const n = Number(parte.trim());
        if (Number.isFinite(n) && n >= 1) out.pularClientes.add(n);
      }
    } else if (a.startsWith('--pular-cliente=')) {
      const n = Number(a.slice(15));
      if (Number.isFinite(n) && n >= 1) out.pularClientes.add(n);
    }
  }
  if (out.clienteMin > out.clienteMax) {
    const t = out.clienteMin;
    out.clienteMin = out.clienteMax;
    out.clienteMax = t;
  }
  return out;
}

function lerClientesTratados(progressoPath) {
  if (!fs.existsSync(progressoPath)) return new Set();
  const done = new Set();
  for (const line of fs.readFileSync(progressoPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (j?.cliente != null && (j?.status === 'ok' || j?.status === 'skip')) {
        done.add(Number(j.cliente));
      }
    } catch {
      /* skip */
    }
  }
  return done;
}

function appendProgresso(progressoPath, row) {
  fs.mkdirSync(path.dirname(progressoPath), { recursive: true });
  fs.appendFileSync(progressoPath, `${JSON.stringify(row)}\n`, 'utf8');
}

function clienteTemDadosDropbox(base, cliente) {
  return listarProcessosDropboxCliente(base, cliente).length > 0;
}

function executarImportRealCliente(opts, cliente) {
  const args = [
    SCRIPT_IMPORT_REAL,
    `--cliente=${cliente}`,
    `--base=${opts.base}`,
    `--base-url=${opts.baseUrl}`,
    `--login=${opts.login}`,
    '--continuar-apesar-falhas',
    '--sem-verificacao',
  ];
  if (opts.zerar) args.push('--zerar');
  else args.push('--sem-zerar');
  if (opts.substituirHistorico) args.push('--substituir-historico');
  if (opts.dryRun) args.push('--dry-run');
  else args.push('--aplicar');
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  return r.status ?? 1;
}

async function verificarGapsHistoricoMysql(base) {
  const conn = await conectarMysqlVilareal();
  try {
    const [rows] = await conn.query(
      `SELECT CAST(TRIM(LEADING '0' FROM c.codigo_cliente) AS UNSIGNED) AS cliente,
              p.numero_interno AS proc,
              (SELECT COUNT(*) FROM processo_andamento pa WHERE pa.processo_id = p.id) AS qtd
       FROM processo p
       INNER JOIN cliente c ON c.id = p.cliente_id
       ORDER BY cliente, proc`
    );
    /** @type {{ cliente: number, proc: number, txtIndice: number }[]} */
    const faltantes = [];
    let comTxt = 0;
    let comTxtSemMysql = 0;
    let comMysql = 0;
    for (const r of rows) {
      const cliente = Number(r.cliente);
      const proc = Number(r.proc);
      const qtd = Number(r.qtd ?? 0);
      const procStr = formatProcNomeArquivo(proc);
      if (!procStr) continue;
      const txtIndice = lerMaxIndiceHistorico(base, formatCod8(cliente), cliente, procStr);
      if (!txtIndice || txtIndice < 1) continue;
      comTxt += 1;
      if (qtd > 0) comMysql += 1;
      else {
        comTxtSemMysql += 1;
        faltantes.push({ cliente, proc, txtIndice });
      }
    }
    return { comTxt, comMysql, comTxtSemMysql, faltantes };
  } finally {
    await conn.end();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const clientes = [];
  for (let c = opts.clienteMin; c <= opts.clienteMax; c += 1) {
    if (clienteTemDadosDropbox(opts.base, c)) clientes.push(c);
  }

  console.log('\n=== import-real-cadastro-completo ===\n');
  console.log(`Base Dropbox: ${opts.base}`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'aplicar'}`);
  console.log(`Clientes ${opts.clienteMin}–${opts.clienteMax} com dados Dropbox: ${clientes.length}`);
  console.log(
    `Política: ${opts.zerar ? 'zerar + realinhar' : 'atualizar (--sem-zerar)'} | histórico: ${
      opts.substituirHistorico ? 'substituir' : 'apenas novos'
    }`
  );
  console.log('Motor: import-real (pessoa + histórico + status + cabeçalho + partes + cálculos)\n');
  if (opts.pularClientes.size > 0) {
    console.log(`Pular clientes (fase 2): ${[...opts.pularClientes].sort((a, b) => a - b).join(', ')}\n`);
  }

  const concluidos = opts.retomar ? lerClientesTratados(opts.progresso) : new Set();
  if (!opts.retomar && opts.aplicar) {
    fs.mkdirSync(path.dirname(opts.progresso), { recursive: true });
    fs.writeFileSync(opts.progresso, '', 'utf8');
  }

  let ok = 0;
  let fail = 0;
  let skip = 0;
  const total = clientes.length;

  for (let i = 0; i < clientes.length; i += 1) {
    const cliente = clientes[i];
    if (opts.pularClientes.has(cliente) && !concluidos.has(cliente)) {
      skip += 1;
      concluidos.add(cliente);
      console.log(`[skip] cliente ${cliente} pulado (--pular-clientes; fase 2)`);
      if (opts.aplicar) {
        appendProgresso(opts.progresso, {
          cliente,
          status: 'skip',
          motivo: 'pular-clientes',
          ts: new Date().toISOString(),
        });
      }
      continue;
    }
    if (concluidos.has(cliente)) {
      skip += 1;
      console.log(`[skip] cliente ${cliente} já tratado`);
      continue;
    }
    console.log(`\n########## [${i + 1 - skip}/${total - concluidos.size}] Cliente ${cliente} ##########`);
    const t0 = Date.now();
    const code = executarImportRealCliente(opts, cliente);
    const dur = Math.round((Date.now() - t0) / 1000);
    const st = code === 0 ? 'ok' : 'fail';
    if (code === 0) ok += 1;
    else fail += 1;
    if (opts.aplicar) {
      appendProgresso(opts.progresso, {
        cliente,
        status: st,
        code,
        duracaoS: dur,
        ts: new Date().toISOString(),
      });
    }
    console.log(`[cliente ${cliente}] ${st.toUpperCase()} em ${dur}s (code=${code})`);
  }

  console.log(`\nClientes: ok=${ok} fail=${fail} skip=${skip} total=${total}`);

  if (!opts.dryRun) {
    console.log('\n=== Verificação final — histórico txt ↔ MySQL ===\n');
    const v = await verificarGapsHistoricoMysql(opts.base);
    console.log(`Processos com txt: ${v.comTxt}`);
    console.log(`Com histórico MySQL: ${v.comMysql}`);
    console.log(`Gaps (txt sem MySQL): ${v.comTxtSemMysql}`);

    const rel = {
      ts: new Date().toISOString(),
      clientes: { ok, fail, skip, total },
      verificacaoHistorico: v,
    };
    fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
    fs.writeFileSync(opts.relatorio, JSON.stringify(rel, null, 2), 'utf8');
    console.log(`\nRelatório: ${opts.relatorio}`);
    console.log(`Progresso: ${opts.progresso}`);

    if (fail > 0 || v.comTxtSemMysql > 0) {
      process.exit(fail > 0 ? 1 : 2);
    }
    console.log('\n✓ Cadastro atualizado via import-real.\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
