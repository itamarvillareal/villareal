#!/usr/bin/env node
/**
 * Importa/sincroniza proprietários da planilha Canal Gestão (Contatos das unidades).
 *
 * Uso:
 *   node scripts/import-contatos-unidades-xlsx.mjs "/caminho/045A - Contatos....xlsx" --dry-run
 *   node scripts/import-contatos-unidades-xlsx.mjs "/caminho/arquivo.xlsx" --aplicar
 *
 * Por CPF/CNPJ: GET /api/cadastro-pessoas?cpf=… — se existir, reutiliza; senão POST.
 * Gera relatório JSON + CSV unidade → pessoa.
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';

const UNIDADES_IGNORAR = new Set(['ADM', 'ACORDOS', 'MERCADINHO']);

function parseArgs(argv) {
  const out = {
    arquivo: null,
    dryRun: true,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'https://portal.villarealadvocacia.adv.br').replace(/\/$/, ''),
    relatorio: null,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.dryRun = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (!a.startsWith('-') && !out.arquivo) out.arquivo = a;
  }
  return out;
}

function normDoc(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11) return d;
  if (d.length === 10) return d.padStart(11, '0');
  if (d.length === 14) return d;
  return null;
}

function normUnit(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** @param {string} raw */
function primeiroEmail(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const part = s.split(/[;,]/).map((x) => x.trim()).find(Boolean);
  return part && part.includes('@') ? part : null;
}

/** @param {unknown} tel @param {unknown} cel */
function primeiroTelefone(tel, cel) {
  for (const v of [cel, tel]) {
    const s = String(v ?? '').trim();
    if (s && s !== '—') return s.slice(0, 40);
  }
  return null;
}

/**
 * @param {string} abs
 */
function lerPlanilha(abs) {
  const wb = XLSX.readFile(abs, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  /** @type {{ linha: number, unidade: string, nome: string, doc: string, email: string|null, telefone: string|null }[]} */
  const out = [];
  let currentUnit = null;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const linha = i + 1;
    const colUnit = row[0];
    const colNome = row[1];
    const colTipo = row[2];
    const colTel = row[3];
    const colCel = row[4];
    const colEmail = row[12];
    const colDoc = row[11];
    if (colUnit != null && String(colUnit).trim()) {
      currentUnit = normUnit(colUnit);
    }
    if (!currentUnit || UNIDADES_IGNORAR.has(currentUnit)) continue;
    const tipo = String(colTipo ?? '').trim().toLowerCase();
    if (tipo !== 'proprietário' && tipo !== 'proprietario') continue;
    const doc = normDoc(colDoc);
    const nome = String(colNome ?? '').trim();
    if (!doc || !nome) continue;
    out.push({
      linha,
      unidade: currentUnit,
      nome,
      doc,
      email: primeiroEmail(colEmail),
      telefone: primeiroTelefone(colTel, colCel),
    });
  }
  return out;
}

function normNome(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {Map<string, object>} porDoc */
function consolidarPorDocumento(linhas) {
  /** @type {Map<string, { doc: string, nome: string, unidades: string[], linhas: number[], email: string|null, telefone: string|null }>} */
  const porDoc = new Map();
  for (const l of linhas) {
    let e = porDoc.get(l.doc);
    if (!e) {
      e = { doc: l.doc, nome: l.nome, unidades: [], linhas: [], email: l.email, telefone: l.telefone };
      porDoc.set(l.doc, e);
    }
    e.unidades.push(l.unidade);
    e.linhas.push(l.linha);
    if (!e.email && l.email) e.email = l.email;
    if (!e.telefone && l.telefone) e.telefone = l.telefone;
    if (normNome(e.nome) !== normNome(l.nome)) {
      e.nomeAlternativo = l.nome;
    }
  }
  return porDoc;
}

async function buscarPessoaPorCpf(baseUrl, token, doc) {
  const url = `${baseUrl}/api/cadastro-pessoas?${new URLSearchParams({ cpf: doc })}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET pessoa cpf=${doc}: ${res.status} ${t.slice(0, 200)}`);
  }
  const list = await res.json();
  if (!Array.isArray(list) || !list.length) return null;
  return list[0];
}

