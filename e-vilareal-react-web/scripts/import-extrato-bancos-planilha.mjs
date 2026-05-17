#!/usr/bin/env node
/**
 * Importa extrato bancário histórico da planilha «Extratos Bancos - Itamar.xls» para a API Financeiro.
 *
 * Fase 1: aba Itaú (layout itau-pf), substituição total do extrato.
 * Importa apenas campos suportados pela API (sem elo/OK/parcela do Excel).
 *
 * Uso (a partir de e-vilareal-react-web/):
 *   npm run import:extrato-bancos-itau
 *   node scripts/import-extrato-bancos-planilha.mjs --dry-run
 *
 * Na raiz do repositório villareal/:
 *   npm run import:extrato-bancos-itau
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY (default 12)
 * Senha também em `.env.import.local` ou `~/.vilareal-import-env` (ver load-vilareal-import-env.mjs).
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import {
  BANCOS_IMPORT_PLANILHA,
  LETRA_PARA_CONTA,
  NOME_ABA_PARA_BANCO,
  NUMERO_PARA_BANCO,
} from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  LAYOUTS_EXTRATO_BANCO,
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';

const DEFAULT_FILE = '/Users/itamar/Downloads/Extratos Bancos - Itamar.xls';

function parseArgs(argv) {
  const out = {
    file: null,
    sheet: 'Itaú',
    banco: 'Itaú',
    layout: 'itau-pf',
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    substituir: false,
    concurrency: Math.min(
      24,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 12) || 12),
    ),
    limite: null,
    todosBancos: false,
    pularItau: true,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--substituir') out.substituir = true;
    else if (a === '--todos-bancos') out.todosBancos = true;
    else if (a === '--incluir-itau') out.pularItau = false;
    else if (a.startsWith('--sheet=')) out.sheet = a.slice(8).trim();
    else if (a.startsWith('--banco=')) out.banco = a.slice(8).trim();
    else if (a.startsWith('--layout=')) out.layout = a.slice(9).trim();
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(24, Math.floor(n));
    } else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--limite=')) {
      const n = Number(a.slice(9));
      if (Number.isFinite(n) && n > 0) out.limite = Math.floor(n);
    }     else if (!a.startsWith('-')) out.file = a;
  }
  if (!out.file) out.file = DEFAULT_FILE;
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
  const body = { banco, numeroBanco };
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/limpar-extrato`, {
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
    throw new Error(`limpar-extrato ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json();
}

function numeroBancoPorNome(nome) {
  const entry = Object.entries(NUMERO_PARA_BANCO).find(([, n]) => n === nome);
  return entry ? Number(entry[0]) : null;
}

function buildContaIdPorLetra(contasApi) {
  const porCodigo = new Map();
  const porNome = new Map();
  for (const c of contasApi || []) {
    if (c?.codigo) porCodigo.set(String(c.codigo).trim().toUpperCase(), c.id);
    if (c?.nome) porNome.set(String(c.nome).trim(), c.id);
  }
  const out = new Map();
  for (const [letra, nomeConta] of Object.entries(LETRA_PARA_CONTA)) {
    const id = porCodigo.get(letra) ?? porNome.get(nomeConta);
    if (id != null) out.set(letra, id);
  }
  return out;
}

function extrairProcessoUnico(body, numeroInternoAlvo) {
  const ni = Math.floor(Number(numeroInternoAlvo));
  if (body == null) return null;
  if (Array.isArray(body)) return body.find((p) => Number(p?.numeroInterno) === ni) ?? null;
  if (typeof body === 'object' && Array.isArray(body.content)) {
    return body.content.find((p) => Number(p?.numeroInterno) === ni) ?? null;
  }
  if (typeof body === 'object' && body.id != null) {
    const niResp = Number(body.numeroInterno);
    return !Number.isFinite(niResp) || niResp === ni ? body : null;
  }
  return null;
}

async function resolverCliente(token, baseUrl, codigoCliente8, cache) {
  if (cache.has(codigoCliente8)) return cache.get(codigoCliente8);
  const res = await fetch(
    `${baseUrl}/api/clientes/resolucao?${new URLSearchParams({ codigoCliente: codigoCliente8 })}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  let val = null;
  if (res.ok) {
    const j = await res.json();
    const pessoaId = j.pessoaId ?? j.id ?? null;
    val = pessoaId != null ? Number(pessoaId) : null;
  }
  cache.set(codigoCliente8, val);
  return val;
}

async function resolverProcesso(token, baseUrl, codigoCliente8, numeroInterno, cache) {
  const chave = `${codigoCliente8}:${numeroInterno}`;
  if (cache.has(chave)) return cache.get(chave);
  const params = new URLSearchParams({
    codigoCliente: codigoCliente8,
    numeroInterno: String(numeroInterno),
  });
  const res = await fetch(`${baseUrl}/api/processos?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  let val = null;
  if (res.status !== 404 && res.ok) {
    const body = await res.json();
    const proc = extrairProcessoUnico(body, numeroInterno);
    val = proc?.id != null ? Number(proc.id) : null;
  }
  cache.set(chave, val);
  return val;
}

/**
 * @param {Awaited<ReturnType<typeof extrairLancamentosDaAba>>[number]} row
 * @param {Map<string, number>} contaIdPorLetra
 * @param {string} bancoNome
 * @param {number | null} numeroBanco
 */
