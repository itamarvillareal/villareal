#!/usr/bin/env node
/**
 * Importa extrato BTG Pactual a partir de PDF, sem proteção de data de corte da UI.
 *
 * Uso:
 *   node scripts/import-extrato-btg-pdf.mjs "/caminho/extrato.pdf"
 *   node scripts/import-extrato-btg-pdf.mjs arquivo.pdf --dry-run
 *   node scripts/import-extrato-btg-pdf.mjs arquivo.pdf --numero-banco=21
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';
import { PDFParse } from 'pdf-parse';

import { parseBtgPdfExtratoText } from '../src/utils/btgPdfExtrato.js';
import { listarLancamentosNovosDedupe } from '../src/utils/ofx.js';

const BANCO_PADRAO = 'BTG';
const NUMERO_BANCO_PADRAO = 21;

function parseArgs(argv) {
  const out = {
    pdf: null,
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
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(24, Math.floor(n));
    } else if (!a.startsWith('-')) out.pdf = a;
  }
  return out;
}

async function extrairTextoPdf(caminho) {
  const buf = fs.readFileSync(caminho);
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  return String(text ?? '');
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
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 400)}`);
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

async function consultarNumerosExistentes(token, baseUrl, numeroBanco, numeros) {
  const res = await fetch(`${baseUrl}/api/financeiro/extrato/importacao/numeros-existentes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ numeroBanco, numeros }),
  });
  if (!res.ok) throw new Error(`numeros-existentes ${res.status}`);
  const j = await res.json();
  return new Set(j?.existentes ?? []);
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
    descricao: String(l.descricao ?? ''),
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
      descricao: String(row.descricao || 'Lançamento BTG').slice(0, 500),
      descricaoDetalhada: String(row.descricaoDetalhada || row.descricao || '').slice(0, 2000),
      valor: Math.abs(valorNum),
      natureza: valorNum < 0 ? 'DEBITO' : 'CREDITO',
      refTipo: 'N',
      origem: 'PDF',
      status: 'ATIVO',
      etapa: 'IMPORTADO',
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

function contarPorAno(rows) {
  const out = {};
  for (const r of rows) {
    const y = String(r.data ?? '').slice(-4) || '?';
    out[y] = (out[y] || 0) + 1;
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.pdf) {
    console.error('Uso: node scripts/import-extrato-btg-pdf.mjs <arquivo.pdf> [--numero-banco=21] [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(opts.pdf)) {
    console.error('Arquivo não encontrado:', opts.pdf);
    process.exit(1);
  }
  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  console.log('PDF:', opts.pdf);
  console.log('Banco:', opts.banco, `(numero=${opts.numeroBanco})`);
  console.log('API:', opts.baseUrl);

  const texto = await extrairTextoPdf(opts.pdf);
  const periodo = texto.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (periodo) console.log('Período PDF:', periodo[1], 'a', periodo[2]);

  const parsed = parseBtgPdfExtratoText(texto);
  console.log(`Lançamentos no PDF: ${parsed.length}`);
  console.log('Por ano no PDF:', contarPorAno(parsed));
  if (!parsed.length) {
    console.error('Nenhum lançamento reconhecido no PDF BTG.');
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log('\nAmostra (5 primeiros):');
    for (const r of parsed.slice(0, 5)) {
      console.log(`  ${r.data}  ${r.valor}  ${String(r.descricao).slice(0, 50)}  ${r.numero}`);
    }
    process.exit(0);
  }

  const token = await login(opts);
  const numeroBanco = opts.numeroBanco;
  const contasApi = await listarContasContabeis(token, opts.baseUrl);
  const contaContabilId = contaNaoIdentificadosId(contasApi);
  if (!contaContabilId) {
    console.error('Conta contábil «Conta Não Identificados» (letra N) não encontrada na API.');
    process.exit(1);
  }

  const existentes = await carregarExistentes(token, opts.baseUrl, numeroBanco);
  const numeros = [...new Set(parsed.map((r) => String(r.numero ?? '').trim()).filter(Boolean))];
  const numerosExistentes = numeros.length
    ? await consultarNumerosExistentes(token, opts.baseUrl, numeroBanco, numeros)
    : new Set();

  const analise = listarLancamentosNovosDedupe(existentes, parsed, {
    respeitarExtratoComoMestre: true,
    numerosExistentes,
  });
  const novos = analise;
  console.log(`A importar (novos): ${novos.length} (${parsed.length - novos.length} já existiam)`);
  console.log('Novos por ano:', contarPorAno(novos));

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
      if (amostraErros.length < 8) {
        amostraErros.push(`${mapped.body.numeroLancamento} ${mapped.body.dataLancamento}: ${res.status} ${res.text}`);
      }
    }
  });

  const verif = await listarPaginado(token, opts.baseUrl, {
    numeroBanco,
    dataInicio: '2023-01-01',
    dataFim: '2023-12-31',
    page: 0,
    size: 1,
  });

  console.log('\n--- Resumo ---');
  console.log(`PDF:              ${parsed.length}`);
  console.log(`Novos:            ${novos.length}`);
  console.log(`POST ok:          ${criados}`);
  console.log(`POST erro:        ${erros}`);
  console.log(`Ativos 2023 agora: ${verif.totalElements}`);
  if (amostraErros.length) {
    console.log('Amostra erros:');
    for (const e of amostraErros) console.log(' ', e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
