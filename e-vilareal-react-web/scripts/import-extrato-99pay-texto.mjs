#!/usr/bin/env node
/**
 * Importa extrato 99 Pay a partir de texto colado (layout data hora + tab + descrição + valor).
 *
 * Uso:
 *   node scripts/import-extrato-99pay-texto.mjs scripts/tmp/extrato-99pay-jul2026.txt
 *   node scripts/import-extrato-99pay-texto.mjs arquivo.txt --dry-run
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';

import { parsePay99PdfExtratoText, nomeBancoPay99Padrao } from '../src/utils/pay99PdfExtrato.js';
import { listarLancamentosNovosDedupe } from '../src/utils/ofx.js';

const BANCO_PADRAO = nomeBancoPay99Padrao();
const NUMERO_BANCO_PADRAO = 30;

function parseArgs(argv) {
  const out = {
    arquivo: null,
    banco: BANCO_PADRAO,
    numeroBanco: NUMERO_BANCO_PADRAO,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    concurrency: Math.min(
      24,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 12) || 12),
    ),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--banco=')) out.banco = a.slice(8).trim();
    else if (a.startsWith('--numero-banco=')) out.numeroBanco = Number(a.slice(15));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (!a.startsWith('-')) out.arquivo = a;
  }
  return out;
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: String(opts.login).trim().toLowerCase(),
      senha: opts.senha,
    }),
  });
  if (!res.ok) throw new Error(`Login falhou ${res.status}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

async function listarContasContabeis(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/contas`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET contas: ${res.status}`);
  return res.json();
}

async function listarPaginado(token, baseUrl, query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/paginada?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`paginada ${res.status}`);
  return res.json();
}

function lancamentoApiParaDedupe(l) {
  const iso = String(l.dataLancamento ?? '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const data = m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  const natureza = String(l.natureza ?? '').toUpperCase();
  const v = Math.abs(Number(l.valor ?? 0));
  const valor = natureza === 'DEBITO' ? -v : v;
  return { numero: String(l.numeroLancamento ?? ''), data, valor };
}

async function carregarExistentes(token, baseUrl, numeroBanco) {
  const rows = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const res = await listarPaginado(token, baseUrl, {
      numeroBanco,
      page,
      size: 100,
      sort: 'dataLancamento,asc',
    });
    for (const l of res?.content ?? []) {
      rows.push(lancamentoApiParaDedupe(l));
    }
    totalPages = Number(res?.totalPages) || 1;
    page += 1;
  }
  return rows;
}

function contaNaoIdentificadosId(contasApi) {
  const hit = (contasApi || []).find(
    (c) =>
      String(c.codigo ?? '').toUpperCase() === 'N' ||
      String(c.nome ?? '').toLowerCase().includes('não identific'),
  );
  return hit?.id ?? null;
}

function rowParaApi(row, contaContabilId, bancoNome, numeroBanco) {
  const br = String(row.data ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  const dataIso = m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  if (!dataIso) return { ok: false, motivo: 'data_invalida' };

  const valorNum = Number(row.valor) || 0;
  return {
    ok: true,
    body: {
      contaContabilId,
      bancoNome,
      numeroBanco,
      numeroLancamento: String(row.numero ?? '').slice(0, 120),
      dataLancamento: dataIso,
      dataCompetencia: dataIso,
      descricao: String(row.descricao || 'Lançamento 99 Pay').slice(0, 500),
      descricaoDetalhada: String(row.descricaoDetalhada || row.descricao || '').slice(0, 2000),
      valor: Math.abs(valorNum),
      natureza: valorNum < 0 ? 'DEBITO' : 'CREDITO',
      refTipo: 'N',
      origem: 'PDF',
      status: 'ATIVO',
    },
  };
}

async function postLancamento(token, baseUrl, body) {
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, status: res.status, text: t.slice(0, 300) };
  }
  return { ok: true, id: (await res.json())?.id };
}

async function saldoBanco(token, baseUrl, numeroBanco, data) {
  const qs = new URLSearchParams({ numeroBanco: String(numeroBanco) });
  if (data) qs.set('data', data);
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/saldo-banco?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`saldo-banco ${res.status}`);
  return res.json();
}

async function runPool(items, concurrency, fn) {
  const conc = Math.min(Math.max(1, Math.floor(concurrency)), items.length || 1);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: conc }, () => worker()));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.arquivo) {
    console.error('Uso: node scripts/import-extrato-99pay-texto.mjs <arquivo.txt> [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(opts.arquivo)) {
    console.error('Arquivo não encontrado:', opts.arquivo);
    process.exit(1);
  }
  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const texto = fs.readFileSync(opts.arquivo, 'utf8');
  const parsed = parsePay99PdfExtratoText(texto);
  const sumParsed = parsed.reduce((s, r) => s + (Number(r.valor) || 0), 0);

  console.log('Arquivo:', opts.arquivo);
  console.log('Banco:', opts.banco, 'numeroBanco:', opts.numeroBanco);
  console.log(`Lançamentos parseados: ${parsed.length} (soma ${sumParsed.toFixed(2)})`);

  if (!parsed.length) {
    console.error('Nenhum lançamento reconhecido.');
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log('\nAmostra (5 primeiros):');
    for (const r of parsed.slice(0, 5)) {
      console.log(`  ${r.data}  ${r.descricao?.slice(0, 40)}  ${r.valor}`);
    }
    process.exit(0);
  }

  const token = await login(opts);
  const saldoAntes = await saldoBanco(token, opts.baseUrl, opts.numeroBanco);
  console.log('Saldo antes:', saldoAntes.saldo, `(${saldoAntes.totalLancamentos} lançamentos)`);

  const contasApi = await listarContasContabeis(token, opts.baseUrl);
  const contaContabilId = contaNaoIdentificadosId(contasApi);
  if (!contaContabilId) {
    console.error('Conta contábil N (Não Identificados) não encontrada.');
    process.exit(1);
  }

  const existentes = await carregarExistentes(token, opts.baseUrl, opts.numeroBanco);
  const novos = listarLancamentosNovosDedupe(existentes, parsed);
  const sumNovos = novos.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  console.log(`A importar: ${novos.length} novos (soma ${sumNovos.toFixed(2)})`);

  let criados = 0;
  let erros = 0;
  const amostraErros = [];

  await runPool(novos, opts.concurrency, async (row) => {
    const mapped = rowParaApi(row, contaContabilId, opts.banco, opts.numeroBanco);
    if (!mapped.ok) {
      erros += 1;
      return;
    }
    const res = await postLancamento(token, opts.baseUrl, mapped.body);
    if (res.ok) criados += 1;
    else {
      erros += 1;
      if (amostraErros.length < 5) {
        amostraErros.push(`${mapped.body.numeroLancamento}: ${res.status} ${res.text}`);
      }
    }
  });

  const saldoDepois = await saldoBanco(token, opts.baseUrl, opts.numeroBanco);
  const saldoJul21 = await saldoBanco(token, opts.baseUrl, opts.numeroBanco, '2026-07-21');

  console.log('\n--- Resumo ---');
  console.log(`Parseados:     ${parsed.length}`);
  console.log(`Novos:         ${novos.length}`);
  console.log(`POST ok:       ${criados}`);
  console.log(`POST erro:     ${erros}`);
  console.log(`Saldo antes:   ${saldoAntes.saldo}`);
  console.log(`Saldo depois:  ${saldoDepois.saldo} (${saldoDepois.totalLancamentos} lançamentos)`);
  console.log(`Saldo 21/jul:  ${saldoJul21.saldo}`);
  if (amostraErros.length) {
    console.log('Amostra erros:', amostraErros.join('\n  '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
