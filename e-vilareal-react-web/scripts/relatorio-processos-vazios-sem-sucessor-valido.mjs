#!/usr/bin/env node
/**
 * Relatório: processos «vazios» sem nenhum processo válido posterior do mesmo cliente.
 *
 * Critérios do processo alvo (vazio):
 *   - sem andamento (`processo_andamento`)
 *   - sem número judicial (`numero_cnj` e `numero_processo_antigo`)
 *   - sem unidade, sem parte RÉU, sem cálculo dim. 0 (mesma noção de `findProcessosVaziosPorCliente`)
 *
 * Critério de sucessão:
 *   - não existe outro processo do mesmo cliente com `numero_interno` maior que seja «válido»
 *
 * Processo «válido» = tem andamento OU número judicial (CNJ ou antigo).
 *
 * Opção `--criterio-valido=completo` usa também unidade, RÉU e cálculo dim. 0
 * (mesma noção invertida de `findProcessosVaziosPorCliente`).
 *
 * Uso:
 *   node scripts/relatorio-processos-vazios-sem-sucessor-valido.mjs
 *   node scripts/relatorio-processos-vazios-sem-sucessor-valido.mjs --csv=tmp/processos-vazios.csv
 *   node scripts/relatorio-processos-vazios-sem-sucessor-valido.mjs --relatorio=tmp/processos-vazios.json
 *   node scripts/relatorio-processos-vazios-sem-sucessor-valido.mjs --somente-cliente-sem-valido
 *   node scripts/relatorio-processos-vazios-sem-sucessor-valido.mjs --cliente=578
 *
 * VPS (túnel SSH 3308):
 *   node scripts/relatorio-processos-vazios-sem-sucessor-valido.mjs --vps
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { aplicarPerfilConexao, parseFlagVps } from './lib/mysql-alvo-vilareal.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';

const SQL_BASE = `
SELECT
  p.id AS processo_id,
  TRIM(c.codigo_cliente) AS codigo_cliente,
  CAST(TRIM(LEADING '0' FROM c.codigo_cliente) AS UNSIGNED) AS codigo_cliente_num,
  p.numero_interno,
  p.ativo,
  p.fase,
  p.natureza_acao,
  p.created_at,
  p.updated_at,
  EXISTS (
    SELECT 1 FROM processo_andamento pa WHERE pa.processo_id = p.id
  ) AS tem_andamento,
  (
    p.numero_cnj IS NOT NULL AND TRIM(p.numero_cnj) <> ''
  ) AS tem_cnj,
  (
    p.numero_processo_antigo IS NOT NULL AND TRIM(p.numero_processo_antigo) <> ''
  ) AS tem_num_antigo,
  (
    p.unidade IS NOT NULL AND TRIM(p.unidade) <> ''
  ) AS tem_unidade,
  EXISTS (
    SELECT 1 FROM processo_parte pp
    WHERE pp.processo_id = p.id AND UPPER(TRIM(pp.polo)) = 'REU'
  ) AS tem_reu,
  EXISTS (
    SELECT 1 FROM calculo_rodada cr
    WHERE TRIM(cr.codigo_cliente) = TRIM(c.codigo_cliente)
      AND cr.numero_processo = p.numero_interno
      AND cr.dimensao = 0
  ) AS tem_calculo_dim0,
  (
    EXISTS (SELECT 1 FROM processo_andamento pa WHERE pa.processo_id = p.id)
    OR (p.numero_cnj IS NOT NULL AND TRIM(p.numero_cnj) <> '')
    OR (p.numero_processo_antigo IS NOT NULL AND TRIM(p.numero_processo_antigo) <> '')
    OR (p.unidade IS NOT NULL AND TRIM(p.unidade) <> '')
    OR EXISTS (
      SELECT 1 FROM processo_parte pp
      WHERE pp.processo_id = p.id AND UPPER(TRIM(pp.polo)) = 'REU'
    )
    OR EXISTS (
      SELECT 1 FROM calculo_rodada cr
      WHERE TRIM(cr.codigo_cliente) = TRIM(c.codigo_cliente)
        AND cr.numero_processo = p.numero_interno
        AND cr.dimensao = 0
    )
  ) AS processo_valido,
  (
    NOT EXISTS (SELECT 1 FROM processo_andamento pa WHERE pa.processo_id = p.id)
    AND (p.numero_cnj IS NULL OR TRIM(p.numero_cnj) = '')
    AND (p.numero_processo_antigo IS NULL OR TRIM(p.numero_processo_antigo) = '')
    AND (p.unidade IS NULL OR TRIM(p.unidade) = '')
    AND NOT EXISTS (
      SELECT 1 FROM processo_parte pp
      WHERE pp.processo_id = p.id AND UPPER(TRIM(pp.polo)) = 'REU'
    )
    AND NOT EXISTS (
      SELECT 1 FROM calculo_rodada cr
      WHERE TRIM(cr.codigo_cliente) = TRIM(c.codigo_cliente)
        AND cr.numero_processo = p.numero_interno
        AND cr.dimensao = 0
    )
  ) AS processo_vazio,
  EXISTS (
    SELECT 1 FROM processo p_ant
    INNER JOIN cliente c_ant ON c_ant.id = p_ant.cliente_id
    WHERE p_ant.cliente_id = p.cliente_id
      AND p_ant.numero_interno < p.numero_interno
      AND p_ant.numero_interno >= 1
      AND (
        EXISTS (SELECT 1 FROM processo_andamento pa WHERE pa.processo_id = p_ant.id)
        OR (p_ant.numero_cnj IS NOT NULL AND TRIM(p_ant.numero_cnj) <> '')
        OR (p_ant.numero_processo_antigo IS NOT NULL AND TRIM(p_ant.numero_processo_antigo) <> '')
        OR (p_ant.unidade IS NOT NULL AND TRIM(p_ant.unidade) <> '')
        OR EXISTS (
          SELECT 1 FROM processo_parte pp
          WHERE pp.processo_id = p_ant.id AND UPPER(TRIM(pp.polo)) = 'REU'
        )
        OR EXISTS (
          SELECT 1 FROM calculo_rodada cr
          WHERE TRIM(cr.codigo_cliente) = TRIM(c_ant.codigo_cliente)
            AND cr.numero_processo = p_ant.numero_interno
            AND cr.dimensao = 0
        )
      )
  ) AS tem_valido_anterior,
  (
    SELECT COUNT(*)
    FROM processo px
    WHERE px.cliente_id = p.cliente_id AND px.numero_interno >= 1
  ) AS total_processos_cliente
FROM processo p
INNER JOIN cliente c ON c.id = p.cliente_id
WHERE p.numero_interno >= 1
`.trim();

function parseArgs(argv) {
  const out = {
    csv: 'tmp/processos-vazios-sem-sucessor-valido.csv',
    relatorio: null,
    pairs: 'tmp/processos-vazios-sem-sucessor-valido.pairs',
    cliente: null,
    somenteClienteSemValido: false,
    criterioValido: 'judicial',
    limiteDetalhe: 80,
  };
  for (const a of argv) {
    if (a.startsWith('--csv=')) out.csv = a.slice(6);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--pairs=')) out.pairs = a.slice(8);
    else if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a === '--somente-cliente-sem-valido') out.somenteClienteSemValido = true;
    else if (a.startsWith('--criterio-valido=')) out.criterioValido = a.slice(18);
    else if (a.startsWith('--limite=')) out.limiteDetalhe = Number(a.slice(9));
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

/** @param {unknown} v */
function asBool(v) {
  return v === 1 || v === true || v === '1';
}

