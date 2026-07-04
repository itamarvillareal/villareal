#!/usr/bin/env node
/**
 * Importa um ou vários arquivos OFX na API (modo mesclar — só linhas novas).
 *
 * Uso (a partir de e-vilareal-react-web/):
 *   node scripts/import-extrato-ofx-lote.mjs --vps ~/Downloads/"extrato (11).ofx" ...
 *   node scripts/import-extrato-ofx-lote.mjs --vps --glob='~/Downloads/extrato (*.ofx'
 *   node scripts/import-extrato-ofx-lote.mjs --dry-run --vps arquivo.ofx
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA (ver load-vilareal-import-env.mjs)
 */
import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { analisarLancamentosNovosDedupe, parseOfxToExtrato } from '../src/utils/ofx.js';

const VPS_BASE = 'https://portal.villarealadvocacia.adv.br';
const CONTA_N_NOME = 'Conta Não Identificados';

function parseArgs(argv) {
  const out = {
    paths: [],
    glob: '',
    banco: 'BB Conta Corrente',
    numeroBanco: 903,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    semProtecaoCorte: true,
    vps: false,
    minNum: null,
    maxNum: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--executar') out.dryRun = false;
    else if (a === '--vps') {
      out.vps = true;
      out.baseUrl = VPS_BASE;
    } else if (a === '--sem-protecao-corte') out.semProtecaoCorte = true;
    else if (a === '--com-protecao-corte') out.semProtecaoCorte = false;
    else if (a.startsWith('--glob=')) out.glob = a.slice(7).trim();
    else if (a.startsWith('--banco=')) out.banco = a.slice(8).trim();
    else if (a.startsWith('--numero-banco=')) out.numeroBanco = Number(a.slice(15));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--min=')) out.minNum = Number(a.slice(6));
    else if (a.startsWith('--max=')) out.maxNum = Number(a.slice(6));
    else if (!a.startsWith('--')) out.paths.push(a);
  }
  if (out.vps && !process.argv.some((x) => x.startsWith('--base-url='))) {
    out.baseUrl = VPS_BASE;
  }
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

function extrairDtStart(ofxText) {
  const m = /<DTSTART>(\d{8})/i.exec(String(ofxText ?? ''));
  return m ? m[1] : '00000000';
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

function resolveFiles(opts) {
  const files = new Set();
  for (const p of opts.paths) {
    const abs = expandHome(p);
    if (!fs.existsSync(abs)) {
      console.warn('Ignorado (não existe):', abs);
      continue;
    }
    if (fs.statSync(abs).isDirectory()) {
      for (const name of fs.readdirSync(abs)) {
        if (/\.ofx$/i.test(name)) files.add(path.join(abs, name));
      }
    } else if (/\.ofx$/i.test(abs)) {
      files.add(abs);
    }
  }
  if (opts.glob) {
    const dir = path.dirname(expandHome(opts.glob));
    const base = path.basename(opts.glob);
    const re = new RegExp(
      '^' +
        base
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') +
        '$',
      'i',
    );
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (re.test(name)) files.add(path.join(dir, name));
      }
    }
  }
  let list = [...files];
  if (opts.minNum != null || opts.maxNum != null) {
    list = list.filter((f) => {
      const m = /extrato \((\d+)\)\.ofx$/i.exec(path.basename(f));
      if (!m) return true;
      const n = Number(m[1]);
      if (opts.minNum != null && n < opts.minNum) return false;
      if (opts.maxNum != null && n > opts.maxNum) return false;
      return true;
    });
  }
  return list.sort((a, b) => {
    const da = extrairDtStart(readOfxPath(a));
    const db = extrairDtStart(readOfxPath(b));
    if (da !== db) return da.localeCompare(db);
    return a.localeCompare(b, 'pt-BR');
  });
}

async function postLancamento(token, baseUrl, body) {
  const res = await fetch(`${baseUrl}/api/financeiro/lancamentos`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, text: (await res.text()).slice(0, 300) };
  }
  return { ok: true, id: (await res.json())?.id };
}

async function importarArquivo({
  filePath,
  token,
  opts,
  contaNId,
  existenteRef,
}) {
  const nome = path.basename(filePath);
  const ofxText = readOfxPath(filePath);
  const dtStart = extrairDtStart(ofxText);
  const rows = parseOfxToExtrato(ofxText, { nomeBanco: opts.banco });
  if (!rows?.length) {
    return { nome, dtStart, totalArquivo: 0, importados: 0, ignorados: 0, erros: ['arquivo vazio'] };
  }

  const analise = analisarLancamentosNovosDedupe(existenteRef.list, rows);
  const novos = analise.novos ?? [];
  const ignorados = analise.ignorados ?? rows.length - novos.length;

  if (opts.dryRun) {
    return { nome, dtStart, totalArquivo: rows.length, importados: novos.length, ignorados, erros: [] };
  }

  const erros = [];
  let importados = 0;
  for (const row of novos) {
    const body = rowParaPayloadApi(row, contaNId, opts.banco, opts.numeroBanco);
    const res = await postLancamento(token, opts.baseUrl, body);
    if (res.ok) {
      importados += 1;
      existenteRef.list.push(row);
    } else {
      erros.push(`${row.numero} ${row.data}: ${res.text}`);
    }
  }

  return { nome, dtStart, totalArquivo: rows.length, importados, ignorados, erros };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const files = resolveFiles(opts);
  if (!files.length) {
    console.error('Nenhum arquivo OFX encontrado.');
    process.exit(1);
  }

  console.log(`API: ${opts.baseUrl}`);
  console.log(`Banco: ${opts.banco} (numeroBanco=${opts.numeroBanco})`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'executar'}`);
  console.log(`Arquivos: ${files.length}`);

  const token = await login(opts);
  const contas = await listarContas(token, opts.baseUrl);
  const contaNId = (contas || []).find((c) => String(c.nome ?? '').trim() === CONTA_N_NOME)?.id;
  if (!contaNId) throw new Error(`Conta contábil «${CONTA_N_NOME}» não encontrada.`);

  console.log('Carregando lançamentos existentes…');
  const existenteRef = { list: await carregarLancamentosBanco(token, opts.baseUrl, opts.numeroBanco) };
  console.log(`Existentes no banco: ${existenteRef.list.length}`);

  let totalImportados = 0;
  let totalIgnorados = 0;
  let totalErros = 0;

  for (const filePath of files) {
    const r = await importarArquivo({ filePath, token, opts, contaNId, existenteRef });
    console.log(
      `${r.nome} [${r.dtStart}]: arquivo=${r.totalArquivo} importar=${r.importados} ignorados=${r.ignorados}`,
    );
    if (r.erros.length) {
      totalErros += r.erros.length;
      console.log(`  erros (${r.erros.length}): ${r.erros.slice(0, 3).join(' | ')}`);
    }
    totalImportados += r.importados;
    totalIgnorados += r.ignorados;
  }

  console.log('\n=== Resumo ===');
  console.log(`Importados: ${totalImportados}`);
  console.log(`Ignorados (dedupe): ${totalIgnorados}`);
  console.log(`Erros: ${totalErros}`);
  console.log(`Total no banco após: ${existenteRef.list.length}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
