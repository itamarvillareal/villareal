#!/usr/bin/env node
/**
 * Diagnóstico pré-importação: planilha de proprietários vs processos legados.
 *
 *   node scripts/diagnosticar-proprietarios-import.mjs --cliente=928 \
 *     --pdf=/path/inadimplencia.pdf --planilha=/path/condominos.xlsx
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_LOGIN, VILAREAL_IMPORT_SENHA
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loginImportApi } from './lib/prazo-fatal-api.mjs';

function parseArgs(argv) {
  const out = {
    cliente: '928',
    pdf: null,
    planilha: null,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
  };
  for (const a of argv) {
    if (a.startsWith('--cliente=')) out.cliente = a.slice(10);
    else if (a.startsWith('--pdf=')) out.pdf = a.slice(6);
    else if (a.startsWith('--planilha=')) out.planilha = a.slice(11);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--login=')) out.login = a.slice(8);
  }
  return out;
}

function padCliente8(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.padStart(8, '0');
}

async function postMultipart(baseUrl, token, urlPath, fields, files) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const [k, filePath] of Object.entries(files)) {
    const buf = fs.readFileSync(filePath);
    const name = path.basename(filePath);
    fd.append(k, new Blob([buf]), name);
  }
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${urlPath} falhou ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json();
}

async function postJson(baseUrl, token, urlPath, body) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${urlPath} falhou ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json();
}

function docValido(doc) {
  const d = String(doc ?? '').replace(/\D/g, '');
  return d.length === 11 || d.length === 14;
}

function mesclar(extracao, planilha) {
  const map = new Map();
  for (const u of planilha?.unidades || []) {
    const cod = String(u?.codigoUnidade ?? '')
      .trim()
      .toUpperCase();
    if (cod) map.set(cod, u);
  }
  const unidades = [];
  for (const u of extracao?.unidades || []) {
    const cod = String(u?.codigoUnidadeNormalizada ?? u?.codigoUnidade ?? '')
      .trim()
      .toUpperCase();
    const legadoNome = String(u?.proprietarioLegadoNome ?? '').trim();
    const legadoDoc = String(u?.proprietarioLegadoDocDigitos ?? '').replace(/\D/g, '');
    const prop = map.get(cod)?.proprietario;
    let nome = '';
    let doc = '';
    if (prop && docValido(prop.cpfCnpjNormalizado ?? prop.cpfCnpjBruto)) {
      nome = String(prop.nome ?? '').trim();
      doc = String(prop.cpfCnpjNormalizado ?? prop.cpfCnpjBruto ?? '').replace(/\D/g, '');
    } else if (docValido(legadoDoc)) {
      nome = legadoNome;
      doc = legadoDoc;
    }
    unidades.push({
      codigoUnidadeNormalizada: cod,
      proprietarioNome: nome,
      proprietarioDocDigitos: doc,
      cobrancas: u?.cobrancas || [],
      proprietarioLegadoNome: legadoNome || null,
      proprietarioLegadoDocDigitos: legadoDoc || null,
    });
  }
  return unidades;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.pdf || !opts.planilha) {
    console.error('Uso: --cliente=928 --pdf=... --planilha=...');
    process.exit(1);
  }
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA');
    process.exit(1);
  }
  for (const p of [opts.pdf, opts.planilha]) {
    if (!fs.existsSync(p)) {
      console.error(`Arquivo não encontrado: ${p}`);
      process.exit(1);
    }
  }

  const cod8 = padCliente8(opts.cliente);
  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);

  const extracao = await postMultipart(
    opts.baseUrl,
    token,
    '/api/cobranca/extrair-pdf',
    { clienteCodigo: cod8 },
    { arquivo: opts.pdf },
  );
  const planilha = await postMultipart(
    opts.baseUrl,
    token,
    '/api/condominio/inadimplencia/extrair-pessoas',
    { clienteCodigo: cod8 },
    { arquivo: opts.planilha },
  );

  const unidades = mesclar(extracao, planilha);
  const diag = await postJson(opts.baseUrl, token, '/api/cobranca/diagnosticar-proprietarios', {
    clienteCodigo: cod8,
    unidades,
    planilhaUnidades: planilha?.unidades || [],
  });

  const r = diag?.resumo || {};
  console.log(`Cliente ${cod8} — ${unidades.length} unidade(s) no PDF`);
  console.log(
    `Resumo: mesmoReu=${r.mesmoReu ?? 0} trocaDono=${r.trocaDono ?? 0} coprop=${r.coproprietarios ?? 0} cpfCorrigido=${r.cpfCorrigido ?? 0} semLegado=${r.semLegado ?? 0}`,
  );
  console.log('');
  for (const it of diag?.itens || []) {
    if (it.classe === 'MESMO_REU') continue;
    console.log(
      `${it.codigoUnidade}\t${it.classe}\tplanilha=${it.proprietarioEfetivoNome}\tlegado=${it.proprietarioLegadoNome}\t${it.mensagem}`,
    );
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
