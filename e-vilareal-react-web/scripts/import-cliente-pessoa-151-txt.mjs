#!/usr/bin/env node
/**
 * Sincroniza o campo **Pessoa** do cadastro Clientes a partir de `Gerais/…/{cod8}.151.1.0.txt`.
 * Não altera partes de processo (90/95) — use `import-processo-partes-txt.mjs`.
 *
 * Uso:
 *   node scripts/import-cliente-pessoa-151-txt.mjs --cliente=257 --dry-run
 *   node scripts/import-cliente-pessoa-151-txt.mjs --cliente=257 --aplicar
 *   node scripts/import-cliente-pessoa-151-txt.mjs --cliente-min=1 --cliente-max=10 --aplicar
 *   node scripts/import-cliente-pessoa-151-txt.mjs --cliente-min=1 --cliente-max=999 --aplicar --substituir
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
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';

function parseArgs(argv) {
  const out = {
    cliente: null,
    clienteMin: null,
    clienteMax: null,
    aplicar: false,
    substituir: false,
    base: resolverBaseBancoDados(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a === '--substituir') out.substituir = true;
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
  if (opts.substituir) console.log('Substituir vínculo divergente: sim (UPDATE cliente.pessoa_id)');
  console.log(`Clientes: ${clientes[0]}..${clientes[clientes.length - 1]} (${clientes.length})\n`);

  if (opts.substituir && !opts.aplicar) {
    console.error('--substituir requer --aplicar');
    process.exit(1);
  }

  let token = null;
  /** @type {import('mysql2/promise').Connection | null} */
  let conn = null;
  if (opts.aplicar) {
    token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
    if (opts.substituir) conn = await conectarMysqlVilareal();
  }

  const cache = new Map();
  let ok = 0;
  let semTxt = 0;
  let divergentes = 0;
  let atualizados = 0;
  let pessoaInexistente = 0;
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
        cache,
        { substituir: opts.substituir, conn: conn ?? undefined }
      );
      if (r.acao === 'divergente_api') {
        divergentes += 1;
        console.warn(
          `cliente ${codNum}: divergente — API pessoa ${r.pessoaIdApi}, txt ${r.pessoaIdTxt}`
        );
      } else if (r.acao === 'atualizado_mysql') {
        atualizados += 1;
        ok += 1;
        const m = r.migracao;
        const migLog = m
          ? `; processos=${m.processosMigrados ?? 0} conflitos=${m.processosConflito ?? 0}`
          : '';
        console.log(
          `cliente ${codNum}: atualizado pessoaId ${r.pessoaIdAnterior} → ${txt.pessoaId}${migLog}`
        );
      } else if (r.acao === 'pessoa_inexistente') {
        pessoaInexistente += 1;
        console.warn(`cliente ${codNum}: pessoa ${txt.pessoaId} não existe na base`);
      } else if (r.acao === 'sem_linha_cliente' || r.acao === 'rejeitado') {
        falhas += 1;
        console.warn(`cliente ${codNum}: ${r.acao} pessoaId=${txt.pessoaId}${r.detalhe ? ` — ${r.detalhe}` : ''}`);
      } else {
        ok += 1;
        console.log(`cliente ${codNum}: ${r.acao} pessoaId=${txt.pessoaId}`);
      }
    } catch (e) {
      falhas += 1;
      console.error(`cliente ${codNum}: falha — ${e?.message || e}`);
    }
  }

  if (conn) await conn.end();

  console.log(
    `\n=== concluído === ok=${ok} atualizados=${atualizados} sem_txt=${semTxt} divergentes=${divergentes} pessoa_inexistente=${pessoaInexistente} falhas=${falhas}\n`
  );
  process.exit(falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
