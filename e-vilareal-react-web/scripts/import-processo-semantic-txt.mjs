#!/usr/bin/env node
/**
 * Importa papel do cliente e audiência a partir dos txt semânticos (legado VB).
 *
 * Uso:
 *   node scripts/import-processo-semantic-txt.mjs --dry-run
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-processo-semantic-txt.mjs --aplicar --login=itamar
 *
 * Opções: --cliente=N --apenas-diferentes --relatorio=JSON
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';
import { levantarCamposSemanticosProcesso } from './lib/proc-processo-semantic-txt.mjs';

function parseArgs(argv) {
  const out = {
    dryRun: true,
    aplicar: false,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    clienteFiltro: null,
    apenasDiferentes: false,
    relatorio: null,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8081').replace(/\/$/, ''),
    concurrency: Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY) || 5),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--apenas-diferentes') out.apenasDiferentes = true;
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
  return out;
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: String(opts.login).trim().toLowerCase(), senha: opts.senha }),
  });
  if (!res.ok) throw new Error(`Login ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  if (!json.accessToken) throw new Error('Login sem accessToken');
  return json.accessToken;
}

async function buscarProcesso(baseUrl, token, cod8, numeroInterno) {
  const res = await fetch(
    `${baseUrl}/api/processos?${new URLSearchParams({ codigoCliente: cod8, size: '500' })}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!res.ok) return null;
  const body = await res.json();
  const lista = Array.isArray(body) ? body : body?.content ?? [];
  return lista.find((p) => Number(p.numeroInterno) === Number(numeroInterno)) ?? null;
}

function corpoPutProcesso(p, patch) {
  return {
    clienteId: p.clienteId ?? p.pessoaId,
    numeroInterno: p.numeroInterno,
    numeroCnj: p.numeroCnj ?? null,
    numeroProcessoAntigo: p.numeroProcessoAntigo ?? null,
    naturezaAcao: p.naturezaAcao ?? null,
    descricaoAcao: p.descricaoAcao ?? null,
    competencia: p.competencia ?? null,
    fase: p.fase ?? null,
    observacaoFase: p.observacaoFase ?? null,
    tramitacao: p.tramitacao ?? null,
    dataProtocolo: p.dataProtocolo ?? null,
    prazoFatal: p.prazoFatal ?? null,
    proximaConsulta: p.proximaConsulta ?? null,
    observacao: p.observacao ?? null,
    valorCausa: p.valorCausa ?? null,
    uf: p.uf ?? null,
    cidade: p.cidade ?? null,
    unidade: p.unidade ?? null,
    pasta: p.pasta ?? null,
    papelCliente: patch.papelCliente !== undefined ? patch.papelCliente : (p.papelCliente ?? null),
    audienciaData: patch.audienciaData !== undefined ? patch.audienciaData : (p.audienciaData ?? null),
    audienciaHora: patch.audienciaHora !== undefined ? patch.audienciaHora : (p.audienciaHora ?? null),
    audienciaTipo: patch.audienciaTipo !== undefined ? patch.audienciaTipo : (p.audienciaTipo ?? null),
    avisoAudiencia: patch.avisoAudiencia !== undefined ? patch.avisoAudiencia : (p.avisoAudiencia ?? null),
    consultaAutomatica: p.consultaAutomatica ?? false,
    ativo: p.ativo ?? true,
    consultor: p.consultor ?? null,
    usuarioResponsavelId: p.usuarioResponsavelId ?? null,
  };
}

function precisaAtualizar(proc, campos, opts) {
  const patch = { ...campos };
  if (!opts.apenasDiferentes) return { aplicar: true, patch };
  let diff = false;
  for (const [k, v] of Object.entries(patch)) {
    const atual = proc[k] ?? null;
    const a = atual == null || atual === '' ? null : String(atual);
    const b = v == null || v === '' ? null : String(v);
    if (a !== b) diff = true;
  }
  return { aplicar: diff, patch };
}

async function atualizarProcesso(baseUrl, token, proc, patch) {
  const res = await fetch(`${baseUrl}/api/processos/${proc.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(corpoPutProcesso(proc, patch)),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PUT ${proc.id}: ${res.status} ${t.slice(0, 200)}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const mapa = levantarCamposSemanticosProcesso({ clienteFiltro: opts.clienteFiltro });
  const registos = [...mapa.values()];
  console.log(`\n=== Import campos semânticos (audiência / papel) — ${registos.length} processo(s) ===\n`);

  let token = null;
  if (opts.aplicar) token = await login(opts);

  const stats = {
    total: registos.length,
    atualizados: 0,
    pulados_iguais: 0,
    orfaos: 0,
    erros: 0,
  };

  for (const reg of registos) {
    const campos = reg.campos;
    if (!Object.keys(campos).length) continue;

    if (opts.dryRun) {
      console.log(
        `[dry-run] ${reg.cod8} proc ${reg.numeroInterno} → ${JSON.stringify(campos)}`
      );
      continue;
    }

    try {
      const proc = await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno);
      if (!proc?.id) {
        stats.orfaos += 1;
        continue;
      }
      const { aplicar, patch } = precisaAtualizar(proc, campos, opts);
      if (!aplicar) {
        stats.pulados_iguais += 1;
        continue;
      }
      await atualizarProcesso(opts.baseUrl, token, proc, patch);
      stats.atualizados += 1;
    } catch (e) {
      stats.erros += 1;
      console.warn(`[erro] ${reg.cod8}/${reg.numeroInterno}:`, e?.message || e);
    }
  }

  console.log('\nResumo:', JSON.stringify(stats, null, 2));
  if (opts.relatorio) {
    fs.writeFileSync(opts.relatorio, JSON.stringify({ opts, stats, registos }, null, 2), 'utf8');
    console.log(`Relatório: ${opts.relatorio}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