/** @param {Record<string, unknown>} row @param {'judicial' | 'completo'} criterio */
function processoValidoPorCriterio(row, criterio) {
  const temAndamento = asBool(row.tem_andamento);
  const temCnj = asBool(row.tem_cnj);
  const temNumAntigo = asBool(row.tem_num_antigo);
  if (temAndamento || temCnj || temNumAntigo) return true;
  if (criterio !== 'completo') return false;
  return asBool(row.tem_unidade) || asBool(row.tem_reu) || asBool(row.tem_calculo_dim0);
}

/** @param {Record<string, unknown>} row @param {'judicial' | 'completo'} criterio */
function processoVazioPorCriterio(row, criterio) {
  const semJudicial =
    !asBool(row.tem_andamento) && !asBool(row.tem_cnj) && !asBool(row.tem_num_antigo);
  if (!semJudicial) return false;
  if (criterio !== 'completo') return true;
  return (
    !asBool(row.tem_unidade) &&
    !asBool(row.tem_reu) &&
    !asBool(row.tem_calculo_dim0)
  );
}

/** @param {Record<string, unknown>} row @param {'judicial' | 'completo'} criterio */
function normalizarRow(row, criterio) {
  const codigoClienteNum = Number(row.codigo_cliente_num);
  return {
    processoId: Number(row.processo_id),
    codigoCliente: String(row.codigo_cliente ?? '').trim(),
    codigoClienteNum,
    codigoCliente8: formatCod8(codigoClienteNum),
    numeroInterno: Number(row.numero_interno),
    ativo: asBool(row.ativo),
    fase: row.fase ?? null,
    naturezaAcao: row.natureza_acao ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    temAndamento: asBool(row.tem_andamento),
    temCnj: asBool(row.tem_cnj),
    temNumAntigo: asBool(row.tem_num_antigo),
    temUnidade: asBool(row.tem_unidade),
    temReu: asBool(row.tem_reu),
    temCalculoDim0: asBool(row.tem_calculo_dim0),
    processoValido: processoValidoPorCriterio(row, criterio),
    processoVazio: processoVazioPorCriterio(row, criterio),
    temValidoAnterior: asBool(row.tem_valido_anterior),
    totalProcessosCliente: Number(row.total_processos_cliente ?? 0),
  };
}

