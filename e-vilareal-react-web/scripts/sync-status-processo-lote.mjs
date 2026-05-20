#!/usr/bin/env node
/**
 * Sincroniza Status.Processo (ativo/inativo) para uma lista de clientes.
 * Uso: node scripts/sync-status-processo-lote.mjs --lista=tmp/status-sync-clientes-hoje.txt
 */
import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { sincronizarStatusProcessoImportReal } from './lib/sincronizar-status-processo-import-real.mjs';
import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';

function parseArgs(argv) {
  const out = {
    lista: null,
    resumo: 'tmp/sync-status-processo-lote-summary.jsonl',
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    base: resolverBaseBancoDados(),
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8081').replace(/\/$/, ''),
    dryRun: false,
    inicio: 0,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--lista=')) out.lista = path.resolve(a.slice(8));
    else if (a.startsWith('--resumo=')) out.resumo = path.resolve(a.slice(9));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--inicio=')) {
      const n = Number(a.slice(9));
      if (Number.isFinite(n) && n >= 0) out.inicio = Math.trunc(n);
    }
  }
  return out;
}

function carregarClientes(listaPath) {
  return fs
    .readFileSync(listaPath, 'utf8')
    .split(/[\s,;]+/)
    .map((x) => Math.trunc(Number(x.replace(/\D/g, ''))))
    .filter((n) => Number.isFinite(n) && n >= 1);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.lista || !fs.existsSync(opts.lista)) {
    console.error('Uso: node scripts/sync-status-processo-lote.mjs --lista=path [--dry-run]');
    process.exit(1);
  }
  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA para aplicar');
    process.exit(1);
  }

  const todos = [...new Set(carregarClientes(opts.lista))].sort((a, b) => a - b);
  const clientes = todos.slice(opts.inicio);

  console.log(`\n=== sync Status.Processo — ${clientes.length} cliente(s) ===\n`);
  console.log(`Lista: ${opts.lista}`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'aplicar'}\n`);

  const token = opts.dryRun ? null : await loginImportApi(opts.baseUrl, opts.login, opts.senha);

  let ok = 0;
  let fail = 0;
  const totais = {
    txtStatus: 0,
    aplicados: 0,
    pulados_igual: 0,
    sem_processo_api: 0,
    inativos: 0,
    falhas: 0,
  };

  fs.mkdirSync(path.dirname(opts.resumo), { recursive: true });
  fs.writeFileSync(opts.resumo, '', 'utf8');

  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    const n = opts.inicio + i + 1;
    process.stdout.write(`[${n}/${todos.length}] cliente ${c} … `);
    try {
      const st = await sincronizarStatusProcessoImportReal(
        {
          cliente: c,
          base: opts.base,
          login: opts.login,
          senha: opts.senha,
          dryRun: opts.dryRun,
        },
        { baseUrl: opts.baseUrl, token }
      );
      totais.txtStatus += st.txtStatus;
      totais.aplicados += st.aplicados;
      totais.pulados_igual += st.pulados_igual;
      totais.sem_processo_api += st.sem_processo_api;
      totais.inativos += st.inativos;
      totais.falhas += st.falhas;
      const linha = {
        cliente: c,
        ok: st.falhas === 0,
        ...st,
        ts: new Date().toISOString(),
      };
      fs.appendFileSync(opts.resumo, `${JSON.stringify(linha)}\n`, 'utf8');
      if (st.falhas > 0) {
        fail += 1;
        console.log(`falhas=${st.falhas} aplicados=${st.aplicados}/${st.txtStatus}`);
      } else {
        ok += 1;
        console.log(`ok txt=${st.txtStatus} aplicados=${st.aplicados} pulados=${st.pulados_igual}`);
      }
    } catch (e) {
      fail += 1;
      console.log(`ERRO ${e?.message || e}`);
      fs.appendFileSync(
        opts.resumo,
        `${JSON.stringify({ cliente: c, ok: false, erro: e?.message || String(e), ts: new Date().toISOString() })}\n`,
        'utf8'
      );
    }
  }

  console.log('\n=== concluído ===');
  console.log(`Clientes: ok=${ok} falha=${fail}`);
  console.log(
    `Totais: txt=${totais.txtStatus} aplicados=${totais.aplicados} pulados=${totais.pulados_igual} sem_api=${totais.sem_processo_api} inativos_txt=${totais.inativos} falhas=${totais.falhas}`
  );
  console.log(`Resumo: ${opts.resumo}\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
