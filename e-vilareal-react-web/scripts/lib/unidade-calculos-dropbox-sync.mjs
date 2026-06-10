/**
 * Sincronização: Calculos `0.88.*` → coluna `processo.unidade` (API ou MySQL directo).
 */

import fs from 'node:fs';
import path from 'node:path';
import { atualizarProcessoApi } from './import-processo-put-body.mjs';
import { loginImportApi } from './prazo-fatal-api.mjs';
import { conectarMysqlVilareal } from './mysql-vilareal.mjs';
import {
  DEFAULT_BASE_CALCULOS,
  levantarUnidadesCalculosDropbox,
  normalizarUnidadeTxt,
  resolverBaseCalculosUnidade,
} from './unidade-calculos-dropbox.mjs';
import { buscarProcesso } from './vilareal-import-processo-api.mjs';

/**
 * @param {string[]} argv
 */
export function parseUnidadeCalculosDropboxArgs(argv) {
  const out = {
    base: DEFAULT_BASE_CALCULOS,
    dryRun: true,
    aplicar: false,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    clienteFiltro: null,
    apenasDiferentes: false,
    relatorio: null,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    concurrency: Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY) || 5),
    verificarApi: true,
    viaMysql: false,
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--apenas-diferentes') out.apenasDiferentes = true;
    else if (a === '--sem-verificar-api') out.verificarApi = false;
    else if (a === '--mysql') out.viaMysql = true;
    else if (a.startsWith('--base=')) out.base = resolverBaseCalculosUnidade(a.slice(7));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--concurrency=')) {
      out.concurrency = Math.max(1, Number(a.slice(14)) || 5);
    }
  }

  out.base = resolverBaseCalculosUnidade(out.base);

  if (!out.relatorio) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    out.relatorio = path.join('tmp', `relatorio-unidades-calculos-${stamp}.json`);
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

/** @param {unknown} val */
function normalizarUnidadeApi(val) {
  return normalizarUnidadeTxt(val);
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
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {string} cod8
 * @param {number} numeroInterno
 */
async function buscarProcessoMysql(conn, cod8, numeroInterno) {
  const [rows] = await conn.query(
    `SELECT po.id, po.unidade, po.numero_interno AS numeroInterno
     FROM processo po
     INNER JOIN cliente c ON c.id = po.cliente_id
     WHERE c.codigo_cliente = ?
       AND po.numero_interno = ?
     LIMIT 1`,
    [cod8, Math.trunc(numeroInterno)]
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    unidade: row.unidade ?? null,
    numeroInterno: Number(row.numeroInterno),
  };
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number} processoId
 * @param {string | null} unidade
 */
async function atualizarUnidadeMysql(conn, processoId, unidade) {
  await conn.query('UPDATE processo SET unidade = ? WHERE id = ?', [unidade, processoId]);
}

/**
 * @param {ReturnType<typeof parseUnidadeCalculosDropboxArgs>} opts
 */
export async function sincronizarUnidadesCalculosDropbox(opts) {
  if (!fs.existsSync(opts.base)) {
    throw new Error(`Pasta Calculos não encontrada: ${opts.base}`);
  }

  if (opts.verificarApi && !opts.dryRun && !opts.viaMysql) {
    await verificarApiDisponivel(opts.baseUrl);
  }

  const { registos, stats: levantamento } = levantarUnidadesCalculosDropbox(opts.base, {
    clienteFiltro: opts.clienteFiltro,
  });

  const stats = {
    ...levantamento,
    ok: 0,
    puladosIguais: 0,
    semProcesso: 0,
    falhas: 0,
    destino: opts.viaMysql ? 'mysql' : 'api',
  };

  /** @type {object[]} */
  const detalhes = [];
  const amostra = registos.slice(0, 15);

  let token = null;
  /** @type {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter | null} */
  let conn = null;

  if (!opts.dryRun) {
    if (opts.viaMysql) {
      conn = await conectarMysqlVilareal();
    } else {
      if (!opts.senha) {
        throw new Error('Defina VILAREAL_IMPORT_SENHA (ou .env.import.local) ou use --senha=');
      }
      token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
    }
  }

  const pessoaPorCod8 = new Map();

  try {
    await runPool(registos, opts.dryRun ? 1 : opts.concurrency, async (reg) => {
      const linha = {
        cod8: reg.cod8,
        numeroInterno: reg.numeroInterno,
        unidade: reg.unidade,
        arquivo: reg.relPath,
        subpasta: `${reg.milhar}/${reg.centena}/${reg.pastaCliente}`,
        tipoMeio: reg.tipoMeio,
      };

      if (opts.dryRun) {
        stats.ok += 1;
        linha.acao = 'dry-run';
        if (detalhes.length < 50_000) detalhes.push(linha);
        return;
      }

      try {
        const proc = opts.viaMysql
          ? await buscarProcessoMysql(conn, reg.cod8, reg.numeroInterno)
          : await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno, pessoaPorCod8);

        if (!proc?.id) {
          stats.semProcesso += 1;
          linha.acao = 'sem_processo';
          detalhes.push(linha);
          return;
        }

        const atual = normalizarUnidadeApi(proc.unidade);
        if (opts.apenasDiferentes && atual === reg.unidade) {
          stats.puladosIguais += 1;
          linha.acao = 'pulado_igual';
          linha.unidadeAnterior = atual;
          detalhes.push(linha);
          return;
        }

        if (opts.viaMysql) {
          await atualizarUnidadeMysql(conn, proc.id, reg.unidade);
        } else {
          await atualizarProcessoApi(opts.baseUrl, token, proc, { unidade: reg.unidade });
        }

        stats.ok += 1;
        linha.acao = atual === reg.unidade ? 'confirmado_igual' : atual ? 'atualizado' : 'gravado';
        linha.unidadeAnterior = atual;
        linha.processoId = proc.id;
        detalhes.push(linha);
      } catch (e) {
        stats.falhas += 1;
        linha.acao = 'falha';
        linha.erro = String(e?.message ?? e).slice(0, 300);
        detalhes.push(linha);
      }
    });
  } finally {
    if (conn?.end) await conn.end();
  }

  const payload = {
    geradoEm: new Date().toISOString(),
    modo: opts.dryRun ? 'dry-run' : 'aplicar',
    destino: stats.destino,
    baseCalculos: opts.base,
    baseApi: opts.viaMysql ? null : opts.baseUrl,
    stats,
    amostra,
    detalhes,
  };

  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, JSON.stringify(payload, null, 2), 'utf8');

  return { payload, opts };
}

