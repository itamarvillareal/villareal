#!/usr/bin/env node
/**
 * Diagnostica e alinha extrato bancário com arquivo OFX mestre (sem data de corte).
 *
 * Uso (a partir de e-vilareal-react-web/):
 *   node scripts/reparar-extrato-ofx.mjs --ofx=/path/arquivo.ofx --numero-banco=26 --banco=CORA
 *   node scripts/reparar-extrato-ofx.mjs --ofx=... --numero-banco=26 --banco=CORA --executar
 *   node scripts/reparar-extrato-ofx.mjs --ofx=... --executar --forcar   # ignora trava LEDGERBAL
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA (ver load-vilareal-import-env.mjs)
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';

import {
  diagnosticarExtratoComOfxCore,
  executarAlinhamentoExtratoComOfxCore,
} from '../src/components/financeiro/extrato/extratoRepararDiagnosticoCore.js';

const CONTA_N_NOME = 'Conta Não Identificados';

function parseArgs(argv) {
  const out = {
    ofx: '',
    banco: 'CORA',
    numeroBanco: 26,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    executar: false,
    forcar: false,
  };
  for (const a of argv) {
    if (a === '--executar') out.executar = true;
    else if (a === '--forcar') out.forcar = true;
    else if (a.startsWith('--ofx=')) out.ofx = a.slice(6).trim();
    else if (a.startsWith('--banco=')) out.banco = a.slice(8).trim();
    else if (a.startsWith('--numero-banco=')) out.numeroBanco = Number(a.slice(15));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
  }
  return out;
}

function toBrDate(iso) {
  const s = String(iso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseBrDateToIso(v) {
  const s = String(v ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
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

async function listarContas(token, baseUrl) {
  const res = await fetch(`${baseUrl}/api/financeiro/contas`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`GET contas: ${res.status}`);
  return res.json();
}

function mapApiParaUi(l) {
  const valorNum = Number(l.valor ?? 0);
  const sinal = String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -1 : 1;
  return {
    apiId: l.id,
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

async function carregarLancamentosBanco(token, baseUrl, numeroBanco) {
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
    if (!res.ok) throw new Error(`GET lançamentos pág ${page}: ${res.status}`);
    const j = await res.json();
    for (const l of j?.content ?? []) {
      out.push(mapApiParaUi(l));
    }
    totalPages = Math.max(1, Number(j?.totalPages ?? 1));
    page += 1;
  }
  return out;
}

async function obterSaldoBanco(token, baseUrl, numeroBanco, dataReferencia) {
  const qs = new URLSearchParams({ numeroBanco: String(numeroBanco) });
  if (dataReferencia) qs.set('data', dataReferencia);
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/saldo-banco?${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`GET saldo-banco: ${res.status}`);
  return res.json();
}

function rowParaPayloadApi(row, contaContabilId, nomeBanco, numeroBanco) {
  const valorNum = Number(row.valor ?? 0);
  return {
    contaContabilId,
    clienteId: null,
    processoId: null,
    bancoNome: nomeBanco,
    numeroBanco: Number(numeroBanco),
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

function formatMoeda(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.ofx || !fs.existsSync(opts.ofx)) {
    console.error('Informe --ofx=/caminho/arquivo.ofx existente.');
    process.exit(1);
  }
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const token = await login(opts);
  const contas = await listarContas(token, opts.baseUrl);
  const contaNId = (contas || []).find((c) => String(c.nome ?? '').trim() === CONTA_N_NOME)?.id;
  if (!contaNId) throw new Error(`Conta contábil «${CONTA_N_NOME}» não encontrada.`);

  const ofxText = fs.readFileSync(opts.ofx, 'utf8');

  const carregarDiag = async () => {
    const existenteAll = await carregarLancamentosBanco(token, opts.baseUrl, opts.numeroBanco);
    const meta = diagnosticarExtratoComOfxCore({ ofxText, existenteAll, saldoApi: null }).meta;
    const saldoApi = await obterSaldoBanco(
      token,
      opts.baseUrl,
      opts.numeroBanco,
      meta.dataFim ?? undefined,
    );
    return diagnosticarExtratoComOfxCore({ ofxText, existenteAll, saldoApi });
  };

  const diag = await carregarDiag();

  console.log('=== Diagnóstico extrato × OFX ===');
  console.log(`Banco: ${opts.banco} (#${opts.numeroBanco})`);
  console.log(`OFX: ${opts.ofx}`);
  if (diag.meta.dataInicio && diag.meta.dataFim) {
    console.log(`Período OFX: ${diag.meta.dataInicio} — ${diag.meta.dataFim}`);
  }
  console.log(`Lançamentos OFX: ${diag.totais.ofxArquivo}`);
  console.log(`Lançamentos sistema: ${diag.totais.sistemaTotal}`);
  console.log(`Faltam no sistema: ${diag.totais.faltamNoSistema} (${formatMoeda(diag.totais.somaFaltam)})`);
  console.log(`Sobram no sistema: ${diag.totais.sobramNoSistema} (${formatMoeda(diag.totais.somaSobram)})`);
  console.log(`Saldo OFX (LEDGERBAL): ${formatMoeda(diag.meta.saldoLedger)}`);
  console.log(`Saldo sistema: ${formatMoeda(diag.totais.saldoSistema)}`);
  if (diag.totais.saldoInicialSistema) {
    console.log(`Saldo inicial cadastrado: ${formatMoeda(diag.totais.saldoInicialSistema)}`);
  }
  console.log('');
  for (const linha of diag.conclusao) {
    console.log(`• ${linha.replace(/\*\*(.*?)\*\*/g, '$1')}`);
  }

  if (!opts.executar) {
    console.log('\nDry-run. Use --executar para excluir sobras e importar faltantes.');
    return;
  }

  console.log('\n=== Executando alinhamento ===');
  if (opts.forcar && !diag.totais.alinhamentoSaldoCoerente) {
    console.log('• --forcar: ignorando incoerência LEDGERBAL × efeito do reparo.');
  }

  const removerLote = async (apiIds) => {
    const removidos = [];
    const erros = [];
    for (const id of apiIds) {
      const res = await fetch(`${opts.baseUrl}/api/financeiro/lancamentos/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (res.ok) removidos.push(id);
      else erros.push({ id, message: `${res.status}` });
    }
    return { removidos, erros };
  };

  const salvarLancamentos = async (linhas) => {
    const criados = [];
    const erros = [];
    for (const row of linhas) {
      try {
        const saved = await (async () => {
          const body = rowParaPayloadApi(row, contaNId, opts.banco, opts.numeroBanco);
          const res = await fetch(`${opts.baseUrl}/api/financeiro/lancamentos`, {
            method: 'POST',
            headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
          }
          return res.json();
        })();
        if (saved?.id) criados.push(Number(saved.id));
      } catch (e) {
        erros.push(`${row.numero} ${row.data}: ${e?.message || e}`);
      }
    }
    return { criados, erros };
  };

  const r = await executarAlinhamentoExtratoComOfxCore({
    ofxText,
    numeroBanco: opts.numeroBanco,
    nomeBanco: opts.banco,
    diagnosticar: carregarDiag,
    removerLote,
    salvarLancamentos,
    ignorarIncoerenciaSaldo: opts.forcar,
  });

  console.log(`Excluídos: ${r.removidos}`);
  console.log(`Importados: ${r.criados}`);
  if (r.errosExclusao.length) console.log(`Erros exclusão: ${r.errosExclusao.length}`);
  if (r.errosImportacao.length) {
    console.log(`Erros importação: ${r.errosImportacao.length}`);
    console.log(r.errosImportacao.slice(0, 5).join('\n'));
  }

  const f = r.diagFinal;
  console.log('\n=== Após alinhamento ===');
  console.log(`Faltam: ${f.totais.faltamNoSistema}`);
  console.log(`Sobram: ${f.totais.sobramNoSistema}`);
  console.log(`Saldo sistema: ${formatMoeda(f.totais.saldoSistema)}`);
  console.log(`Saldo OFX: ${formatMoeda(f.meta.saldoLedger)}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
