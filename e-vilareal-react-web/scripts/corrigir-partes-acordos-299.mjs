#!/usr/bin/env node
/**
 * Corrige titular + partes dos processos criados pelo import de acordos Terra Mundi.
 * Titular → condomínio; AUTOR = condomínio; REU = devedor da unidade.
 *
 *   node scripts/corrigir-partes-acordos-299.mjs --dry-run
 *   node scripts/corrigir-partes-acordos-299.mjs --aplicar
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  buscarProcesso,
  loginImportApi,
  resolverClienteFromApi,
} from './lib/vilareal-import-processo-api.mjs';
import {
  corrigirTitularProcessoParaCliente,
  garantirPartesCobrancaCondominio,
} from './lib/processo-partes-cobranca-condominio.mjs';

const COD8 = '00000299';
const DEFAULT_REL = path.join(os.homedir(), 'Dropbox/tmp/acordos-299-diagnostico.json');
const PROC_MIN = 25;
const PROC_MAX = 40;

function parseArgs(argv) {
  const out = {
    dryRun: true,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'https://portal.villarealadvocacia.adv.br').replace(
      /\/$/,
      ''
    ),
    relatorio: DEFAULT_REL,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.dryRun = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
  }
  return out;
}

async function mainAsync() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.relatorio)) {
    console.error(`Relatório não encontrado: ${opts.relatorio}`);
    process.exit(1);
  }
  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const rel = JSON.parse(fs.readFileSync(opts.relatorio, 'utf8'));
  const itens = (rel.itens ?? []).filter(
    (it) =>
      it.proc >= PROC_MIN &&
      it.proc <= PROC_MAX &&
      it.pessoaId &&
      (it.acao === 'put_rodada' || it.acao === 'criar_processo')
  );

  if (!itens.length) {
    console.log('[corrigir-partes-299] nenhum processo 25–40 no relatório.');
    return;
  }

  const token = opts.dryRun ? null : await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  const clienteCache = new Map();
  const resolved = opts.dryRun
    ? null
    : await resolverClienteFromApi(opts.baseUrl, token, COD8, clienteCache);
  const condominioPessoaId = resolved?.pessoaId ?? null;

  const stats = { titular: 0, partes: 0, skip: 0, erro: 0 };

  for (const it of itens) {
    const label = `proc ${it.proc} (${it.unidade}) devedor ${it.pessoaId}`;
    if (opts.dryRun) {
      console.log(`[dry-run] ${label} → titular=condomínio, AUTOR=condomínio, REU=${it.pessoaId}`);
      stats.partes += 1;
      continue;
    }

    const proc = await buscarProcesso(opts.baseUrl, token, COD8, it.proc, clienteCache);
    if (!proc?.id) {
      console.warn(`[ERRO] processo ${it.proc} não encontrado`);
      stats.erro += 1;
      continue;
    }

    if (Number(proc.pessoaTitularId) === condominioPessoaId) {
      stats.skip += 1;
    } else {
      const r = await corrigirTitularProcessoParaCliente(opts.baseUrl, token, proc);
      if (!r.ok) {
        console.warn(`[ERRO] PUT titular proc ${it.proc}: ${r.status} ${r.text}`);
        stats.erro += 1;
        continue;
      }
      stats.titular += 1;
      console.log(`[titular] proc ${it.proc}: ${proc.pessoaTitularId} → condomínio (${condominioPessoaId})`);
    }

    const partes = await garantirPartesCobrancaCondominio(
      opts.baseUrl,
      token,
      Number(proc.id),
      condominioPessoaId,
      Number(it.pessoaId)
    );
    if (partes.falhas > 0) {
      stats.erro += 1;
      console.warn(`[ERRO] partes proc ${it.proc}`);
    } else if (partes.jaOk) {
      console.log(`[partes] proc ${it.proc}: já OK`);
    } else {
      stats.partes += 1;
      console.log(
        `[partes] proc ${it.proc}: AUTOR=${condominioPessoaId}${partes.autorCriado ? ' (criado)' : ''}, REU=${it.pessoaId}${partes.reuCriado ? ' (criado)' : ''}`
      );
    }
  }

  console.log(`\n[corrigir-partes-299] ${opts.dryRun ? 'DRY-RUN' : 'APLICADO'}`, stats);
  if (stats.erro > 0) process.exit(2);
}

mainAsync().catch((err) => {
  console.error('[corrigir-partes-299] FATAL:', err?.message ?? err);
  process.exit(1);
});
