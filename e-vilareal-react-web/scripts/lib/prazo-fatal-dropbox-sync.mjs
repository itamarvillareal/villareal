/**
 * Sincronização fidedigna: Gerais/145.1 (Dropbox) → API (MySQL via backend).
 *
 * Regra de deduplicação (legado): um par cliente+processo; vence o ficheiro na pasta ano/mês mais recente.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BASE_GERAIS_145_1 } from './gerais-145-1-prazo-fatal.mjs';
import { levantarPrazosFatais145_1 } from './levantar-prazos-fatais-145-1.mjs';
import {
  aplicarPrazoFatalNaApi,
  loginImportApi,
  normalizarDataApi,
} from './prazo-fatal-api.mjs';
import { buscarProcesso } from './vilareal-import-processo-api.mjs';

const ANO_ATUAL = new Date().getFullYear();

/**
 * @param {string[]} argv
 */
export function parsePrazoFatalDropboxArgs(argv) {
  const out = {
    base: DEFAULT_BASE_GERAIS_145_1,
    dryRun: true,
    aplicar: false,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    clienteFiltro: null,
    anoMin: 2017,
    anoMax: ANO_ATUAL + 1,
    apenasDiferentes: false,
    relatorio: null,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8081').replace(/\/$/, ''),
    concurrency: Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY) || 5),
    verificarApi: true,
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--apenas-diferentes') out.apenasDiferentes = true;
    else if (a === '--sem-verificar-api') out.verificarApi = false;
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--ano-min=')) out.anoMin = Number(a.slice(10)) || 2017;
    else if (a.startsWith('--ano-max=')) out.anoMax = Number(a.slice(10)) || ANO_ATUAL + 1;
    else if (a.startsWith('--concurrency=')) out.concurrency = Math.max(1, Number(a.slice(14)) || 5);
  }

  if (!out.relatorio) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    out.relatorio = path.join('tmp', `relatorio-prazos-fatais-${stamp}.json`);
  }

  return out;
}

/**
 * @param {string} baseUrl
 */
