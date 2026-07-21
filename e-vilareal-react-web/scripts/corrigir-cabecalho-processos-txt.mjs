#!/usr/bin/env node
/**
 * Corrige cabeçalho de processos na API a partir dos txt locais.
 *
 * Uso:
 *   node scripts/corrigir-cabecalho-processos-txt.mjs --cliente=149 --processo=162 --dry-run
 *   VILAREAL_IMPORT_SENHA='…' node scripts/corrigir-cabecalho-processos-txt.mjs --vps --cliente=149 --processo=162 --aplicar
 *   node scripts/corrigir-cabecalho-processos-txt.mjs --vps --cliente=149 --apenas-criticos --aplicar
 *
 * Correção cirúrgica (só campos indicados, vários clientes):
 *   node scripts/corrigir-cabecalho-processos-txt.mjs --alvos=728/133,800/38 --campos=descricaoAcao --dry-run
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  compararCabecalhoTxtVsDb,
  detectarContaminacaoCnj,
  indexarCnjTxtGlobal,
  montarSnapshotTxtCabecalho,
} from './lib/cabecalho-processo-txt-audit.mjs';
import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';
import { atualizarProcessoApi } from './lib/import-processo-put-body.mjs';
import {
  levantarDadosProcessoTxt,
  montarPatchProcessoFromTxt,
} from './lib/proc-processo-dados-txt.mjs';
import { listarProcessosComDadosCabecalhoTxt } from './lib/processos-dropbox-cliente.mjs';
import {
  construirMapaUsuarioPorNomeResponsavel,
  fetchUsuariosImportApi,
  resolverUsuarioResponsavelId,
} from './lib/responsavel-usuario-import.mjs';
import { buscarProcesso, loginImportApi } from './lib/vilareal-import-processo-api.mjs';
import { resolverBaseUrlImport } from './lib/vilareal-import-api-base.mjs';

function parseArgs(argv) {
  const out = {
    cliente: null,
    processo: null,
    processoMin: null,
    processoMax: null,
    base: resolverBaseBancoDados(),
    mysqlLocal: false,
    vpsHost: process.env.VPS_HOST || 'root@161.97.175.73',
    apenasCriticos: false,
    dryRun: true,
    aplicar: false,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: resolverBaseUrlImport(),
    vps: false,
    relatorio: null,
    /** @type {string[] | null} Restringe o patch a estes campos (ex.: ['descricaoAcao']). */
    campos: null,
    /** @type {Array<{ codNum: number, proc: number }> | null} Alvos multi-cliente `cliente/proc`. */
    alvos: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--apenas-criticos') out.apenasCriticos = true;
    else if (a === '--mysql-local') out.mysqlLocal = true;
    else if (a === '--vps') out.vps = true;
    else if (a.startsWith('--cliente=')) out.cliente = Math.trunc(Number(a.slice(10)));
    else if (a.startsWith('--processo=')) out.processo = Math.trunc(Number(a.slice(11)));
    else if (a.startsWith('--processo-min=')) out.processoMin = Math.trunc(Number(a.slice(15)));
    else if (a.startsWith('--processo-max=')) out.processoMax = Math.trunc(Number(a.slice(15)));
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--campos=')) {
      out.campos = a
        .slice(9)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith('--alvos=')) {
      out.alvos = a
        .slice(8)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((par) => {
          const [cli, proc] = par.split('/');
          return { codNum: Math.trunc(Number(cli)), proc: Math.trunc(Number(proc)) };
        });
    }
  }
  if (out.vps && !argv.some((a) => a.startsWith('--base-url='))) {
    out.baseUrl = resolverBaseUrlImport(process.env, { vps: true });
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
  if (opts.cliente == null && !opts.alvos?.length) {
    console.error(
      'Uso: node scripts/corrigir-cabecalho-processos-txt.mjs --cliente=N [--processo=N] [--dry-run|--aplicar] [--vps] [--apenas-criticos]\n' +
        '     node scripts/corrigir-cabecalho-processos-txt.mjs --alvos=CLI/PROC,… [--campos=a,b] [--dry-run|--aplicar]'
    );
    process.exit(1);
  }
  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha= para --aplicar');
    process.exit(1);
  }

  const indiceCnj = indexarCnjTxtGlobal(opts.base);

  /** @type {Array<{ codNum: number, proc: number }>} */
  let alvos;
  if (opts.alvos?.length) {
    alvos = opts.alvos;
  } else {
    const codNum = opts.cliente;
    const cod8 = formatCod8(codNum);
    let procs = filtrarProcs(listarProcessosComDadosCabecalhoTxt(opts.base, codNum), opts);

    if (opts.apenasCriticos) {
      const { spawnSync } = await import('node:child_process');
      const auditScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'auditar-cabecalho-processos-txt.mjs');
      spawnSync(
        process.execPath,
        [auditScript, `--cliente=${codNum}`, '--criticos', `--base=${opts.base}`],
        { encoding: 'utf8' }
      );
      const relPathCriticos = path.join(process.cwd(), 'tmp', `auditoria-cabecalho-${cod8}.json`);
      if (fs.existsSync(relPathCriticos)) {
        const rel = JSON.parse(fs.readFileSync(relPathCriticos, 'utf8'));
        const lista = rel.clientes?.[0]?.lista_criticos ?? [];
        procs = procs.filter((p) => lista.includes(p));
      }
    }
    alvos = procs.map((proc) => ({ codNum, proc }));
  }

  console.log(`\n=== Corrigir cabeçalho ${opts.alvos?.length ? '(alvos multi-cliente)' : `— cliente ${formatCod8(opts.cliente)}`} ===`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'aplicar'}`);
  if (opts.campos?.length) console.log(`Campos restritos: ${opts.campos.join(', ')}`);
  console.log(`Processos alvo: ${alvos.length}\n`);

  /** @type {object[]} */
  const resultados = [];
  // Com senha disponível, autentica mesmo em dry-run para mostrar o estado atual (antes).
  const token = opts.senha ? await loginImportApi(opts.baseUrl, opts.login, opts.senha) : null;
  const clientePorCod8 = new Map();
  const mapaResp = token
    ? construirMapaUsuarioPorNomeResponsavel(await fetchUsuariosImportApi(opts.baseUrl, token))
    : null;

  for (const { codNum, proc } of alvos) {
    const cod8 = formatCod8(codNum);
    const rotulo = `${cod8}/${proc}`;
    const dados = levantarDadosProcessoTxt(codNum, proc, { baseBanco: opts.base });
    let patch = montarPatchProcessoFromTxt(dados);
    if (opts.campos?.length) {
      /** @type {Record<string, unknown>} */
      const filtrado = {};
      for (const k of opts.campos) if (patch[k] !== undefined) filtrado[k] = patch[k];
      patch = filtrado;
    }

    /** @type {object} */
    const linha = { cliente: cod8, proc, patchResumo: {} };
    const camposResumo = opts.campos?.length
      ? opts.campos
      : ['numeroCnj', 'descricaoAcao', 'valorCausa', 'observacao', 'competencia', 'observacaoFase', 'fase', 'naturezaAcao'];
    for (const k of camposResumo) {
      if (patch[k] !== undefined) linha.patchResumo[k] = patch[k];
    }

    if (Object.keys(patch).length === 0) {
      linha.acao = 'sem_campos_no_txt';
      resultados.push(linha);
      console.warn(`[${rotulo}] txt não tem os campos pedidos — ignorado`);
      continue;
    }

    if (token) {
      const procApi = await buscarProcesso(opts.baseUrl, token, cod8, proc, clientePorCod8);
      if (!procApi?.id) {
        linha.acao = 'sem_processo_api';
        resultados.push(linha);
        console.warn(`[${rotulo}] processo ausente na API — ignorado`);
        continue;
      }
      linha.processoId = procApi.id;
      linha.antes = {};
      for (const k of Object.keys(linha.patchResumo)) linha.antes[k] = procApi[k] ?? null;
      const contaminacao = detectarContaminacaoCnj(procApi.numeroCnj, cod8, proc, indiceCnj);
      if (contaminacao) linha.contaminacao = contaminacao;

      const patchApi = { ...patch };
      if (patchApi._responsavelNome) {
        const uid = resolverUsuarioResponsavelId(patchApi._responsavelNome, mapaResp);
        if (uid != null) patchApi.usuarioResponsavelId = uid;
        delete patchApi._responsavelNome;
      }

      if (opts.dryRun) {
        linha.acao = 'dry_run';
        console.log(`[${rotulo}] dry-run — antes:`, linha.antes, '→ depois:', linha.patchResumo);
        if (contaminacao) console.log(`  CNJ contaminado — dono txt: ${contaminacao.donoTxt}`);
      } else {
        await atualizarProcessoApi(opts.baseUrl, token, procApi, patchApi);
        linha.acao = 'corrigido';
        console.log(`[${rotulo}] atualizado (id=${procApi.id})`, linha.patchResumo);
        if (contaminacao) console.log(`  CNJ corrigido (era de ${contaminacao.donoTxt})`);
      }
    } else {
      linha.acao = 'preview';
      console.log(`[${rotulo}] preview`, linha.patchResumo);
    }

    resultados.push(linha);
  }

  const relPath =
    opts.relatorio ??
    path.join(
      process.cwd(),
      'tmp',
      opts.alvos?.length
        ? 'correcao-cabecalho-alvos.json'
        : `correcao-cabecalho-${formatCod8(opts.cliente)}${opts.processo != null ? `-p${opts.processo}` : ''}.json`
    );
  fs.mkdirSync(path.dirname(relPath), { recursive: true });
  fs.writeFileSync(
    relPath,
    `${JSON.stringify({ geradoEm: new Date().toISOString(), codigo_cliente: opts.cliente != null ? formatCod8(opts.cliente) : null, campos: opts.campos ?? null, baseUrl: opts.baseUrl, aplicado: opts.aplicar, resultados }, null, 2)}\n`
  );
  console.log(`\nRelatório: ${relPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
