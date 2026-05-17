#!/usr/bin/env node
/**
 * Importa extrato 99 Pay a partir de planilha consolidada (layout auditado).
 *
 * Uso (a partir de e-vilareal-react-web/):
 *   node scripts/import-extrato-99pay-xlsx.mjs "/caminho/extrato_consolidado_auditado.xlsx"
 *   node scripts/import-extrato-99pay-xlsx.mjs arquivo.xlsx --dry-run
 *   node scripts/import-extrato-99pay-xlsx.mjs arquivo.xlsx --substituir --numero-banco=30
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';

import { nomeBancoPay99Padrao } from '../src/utils/pay99PdfExtrato.js';
import { listarLancamentosNovosDedupe } from '../src/utils/ofx.js';
import { parse99PayConsolidadoXlsx } from './lib/parse-99pay-consolidado-xlsx.mjs';

const BANCO_PADRAO = nomeBancoPay99Padrao();
const NUMERO_BANCO_PADRAO = 30;

function parseArgs(argv) {
  const out = {
    xlsx: null,
    banco: BANCO_PADRAO,
    numeroBanco: process.env.VILAREAL_99PAY_NUMERO_BANCO
      ? Number(process.env.VILAREAL_99PAY_NUMERO_BANCO)
      : NUMERO_BANCO_PADRAO,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    substituir: false,
    concurrency: Math.min(
      24,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 12) || 12),
    ),
    sheet: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--substituir') out.substituir = true;
    else if (a.startsWith('--banco=')) out.banco = a.slice(8).trim();
    else if (a.startsWith('--numero-banco=')) {
      const n = Number(a.slice(15));
      if (Number.isFinite(n)) out.numeroBanco = n;
    } else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--sheet=')) out.sheet = a.slice(8).trim();
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(24, Math.floor(n));
    } else if (!a.startsWith('-')) out.xlsx = a;
  }
  if (!argv.includes('--substituir') && !out.dryRun) {
    out.substituir = true;
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
  if (!res.ok) {
    throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
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

async function limparExtrato(token, baseUrl, banco, numeroBanco) {
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/limpar-extrato`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ banco, numeroBanco }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`limpar-extrato ${res.status}: ${t.slice(0, 500)}`);
  }
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
  return {
    numero: String(l.numeroLancamento ?? ''),
    data,
    valor,
  };
}

async function carregarExistentes(token, baseUrl, numeroBanco) {
  const rows = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const res = await listarPaginado(token, baseUrl, {
      numeroBanco,
      page,
      size: 200,
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
      origem: 'PLANILHA_99PAY',
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
  if (!opts.xlsx) {
    console.error(
      'Uso: node scripts/import-extrato-99pay-xlsx.mjs <arquivo.xlsx> [--numero-banco=30] [--substituir] [--dry-run]',
    );
    process.exit(1);
  }
  if (!fs.existsSync(opts.xlsx)) {
    console.error('Arquivo não encontrado:', opts.xlsx);
    process.exit(1);
  }

  console.log('Planilha:', opts.xlsx);
  console.log('Banco:', opts.banco, `(nº ${opts.numeroBanco})`);

  const parsed = parse99PayConsolidadoXlsx(opts.xlsx, { sheet: opts.sheet });
  console.log(`Lançamentos na planilha: ${parsed.length}`);
  if (!parsed.length) {
    console.error('Nenhum lançamento reconhecido na aba Extrato Consolidado.');
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log('\nAmostra (5 primeiros):');
    for (const r of parsed.slice(0, 5)) {
      console.log(`  ${r.data}  ${r.descricao?.slice(0, 40)}  ${r.valor}`);
    }
    const creditos = parsed.filter((r) => r.valor > 0).length;
    const debitos = parsed.filter((r) => r.valor < 0).length;
    console.log(`\nCréditos: ${creditos}  Débitos: ${debitos}`);
    process.exit(0);
  }

  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const token = await login(opts);
  const numeroBanco = opts.numeroBanco;
  console.log('numeroBanco:', numeroBanco);

  const contasApi = await listarContasContabeis(token, opts.baseUrl);
  const contaContabilId = contaNaoIdentificadosId(contasApi);
  if (!contaContabilId) {
    console.error('Conta contábil «Conta Não Identificados» (letra N) não encontrada na API.');
    process.exit(1);
  }

  if (opts.substituir) {
    const limpo = await limparExtrato(token, opts.baseUrl, opts.banco, numeroBanco);
    console.log(`Extrato limpo: ${limpo?.lancamentosRemovidos ?? 0} lançamento(s) removidos.`);
  }

  const existentes = opts.substituir ? [] : await carregarExistentes(token, opts.baseUrl, numeroBanco);
  const novos = opts.substituir ? parsed : listarLancamentosNovosDedupe(existentes, parsed);
  console.log(`A importar: ${novos.length} (${parsed.length - novos.length} já existiam / ignorados)`);

  let criados = 0;
  let erros = 0;
  const amostraErros = [];

  await runPool(novos, opts.concurrency, async (row) => {
    const mapped = rowParaApi(row, contaContabilId, opts.banco, numeroBanco);
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

  console.log('\n--- Resumo ---');
  console.log(`Planilha:      ${parsed.length}`);
  console.log(`Importados:    ${criados}`);
  console.log(`Erros POST:    ${erros}`);
  if (amostraErros.length) {
    console.log('Amostra erros:', amostraErros.join('\n  '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
