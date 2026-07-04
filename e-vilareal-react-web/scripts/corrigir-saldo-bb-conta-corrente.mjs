#!/usr/bin/env node
/**
 * Corrige saldo BB Conta Corrente (903) para bater com OFX mestre:
 * - Move lançamentos OFX ainda em BB (3) → BB Conta Corrente (903)
 * - Importa extrato (73).ofx se faltar algum FITID
 * - Verifica saldo vs LEDGERBAL do OFX
 *
 * Uso: node scripts/corrigir-saldo-bb-conta-corrente.mjs --vps [--dry-run]
 */
import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';

import { analisarLancamentosNovosDedupe, parseOfxToExtrato } from '../src/utils/ofx.js';

const VPS_BASE = 'https://portal.villarealadvocacia.adv.br';
const ORIGEM_NB = 3;
const DESTINO_NB = 903;
const DESTINO_BANCO = 'BB Conta Corrente';
const CONTA_N_NOME = 'Conta Não Identificados';
const OFX_73 = '~/Downloads/extrato (73).ofx';

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

function ledgerBal(ofxText) {
  const m = /<LEDGERBAL>[\s\S]*?<BALAMT>([^<]+)/i.exec(String(ofxText ?? ''));
  return m ? Number(m[1]) : null;
}

function parseBrDateToIso(v) {
  const s = String(v ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toBrDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function mapApiParaUi(l) {
  const valorNum = Number(l.valor ?? 0);
  const sinal = String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -1 : 1;
  return {
    letra: 'N',
    numero: String(l.numeroLancamento ?? ''),
    data: toBrDate(l.dataLancamento),
    dataCompetencia: toBrDate(l.dataCompetencia ?? l.dataLancamento),
    descricao: String(l.descricao ?? ''),
    valor: valorNum * sinal,
    descricaoDetalhada: String(l.descricaoDetalhada ?? ''),
    nomeBanco: String(l.bancoNome ?? ''),
    numeroBanco: l.numeroBanco ?? null,
    origemImportacao: String(l.origem ?? ''),
    ref: 'N',
    codCliente: '',
    proc: '',
    _financeiroMeta: {},
  };
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: opts.login.trim().toLowerCase(), senha: opts.senha }),
  });
  if (!res.ok) throw new Error(`Login ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Sem accessToken');
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
    if (!res.ok) throw new Error(`GET nb=${numeroBanco} pág ${page}: ${res.status}`);
    const j = await res.json();
    out.push(...(j.content ?? []));
    totalPages = Math.max(1, Number(j?.totalPages ?? 1));
    page += 1;
  }
  return out;
}

async function saldoBanco(token, baseUrl, numeroBanco, data = null) {
  const qs = new URLSearchParams({ numeroBanco: String(numeroBanco) });
  if (data) qs.set('data', data);
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/saldo-banco?${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`saldo-banco ${numeroBanco}: ${res.status}`);
  return res.json();
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
  if (!res.ok) return { ok: false, text: (await res.text()).slice(0, 200) };
  return { ok: true };
}

function rowParaPayloadApi(row, contaContabilId) {
  const valorNum = Number(row.valor ?? 0);
  return {
    contaContabilId,
    clienteId: null,
    processoId: null,
    bancoNome: DESTINO_BANCO,
    numeroBanco: DESTINO_NB,
    numeroLancamento: String(row.numero ?? ''),
    dataLancamento: parseBrDateToIso(row.data),
    dataCompetencia: parseBrDateToIso(row.dataCompetencia) || parseBrDateToIso(row.data),
    descricao: String(row.descricao || '').trim() || 'Lançamento extrato',
    descricaoDetalhada: String(row.descricaoDetalhada || ''),
    valor: Math.abs(valorNum),
    natureza: valorNum < 0 ? 'DEBITO' : 'CREDITO',
    refTipo: 'N',
    origem: 'OFX',
    status: 'ATIVO',
    grupoCompensacao: null,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA');
    process.exit(1);
  }

  const ofx73Path = expandHome(OFX_73);
  if (!fs.existsSync(ofx73Path)) {
    console.error('OFX mestre não encontrado:', ofx73Path);
    process.exit(1);
  }
  const ofx73Text = readOfxPath(ofx73Path);
  const saldoAlvo = ledgerBal(ofx73Text);
  const rows73 = parseOfxToExtrato(ofx73Text, { nomeBanco: DESTINO_BANCO });
  const fitids73 = new Set(rows73.map((r) => String(r.numero)));

  console.log(`API: ${opts.baseUrl}`);
  console.log(`Saldo alvo (OFX 73 LEDGERBAL): R$ ${saldoAlvo?.toFixed(2)}`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'executar'}`);

  const token = await login(opts);
  const origem = await listarPorBanco(token, opts.baseUrl, ORIGEM_NB);
  const destinoAntes = await listarPorBanco(token, opts.baseUrl, DESTINO_NB);

  const ofxEmBb = origem.filter((l) => l.origem === 'OFX');
  const fitids73EmBb = origem.filter((l) => fitids73.has(String(l.numeroLancamento)));
  const fitids73Em903 = destinoAntes.filter((l) => fitids73.has(String(l.numeroLancamento)));

  console.log(`OFX em BB (${ORIGEM_NB}): ${ofxEmBb.length}`);
  console.log(`FITIDs OFX 73 em BB: ${fitids73EmBb.length}, em BB CC: ${fitids73Em903.length}`);

  const saldoAntes = await saldoBanco(token, opts.baseUrl, DESTINO_NB, '2026-07-04');
  console.log(`Saldo BB CC antes: R$ ${Number(saldoAntes.saldo).toFixed(2)}`);

  if (opts.dryRun) return;

  // 1) Move todo OFX de BB → BB Conta Corrente
  let movidos = 0;
  let erros = 0;
  for (const l of ofxEmBb) {
    const r = await moverLancamento(token, opts.baseUrl, l);
    if (r.ok) movidos += 1;
    else {
      erros += 1;
      if (erros <= 3) console.error(`Erro mover ${l.id}: ${r.text}`);
    }
  }
  console.log(`Movidos OFX BB → BB CC: ${movidos} (erros: ${erros})`);

  // 2) Importa FITIDs do OFX 73 que ainda faltem em BB CC
  const destinoMeio = await listarPorBanco(token, opts.baseUrl, DESTINO_NB);
  const existenteUi = destinoMeio.map(mapApiParaUi);
  const analise = analisarLancamentosNovosDedupe(existenteUi, rows73);
  const novos = analise.novos ?? [];

  const contas = await (await fetch(`${opts.baseUrl}/api/financeiro/contas`, {
    headers: authHeaders(token),
  })).json();
  const contaNId = (contas || []).find((c) => String(c.nome ?? '').trim() === CONTA_N_NOME)?.id;
  if (!contaNId) throw new Error(`Conta «${CONTA_N_NOME}» não encontrada.`);

  let importados = 0;
  for (const row of novos) {
    const body = rowParaPayloadApi(row, contaNId);
    const res = await fetch(`${opts.baseUrl}/api/financeiro/lancamentos`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    if (res.ok) importados += 1;
    else console.error(`POST ${row.numero}: ${(await res.text()).slice(0, 150)}`);
  }
  console.log(`Importados OFX 73 novos: ${importados}`);

  const saldoDepois = await saldoBanco(token, opts.baseUrl, DESTINO_NB, '2026-07-04');
  const saldoBb = await saldoBanco(token, opts.baseUrl, ORIGEM_NB, '2026-07-04');

  console.log('\n=== Resultado ===');
  console.log(`BB Conta Corrente (${DESTINO_NB}): R$ ${Number(saldoDepois.saldo).toFixed(2)}`);
  console.log(`BB (${ORIGEM_NB}): R$ ${Number(saldoBb.saldo).toFixed(2)}`);
  console.log(`Alvo OFX: R$ ${saldoAlvo?.toFixed(2)}`);
  const diff = Math.abs(Number(saldoDepois.saldo) - (saldoAlvo ?? 0));
  console.log(diff < 0.02 ? 'OK — saldo confere com OFX' : `ATENÇÃO — diferença R$ ${diff.toFixed(2)}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
