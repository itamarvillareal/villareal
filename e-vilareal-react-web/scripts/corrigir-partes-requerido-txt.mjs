#!/usr/bin/env node
/**
 * Varre txt com `ClienteRequerenteOuRequerido=REQUERIDO` e ficheiros 90/95,
 * compara polos na API e corrige o mapeamento invertido do import legado.
 *
 * Uso:
 *   node scripts/corrigir-partes-requerido-txt.mjs --dry-run
 *   VILAREAL_IMPORT_SENHA='…' node scripts/corrigir-partes-requerido-txt.mjs --aplicar --verbose
 *
 * Opções:
 *   --cliente=N | --cliente-min=N | --cliente-max=N
 *   --base=PATH (Dropbox «Banco de Dados»)
 *   --base-url=URL
 *   --relatorio=PATH.json
 *   --concurrency=N
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  analisarCorrecoesPartesRequerido,
  aplicarCorrecoesPartesRequerido,
  listarRegistrosRequeridoComPartesTxt,
  slotVbaLabel,
} from './lib/corrigir-partes-requerido-txt.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { listarPartes } from './lib/proc-processo-partes-api.mjs';
import { buscarProcesso, loginImportApi } from './lib/vilareal-import-processo-api.mjs';
import { resolverBaseUrlImport } from './lib/vilareal-import-api-base.mjs';

function parseArgs(argv) {
  const out = {
    aplicar: false,
    verbose: false,
    cliente: null,
    clienteMin: null,
    clienteMax: null,
    base: resolverBaseBancoDados(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: resolverBaseUrlImport(),
    relatorio: null,
    concurrency: Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY) || 5),
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.cliente = Math.trunc(n);
    } else if (a.startsWith('--cliente-min=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.clienteMin = Math.trunc(n);
    } else if (a.startsWith('--cliente-max=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.clienteMax = Math.trunc(n);
    } else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--concurrency=')) {
      out.concurrency = Math.max(1, Number(a.slice(14)) || 5);
    }
  }
  return out;
}

function filtrarCliente(codNum, opts) {
  if (opts.cliente != null && codNum !== opts.cliente) return false;
  if (opts.clienteMin != null && codNum < opts.clienteMin) return false;
  if (opts.clienteMax != null && codNum > opts.clienteMax) return false;
  return true;
}

/**
 * @param {object[]} items
 * @param {number} concurrency
 * @param {(item: object) => Promise<void>} worker
 */
