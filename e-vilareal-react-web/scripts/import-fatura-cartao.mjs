#!/usr/bin/env node
/**
 * Importa fatura de cartão Itaú (Excel preferencial ou PDF) para a API.
 *
 * Exemplos:
 *   node scripts/import-fatura-cartao.mjs "/path/fatura.xlsx" --cartao=Visa --login=itamar
 *   node scripts/import-fatura-cartao.mjs fatura.pdf --cartao="Mastercard Black" --dry-run
 */
import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  parseFaturaCartaoItauPdfText,
  parseFaturaCartaoItauXlsxArrayBuffer,
} from '../src/utils/faturaCartaoItauImport.js';

function parseArgs(argv) {
  const out = {
    file: null,
    cartao: 'Visa',
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    substituir: false,
    finalCartao: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--substituir') out.substituir = true;
    else if (a.startsWith('--cartao=')) out.cartao = a.slice(9).trim();
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--final-cartao=')) out.finalCartao = a.slice(15).trim();
    else if (!a.startsWith('-')) out.file = a;
  }
  if (!out.substituir && !out.dryRun) out.substituir = true;
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
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

async function listarCartoes(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET cartoes: ${res.status}`);
  return res.json();
}

async function listarContas(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/contas`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET contas: ${res.status}`);
  return res.json();
}

async function limparExtrato(token, baseUrl, cartao, numeroCartao) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/limpar-extrato`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ cartao, numeroCartao }),
  });
  if (!res.ok) throw new Error(`limpar-extrato: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function postLancamento(token, baseUrl, body) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, text: (await res.text()).slice(0, 300) };
  return { ok: true };
}

function lerArquivoFatura(filePath, opts) {
  const lower = filePath.toLowerCase();
  const parseOpts = {
    finalCartaoFiltro: opts.finalCartao,
    ignorarPagamento: true,
  };
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buf = fs.readFileSync(filePath);
    const parsed = parseFaturaCartaoItauXlsxArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), parseOpts);
    return { ...parsed, origem: 'FATURA_XLSX' };
  }
  if (lower.endsWith('.pdf')) {
    console.warn('PDF: use o script via UI para OCR ou exporte Excel. Tentando texto bruto não disponível em CLI.');
    throw new Error('PDF no CLI requer conversão manual — prefira .xlsx ou use a tela Importar fatura.');
  }
  throw new Error('Formato não suportado. Use .xlsx (recomendado).');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file) {
    console.error('Uso: node scripts/import-fatura-cartao.mjs <fatura.xlsx> --cartao=Visa [--substituir|--dry-run]');
    process.exit(1);
  }
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(`Arquivo: ${filePath}`);
  console.log(`Cartão: ${opts.cartao}`);
  const { rows, meta, origem } = lerArquivoFatura(filePath, opts);
  const dataVencimento = meta?.dataVencimento ?? null;
  console.log(`Origem: ${origem} · ${rows.length} lançamentos (${meta?.ignoradosPagamento ?? 0} pagamentos ignorados)`);
  if (meta?.dataVencimento) console.log(`Vencimento: ${meta.dataVencimento}`);
  if (meta?.conferenciaTotal) {
    const c = meta.conferenciaTotal;
    console.log(
      `Total: soma ${c.somaCalculada?.toFixed(2)} · banco ${c.valorTotalBanco?.toFixed(2) ?? '—'} · ${c.ok === true ? 'OK' : c.ok === false ? 'DIVERGE' : 'sem referência'}`,
    );
  }

  if (opts.dryRun) {
    console.log('[DRY-RUN] Primeiras linhas:');
    for (const r of rows.slice(0, 5)) {
      console.log(`  ${r.dataIso}  ${r.valor}\t${r.descricao}`);
    }
    return;
  }

  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const token = await login(opts);
  const [cartoes, contas] = await Promise.all([listarCartoes(token, opts.baseUrl), listarContas(token, opts.baseUrl)]);
  const cartao = (cartoes || []).find((c) => String(c.nome).trim() === opts.cartao);
  if (!cartao?.id) {
    console.error(`Cartão «${opts.cartao}» não encontrado. Disponíveis: ${(cartoes || []).map((c) => c.nome).join(', ')}`);
    process.exit(1);
  }
  const contaN =
    (contas || []).find((c) => String(c.codigo ?? '').toUpperCase() === 'N') ||
    (contas || []).find((c) => /não identific/i.test(String(c.nome ?? '')));
  if (!contaN?.id) {
    console.error('Conta N não encontrada.');
    process.exit(1);
  }

  if (opts.substituir) {
    const limpo = await limparExtrato(token, opts.baseUrl, cartao.nome, cartao.numeroCartao);
    console.log(`Extrato limpo: ${limpo?.lancamentosRemovidos ?? 0} removidos`);
  }

  let criados = 0;
  let erros = 0;
  for (const row of rows) {
    const body = {
      cartaoId: cartao.id,
      contaContabilId: contaN.id,
      clienteId: null,
      processoId: null,
      numeroLancamento: row.numeroLancamento,
      dataLancamento: row.dataIso,
      dataCompetencia: dataVencimento || row.dataIso,
      descricao: row.descricao,
      descricaoDetalhada: row.descricaoDetalhada || '',
      valor: row.valor,
      refTipo: 'N',
      origem,
      status: 'ATIVO',
    };
    const res = await postLancamento(token, opts.baseUrl, body);
    if (res.ok) criados += 1;
    else erros += 1;
  }

  console.log(`Concluído: ${criados} criados, ${erros} erros`);
  if (erros > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