/** @param {ReturnType<typeof normalizarRow>[]} rows */
function filtrarAlvo(rows, opts) {
  let out = rows.filter((r) => r.processoVazio);
  out = out.filter((r) => {
    const temSucessorValido = rows.some(
      (o) =>
        o.codigoCliente === r.codigoCliente &&
        o.numeroInterno > r.numeroInterno &&
        o.processoValido
    );
    return !temSucessorValido;
  });
  if (opts.cliente != null && Number.isFinite(opts.cliente)) {
    out = out.filter((r) => r.codigoClienteNum === opts.cliente);
  }
  if (opts.somenteClienteSemValido) {
    const clientesComValido = new Set(
      rows.filter((r) => r.processoValido).map((r) => r.codigoCliente)
    );
    out = out.filter((r) => !clientesComValido.has(r.codigoCliente));
  }
  out.sort((a, b) => a.codigoClienteNum - b.codigoClienteNum || a.numeroInterno - b.numeroInterno);
  return out;
}

/** @param {ReturnType<typeof normalizarRow>[]} alvo */
function montarStats(todos, alvo) {
  const clientesAlvo = new Set(alvo.map((r) => r.codigoCliente));
  const clientesSemValido = new Set(
    alvo.filter((r) => !r.temValidoAnterior).map((r) => r.codigoCliente)
  );
  return {
    totalProcessosDb: todos.length,
    totalValidosDb: todos.filter((r) => r.processoValido).length,
    totalVaziosDb: todos.filter((r) => r.processoVazio).length,
    alvoProcessos: alvo.length,
    alvoClientes: clientesAlvo.size,
    alvoClientesSemNenhumValido: clientesSemValido.size,
    alvoClientesComValidoAnterior: [...clientesAlvo].filter((c) =>
      alvo.some((r) => r.codigoCliente === c && r.temValidoAnterior)
    ).length,
  };
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** @param {ReturnType<typeof normalizarRow>[]} alvo @param {string} file */
function gravarCsv(alvo, file) {
  const headers = [
    'codigo_cliente',
    'numero_interno',
    'processo_id',
    'ativo',
    'tem_valido_anterior',
    'total_processos_cliente',
    'fase',
    'natureza_acao',
    'created_at',
    'updated_at',
  ];
  const lines = [
    headers.join(','),
    ...alvo.map((r) =>
      [
        r.codigoCliente8,
        r.numeroInterno,
        r.processoId,
        r.ativo ? 1 : 0,
        r.temValidoAnterior ? 1 : 0,
        r.totalProcessosCliente,
        r.fase,
        r.naturezaAcao,
        r.createdAt,
        r.updatedAt,
      ]
        .map(csvEscape)
        .join(',')
    ),
  ];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + (lines.length > 1 ? '\n' : ''), 'utf8');
}