export async function verificarApiDisponivel(baseUrl) {
  const res = await fetch(`${baseUrl}/actuator/health`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Backend indisponível em ${baseUrl} (health ${res.status})`);
  }
}

async function runPool(items, concurrency, fn) {
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

/**
 * @param {ReturnType<typeof parsePrazoFatalDropboxArgs>} opts
 */
export async function sincronizarPrazosFataisDropbox(opts) {
  if (!fs.existsSync(opts.base)) {
    throw new Error(`Pasta Dropbox não encontrada: ${opts.base}`);
  }

  if (opts.verificarApi && !opts.dryRun) {
    await verificarApiDisponivel(opts.baseUrl);
  }

  const { registos, stats: levantamento } = levantarPrazosFatais145_1(opts.base, {
    anoMin: opts.anoMin,
    anoMax: opts.anoMax,
    clienteFiltro: opts.clienteFiltro,
  });

  const stats = {
    ...levantamento,
    ok: 0,
    puladosIguais: 0,
    semProcesso: 0,
    falhas: 0,
  };

  /** @type {object[]} */
  const detalhes = [];
  const amostra = registos.slice(0, 15);

  let token = null;
  if (!opts.dryRun) {
    if (!opts.senha) {
      throw new Error('Defina VILAREAL_IMPORT_SENHA (ou ~/.vilareal-import-env) ou use --senha=');
    }
    token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  }

  const pessoaPorCod8 = new Map();

  await runPool(registos, opts.dryRun ? 1 : opts.concurrency, async (reg) => {
    const linha = {
      cod8: reg.cod8,
      numeroInterno: reg.numeroInterno,
      prazoFatal: reg.prazoFatalIso,
      arquivo: reg.relPath,
    };

    if (opts.dryRun) {
      stats.ok += 1;
      linha.acao = 'dry-run';
      if (detalhes.length < 50_000) detalhes.push(linha);
      return;
    }

    try {
      const proc = await buscarProcesso(
        opts.baseUrl,
        token,
        reg.cod8,
        reg.numeroInterno,
        pessoaPorCod8,
      );
      if (!proc?.id) {
        stats.semProcesso += 1;
        linha.acao = 'sem_processo';
        detalhes.push(linha);
        return;
      }

      const atual = normalizarDataApi(proc.prazoFatal);
      if (opts.apenasDiferentes && atual === reg.prazoFatalIso) {
        stats.puladosIguais += 1;
        linha.acao = 'pulado_igual';
        linha.prazoAnterior = atual;
        detalhes.push(linha);
        return;
      }

      await aplicarPrazoFatalNaApi(opts.baseUrl, token, proc, reg.prazoFatalIso);
      stats.ok += 1;
      linha.acao = atual === reg.prazoFatalIso ? 'confirmado_igual' : atual ? 'atualizado' : 'gravado';
      linha.prazoAnterior = atual;
      linha.processoId = proc.id;
      detalhes.push(linha);
    } catch (e) {
      stats.falhas += 1;
      linha.acao = 'falha';
      linha.erro = String(e?.message ?? e).slice(0, 300);
      detalhes.push(linha);
    }
  });

  const payload = {
    geradoEm: new Date().toISOString(),
    modo: opts.dryRun ? 'dry-run' : 'aplicar',
    baseDropbox: opts.base,
    baseApi: opts.baseUrl,
    stats,
    amostra,
    detalhes,
  };

  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, JSON.stringify(payload, null, 2), 'utf8');

  return { payload, opts };
}

/**
 * @param {ReturnType<typeof sincronizarPrazosFataisDropbox>} result
 */
export function imprimirResumoPrazoFatalSync({ payload, opts }) {
  const { stats } = payload;
  console.log('\n=== Sincronização prazos fatais (Dropbox Gerais/145.1 → API) ===');
  console.log(`Dropbox: ${opts.base}`);
  console.log(`API:     ${opts.baseUrl}`);
  console.log(`Modo:    ${opts.dryRun ? 'pré-visualização (dry-run)' : 'aplicar na base'}`);
  console.log('');
  console.log(`Ficheiros .txt na árvore:     ${stats.ficheirosTxt}`);
  console.log(`Com data válida:            ${stats.dataValida}`);
  console.log(`Registos únicos (cli+proc): ${stats.registosUnicos}`);
  console.log(`Duplicados (pasta recente): ${stats.duplicadosDescartados}`);
  console.log(`Nomes inválidos:            ${stats.nomeInvalido}`);
  console.log(`Datas inválidas/vazias:     ${stats.dataInvalida}`);
  console.log('');
  console.log('--- Resultado ---');
  if (opts.dryRun) {
    console.log(`  Processos que seriam alinhados: ${stats.ok}`);
  } else {
    console.log(`  Gravados/atualizados na API:    ${stats.ok}`);
    console.log(`  Já iguais (pulados):            ${stats.puladosIguais}`);
    console.log(`  Sem processo na API:            ${stats.semProcesso}`);
    console.log(`  Falhas:                         ${stats.falhas}`);
  }
  console.log('\nAmostra (15 primeiros no Dropbox):');
  for (const a of payload.amostra) {
    console.log(`  ${a.cod8} proc ${a.numeroInterno} → ${a.prazoFatalIso}  (${a.relPath})`);
  }
  console.log(`\nRelatório completo: ${opts.relatorio}\n`);
}

/**
 * @param {string[]} argv
 */
export async function runPrazoFatalDropboxCli(argv) {
  const opts = parsePrazoFatalDropboxArgs(argv);
  const result = await sincronizarPrazosFataisDropbox(opts);
  imprimirResumoPrazoFatalSync(result);
  if (!opts.dryRun && result.payload.stats.falhas > 0) {
    process.exitCode = 2;
  }
}