async function mapPool(items, concurrency, worker) {
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      await worker(items[i]);
    }
  }
  const n = Math.min(concurrency, items.length || 1);
  await Promise.all(Array.from({ length: n }, () => run()));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha= para --aplicar');
    process.exit(1);
  }
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha= para comparar/corrigir via API');
    process.exit(1);
  }

  const todos = listarRegistrosRequeridoComPartesTxt({
    baseBanco: opts.base,
    clienteFiltro: opts.cliente ?? null,
  });
  const registros = todos.filter((r) => filtrarCliente(r.codNum, opts));

  console.log('\n=== corrigir-partes-requerido-txt ===\n');
  console.log(`Base Dropbox: ${opts.base}`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(`Modo: ${opts.aplicar ? 'aplicar' : 'dry-run'}`);
  console.log(`Processos REQUERIDO com ficheiros 90/95: ${registros.length}\n`);

  if (registros.length === 0) {
    console.log('Nada a verificar.');
    process.exit(0);
  }

  let token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);

  const totais = {
    processos: 0,
    processosOk: 0,
    processosComCorrecao: 0,
    processosOrfaos: 0,
    partesOk: 0,
    invertidos: 0,
    criados: 0,
    duplicadosRemovidos: 0,
    dryRunInvertir: 0,
    dryRunCriar: 0,
    dryRunRemover: 0,
    falhas: 0,
  };

  /** @type {object[]} */
  const detalhes = [];

  await mapPool(registros, opts.concurrency, async (reg) => {
    totais.processos += 1;
    const linha = `${reg.cod8} proc ${reg.numeroInterno}`;

    if (!token) {
      totais.processosComCorrecao += 1;
      console.warn(
        `[sem API] ${linha} — defina VILAREAL_IMPORT_SENHA para comparar com a API (${reg.partes.length} parte(s) no txt)`
      );
      detalhes.push({
        cod8: reg.cod8,
        codNum: reg.codNum,
        numeroInterno: reg.numeroInterno,
        partesTxt: reg.partes.length,
        semApi: true,
      });
      return;
    }

    const proc = await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno);
    if (!proc?.id) {
      totais.processosOrfaos += 1;
      console.warn(`[orfao] ${linha} — processo não encontrado na API`);
      detalhes.push({
        cod8: reg.cod8,
        codNum: reg.codNum,
        numeroInterno: reg.numeroInterno,
        orfao: true,
      });
      return;
    }

    const partesApi = await listarPartes(opts.baseUrl, token, proc.id);
    const { correcoes, ok } = analisarCorrecoesPartesRequerido(reg.partes, partesApi);
    totais.partesOk += ok;

    if (correcoes.length === 0) {
      totais.processosOk += 1;
      if (opts.verbose) {
        console.log(`[ok] ${linha} — partes já corretas`);
      }
      return;
    }

    totais.processosComCorrecao += 1;
    if (!opts.verbose) {
      const resumo = correcoes
        .map(
          (c) =>
            `${slotVbaLabel(c.pt.ladoVba)} pessoa ${c.pt.pessoaId}: ${c.poloErrado}→${c.poloEsperado}`
        )
        .join('; ');
      console.log(`[corrigir] ${linha} — ${correcoes.length} parte(s): ${resumo}`);
    } else {
      console.log(`\n——— ${linha} (processoId=${proc.id}) ———`);
    }

    const stats = await aplicarCorrecoesPartesRequerido(
      opts,
      token,
      proc.id,
      reg.partes,
      correcoes,
      opts.aplicar
    );

    totais.invertidos += stats.invertidos;
    totais.criados += stats.criados;
    totais.duplicadosRemovidos += stats.duplicadosRemovidos;
    totais.dryRunInvertir += stats.dryRunInvertir;
    totais.dryRunCriar += stats.dryRunCriar;
    totais.dryRunRemover += stats.dryRunRemover;
    totais.falhas += stats.falhas;

    detalhes.push({
      cod8: reg.cod8,
      codNum: reg.codNum,
      numeroInterno: reg.numeroInterno,
      processoId: proc.id,
      correcoes: correcoes.map((c) => ({
        tipo: c.tipo,
        pessoaId: c.pt.pessoaId,
        ordem: c.bodyEsperado.ordem,
        slotVba: slotVbaLabel(c.pt.ladoVba),
        de: c.poloErrado,
        para: c.poloEsperado,
      })),
      stats,
    });
  });

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: opts.aplicar ? 'aplicar' : 'dry-run',
    base: opts.base,
    baseUrl: opts.baseUrl,
    filtros: {
      cliente: opts.cliente,
      clienteMin: opts.clienteMin,
      clienteMax: opts.clienteMax,
    },
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
    `Processos: ${totais.processos} | já ok: ${totais.processosOk} | com correção: ${totais.processosComCorrecao} | órfãos: ${totais.processosOrfaos}`
  );
  if (opts.aplicar) {
    console.log(
      `Aplicados: invertidos=${totais.invertidos} criados=${totais.criados} duplicados removidos=${totais.duplicadosRemovidos} falhas=${totais.falhas}`
    );
  } else {
    console.log(
      `Previsto (dry-run): inverter=${totais.dryRunInvertir} criar=${totais.dryRunCriar} remover=${totais.dryRunRemover}`
    );
  }
  console.log(`Partes já corretas (txt): ${totais.partesOk}\n`);

  if (totais.falhas > 0) process.exit(2);
  if (totais.processosOrfaos > 0 && opts.aplicar) process.exit(3);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
