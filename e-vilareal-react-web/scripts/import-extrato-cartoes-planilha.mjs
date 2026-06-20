#!/usr/bin/env node
/**
 * Importa extratos de cartão (fatura) da planilha Extratos Bancos para a API.
 * Valor com sinal da fatura (sem inversão). Inversão contábil só no consolidado (front).
 *
 * Cartões (aba = nome do cartão):
 *   Mastercard | Visa | Mastercard Sicoob | Mastercard Black | BTG Cartão
 *
 * Uso:
 *   cd e-vilareal-react-web
 *   export VILAREAL_IMPORT_SENHA='…'
 *
 *   node scripts/import-extrato-cartoes-planilha.mjs --cartao="Visa" --dry-run
 *   node scripts/import-extrato-cartoes-planilha.mjs --cartao="Mastercard Black" --substituir --login=itamar
 *   node scripts/import-extrato-cartoes-planilha.mjs --todos-cartoes --substituir --login=itamar
 *
 * Atalho (repo root):
 *   ./scripts/import-cartao-extrato-planilha.sh --cartao "Visa" --dry-run
 *   ./scripts/import-cartao-extrato-planilha.sh --cartao "Mastercard Black" --substituir
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import {
  CARTOES_IMPORT_PLANILHA,
  LETRA_PARA_CONTA,
  NOME_ABA_PARA_CARTAO,
  NUMERO_PARA_CARTAO,
} from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';
import {
  candidatosExtratoBancosPlanilhaXlsParaLog,
  resolveExtratoBancosPlanilhaXlsPath,
} from './lib/resolve-extrato-bancos-planilha-xls.mjs';
import { anexarCodigoClienteTagDescricaoDetalhada } from '../src/data/financeiroData.js';

function printHelp() {
  console.log(`Importa extrato de cartão da planilha Extratos Bancos (.xls/.xlsx).

Cartões disponíveis:
  ${CARTOES_IMPORT_PLANILHA.join(' | ')}

Opções:
  --cartao=NOME       Cartão alvo (nome da aba; ex.: "Mastercard Black")
  --todos-cartoes     Importa todos os cartões acima
  --substituir        Limpa extrato do cartão na API antes de importar (padrão se não --dry-run)
  --dry-run           Só conta linhas, não chama API
  --login=USER        Login API (padrão: itamar)
  --senha=…           Ou VILAREAL_IMPORT_SENHA
  --base-url=URL      Padrão: VILAREAL_API_BASE ou http://localhost:8080
  --limite=N          Máximo de linhas por cartão (debug)
  --concurrency=N     Paralelismo POST (padrão 12)
  [caminho-planilha]  Opcional; senão busca Extratos Bancos no Dropbox/paths conhecidos

Exemplos:
  node scripts/import-extrato-cartoes-planilha.mjs --cartao="Visa" --dry-run
  node scripts/import-extrato-cartoes-planilha.mjs --cartao="Mastercard" --substituir --login=itamar
  node scripts/import-extrato-cartoes-planilha.mjs --todos-cartoes --substituir --login=itamar
`);
}

function parseArgs(argv) {
  const out = {
    file: null,
    sheet: null,
    cartao: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    substituir: false,
    todosCartoes: false,
    help: false,
    concurrency: Math.min(
      24,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 12) || 12),
    ),
    limite: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--substituir') out.substituir = true;
    else if (a === '--todos-cartoes') out.todosCartoes = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--cartao' || a === '--cartao-nome') {
      out.cartao = String(argv[i + 1] || '').trim();
      i += 1;
    } else if (a.startsWith('--cartao=')) out.cartao = a.slice(9).trim();
    else if (a === '--sheet') {
      out.sheet = String(argv[i + 1] || '').trim();
      i += 1;
    } else if (a.startsWith('--sheet=')) out.sheet = a.slice(8).trim();
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(24, Math.floor(n));
    } else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--limite=')) {
      const n = Number(a.slice(9));
      if (Number.isFinite(n) && n > 0) out.limite = Math.floor(n);
    } else if (!a.startsWith('-')) out.file = a;
  }
  if (!out.file) {
    const resolved = resolveExtratoBancosPlanilhaXlsPath(null);
    if (!resolved) {
      console.error(
        'Planilha Extratos Bancos não encontrada. Tentados:\n',
        candidatosExtratoBancosPlanilhaXlsParaLog(null).map((p) => `  ${p}`).join('\n'),
      );
      process.exit(1);
    }
    out.file = resolved;
  }
  if (!argv.includes('--substituir') && !out.dryRun) out.substituir = true;
  if (!out.todosCartoes) {
    const nome =
      out.cartao ||
      (out.sheet ? NOME_ABA_PARA_CARTAO[out.sheet] || out.sheet : null);
    if (!nome) {
      console.error(
        'Informe o cartão: --cartao "Visa"  ou  --todos-cartoes\n' +
          `Cartões: ${CARTOES_IMPORT_PLANILHA.join(', ')}\n` +
          'Use --help para mais opções.',
      );
      process.exit(2);
    }
    if (!CARTOES_IMPORT_PLANILHA.includes(nome)) {
      console.error(
        `Cartão desconhecido: «${nome}»\n` +
          `Válidos: ${CARTOES_IMPORT_PLANILHA.join(', ')}`,
      );
      process.exit(2);
    }
    out.cartao = nome;
    out.sheet = nome;
  }
  return out;
}

function avisarSenhaInvalida(senha) {
  const s = String(senha || '').trim();
  if (s === '…' || s === '...' || s === 'senha' || s === 'sua-senha-real') {
    return 'VILAREAL_IMPORT_SENHA parece placeholder — use a senha real (ver .env.import.local)';
  }
  return null;
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

async function listarCartoesApi(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET cartoes: ${res.status}`);
  return res.json();
}

async function limparExtratoCartao(token, baseUrl, cartao, numeroCartao) {
  const res = await fetch(`${baseUrl}/api/financeiro/cartoes/limpar-extrato`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ cartao, numeroCartao }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`limpar-extrato cartão ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json();
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

function buildCartaoIdPorNome(cartoesApi) {
  const out = new Map();
  for (const c of cartoesApi || []) {
    if (c?.nome && c?.id != null) out.set(String(c.nome).trim(), Number(c.id));
  }
  return out;
}

function numeroCartaoPorNome(nome) {
  const entry = Object.entries(NUMERO_PARA_CARTAO).find(([, n]) => n === nome);
  return entry ? Number(entry[0]) : null;
}

/** Reutiliza resolvers do import bancário via import dinâmico leve — duplicado mínimo. */
async function resolverCliente(token, baseUrl, codigoCliente8, cache) {
  if (cache.has(codigoCliente8)) return cache.get(codigoCliente8);
  const res = await fetch(
    `${baseUrl}/api/clientes/resolucao?${new URLSearchParams({ codigoCliente: codigoCliente8 })}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  let val = null;
  if (res.ok) {
    const j = await res.json();
    const clientePk = Number(j.clienteId ?? j.id);
    val = Number.isFinite(clientePk) && clientePk > 0 ? clientePk : null;
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
    const ni = Math.floor(Number(numeroInterno));
    const proc = Array.isArray(body)
      ? body.find((p) => Number(p?.numeroInterno) === ni)
      : body?.content?.find?.((p) => Number(p?.numeroInterno) === ni) ?? body;
    val = proc?.id != null ? Number(proc.id) : null;
  }
  cache.set(chave, val);
  return val;
}

function rowParaPayloadCartao(row, contaIdPorLetra, cartaoId) {
  const contaContabilId = contaIdPorLetra.get(row.letra);
  if (!contaContabilId) return { ok: false, motivo: `conta_contabil_${row.letra}` };
  const valorNum = Number(row.valor) || 0;
  const descricaoDetalhada =
    row.letra === 'A' && row.codigoCliente
      ? anexarCodigoClienteTagDescricaoDetalhada(row.descricaoDetalhada, row.codigoCliente)
      : String(row.descricaoDetalhada || '');
  return {
    ok: true,
    body: {
      cartaoId,
      contaContabilId,
      clienteId: row.clienteId ?? null,
      processoId: row.processoId ?? null,
      numeroLancamento: row.numeroLancamento,
      dataLancamento: row.dataIso,
      dataCompetencia: row.dataCompetenciaIso || row.dataIso,
      descricao: String(row.descricao || 'Lançamento cartão').slice(0, 500),
      descricaoDetalhada: descricaoDetalhada.slice(0, 2000),
      valor: valorNum,
      refTipo: row.refTipo || 'N',
      origem: 'PLANILHA',
      status: 'ATIVO',
      grupoCompensacao: row.grupoCompensacao ?? null,
    },
  };
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

async function importarUmCartao(opts, token, wb, nomeCartao, cartaoIdPorNome, contaIdPorLetra) {
  const layout = layoutExtratoPorNomeInstituicao(nomeCartao);
  const ws = wb.Sheets[nomeCartao];
  if (!ws) {
    console.error(`  Aba não encontrada: ${nomeCartao}`);
    return { lidas: 0, criados: 0, errosPost: 1 };
  }

  let linhas = extrairLancamentosDaAba(ws, layout, nomeCartao);
  if (opts.limite != null) linhas = linhas.slice(0, opts.limite);

  const stats = {
    lidas: linhas.length,
    prontas: 0,
    criados: 0,
    errosPost: 0,
    contaFalta: 0,
    clienteNaoAchado: 0,
    processoNaoAchado: 0,
    porLetra: {},
    amostraErros: [],
  };

  for (const row of linhas) {
    stats.porLetra[row.letra] = (stats.porLetra[row.letra] || 0) + 1;
  }

  const cartaoId = cartaoIdPorNome.get(nomeCartao);
  const numeroCartao = numeroCartaoPorNome(nomeCartao);
  if (cartaoId == null) {
    console.error(`  Cartão «${nomeCartao}» não encontrado na API.`);
    return stats;
  }

  if (opts.substituir && !opts.dryRun) {
    const limpo = await limparExtratoCartao(token, opts.baseUrl, nomeCartao, numeroCartao);
    console.log(`  Limpou ${nomeCartao}: ${limpo?.lancamentosRemovidos ?? 0} removidos`);
  }

  const cacheCliente = new Map();
  const cacheProcesso = new Map();
  for (const row of linhas) {
    if (row.letra !== 'A') continue;
    if (row.codigoCliente) {
      const clientePk = await resolverCliente(token, opts.baseUrl, row.codigoCliente, cacheCliente);
      if (clientePk) row.clienteId = clientePk;
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
    const mapped = rowParaPayloadCartao(row, contaIdPorLetra, cartaoId);
    if (!mapped.ok) {
      stats.contaFalta += 1;
      continue;
    }
    payloads.push({ row, body: mapped.body });
  }
  stats.prontas = payloads.length;

  if (opts.dryRun) {
    console.log(`  [DRY-RUN] ${nomeCartao}: ${linhas.length} linhas`);
    return stats;
  }

  await runPool(payloads, opts.concurrency, async ({ row, body }) => {
    const res = await postLancamento(token, opts.baseUrl, body);
    if (res.ok) stats.criados += 1;
    else {
      stats.errosPost += 1;
      if (stats.amostraErros.length < 5) {
        stats.amostraErros.push(`L${row.linhaExcel}: HTTP ${res.status}`);
      }
    }
  });

  console.log(
    `  ${nomeCartao}: lidas=${stats.lidas} POST ok=${stats.criados} erros=${stats.errosPost} porLetra=${JSON.stringify(stats.porLetra)}`,
  );
  return stats;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Ficheiro não encontrado: ${filePath}`);
    process.exit(1);
  }

  const cartoesAlvo = opts.todosCartoes
    ? CARTOES_IMPORT_PLANILHA
    : [opts.cartao];

  console.log(`Ficheiro: ${filePath}`);
  console.log(`Cartões: ${cartoesAlvo.join(', ')}`);
  console.log(`Modo: ${opts.dryRun ? 'DRY-RUN' : opts.substituir ? 'SUBSTITUIR + IMPORTAR' : 'IMPORTAR'}`);

  const wb = XLSX.readFile(filePath, { cellDates: true, cellNF: false });

  if (opts.dryRun) {
    for (const nome of cartoesAlvo) {
      const layout = layoutExtratoPorNomeInstituicao(nome);
      const n = extrairLancamentosDaAba(wb.Sheets[nome], layout, nome).length;
      console.log(`  ${nome}: ${n} lançamentos`);
    }
    return;
  }

  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou crie e-vilareal-react-web/.env.import.local');
    process.exit(1);
  }
  const avisoSenha = avisarSenhaInvalida(opts.senha);
  if (avisoSenha) {
    console.error(avisoSenha);
    process.exit(1);
  }

  const token = await login(opts);
  const [contasApi, cartoesApi] = await Promise.all([
    listarContasContabeis(token, opts.baseUrl),
    listarCartoesApi(token, opts.baseUrl),
  ]);
  const contaIdPorLetra = buildContaIdPorLetra(contasApi);
  const cartaoIdPorNome = buildCartaoIdPorNome(cartoesApi);

  let totalErros = 0;
  for (const nome of cartoesAlvo) {
    const st = await importarUmCartao(opts, token, wb, nome, cartaoIdPorNome, contaIdPorLetra);
    totalErros += st.errosPost || 0;
  }

  if (totalErros > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
