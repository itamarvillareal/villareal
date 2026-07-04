#!/usr/bin/env node
/**
 * Move lançamentos importados de OFX (extrato (11)..(71)) de BB → BB Conta Corrente na API.
 *
 * Uso: node scripts/migrar-ofx-bb-para-bb-conta-corrente.mjs --vps [--dry-run]
 */
import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';

import { parseOfxToExtrato } from '../src/utils/ofx.js';

const VPS_BASE = 'https://portal.villarealadvocacia.adv.br';
const ORIGEM_NB = 3;
const DESTINO_NB = 903;
const DESTINO_BANCO = 'BB Conta Corrente';
const MIN_FILE = 11;
const MAX_FILE = 71;

function parseArgs(argv) {
  const out = {
    dryRun: false,
    vps: false,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--vps') {
      out.vps = true;
      out.baseUrl = VPS_BASE;
    } else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
  }
  if (out.vps) out.baseUrl = VPS_BASE;
  return out;
}

function expandHome(p) {
  return p.replace(/^~(?=$|[\\/])/, os.homedir());
}

function readOfxPath(filePath) {
  const buf = fs.readFileSync(filePath);
  try {
    return new TextDecoder('windows-1252').decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

function coletarFitidsOfx() {
  const dir = expandHome('~/Downloads');
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^extrato \((\d+)\)\.ofx$/i.test(f))
    .map((f) => Number(f.match(/\((\d+)\)/)[1]))
    .filter((n) => n >= MIN_FILE && n <= MAX_FILE)
    .sort((a, b) => a - b);

  const fitids = new Set();
  for (const n of files) {
    const path = `${dir}/extrato (${n}).ofx`;
    const rows = parseOfxToExtrato(readOfxPath(path), { nomeBanco: DESTINO_BANCO });
    for (const r of rows) fitids.add(String(r.numero));
  }
  return fitids;
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: opts.login.trim().toLowerCase(), senha: opts.senha }),
  });
  if (!res.ok) throw new Error(`Login ${res.status}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Sem token');
  return j.accessToken;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
}

async function listarPorBanco(token, baseUrl, numeroBanco) {
  const out = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const qs = new URLSearchParams({
      page: String(page),
      size: '200',
      sort: 'dataLancamento,asc',
      numeroBanco: String(numeroBanco),
    });
    const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/paginada?${qs}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`GET pág ${page}: ${res.status}`);
    const j = await res.json();
    out.push(...(j.content ?? []));
    totalPages = Math.max(1, Number(j?.totalPages ?? 1));
    page += 1;
  }
  return out;
}

async function moverLancamento(token, baseUrl, l) {
  const body = {
    contaContabilId: l.contaContabilId,
    clienteId: l.clienteId,
    processoId: l.processoId,
    bancoNome: DESTINO_BANCO,
    numeroBanco: DESTINO_NB,
    numeroLancamento: l.numeroLancamento,
    dataLancamento: l.dataLancamento,
    dataCompetencia: l.dataCompetencia,
    descricao: l.descricao,
    descricaoDetalhada: l.descricaoDetalhada,
    valor: l.valor,
    natureza: l.natureza,
    refTipo: l.refTipo,
    origem: l.origem,
    status: l.status,
    grupoCompensacao: l.grupoCompensacao,
  };
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/${l.id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, text: (await res.text()).slice(0, 200) };
  }
  return { ok: true };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA');
    process.exit(1);
  }

  const fitids = coletarFitidsOfx();
  console.log(`FITIDs nos OFX (${MIN_FILE}..${MAX_FILE}): ${fitids.size}`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'executar'}`);

  const token = await login(opts);
  const origem = await listarPorBanco(token, opts.baseUrl, ORIGEM_NB);
  const destino = await listarPorBanco(token, opts.baseUrl, DESTINO_NB);

  const paraMover = origem.filter((l) => fitids.has(String(l.numeroLancamento)));
  const jaNoDestino = destino.filter((l) => fitids.has(String(l.numeroLancamento)));

  console.log(`Em BB (${ORIGEM_NB}): ${paraMover.length} a mover`);
  console.log(`Já em BB Conta Corrente (${DESTINO_NB}): ${jaNoDestino.length}`);

  if (opts.dryRun) return;

  let ok = 0;
  let erros = 0;
  const conc = 8;
  let i = 0;
  async function worker() {
    while (i < paraMover.length) {
      const idx = i;
      i += 1;
      const r = await moverLancamento(token, opts.baseUrl, paraMover[idx]);
      if (r.ok) ok += 1;
      else {
        erros += 1;
        if (erros <= 5) console.error(`Erro ${paraMover[idx].id}: ${r.text}`);
      }
      if ((ok + erros) % 100 === 0) console.log(`Progresso: ${ok + erros}/${paraMover.length}`);
    }
  }
  await Promise.all(Array.from({ length: conc }, () => worker()));

  const posOrigem = (await listarPorBanco(token, opts.baseUrl, ORIGEM_NB)).filter((l) =>
    fitids.has(String(l.numeroLancamento)),
  );
  const posDestino = (await listarPorBanco(token, opts.baseUrl, DESTINO_NB)).filter((l) =>
    fitids.has(String(l.numeroLancamento)),
  );

  console.log('\n=== Concluído ===');
  console.log(`Movidos OK: ${ok}`);
  console.log(`Erros: ${erros}`);
  console.log(`BB (${ORIGEM_NB}) restantes deste OFX: ${posOrigem.length}`);
  console.log(`BB Conta Corrente (${DESTINO_NB}) total deste OFX: ${posDestino.length}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