/** @param {ReturnType<typeof normalizarRow>[]} alvo @param {string} file */
function gravarPairs(alvo, file) {
  const lines = alvo.map((r) => `${r.codigoClienteNum} ${r.numeroInterno}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
}

function imprimirRelatorio(stats, alvo, limiteDetalhe, criterioValido) {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  RELATÓRIO — processos vazios sem sucessor válido');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(
    criterioValido === 'completo'
      ? '  Vazio: sem andamento, sem nº judicial, sem unidade, sem RÉU, sem cálculo dim.0'
      : '  Vazio: sem andamento e sem nº judicial (CNJ ou antigo)'
  );
  console.log(
    criterioValido === 'completo'
      ? '  Válido: andamento OU nº judicial OU unidade OU RÉU OU cálculo dim.0'
      : '  Válido: andamento OU nº judicial'
  );
  console.log('  Alvo: vazio + nenhum processo válido com Proc. maior no mesmo cliente');
  console.log('──────────────────────────────────────────────────────────────────');
  console.log(`  Processos na base (Proc. ≥ 1):     ${stats.totalProcessosDb}`);
  console.log(`  Processos válidos na base:         ${stats.totalValidosDb}`);
  console.log(`  Processos vazios na base:          ${stats.totalVaziosDb}`);
  console.log(`  Processos no relatório (alvo):     ${stats.alvoProcessos}`);
  console.log(`  Clientes distintos no alvo:        ${stats.alvoClientes}`);
  console.log(`  Clientes sem nenhum proc. válido:  ${stats.alvoClientesSemNenhumValido}`);
  console.log(`  Clientes com proc. válido anterior: ${stats.alvoClientesComValidoAnterior}`);
  console.log('──────────────────────────────────────────────────────────────────');

  if (!alvo.length) {
    console.log('\n  Nenhum processo encontrado com os critérios.\n');
    console.log('══════════════════════════════════════════════════════════════════\n');
    return;
  }

  console.log(`\n  Amostra (até ${limiteDetalhe} linhas):\n`);
  console.log('  Cliente   Proc.  ID proc.   Ant.valido?  Procs.cli.  Ativo');
  let n = 0;
  for (const r of alvo) {
    if (n >= limiteDetalhe) {
      console.log(`  … e mais ${alvo.length - limiteDetalhe} processo(s).`);
      break;
    }
    n += 1;
    console.log(
      `  ${r.codigoCliente8}   ${String(r.numeroInterno).padStart(4)}   ${String(r.processoId).padStart(8)}   ${r.temValidoAnterior ? 'sim       ' : 'não       '}  ${String(r.totalProcessosCliente).padStart(9)}  ${r.ativo ? 'sim' : 'não'}`
    );
  }
  console.log('\n══════════════════════════════════════════════════════════════════\n');
}

function printHelp() {
  console.log(`Uso: node scripts/relatorio-processos-vazios-sem-sucessor-valido.mjs [opções]

Opções:
  --csv=PATH                 CSV de saída (default: tmp/processos-vazios-sem-sucessor-valido.csv)
  --pairs=PATH               Lista cliente proc (default: tmp/processos-vazios-sem-sucessor-valido.pairs)
  --relatorio=PATH           JSON completo
  --cliente=N                Filtra um cliente
  --somente-cliente-sem-valido  Só clientes que não têm nenhum processo válido
  --criterio-valido=judicial|completo  (default: judicial)
  --limite=N                 Linhas no resumo console (default: 80)
`);
}

const argv = process.argv.slice(2);
const opts = parseArgs(argv);
if (opts.help) {
  printHelp();
  process.exit(0);
}

const perfil = aplicarPerfilConexao({ vps: parseFlagVps(argv) });
const criterioValido = opts.criterioValido === 'completo' ? 'completo' : 'judicial';

const conn = await conectarMysqlVilareal();
let rows;
try {
  [rows] = await conn.query(SQL_BASE);
} finally {
  await conn.end();
}

const todos = rows.map((r) => normalizarRow(r, criterioValido));

// `tem_valido_anterior` veio da SQL com critério completo; recalcula se necessário.
if (criterioValido === 'judicial') {
  for (const r of todos) {
    r.temValidoAnterior = todos.some(
      (o) =>
        o.codigoCliente === r.codigoCliente &&
        o.numeroInterno < r.numeroInterno &&
        o.processoValido
    );
  }
}

const alvo = filtrarAlvo(todos, opts);
const stats = montarStats(todos, alvo);

console.log(`Alvo DB: ${perfil.alvo}`);
imprimirRelatorio(stats, alvo, opts.limiteDetalhe, criterioValido);
gravarCsv(alvo, opts.csv);
gravarPairs(alvo, opts.pairs);
console.log(`CSV:   ${opts.csv}`);
console.log(`Pairs: ${opts.pairs}`);

if (opts.relatorio) {
  const payload = {
    geradoEm: new Date().toISOString(),
    criterios: {
      criterioValido,
      vazio:
        criterioValido === 'completo'
          ? 'sem andamento, sem numero_cnj/antigo, sem unidade, sem REU, sem calculo_rodada dim.0'
          : 'sem andamento e sem numero_cnj/antigo',
      sucessor:
        'nenhum processo do mesmo cliente com numero_interno maior e marcado como valido',
      valido:
        criterioValido === 'completo'
          ? 'tem andamento OU numero judicial OU unidade OU REU OU calculo dim.0'
          : 'tem andamento OU numero judicial (CNJ ou antigo)',
    },
    stats,
    processos: alvo,
  };
  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`JSON:  ${opts.relatorio}`);
}