/**
 * @param {Awaited<ReturnType<typeof sincronizarUnidadesCalculosDropbox>>} result
 */
export function imprimirResumoUnidadeCalculosSync({ payload, opts }) {
  const { stats } = payload;
  console.log('\n=== Sincronização unidades (Calculos 0.88.* → processo.unidade) ===');
  console.log(`Calculos: ${opts.base}`);
  console.log(`Destino:  ${stats.destino === 'mysql' ? 'MySQL directo' : `API ${opts.baseUrl}`}`);
  console.log(`Modo:     ${opts.dryRun ? 'pré-visualização (dry-run)' : 'aplicar na base'}`);
  console.log(`Fonte:    ${stats.fonte ?? 'Calculos/{Milhar}/{Centena}/{Cliente}'}`);
  console.log('');
  console.log(`Ficheiros 0.88.* na árvore:       ${stats.ficheirosTxt}`);
  console.log(`Com texto válido:                 ${stats.textoValido}`);
  console.log(`Vazios / inválidos:               ${stats.textoVazio}`);
  console.log(`Nomes inválidos:                  ${stats.nomeInvalido}`);
  console.log(`Registos únicos (cli+proc):       ${stats.registosUnicos}`);
  console.log(`Duplicados descartados:           ${stats.duplicadosDescartados ?? 0}`);
  console.log(`Pastas fora da regra VB:          ${stats.pastasIgnoradasSubpasta ?? 0}`);
  console.log('');
  console.log('--- Resultado ---');
  if (opts.dryRun) {
    console.log(`  Processos que seriam alinhados: ${stats.ok}`);
  } else {
    console.log(`  Gravados/atualizados:           ${stats.ok}`);
    console.log(`  Já iguais (pulados):            ${stats.puladosIguais}`);
    console.log(`  Sem processo na base:           ${stats.semProcesso}`);
    console.log(`  Falhas:                         ${stats.falhas}`);
  }
  console.log('\nAmostra (15 primeiros):');
  for (const a of payload.amostra) {
    const unid = a.unidade == null ? '(vazio)' : a.unidade;
    console.log(
      `  ${a.cod8} proc ${a.numeroInterno} → ${unid}  (${a.milhar}/${a.centena}/${a.pastaCliente})`
    );
  }
  console.log(`\nRelatório completo: ${opts.relatorio}\n`);
}

/**
 * @param {string[]} argv
 */
export async function runUnidadeCalculosDropboxCli(argv) {
  const opts = parseUnidadeCalculosDropboxArgs(argv);
  const result = await sincronizarUnidadesCalculosDropbox(opts);
  imprimirResumoUnidadeCalculosSync(result);
  if (!opts.dryRun && result.payload.stats.falhas > 0) {
    process.exitCode = 2;
  }
}
