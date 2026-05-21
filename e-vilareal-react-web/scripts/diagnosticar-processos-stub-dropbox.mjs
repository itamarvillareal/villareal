#!/usr/bin/env node
/**
 * Diagnóstico: processos stub MySQL vs lista Dropbox (3.1 + HC + 152.1) e tamanho estimado por cliente.
 *
 *   node scripts/diagnosticar-processos-stub-dropbox.mjs
 *   node scripts/diagnosticar-processos-stub-dropbox.mjs --cliente=431
 *   node scripts/diagnosticar-processos-stub-dropbox.mjs --cliente-min=25 --cliente-max=999 --csv=tmp/stub-dropbox.csv
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { diagnosticarClienteStub } from './lib/processos-stub-dropbox.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const out = {
    cliente: null,
    clienteMin: 1,
    clienteMax: 999,
    relatorio: path.join(ROOT, 'tmp/diagnostico-processos-stub-dropbox.json'),
    csv: null,
    limiteTop: 30,
  };
  for (const a of argv) {
    if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max=')) out.clienteMax = Math.min(999, Number(a.slice(14)) || 999);
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--csv=')) out.csv = path.resolve(a.slice(6));
    else if (a.startsWith('--limite-top=')) out.limiteTop = Math.max(1, Number(a.slice(13)) || 30);
  }
  return out;
}

function linhaCsv(r) {
  const cols = [
    r.cliente,
    r.processosMysql ?? '',
    r.processosDropbox ?? '',
    r.foraDropbox ?? '',
    r.semAndamento ?? '',
    r.stubLimpeza ?? '',
    r.vazioComTxt ?? '',
    r.andamentos ?? '',
    r.partes ?? '',
    r.calculoRodadas ?? '',
    ((r.calculoBytes ?? 0) / 1024 / 1024).toFixed(2),
    r.estimativaMb ?? '',
    r.skipLimpeza ?? '',
  ];
  return cols.join(';');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const base = resolverBaseBancoDados();
  const conn = await conectarMysqlVilareal();

  /** @type {number[]} */
  let codigos = [];
  if (opts.cliente != null && Number.isFinite(opts.cliente)) {
    codigos = [Math.trunc(opts.cliente)];
  } else {
    const [rows] = await conn.query(`SELECT codigo_cliente FROM cliente ORDER BY codigo_cliente`);
    codigos = rows
      .map((r) => Number.parseInt(String(r.codigo_cliente).trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= opts.clienteMin && n <= opts.clienteMax);
  }

  /** @type {object[]} */
  const clientes = [];
  const totais = {
    clientes: 0,
    processosMysql: 0,
    processosDropbox: 0,
    foraDropbox: 0,
    semAndamento: 0,
    stubLimpeza: 0,
    vazioComTxt: 0,
    andamentos: 0,
    calculoBytes: 0,
    estimativaMb: 0,
    skips: {},
  };

  for (const cod of codigos) {
    const d = await diagnosticarClienteStub(conn, cod, base);
    if (d.erro) continue;
    clientes.push(d);
    totais.clientes += 1;
    totais.processosMysql += d.processosMysql ?? 0;
    totais.processosDropbox += d.processosDropbox ?? 0;
    totais.foraDropbox += d.foraDropbox ?? 0;
    totais.semAndamento += d.semAndamento ?? 0;
    totais.stubLimpeza += d.stubLimpeza ?? 0;
    totais.vazioComTxt += d.vazioComTxt ?? 0;
    totais.andamentos += d.andamentos ?? 0;
    totais.calculoBytes += d.calculoBytes ?? 0;
    totais.estimativaMb += d.estimativaMb ?? 0;
    if (d.skipLimpeza) {
      totais.skips[d.skipLimpeza] = (totais.skips[d.skipLimpeza] ?? 0) + 1;
    }
  }

  const [[glob]] = await conn.query(
    `SELECT
       (SELECT COUNT(*) FROM processo) AS processosTotal,
       (SELECT COUNT(*) FROM processo p
        WHERE NOT EXISTS (SELECT 1 FROM cliente c WHERE c.pessoa_id = p.pessoa_id)) AS processosSemCliente,
       (SELECT COUNT(*) FROM processo p
        WHERE NOT EXISTS (SELECT 1 FROM cliente c WHERE c.pessoa_id = p.pessoa_id)
          AND NOT EXISTS (SELECT 1 FROM processo_andamento a WHERE a.processo_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM processo_parte pp WHERE pp.processo_id = p.id)) AS stubSemCliente`
  );

  await conn.end();

  totais.estimativaMb = Math.round(totais.estimativaMb * 100) / 100;
  totais.calculoMb = Math.round((totais.calculoBytes / 1024 / 1024) * 100) / 100;
  totais.processosTotal = Number(glob?.processosTotal ?? 0);
  totais.processosSemCliente = Number(glob?.processosSemCliente ?? 0);
  totais.stubSemCliente = Number(glob?.stubSemCliente ?? 0);

  const topStub = [...clientes]
    .filter((c) => (c.stubLimpeza ?? 0) > 0)
    .sort((a, b) => (b.stubLimpeza ?? 0) - (a.stubLimpeza ?? 0))
    .slice(0, opts.limiteTop);

  const topMb = [...clientes]
    .sort((a, b) => (b.estimativaMb ?? 0) - (a.estimativaMb ?? 0))
    .slice(0, opts.limiteTop);

  const relatorio = {
    geradoEm: new Date().toISOString(),
    base,
    faixa: opts.cliente != null ? String(opts.cliente) : `${opts.clienteMin}..${opts.clienteMax}`,
    totais,
    topStubLimpeza: topStub,
    topEstimativaMb: topMb,
    clientes: clientes.length <= 500 ? clientes : undefined,
    clientesOmitidos: clientes.length > 500 ? clientes.length : 0,
  };

  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8');

  if (opts.csv) {
    const header =
      'cliente;processos_mysql;processos_dropbox;fora_dropbox;sem_andamento;stub_limpeza;vazio_com_txt;andamentos;partes;calculo_rodadas;calculo_mb;estimativa_mb;skip_limpeza';
    const body = clientes.map((r) => linhaCsv(r)).join('\n');
    fs.mkdirSync(path.dirname(opts.csv), { recursive: true });
    fs.writeFileSync(opts.csv, `${header}\n${body}\n`, 'utf8');
  }

  console.log('\n=== diagnosticar-processos-stub-dropbox ===\n');
  console.log(`Base: ${base}`);
  console.log(`Clientes analisados: ${totais.clientes}`);
  console.log(`Processos MySQL: ${totais.processosMysql} | Dropbox (txt): ${totais.processosDropbox}`);
  console.log(`Fora Dropbox: ${totais.foraDropbox} | Sem andamento: ${totais.semAndamento}`);
  console.log(`Stub limpeza (sem txt + sem andamento + sem partes): ${totais.stubLimpeza}`);
  console.log(`Vazio com txt (aguardam import): ${totais.vazioComTxt}`);
  console.log(`Andamentos: ${totais.andamentos} | Cálculos: ${totais.calculoMb} MB`);
  console.log(`Estimativa total cliente: ${totais.estimativaMb} MB`);
  console.log(
    `Global MySQL: ${totais.processosTotal} processos | sem cadastro cliente: ${totais.processosSemCliente} | stub sem cliente: ${totais.stubSemCliente}`
  );
  if (Object.keys(totais.skips).length) {
    console.log(`Skips limpeza: ${JSON.stringify(totais.skips)}`);
  }
  console.log(`\nTop stub limpeza (${topStub.length}):`);
  for (const t of topStub.slice(0, 15)) {
    console.log(
      `  ${t.cliente}: stub=${t.stubLimpeza} mysql=${t.processosMysql} dropbox=${t.processosDropbox} nums=${(t.stubNumeros ?? []).join(',')}`
    );
  }
  console.log(`\nRelatório: ${opts.relatorio}`);
  if (opts.csv) console.log(`CSV: ${opts.csv}`);
  console.log(
    `\nLimpeza: node scripts/limpar-processos-stub-dropbox.mjs --dry-run\n         node scripts/limpar-processos-stub-dropbox.mjs --aplicar --confirmar=APAGAR-STUBS\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
