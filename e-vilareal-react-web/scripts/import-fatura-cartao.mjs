#!/usr/bin/env node
/**
 * Importa fatura de cartão (Excel BTG ou Itaú) para a API local/produção.
 *
 * Modo padrão (`--fatura`): substitui o ciclo do vencimento — remove lançamentos
 * PLANILHA/FATURA daquele mês, importa o .xlsx e recalcula AUTO-FAT.
 *
 * Exemplos:
 *   node scripts/import-fatura-cartao.mjs fatura.xlsx --cartao="BTG Cartão" --dry-run
 *   node scripts/import-fatura-cartao.mjs ~/Downloads/*_BTG.xlsx --cartao="BTG Cartão"
 *   node scripts/import-fatura-cartao.mjs fatura.xlsx --cartao=Visa --mesclar
 *   node scripts/import-fatura-cartao.mjs fatura.xlsx --cartao=Visa --substituir
 *
 * Variáveis (.env.import.local / ~/.vilareal-import-env):
 *   VILAREAL_IMPORT_LOGIN, VILAREAL_IMPORT_SENHA, VILAREAL_API_BASE
 *   VILAREAL_FATURA_EXCEL_SENHA  (BTG: CPF titular, 11 dígitos)
 */
import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { lerEParsearFaturaCartaoXlsx } from '../src/utils/faturaCartaoXlsx.js';
import { parseFaturaCartaoItauPdfText } from '../src/utils/faturaCartaoItauImport.js';
import { extrairTextoPdfDeBuffer } from './lib/extrair-texto-pdf-node.mjs';

