#!/usr/bin/env node
/**
 * Após V67: vincula processos em imovel_processo (falta_vinculo) e tenta corrigir órfãos via extras.
 *
 *   node scripts/backfill-imovel-processo-apos-v67.mjs --dry-run
 *   node scripts/backfill-imovel-processo-apos-v67.mjs --aplicar
 */

import './lib/load-vilareal-import-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loginImportApi, buscarProcesso, resolverClienteFromApi } from './lib/vilareal-import-processo-api.mjs';

function parseArgs(argv) {
  const out = {
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8081').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    dryRun: true,
    auditJson: path.join(process.cwd(), 'tmp', 'vinculos-imovel-0891-auditoria.json'),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') out.dryRun = false;
    else if (a.startsWith('--audit=')) out.auditJson = a.slice(8);
  }
  return out;
}

async function vincular(baseUrl, token, imovelId, processoId, observacao) {
  const res = await fetch(`${baseUrl}/api/imoveis/${imovelId}/processos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ processoId, observacao }),
  });
  const t = await res.text();
  if (res.ok || res.status === 201) return { ok: true };
  if (/duplicate|unique/i.test(t)) return { ok: true, idempotente: true };
  return { ok: false, status: res.status, text: t };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha && !opts.dryRun) {
    console.error('Defina VILAREAL_IMPORT_SENHA');
    process.exit(1);
  }
  if (!fs.existsSync(opts.auditJson)) {
    console.error('Auditoria não encontrada:', opts.auditJson);
    process.exit(1);
  }
  const audit = JSON.parse(fs.readFileSync(opts.auditJson, 'utf8'));
  const falta = audit.linhas.filter((l) => l.status === 'falta_vinculo');
  console.log('Modo:', opts.dryRun ? 'dry-run' : 'aplicar');
  console.log('falta_vinculo:', falta.length);

  const token = opts.dryRun ? null : await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  const clienteMap = new Map();
  let ok = 0;
  let fail = 0;

  for (const row of falta) {
    if (!row.imovelId || !row.processoId) {
      fail += 1;
      continue;
    }
    if (opts.dryRun) {
      console.log(`  ${row.cod8} proc=${row.numeroInterno} → POST imovel ${row.imovelId} processo ${row.processoId}`);
      ok += 1;
      continue;
    }
    const r = await vincular(
      opts.baseUrl,
      token,
      row.imovelId,
      row.processoId,
      `Backfill V67 ${row.cod8} proc ${row.numeroInterno}`
    );
    if (r.ok) {
      ok += 1;
      console.log(`  OK ${row.cod8} proc=${row.numeroInterno} imovel=${row.imovelId}`);
    } else {
      fail += 1;
      console.log(`  ERRO ${row.cod8}: ${r.status} ${r.text?.slice(0, 120)}`);
    }
  }

  const resIm = await fetch(`${opts.baseUrl}/api/imoveis`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (token && resIm.ok) {
    const imoveis = await resIm.json();
    const orfaos = imoveis.filter((i) => i.clienteId == null && i.processoId == null);
    console.log('\nÓrfãos (sem cliente e processo):', orfaos.length);
    for (const o of orfaos.slice(0, 9)) {
      let extras = {};
      try {
        extras = o.camposExtrasJson ? JSON.parse(o.camposExtrasJson) : {};
      } catch {
        extras = {};
      }
      const cod = extras.codigo;
      const proc = extras.proc ? Number.parseInt(String(extras.proc), 10) : null;
      if (!cod || !proc) {
        console.log(`  imovel ${o.id}: sem cod/proc nos extras — revisão manual`);
        continue;
      }
      const cliente = await resolverClienteFromApi(opts.baseUrl, token, cod, clienteMap);
      if (!cliente?.clientePk) continue;
      const procEnt = await buscarProcesso(opts.baseUrl, token, cod, proc, clienteMap);
      if (opts.dryRun) {
        console.log(`  imovel ${o.id}: atribuiria cliente ${cod} proc ${proc}`);
        continue;
      }
      const putRes = await fetch(`${opts.baseUrl}/api/imoveis/${o.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clienteId: cliente.clientePk,
          numeroPlanilha: o.numeroPlanilha,
          situacao: o.situacao ?? 'DESOCUPADO',
          ativo: o.ativo ?? true,
        }),
      });
      if (putRes.ok && procEnt?.id) {
        await vincular(opts.baseUrl, token, o.id, procEnt.id, `Backfill órfão V67`);
        console.log(`  imovel ${o.id}: cliente + vínculo aplicados`);
      }
    }
  }

  console.log('\nResumo falta_vinculo:', { ok, fail });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
