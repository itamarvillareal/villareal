#!/usr/bin/env node
/**
 * Importa **partes do processo** (várias pessoas por par cliente × proc) a partir de Proc/1000/…
 *
 * Fontes (VBA «Processos»):
 *   - {cod8}.90.{proc}.{NN} — slot parte cliente no formulário VBA
 *   - {cod8}.95.{proc}.{NN} — slot parte oposta
 *   - {cod8}.91.{proc}.{NN} — índice endereço (qualificação)
 *   Polo jurídico na API: `REQUERENTE` → 90=AUTOR, 95=REU; `REQUERIDO` → 90=REU, 95=AUTOR
 *
 * **Não** importa:
 *   - `Gerais/…/{cod8}.151.1.0.txt` — pessoa do cadastro Clientes (`import-real` etapa 1)
 *   - Títulos `1.N` / `6.N` (só texto)
 *
 * Uso:
 *   node scripts/import-processo-partes-txt.mjs --cliente=257 --processo=37 --dry-run
 *   node scripts/import-processo-partes-txt.mjs --cliente=257 --aplicar --verbose
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { lerNumeroPessoaCliente151Txt } from './lib/cliente-pessoa-151-txt.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';
import { TXT_PESSOA_CLIENTE_CADASTRO } from './lib/legado-pessoa-cliente-vs-partes-processo.mjs';
import {
  lerPartesProcessoTxt,
  lerPapelClienteProcessoTxt,
  listarProcessosComPartesTxt,
} from './lib/proc-processo-partes-txt.mjs';
import { sincronizarPartesProcesso } from './lib/proc-processo-partes-api.mjs';
import {
  buscarProcesso,
  loginImportApi,
} from './lib/vilareal-import-processo-api.mjs';
import { resolverBaseUrlImport } from './lib/vilareal-import-api-base.mjs';

function parseArgs(argv) {
  const out = {
    cliente: null,
    processo: null,
    processoMin: null,
    processoMax: null,
    aplicar: false,
    verbose: false,
    base: resolverBaseBancoDados(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: resolverBaseUrlImport(),
    relatorio: null,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.cliente = Math.trunc(n);
    } else if (a.startsWith('--processo=')) {
      const n = Number(a.slice(11));
      if (Number.isFinite(n) && n >= 1) out.processo = Math.trunc(n);
    } else if (a.startsWith('--processo-min=')) {
      const n = Number(a.slice(15));
      if (Number.isFinite(n) && n >= 1) out.processoMin = Math.trunc(n);
    } else if (a.startsWith('--processo-max=')) {
      const n = Number(a.slice(15));
      if (Number.isFinite(n) && n >= 1) out.processoMax = Math.trunc(n);
    } else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
  }
  return out;
}

function filtrarProcs(procs, opts) {
  return procs.filter((p) => {
    if (opts.processo != null && p !== opts.processo) return false;
    if (opts.processoMin != null && p < opts.processoMin) return false;
    if (opts.processoMax != null && p > opts.processoMax) return false;
    return true;
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.cliente == null) {
    console.error('Uso: node scripts/import-processo-partes-txt.mjs --cliente=N [--processo=N] [--aplicar]');
    process.exit(1);
  }

  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha= para --aplicar');
    process.exit(1);
  }

  const cod8 = formatCod8(opts.cliente);
  const pessoaCadastro = lerNumeroPessoaCliente151Txt(opts.cliente, { baseBanco: opts.base });
  let procs = listarProcessosComPartesTxt(opts.base, opts.cliente);
  procs = filtrarProcs(procs, opts);

  console.log('\n=== import-processo-partes-txt ===\n');
  console.log(`Cliente: ${opts.cliente} (${cod8})`);
  console.log(`Base: ${opts.base}`);
  console.log(`Modo: ${opts.aplicar ? 'aplicar' : 'dry-run'}`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(
    `Pessoa cadastro Clientes (${TXT_PESSOA_CLIENTE_CADASTRO}): ${
      pessoaCadastro.pessoaId ?? '—'
    } — não importada por este script`
  );
  console.log(`Processos com ficheiros 90/95: ${procs.length}\n`);

  if (procs.length === 0) {
    console.log('Nenhum processo com ficheiros 90/95.');
    process.exit(0);
  }

  let token = null;
  if (opts.senha) token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);

  const totais = {
    processos: 0,
    criados: 0,
    atualizados: 0,
    iguais: 0,
    falhas: 0,
    orfaos: 0,
    semPartesTxt: 0,
    semPessoa: 0,
    verificacaoFalhas: 0,
  };

  /** @type {object[]} */
  const detalhes = [];

  for (const procNum of procs) {
    totais.processos += 1;
    const partes = lerPartesProcessoTxt(opts.base, opts.cliente, procNum);

    if (opts.verbose || opts.processo != null) {
      console.log(`\n——— processo ${procNum} (${partes.length} parte(s) 90/95) ———`);
      for (const p of partes) {
        console.log(
          `  lado ${p.ladoVba} ordem ${p.ordem} | pessoa=${p.pessoaId ?? '—'} | ${p.fontes.join(', ')}`
        );
      }
    }

    if (partes.length === 0) {
      totais.semPartesTxt += 1;
      continue;
    }

    if (!token) {
      detalhes.push({ procNum, partes: partes.length, acao: 'dry-run-sem-api' });
      totais.criados += partes.length;
      continue;
    }

    const proc = await buscarProcesso(opts.baseUrl, token, cod8, procNum);
    if (!proc?.id) {
      totais.orfaos += 1;
      console.warn(`[orfao] processo ${procNum} não encontrado na API`);
      continue;
    }

    const stats = await sincronizarPartesProcesso(
      opts,
      token,
      proc.id,
      partes,
      opts.aplicar,
      lerPapelClienteProcessoTxt(opts.base, opts.cliente, procNum) ?? proc.papelCliente ?? null
    );
    totais.criados += stats.criados + stats.dryRunCriar;
    totais.atualizados += stats.atualizados + stats.dryRunAtualizar;
    totais.iguais += stats.iguais;
    totais.falhas += stats.falhas;
    if (stats.puladosSemPessoa > 0) {
      totais.semPessoa += stats.puladosSemPessoa;
    }
    if (stats.verificacaoFalhas > 0) {
      totais.verificacaoFalhas += stats.verificacaoFalhas;
    }

    if (!opts.verbose) {
      const act =
        stats.criados + stats.dryRunCriar > 0 || stats.atualizados + stats.dryRunAtualizar > 0
          ? 'sync'
          : 'ok';
      if (act === 'sync' || opts.processo != null) {
        console.log(
          `proc ${procNum}: +${stats.criados + stats.dryRunCriar} ~${stats.atualizados + stats.dryRunAtualizar} =${stats.iguais} falhas=${stats.falhas}`
        );
      }
    }

    detalhes.push({ procNum, processoId: proc.id, partes: partes.length, stats });
  }

  const relatorio = {
    geradoEm: new Date().toISOString(),
    cliente: opts.cliente,
    cod8,
    pessoaCadastroClientes151: pessoaCadastro.pessoaId ?? null,
    modo: opts.aplicar ? 'aplicar' : 'dry-run',
    processos: procs.length,
    totais,
    detalhes,
  };

  if (opts.relatorio) {
    fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
    fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
    console.log(`\nRelatório: ${opts.relatorio}`);
  }

  console.log('\n=== concluído ===');
  console.log(
    `Processos: ${totais.processos} | criar: ${totais.criados} | actualizar: ${totais.atualizados} | iguais: ${totais.iguais} | falhas: ${totais.falhas} | sem pessoa: ${totais.semPessoa} | verificação: ${totais.verificacaoFalhas} | órfãos: ${totais.orfaos}\n`
  );

  if (totais.falhas > 0 || totais.verificacaoFalhas > 0) process.exit(2);
  if (totais.orfaos > 0 && opts.aplicar) process.exit(3);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