function rowParaPayloadApi(row, contaIdPorLetra, bancoNome, numeroBanco) {
  const contaContabilId = contaIdPorLetra.get(row.letra);
  if (!contaContabilId) return { ok: false, motivo: `conta_contabil_${row.letra}` };

  const valorNum = Number(row.valor) || 0;
  const natureza = valorNum < 0 ? 'DEBITO' : 'CREDITO';

  return {
    ok: true,
    body: {
      contaContabilId,
      clienteId: row.clienteId ?? null,
      processoId: row.processoId ?? null,
      bancoNome,
      numeroBanco,
      numeroLancamento: row.numeroLancamento,
      dataLancamento: row.dataIso,
      dataCompetencia: row.dataIso,
      descricao: String(row.descricao || 'Lançamento extrato').slice(0, 500),
      descricaoDetalhada: String(row.descricaoDetalhada || '').slice(0, 2000),
      valor: Math.abs(valorNum),
      natureza,
      refTipo: row.refTipo || 'N',
      origem: 'PLANILHA',
      status: 'ATIVO',
      grupoCompensacao: row.grupoCompensacao ?? null,
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

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<void>} fn
 */
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

function imprimirResumo(stats) {
  console.log('\n--- Resumo ---');
  console.log(`Linhas lidas:        ${stats.lidas}`);
  console.log(`Prontas para API:    ${stats.prontas}`);
  console.log(`POST ok:             ${stats.criados}`);
  console.log(`POST erro:           ${stats.errosPost}`);
  console.log(`Letra desconhecida:  ${stats.letraDesconhecida}`);
  console.log(`Cliente não achado:  ${stats.clienteNaoAchado}`);
  console.log(`Processo não achado: ${stats.processoNaoAchado}`);
  console.log(`Conta contábil falta: ${stats.contaFalta}`);
  if (stats.porLetra && Object.keys(stats.porLetra).length) {
    console.log('Por letra:', stats.porLetra);
  }
  if (stats.amostraErros?.length) {
    console.log('\nAmostra erros POST:');
    for (const e of stats.amostraErros) console.log(' ', e);
  }
}

async function importarUmBanco(opts, token, wb, bancoNome, contaIdPorLetra) {
  const layout = opts.layout
    ? LAYOUTS_EXTRATO_BANCO[opts.layout] ?? layoutExtratoPorNomeInstituicao(bancoNome)
    : layoutExtratoPorNomeInstituicao(bancoNome);
  const numeroBanco = numeroBancoPorNome(bancoNome);
  const ws = wb.Sheets[bancoNome];
  if (!ws) {
    console.error(`  Aba não encontrada: ${bancoNome}`);
    return { errosPost: 1 };
  }

  let linhas = extrairLancamentosDaAba(ws, layout, bancoNome);
  if (opts.limite != null) linhas = linhas.slice(0, opts.limite);

  const stats = {
    lidas: linhas.length,
    prontas: 0,
    criados: 0,
    errosPost: 0,
    letraDesconhecida: 0,
    clienteNaoAchado: 0,
    processoNaoAchado: 0,
    contaFalta: 0,
    porLetra: {},
    amostraErros: [],
  };

  for (const row of linhas) {
    stats.porLetra[row.letra] = (stats.porLetra[row.letra] || 0) + 1;
    if (row.letraDesconhecida) stats.letraDesconhecida += 1;
  }

  if (opts.dryRun) {
    console.log(`  ${bancoNome}: ${linhas.length} lançamentos (layout ${layout.id})`);
    return stats;
  }

  if (numeroBanco == null) {
    console.error(`  Número do banco desconhecido: ${bancoNome}`);
    return { errosPost: 1 };
  }

  if (opts.substituir) {
    const limpo = await limparExtrato(token, opts.baseUrl, bancoNome, numeroBanco);
    console.log(`  Limpou ${bancoNome}: ${limpo?.lancamentosRemovidos ?? 0}`);
  }

  const cacheCliente = new Map();
  const cacheProcesso = new Map();
  for (const row of linhas) {
    if (row.letra !== 'A') continue;
    if (row.codigoCliente) {
      const pessoaId = await resolverCliente(token, opts.baseUrl, row.codigoCliente, cacheCliente);
      if (pessoaId) row.clienteId = pessoaId;
      else stats.clienteNaoAchado += 1;
      if (row.numeroInterno != null && row.clienteId) {
        const processoId = await resolverProcesso(
          token,
          opts.baseUrl,
          row.codigoCliente,
          row.numeroInterno,
          cacheProcesso,
        );
        if (processoId) row.processoId = processoId;
        else stats.processoNaoAchado += 1;
      }
    }
  }

  const payloads = [];
  for (const row of linhas) {
    const mapped = rowParaPayloadApi(row, contaIdPorLetra, bancoNome, numeroBanco);
    if (!mapped.ok) {
      stats.contaFalta += 1;
      continue;
    }
    payloads.push({ row, body: mapped.body });
  }
  stats.prontas = payloads.length;

  let done = 0;
  await runPool(payloads, opts.concurrency, async ({ row, body }) => {
    const res = await postLancamento(token, opts.baseUrl, body);
    if (res.ok) stats.criados += 1;
    else {
      stats.errosPost += 1;
      if (stats.amostraErros.length < 3) {
        stats.amostraErros.push(`L${row.linhaExcel}: HTTP ${res.status} — ${res.text || ''}`);
      }
    }
    done += 1;
    if (done % 2000 === 0) console.log(`    … ${bancoNome} ${done}/${payloads.length}`);
  });

  console.log(
    `  ${bancoNome}: lidas=${stats.lidas} POST ok=${stats.criados} erros=${stats.errosPost}`,
  );
  return stats;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(opts.file);

  if (!fs.existsSync(filePath)) {
    console.error(`Ficheiro não encontrado: ${filePath}`);
    process.exit(1);
  }

  const bancosAlvo = opts.todosBancos
    ? BANCOS_IMPORT_PLANILHA.filter((n) => !opts.pularItau || n !== 'Itaú')
    : [opts.banco || NOME_ABA_PARA_BANCO[opts.sheet] || opts.sheet];

  console.log(`Ficheiro: ${filePath}`);
  console.log(`Bancos (${bancosAlvo.length}): ${bancosAlvo.join(', ')}`);
  console.log(`Modo: ${opts.dryRun ? 'DRY-RUN' : opts.substituir ? 'SUBSTITUIR + IMPORTAR' : 'IMPORTAR'}`);

  const wb = XLSX.readFile(filePath, { cellDates: true, cellNF: false });

  if (opts.dryRun) {
    let total = 0;
    for (const nome of bancosAlvo) {
      const st = await importarUmBanco(opts, null, wb, nome, new Map());
      total += st.lidas || 0;
    }
    console.log(`\nTotal: ${total} lançamentos`);
    return;
  }

  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const token = await login(opts);
  const contasApi = await listarContasContabeis(token, opts.baseUrl);
  const contaIdPorLetra = buildContaIdPorLetra(contasApi);

  let totalErros = 0;
  for (const nome of bancosAlvo) {
    const st = await importarUmBanco(opts, token, wb, nome, contaIdPorLetra);
    totalErros += st.errosPost || 0;
  }

  if (totalErros > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
