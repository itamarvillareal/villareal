#!/usr/bin/env node
/**
 * Compara aba Itaú da planilha × API (VPS ou localhost) por PL-*.
 * Gera CSV de diff + resumo JSON com ações exatas para sincronização.
 *
 * Uso:
 *   node scripts/gerar-comparacao-planilha-vps-itau.mjs
 *   node scripts/gerar-comparacao-planilha-vps-itau.mjs --base-url=http://localhost:8080
 *   node scripts/gerar-comparacao-planilha-vps-itau.mjs --out=~/Downloads/itau-vps-diff.csv
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import {
  agregarDbPorMes,
  agregarPlanilhaPorMes,
  compararMeses,
  extrairLinhasPlanilhaBanco,
  fetchTodosLancamentosBanco,
  saldoSigned,
} from './lib/extrato-bancos-planilha-validacao.mjs';
import { resolveExtratoBancosPlanilhaXlsPath } from './lib/resolve-extrato-bancos-planilha-xls.mjs';

const BANCO = 'Itaú';
const NUMERO_BANCO = 1;
const CORTE_PLANILHA = '2026-05-19';
const DUPTEST_NUM = 'PL-ecbc576f8cce86cf1ba560af-DUPTEST';

function parseArgs(argv) {
  const out = {
    baseUrl: (process.env.VILAREAL_API_BASE || 'https://portal.villarealadvocacia.adv.br').replace(/\/$/, ''),
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    outCsv: path.join(os.homedir(), 'Downloads', `itau-planilha-vs-api-${new Date().toISOString().slice(0, 10)}.csv`),
    outJson: null,
  };
  for (const a of argv) {
    if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--out=')) out.outCsv = a.slice(6).replace(/^~/, os.homedir());
    else if (a.startsWith('--json=')) out.outJson = a.slice(7).replace(/^~/, os.homedir());
  }
  if (!out.outJson) {
    out.outJson = out.outCsv.replace(/\.csv$/i, '.json');
  }
  return out;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cols) {
  return cols.map(csvEscape).join(',');
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: opts.login.trim().toLowerCase(), senha: opts.senha }),
  });
  if (!res.ok) throw new Error(`Login falhou ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  if (!j.accessToken) throw new Error('Login sem accessToken');
  return j.accessToken;
}

function classificarSobraDb(row) {
  const num = String(row.numeroLancamento ?? '');
  const origem = String(row.origem ?? '').toUpperCase();
  if (num.includes('DUPTEST')) return 'DELETE_DUPTEST';
  if (origem === 'OFX') return 'DELETE_OFX_INDEVIDO';
  if (!num.startsWith('PL-')) return 'DELETE_NAO_PLANILHA';
  return 'SOBRA_PL_DESCONHECIDO';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const planPath = resolveExtratoBancosPlanilhaXlsPath(null);
  if (!planPath) {
    console.error('Planilha Extratos Bancos não encontrada.');
    process.exit(1);
  }

  console.log(`Planilha: ${planPath}`);
  console.log(`API: ${opts.baseUrl}`);

  const token = await login(opts);
  const wb = XLSX.readFile(planPath, { cellDates: true });
  const { linhas: planLinhas } = extrairLinhasPlanilhaBanco(wb, BANCO);
  const dbRows = await fetchTodosLancamentosBanco(token, opts.baseUrl, NUMERO_BANCO);

  const planByNum = new Map(planLinhas.map((p) => [p.numeroLancamento, p]));
  const dbByNum = new Map(dbRows.map((d) => [d.numeroLancamento, d]));

  /** @type {Array<Record<string, string|number>>} */
  const rows = [];

  for (const p of planLinhas) {
    const d = dbByNum.get(p.numeroLancamento);
    if (!d) {
      rows.push({
        acao: 'INSERT_FALTANTE',
        numero_lancamento: p.numeroLancamento,
        data: p.dataIso,
        valor_plan: p.valor,
        valor_db: '',
        origem_db: '',
        api_id: '',
        linha_excel: p.linhaExcel ?? '',
        descricao: p.descricao ?? '',
        observacao: p.observacao ?? '',
        cod_cliente: p.codCliente ?? '',
        proc: p.proc ?? '',
        notas: 'Importar da planilha (--apenas-faltantes)',
      });
      continue;
    }
    const vPlan = Number(p.valor) || 0;
    const vDb = saldoSigned(d.valor, d.natureza);
    const dataDb = String(d.dataLancamento ?? '').slice(0, 10);
    if (dataDb !== p.dataIso || Math.round(vPlan * 100) !== Math.round(vDb * 100)) {
      rows.push({
        acao: 'DIVERGENTE_DATA_OU_VALOR',
        numero_lancamento: p.numeroLancamento,
        data: p.dataIso,
        valor_plan: vPlan,
        valor_db: vDb,
        origem_db: d.origem ?? '',
        api_id: d.id ?? '',
        linha_excel: p.linhaExcel ?? '',
        descricao: p.descricao ?? '',
        observacao: '',
        cod_cliente: '',
        proc: '',
        notas: `DB data=${dataDb} — NÃO corrigir automaticamente; investigar`,
      });
    } else {
      rows.push({
        acao: 'OK',
        numero_lancamento: p.numeroLancamento,
        data: p.dataIso,
        valor_plan: vPlan,
        valor_db: vDb,
        origem_db: d.origem ?? '',
        api_id: d.id ?? '',
        linha_excel: p.linhaExcel ?? '',
        descricao: p.descricao ?? '',
        observacao: '',
        cod_cliente: '',
        proc: '',
        notas: '',
      });
    }
  }

  for (const d of dbRows) {
    if (planByNum.has(d.numeroLancamento)) continue;
    const acao = classificarSobraDb(d);
    rows.push({
      acao,
      numero_lancamento: d.numeroLancamento ?? '',
      data: String(d.dataLancamento ?? '').slice(0, 10),
      valor_plan: '',
      valor_db: saldoSigned(d.valor, d.natureza),
      origem_db: d.origem ?? '',
      api_id: d.id ?? '',
      linha_excel: '',
      descricao: d.descricao ?? '',
      observacao: '',
      cod_cliente: '',
      proc: '',
      notas: acao === 'DELETE_DUPTEST' ? 'Excluir via DELETE /api/financeiro/lancamentos/{id}' : '',
    });
  }

  rows.sort((a, b) => {
    const ord = { INSERT_FALTANTE: 0, DIVERGENTE_DATA_OU_VALOR: 1, DELETE_DUPTEST: 2, DELETE_OFX_INDEVIDO: 3, SOBRA_PL_DESCONHECIDO: 4, DELETE_NAO_PLANILHA: 5, OK: 9 };
    const ca = ord[a.acao] ?? 8;
    const cb = ord[b.acao] ?? 8;
    if (ca !== cb) return ca - cb;
    return String(a.data).localeCompare(String(b.data)) || String(a.numero_lancamento).localeCompare(String(b.numero_lancamento));
  });

  const header = [
    'acao', 'numero_lancamento', 'data', 'valor_plan', 'valor_db', 'origem_db', 'api_id',
    'linha_excel', 'descricao', 'observacao', 'cod_cliente', 'proc', 'notas',
  ];
  const csv = [csvLine(header), ...rows.map((r) => csvLine(header.map((h) => r[h])))].join('\n');
  fs.mkdirSync(path.dirname(opts.outCsv), { recursive: true });
  fs.writeFileSync(opts.outCsv, csv, 'utf8');

  const counts = {};
  for (const r of rows) counts[r.acao] = (counts[r.acao] || 0) + 1;

  const faltantes = rows.filter((r) => r.acao === 'INSERT_FALTANTE');
  const sobrasDelete = rows.filter((r) => r.acao.startsWith('DELETE'));
  const divergentes = rows.filter((r) => r.acao === 'DIVERGENTE_DATA_OU_VALOR');

  const saldoPlan = planLinhas.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const saldoDb = dbRows.reduce((s, r) => s + saldoSigned(r.valor, r.natureza), 0);
  const saldoFalt = faltantes.reduce((s, r) => s + (Number(r.valor_plan) || 0), 0);
  const gaps = compararMeses(agregarPlanilhaPorMes(planLinhas), agregarDbPorMes(dbRows));

  const dup = dbRows.find((d) => String(d.numeroLancamento) === DUPTEST_NUM);
  const ofxCount = dbRows.filter((d) => String(d.origem).toUpperCase() === 'OFX').length;
  const afterCorte = dbRows.filter((d) => String(d.dataLancamento) > CORTE_PLANILHA);

  const playbook = {
    geradoEm: new Date().toISOString(),
    planilha: planPath,
    apiBase: opts.baseUrl,
    cortePlanilha: CORTE_PLANILHA,
    totais: {
      planilha: planLinhas.length,
      api: dbRows.length,
      ok: counts.OK ?? 0,
      insertFaltantes: faltantes.length,
      divergentes: divergentes.length,
      deletes: sobrasDelete.length,
      ofxIndevidos: counts.DELETE_OFX_INDEVIDO ?? 0,
      duptest: counts.DELETE_DUPTEST ?? 0,
      lancamentosAposCortePlanilha: afterCorte.length,
    },
    saldos: {
      planilhaMovimento: Math.round(saldoPlan * 100) / 100,
      apiMovimento: Math.round(saldoDb * 100) / 100,
      deltaPlanMenosApi: Math.round((saldoPlan - saldoDb) * 100) / 100,
      somaFaltantes: Math.round(saldoFalt * 100) / 100,
      metaPosCorrecaoPlanilha: '29.534 lanç. PLANILHA, saldo +3080.82 em 19/05/2026',
    },
    mesesComGap: gaps.length,
    acoesVps: [],
    naoFazer: [
      'NÃO usar --substituir no import da planilha (apaga tudo e falha com duplicatas)',
      'NÃO rodar reparar-extrato-ofx.mjs --executar (troca maio/jun e quebra planilha em 19/05)',
      'NÃO importar OFX para período coberto pela planilha (preferir planilha: obs, cod, proc)',
      'NÃO usar .env.import.local sem --base-url explícito se quiser localhost (aponta produção)',
    ],
  };

  if (faltantes.length > 0) {
    playbook.acoesVps.push({
      ordem: 1,
      acao: 'INSERT',
      comando: `cd e-vilareal-react-web && node scripts/import-extrato-bancos-planilha.mjs --sheet=Itaú --banco=Itaú --layout=itau-pf --apenas-faltantes --login=itamar --base-url=${opts.baseUrl}`,
      qtd: faltantes.length,
      somaValores: Math.round(saldoFalt * 100) / 100,
    });
  }

  if (dup) {
    playbook.acoesVps.push({
      ordem: 2,
      acao: 'DELETE',
      alvo: DUPTEST_NUM,
      apiId: dup.id,
      data: dup.dataLancamento,
      valor: saldoSigned(dup.valor, dup.natureza),
      comando: `DELETE ${opts.baseUrl}/api/financeiro/lancamentos/${dup.id}`,
    });
  }

  for (const s of sobrasDelete.filter((r) => r.acao === 'DELETE_OFX_INDEVIDO')) {
    playbook.acoesVps.push({
      ordem: 3,
      acao: 'DELETE_OFX',
      numero_lancamento: s.numero_lancamento,
      apiId: s.api_id,
      data: s.data,
      valor: s.valor_db,
    });
  }

  if (divergentes.length > 0) {
    playbook.acoesVps.push({
      ordem: 99,
      acao: 'INVESTIGAR',
      qtd: divergentes.length,
      nota: 'Mesmo PL-* com data ou valor diferente — não corrigir em massa',
    });
  }

  playbook.acoesVps.push({
    ordem: 10,
    acao: 'VALIDAR',
    comando: `node scripts/import-extrato-bancos-planilha.mjs --apenas-faltantes --dry-run --base-url=${opts.baseUrl}`,
    criterios: [
      'faltantes PL-* = 0',
      'meses com gap = 0',
      '29.534 lançamentos, 100% origem PLANILHA',
      'saldo 19/05/2026 = +3080.82 (= col I planilha)',
    ],
  });

  fs.writeFileSync(opts.outJson, JSON.stringify(playbook, null, 2), 'utf8');

  console.log('\n=== Resumo ===');
  console.log(`Planilha: ${planLinhas.length} | API: ${dbRows.length}`);
  console.log(`OK: ${counts.OK ?? 0} | INSERT: ${faltantes.length} | DELETE: ${sobrasDelete.length} | DIVERGENTE: ${divergentes.length}`);
  console.log(`OFX indevidos na API: ${ofxCount} | Após ${CORTE_PLANILHA}: ${afterCorte.length}`);
  console.log(`Δ saldo plan−api: ${playbook.saldos.deltaPlanMenosApi.toFixed(2)} (= faltantes ${playbook.saldos.somaFaltantes.toFixed(2)}?)`);
  console.log(`Meses com gap: ${gaps.length}`);
  console.log(`\nCSV: ${opts.outCsv}`);
  console.log(`JSON playbook: ${opts.outJson}`);

  if (playbook.acoesVps.length) {
    console.log('\n=== Ações VPS (ordem) ===');
    for (const a of playbook.acoesVps.sort((x, y) => x.ordem - y.ordem)) {
      if (a.comando) console.log(`${a.ordem}. [${a.acao}] ${a.comando}${a.qtd != null ? ` (${a.qtd})` : ''}`);
      else console.log(`${a.ordem}. [${a.acao}] ${JSON.stringify(a)}`);
    }
  }

  console.log('\n=== NÃO FAZER ===');
  for (const n of playbook.naoFazer) console.log(`• ${n}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