function parseArgs(argv) {
  const out = {
    files: [],
    cartao: process.env.VILAREAL_IMPORT_CARTAO || 'BTG Cartão',
    numeroCartao: process.env.VILAREAL_IMPORT_NUMERO_CARTAO || '',
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    substituir: false,
    mesclar: false,
    fatura: false,
    limparPlanilha: true,
    recalcularFechamento: true,
    force: false,
    finalCartao: null,
    senhaExcel: process.env.VILAREAL_FATURA_EXCEL_SENHA || '',
    senhaPdf: process.env.VILAREAL_FATURA_PDF_SENHA || '',
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--substituir') out.substituir = true;
    else if (a === '--mesclar') out.mesclar = true;
    else if (a === '--fatura') out.fatura = true;
    else if (a === '--sem-limpar-planilha') out.limparPlanilha = false;
    else if (a === '--sem-recalcular-fechamento') out.recalcularFechamento = false;
    else if (a === '--force') out.force = true;
    else if (a.startsWith('--cartao=')) out.cartao = a.slice(9).trim();
    else if (a.startsWith('--numero-cartao=')) out.numeroCartao = a.slice(16).trim();
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--senha-excel=')) out.senhaExcel = a.slice(14);
    else if (a.startsWith('--senha-pdf=')) out.senhaPdf = a.slice(12);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--final-cartao=')) out.finalCartao = a.slice(15).trim();
    else if (!a.startsWith('-')) out.files.push(a);
  }

  if (out.substituir) {
    out.fatura = false;
    out.mesclar = false;
  } else if (out.mesclar) {
    out.fatura = false;
  } else if (!out.dryRun) {
    out.fatura = true;
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

function resolverCartao(cartoes, opts) {
  const nome = String(opts.cartao || '').trim();
  const nc = Number(opts.numeroCartao);
  let cartao = (cartoes || []).find((c) => String(c.nome).trim() === nome);
  if (!cartao && Number.isFinite(nc)) {
    cartao = (cartoes || []).find((c) => Number(c.numeroCartao) === nc);
  }
  if (!cartao && nome) {
    cartao = (cartoes || []).find((c) =>
      String(c.nome).toLowerCase().includes(nome.toLowerCase()),
    );
  }
  return cartao;
}

async function limparExtratoCartao(token, baseUrl, cartao) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/limpar-extrato`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ cartao: cartao.nome, numeroCartao: cartao.numeroCartao }),
  });
  if (!res.ok) throw new Error(`limpar-extrato: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Remove lançamentos do ciclo (PLANILHA/FATURA), preservando AUTO-FAT. */
async function limparCicloFatura(token, baseUrl, cartaoId, dataVencimento, { apenasPlanilha = false } = {}) {
  // A API filtra por dataLancamento; o ciclo da fatura é dataCompetencia (= vencimento).
  const params = new URLSearchParams({ cartaoId: String(cartaoId) });
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET lancamentos ciclo: ${res.status}`);
  const lista = await res.json();
  let removidos = 0;
  for (const l of lista || []) {
    const competencia = String(l.dataCompetencia ?? '').slice(0, 10);
    if (competencia !== dataVencimento) continue;
    const numero = String(l.numeroLancamento ?? '').trim();
    const origem = String(l.origem ?? '').trim();
    if (/^AUTO-FAT-/i.test(numero)) continue;
    if (apenasPlanilha && origem !== 'PLANILHA') continue;
    const del = await fetch(`${baseUrl}/api/financeiro/cartoes/lancamentos/${l.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (del.status === 204) removidos += 1;
  }
  return removidos;
}

async function executarFechamentoFatura(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/fechamento-fatura/executar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) throw new Error(`fechamento-fatura: ${res.status} ${(await res.text()).slice(0, 300)}`);
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

async function lerArquivoFatura(filePath, opts) {
  const lower = filePath.toLowerCase();
  const parseOpts = {
    finalCartaoFiltro: opts.finalCartao,
    ignorarPagamento: true,
    password: opts.senhaExcel || null,
    senhaExcel: opts.senhaExcel || null,
  };
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buf = fs.readFileSync(filePath);
    const parsed = await lerEParsearFaturaCartaoXlsx(buf, parseOpts);
    const origem = parsed.meta?.formato === 'BTG' ? 'FATURA_XLSX_BTG' : 'FATURA_XLSX';
    return { ...parsed, origem };
  }
  if (lower.endsWith('.pdf')) {
    const senhaPdf =
      opts.senhaPdf ||
      (path.basename(filePath).toLowerCase().startsWith('fatura_visa_') ? '00733' : '');
    const { texto } = await extrairTextoPdfDeBuffer(filePath, {
      password: senhaPdf || undefined,
    });
    const parsed = parseFaturaCartaoItauPdfText(texto, parseOpts);
    return { ...parsed, origem: 'FATURA_PDF' };
  }
  throw new Error('Formato não suportado. Use .xlsx (recomendado).');
}

function logResumoParse(filePath, { rows, meta, origem }) {
  console.log(`\nArquivo: ${filePath}`);
  console.log(`Origem: ${origem} · ${rows.length} lançamentos (${meta?.ignoradosPagamento ?? 0} pagamentos ignorados)`);
  if (meta?.dataVencimento) console.log(`Vencimento: ${meta.dataVencimento}`);
  if (meta?.saldoFaturaAnterior != null && meta.saldoFaturaAnterior !== 0) {
    console.log(`Saldo fatura anterior (resumo BTG): ${Number(meta.saldoFaturaAnterior).toFixed(2)}`);
  }
  if (meta?.conferenciaTotal) {
    const c = meta.conferenciaTotal;
    console.log(
      `Total: soma ${c.somaCalculada?.toFixed(2)} · banco ${c.valorTotalBanco?.toFixed(2) ?? '—'} · ${c.ok === true ? 'OK' : c.ok === false ? 'DIVERGE' : 'sem referência'}`,
    );
    if (c.ok === false && c.diferenca != null) {
      console.log(`  Diferença: ${Number(c.diferenca).toFixed(2)}`);
    }
  }
}

async function importarArquivo(filePath, opts, ctx) {
  const { rows, meta, origem } = await lerArquivoFatura(filePath, opts);
  logResumoParse(filePath, { rows, meta, origem });

  if (opts.dryRun) {
    console.log('[DRY-RUN] Primeiras linhas:');
    for (const r of rows.slice(0, 5)) {
      console.log(`  ${r.dataIso}  ${r.valor}\t${r.descricao}`);
    }
    return { ok: true, vencimento: meta?.dataVencimento ?? null };
  }

  const conferencia = meta?.conferenciaTotal;
  if (conferencia?.ok === false && !opts.force) {
    throw new Error(
      `Conferência DIVERGE (dif. ${conferencia.diferenca}). Use --force para importar mesmo assim.`,
    );
  }

  const dataVencimento = meta?.dataVencimento ?? null;
  if (!dataVencimento) {
    throw new Error('Vencimento não encontrado no arquivo — abortando.');
  }

  if (opts.fatura) {
    const removidosCiclo = await limparCicloFatura(
      ctx.token,
      opts.baseUrl,
      ctx.cartao.id,
      dataVencimento,
      { apenasPlanilha: false },
    );
    console.log(`Ciclo limpo: ${removidosCiclo} lançamento(s) removido(s) (exceto AUTO-FAT)`);
  } else if (opts.mesclar && opts.limparPlanilha) {
    const removidosPlanilha = await limparCicloFatura(
      ctx.token,
      opts.baseUrl,
      ctx.cartao.id,
      dataVencimento,
      { apenasPlanilha: true },
    );
    console.log(`PLANILHA removida: ${removidosPlanilha} lançamento(s)`);
  }

  let criados = 0;
  let erros = 0;
  for (const row of rows) {
    const body = {
      cartaoId: ctx.cartao.id,
      contaContabilId: ctx.contaN.id,
      clienteId: null,
      processoId: null,
      numeroLancamento: row.numeroLancamento,
      dataLancamento: row.dataIso,
      dataCompetencia: dataVencimento,
      descricao: row.descricao,
      descricaoDetalhada: row.descricaoDetalhada || '',
      valor: row.valor,
      refTipo: 'N',
      origem,
      status: 'ATIVO',
    };
    const res = await postLancamento(ctx.token, opts.baseUrl, body);
    if (res.ok) criados += 1;
    else {
      erros += 1;
      if (erros <= 3) console.error(`  Erro POST: ${row.descricao?.slice(0, 40)} — ${res.text}`);
    }
  }

  console.log(`Importado: ${criados} criados, ${erros} erros`);
  if (erros > 0) return { ok: false, vencimento: dataVencimento };

  ctx.vencimentosImportados.add(dataVencimento);
  return { ok: true, vencimento: dataVencimento, total: meta?.conferenciaTotal?.somaCalculada };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.files.length) {
    console.error(`Uso: node scripts/import-fatura-cartao.mjs <fatura.xlsx> [mais.xlsx ...] --cartao="BTG Cartão"

Modos (padrão: --fatura):
  --fatura                 Limpa ciclo do vencimento + importa + recalcula AUTO-FAT
  --mesclar                Só adiciona lançamentos novos (sem limpar ciclo)
  --substituir             Apaga extrato inteiro do cartão antes de importar
  --dry-run                Só parseia e exibe totais
  --force                  Importa mesmo se conferência DIVERGE
  --sem-recalcular-fechamento
  --senha-excel=           Senha do .xlsx BTG (CPF, 11 dígitos)`);
    process.exit(1);
  }

  const files = opts.files.map((f) => path.resolve(f)).filter((f) => {
    if (!fs.existsSync(f)) {
      console.error(`Arquivo não encontrado: ${f}`);
      return false;
    }
    return true;
  });
  if (!files.length) process.exit(1);

  console.log(`Cartão: ${opts.cartao}`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(
    `Modo: ${opts.substituir ? 'substituir cartão' : opts.mesclar ? 'mesclar' : opts.dryRun ? 'dry-run' : 'fatura (ciclo)'}`,
  );

  if (opts.dryRun) {
    for (const filePath of files) {
      await importarArquivo(filePath, opts, {});
    }
    return;
  }

  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const token = await login(opts);
  const [cartoes, contas] = await Promise.all([listarCartoes(token, opts.baseUrl), listarContas(token, opts.baseUrl)]);
  const cartao = resolverCartao(cartoes, opts);
  if (!cartao?.id) {
    console.error(
      `Cartão «${opts.cartao}» não encontrado. Disponíveis: ${(cartoes || []).map((c) => c.nome).join(', ')}`,
    );
    process.exit(1);
  }
  const contaN =
    (contas || []).find((c) => String(c.codigo ?? '').toUpperCase() === 'N') ||
    (contas || []).find((c) => /não identific/i.test(String(c.nome ?? '')));
  if (!contaN?.id) {
    console.error('Conta N não encontrada.');
    process.exit(1);
  }

  if (opts.substituir && files.length === 1) {
    const limpo = await limparExtratoCartao(token, opts.baseUrl, cartao);
    console.log(`Extrato limpo: ${limpo?.lancamentosRemovidos ?? 0} removidos`);
  }

  const ctx = { token, cartao, contaN, vencimentosImportados: new Set() };
  let falhas = 0;
  for (const filePath of files) {
    try {
      const r = await importarArquivo(filePath, opts, ctx);
      if (!r.ok) falhas += 1;
    } catch (e) {
      console.error(`Falha ${path.basename(filePath)}: ${e.message}`);
      falhas += 1;
    }
  }

  if (opts.recalcularFechamento && ctx.vencimentosImportados.size > 0 && !opts.mesclar) {
    const fech = await executarFechamentoFatura(token, opts.baseUrl);
    console.log(`\nAUTO-FAT: ${fech?.fechamentosProcessados ?? 0} fechamento(s) recalculado(s)`);
  }

  if (falhas > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
