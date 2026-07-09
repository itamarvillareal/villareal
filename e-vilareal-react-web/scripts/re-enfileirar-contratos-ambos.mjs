#!/usr/bin/env node
/**
 * Re-enfileira PDFs importáveis do censo no localhost e na VPS, depois sincroniza heurística.
 *
 * Uso:
 *   node scripts/re-enfileirar-contratos-ambos.mjs
 *   node scripts/re-enfileirar-contratos-ambos.mjs --apenas-local
 *   node scripts/re-enfileirar-contratos-ambos.mjs --apenas-vps
 */
import './lib/load-vilareal-import-env.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';
import { VILAREAL_API_BASE_PROD } from './lib/vilareal-import-api-base.mjs';

const MANIFEST =
  'tmp/contratos-honorarios-inventario/extracao-carteira-1-999-importaveis-consolidado.json';
const REL = path.resolve('tmp/contratos-honorarios-inventario/relatorios');

function parseArgs(argv) {
  const out = { local: true, vps: true, login: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apenas-local') out.vps = false;
    else if (a === '--apenas-vps') out.local = false;
    else if (a === '--login') out.login = argv[++i];
  }
  return out;
}

async function resolverLogin(baseUrl, senha, preferido) {
  const candidatos = [preferido, process.env.VILAREAL_IMPORT_LOGIN, 'karla.pedroza', 'itamar'].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  for (const login of candidatos) {
    try {
      await loginImportApi(baseUrl, login, senha);
      return login;
    } catch {
      /* próximo */
    }
  }
  throw new Error(`Nenhum login funcionou em ${baseUrl}`);
}

function runNode(script, args) {
  console.error(`\n>>> node ${script} ${args.join(' ')}`);
  const r = spawnSync('node', [script, ...args], { stdio: 'inherit', cwd: process.cwd() });
  if (r.status !== 0) throw new Error(`${script} exit ${r.status}`);
}

async function resumoFila(baseUrl, token) {
  const h = { Authorization: `Bearer ${token}` };
  const porStatus = {};
  for (const st of ['', 'EM_REVISAO', 'EXTRAIDO', 'AGUARDANDO_EXTRACAO', 'APROVADO']) {
    const qs = st ? `?status=${st}&page=0&size=1` : '?page=0&size=1';
    const r = await fetch(`${baseUrl}/api/documentos/contratos-honorarios/importar/fila${qs}`, { headers: h });
    const j = await r.json();
    porStatus[st || 'TOTAL'] = j.totalElements ?? '?';
  }
  return porStatus;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const senha = process.env.VILAREAL_IMPORT_SENHA;
  if (!senha) throw new Error('Defina VILAREAL_IMPORT_SENHA em .env.import.local');

  const alvos = [];
  if (opts.local) alvos.push({ nome: 'local', baseUrl: 'http://localhost:8080', saida: 'fila-importacao-replay-local.json' });
  if (opts.vps) alvos.push({ nome: 'vps', baseUrl: VILAREAL_API_BASE_PROD, saida: 'fila-importacao-replay-vps.json' });

  const resumos = [];

  for (const alvo of alvos) {
    const login = await resolverLogin(alvo.baseUrl, senha, opts.login);
    console.error(`\n========== ${alvo.nome.toUpperCase()} (${alvo.baseUrl}) login=${login} ==========`);
    const senhaArg = ['--senha', senha];
    runNode('scripts/enfileirar-contratos-honorarios-carteira.mjs', [
      `--manifest=${MANIFEST}`,
      '--incluir-parcial',
      `--base-url=${alvo.baseUrl}`,
      `--login=${login}`,
      ...senhaArg,
      `--saida=tmp/contratos-honorarios-inventario/${alvo.saida}`,
      '--batch-size=15',
    ]);
    runNode('scripts/sincronizar-extracao-heuristica-estatica.mjs', [
      `--base-url=${alvo.baseUrl}`,
      `--login=${login}`,
      ...senhaArg,
    ]);
    const token = await loginImportApi(alvo.baseUrl, login, senha);
    const fila = await resumoFila(alvo.baseUrl, token);
    resumos.push({ alvo: alvo.nome, baseUrl: alvo.baseUrl, fila, geradoEm: new Date().toISOString() });
  }

  fs.mkdirSync(REL, { recursive: true });
  const outPath = path.join(REL, '60-re-enfileiramento-ambos-resumo.json');
  fs.writeFileSync(outPath, JSON.stringify({ geradoEm: new Date().toISOString(), resumos }, null, 2));
  console.error('\n=== Resumo final ===');
  console.error(JSON.stringify(resumos, null, 2));
  console.error(`\nSalvo: ${outPath}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
