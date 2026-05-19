#!/usr/bin/env node
/**
 * Sincroniza o campo **Pessoa** do cadastro Clientes a partir de `Gerais/…/{cod8}.151.1.0.txt`.
 * Não altera partes de processo (90/95) — use `import-processo-partes-txt.mjs`.
 *
 * Uso:
 *   node scripts/import-cliente-pessoa-151-txt.mjs --cliente=257 --dry-run
 *   node scripts/import-cliente-pessoa-151-txt.mjs --cliente=257 --aplicar
 *   node scripts/import-cliente-pessoa-151-txt.mjs --cliente-min=1 --cliente-max=10 --aplicar
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';

import {
  lerNumeroPessoaCliente151Txt,
  sincronizarVinculoClientePessoaApi,
} from './lib/cliente-pessoa-151-txt.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';
import { TXT_PESSOA_CLIENTE_CADASTRO } from './lib/legado-pessoa-cliente-vs-partes-processo.mjs';
import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';

function parseArgs(argv) {
  const out = {
    cliente: null,
    clienteMin: null,
    clienteMax: null,
    aplicar: false,
    base: resolverBaseBancoDados(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.cliente = Math.trunc(n);
    } else if (a.startsWith('--cliente-min=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.clienteMin = Math.trunc(n);
    } else if (a.startsWith('--cliente-max=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.clienteMax = Math.trunc(n);
    } else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
  }
  return out;
}

function listarClientes(opts) {
  if (opts.cliente != null) return [opts.cliente];
  const min = opts.clienteMin ?? 1;
  const max = opts.clienteMax ?? min;
  const out = [];
  for (let c = min; c <= max; c += 1) out.push(c);
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const clientes = listarClientes(opts);

  if (clientes.length === 0) {
    console.error(
      'Uso: node scripts/import-cliente-pessoa-151-txt.mjs --cliente=N | --cliente-min=N --cliente-max=M [--aplicar]'
    );
    process.exit(1);
  }

  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha= para --aplicar');
    process.exit(1);
  }

  console.log('\n=== import-cliente-pessoa-151-txt ===\n');
  console.log(`Modo: ${opts.aplicar ? 'aplicar' : 'dry-run'}`);
  console.log(`Clientes: ${clientes[0]}..${clientes[clientes.length - 1]} (${clientes.length})\n`);

  let token = null;
  if (opts.aplicar) token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);

  const cache = new Map();
  let ok = 0;
  let semTxt = 0;
  let divergentes = 0;
  let falhas = 0;

  for (const codNum of clientes) {
    const cod8 = formatCod8(codNum);
    const txt = lerNumeroPessoaCliente151Txt(codNum, { baseBanco: opts.base });

    if (!txt.pessoaId) {
      semTxt += 1;
      console.log(
        `cliente ${codNum}: sem ${TXT_PESSOA_CLIENTE_CADASTRO} válido${txt.arquivo ? ` (${txt.aviso || 'vazio'})` : ''}`
      );
      continue;
    }

    if (!opts.aplicar) {
      console.log(`cliente ${codNum} (${cod8}): dry-run pessoaId=${txt.pessoaId} ← ${txt.arquivo}`);
      ok += 1;
      continue;
    }

    try {
      const r = await sincronizarVinculoClientePessoaApi(
        opts.baseUrl,
        token,
        cod8,
        txt.pessoaId,
        cache
      );
      if (r.acao === 'divergente_api') {
        divergentes += 1;
        console.warn(
          `cliente ${codNum}: divergente — API pessoa ${r.pessoaIdApi}, txt ${r.pessoaIdTxt}`
        );
      } else {
        ok += 1;
        console.log(`cliente ${codNum}: ${r.acao} pessoaId=${txt.pessoaId}`);
      }
    } catch (e) {
      falhas += 1;
      console.error(`cliente ${codNum}: falha — ${e?.message || e}`);
    }
  }

  console.log(
    `\n=== concluído === ok=${ok} sem_txt=${semTxt} divergentes=${divergentes} falhas=${falhas}\n`
  );
  process.exit(falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