async function criarPessoa(baseUrl, token, payload) {
  const res = await fetch(`${baseUrl}/api/cadastro-pessoas`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(`POST pessoa: ${res.status} ${text.slice(0, 300)}`);
  }
  return json;
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.arquivo) {
    console.error('Uso: node scripts/import-contatos-unidades-xlsx.mjs <arquivo.xlsx> [--aplicar|--dry-run]');
    process.exit(1);
  }
  const abs = path.resolve(opts.arquivo);
  if (!fs.existsSync(abs)) {
    console.error(`Arquivo não encontrado: ${abs}`);
    process.exit(1);
  }
  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha= para --aplicar');
    process.exit(1);
  }

  const linhas = lerPlanilha(abs);
  const porDoc = consolidarPorDocumento(linhas);
  console.log(`[contatos-unidades] linhas proprietário: ${linhas.length} | documentos únicos: ${porDoc.size}`);

  const token = opts.dryRun ? null : await loginImportApi(opts.baseUrl, opts.login, opts.senha);

  /** @type {Record<string, number|null>} */
  const pessoaIdPorDoc = {};
  const stats = { existente: 0, criado: 0, dryRunCriar: 0, erro: 0, conflitoNome: 0 };

  for (const [doc, info] of [...porDoc.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    try {
      let pessoa = opts.dryRun ? null : await buscarPessoaPorCpf(opts.baseUrl, token, doc);
      if (pessoa?.id) {
        pessoaIdPorDoc[doc] = Number(pessoa.id);
        stats.existente += 1;
        const nomeDb = normNome(pessoa.nome);
        const nomePlan = normNome(info.nome);
        if (nomeDb && nomePlan && nomeDb !== nomePlan && !nomeDb.includes(nomePlan.slice(0, 12))) {
          stats.conflitoNome += 1;
          info.conflitoNome = { api: pessoa.nome, planilha: info.nome };
        }
        continue;
      }

      const payload = {
        nome: info.nome.slice(0, 255),
        cpf: doc,
        ativo: true,
        criarCliente: false,
      };
      if (info.email) payload.email = info.email;
      if (info.telefone) payload.telefone = info.telefone;

      if (opts.dryRun) {
        pessoaIdPorDoc[doc] = null;
        stats.dryRunCriar += 1;
        continue;
      }

      pessoa = await criarPessoa(opts.baseUrl, token, payload);
      pessoaIdPorDoc[doc] = Number(pessoa.id);
      stats.criado += 1;
    } catch (e) {
      stats.erro += 1;
      info.erro = String(e?.message ?? e);
      pessoaIdPorDoc[doc] = null;
    }
  }

  /** @type {object[]} */
  const mapaUnidades = linhas.map((l) => ({
    linha: l.linha,
    unidade: l.unidade,
    unidadeCompacta: l.unidade.replace(/\s+/g, ''),
    nome: l.nome,
    doc: l.doc,
    pessoaId: pessoaIdPorDoc[l.doc] ?? null,
    status: pessoaIdPorDoc[l.doc] ? (stats.criado && !opts.dryRun ? 'verificar' : 'ok') : opts.dryRun ? 'criar_pendente' : 'sem_id',
  }));

  for (const m of mapaUnidades) {
    const info = porDoc.get(m.doc);
    if (info?.erro) m.erro = info.erro;
    if (info?.conflitoNome) m.conflitoNome = info.conflitoNome;
  }

  const relBase =
    opts.relatorio ||
    path.join(process.env.HOME || '.', 'Dropbox/tmp/contatos-unidades-terra-mundi');
  const relJson = relBase.endsWith('.json') ? relBase : `${relBase}.json`;
  const relCsv = relJson.replace(/\.json$/i, '.csv');
  fs.mkdirSync(path.dirname(relJson), { recursive: true });
  fs.writeFileSync(
    relJson,
    `${JSON.stringify({ arquivo: abs, stats, mapaUnidades, porDocumento: Object.fromEntries(porDoc) }, null, 2)}\n`,
  );
  const csvLines = [
    ['linha', 'unidade', 'unidadeCompacta', 'nome', 'doc', 'pessoaId', 'status'].join(','),
    ...mapaUnidades.map((m) =>
      [m.linha, m.unidade, m.unidadeCompacta, m.nome, m.doc, m.pessoaId ?? '', m.status].map(csvEscape).join(','),
    ),
  ];
  fs.writeFileSync(relCsv, `${csvLines.join('\n')}\n`);

  console.log('[contatos-unidades] stats:', stats);
  console.log(`[contatos-unidades] relatório: ${relJson}`);
  console.log(`[contatos-unidades] CSV: ${relCsv}`);
  if (stats.erro) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
