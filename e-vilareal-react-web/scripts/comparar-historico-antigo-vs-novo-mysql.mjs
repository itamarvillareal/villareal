#!/usr/bin/env node
/**
 * Compara histórico na base antiga (backup → schema vilareal_old) com a importação txt (vilareal).
 *
 * Pré-requisito: backup restaurado, ex.:
 *   docker exec vilareal-local-db mysql -uroot -proot -e "CREATE DATABASE vilareal_old"
 *   docker exec -i vilareal-local-db mysql -uroot -proot vilareal_old < /tmp/vilareal-local-backup-20260515_1640.sql
 *
 * Uso:
 *   node scripts/comparar-historico-antigo-vs-novo-mysql.mjs
 *   node scripts/comparar-historico-antigo-vs-novo-mysql.mjs --relatorio=/tmp/comparacao-historico.json
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const SCHEMA_OLD = process.env.VILAREAL_MYSQL_SCHEMA_OLD || 'vilareal_old';
const SCHEMA_NEW = process.env.VILAREAL_MYSQL_DATABASE || 'vilareal';

function parseArgs(argv) {
  const out = { relatorio: null, cliente: null };
  for (const a of argv) {
    if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--cliente=')) out.cliente = Math.trunc(Number(a.slice(10)));
  }
  return out;
}

/** @param {import('mysql2/promise').Connection} conn */
async function existeSchema(conn, name) {
  const [rows] = await conn.query(
    `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
    [name]
  );
  return rows.length > 0;
}

/** @param {import('mysql2/promise').Connection} conn */
async function resumoGlobal(conn) {
  const [antiga] = await conn.query(
    `SELECT origem, COUNT(*) n FROM ${SCHEMA_OLD}.processo_andamento GROUP BY origem ORDER BY n DESC`
  );
  const [nova] = await conn.query(
    `SELECT origem, COUNT(*) n FROM ${SCHEMA_NEW}.processo_andamento GROUP BY origem ORDER BY n DESC`
  );
  const [[tOld]] = await conn.query(`SELECT COUNT(*) n FROM ${SCHEMA_OLD}.processo_andamento`);
  const [[tNew]] = await conn.query(`SELECT COUNT(*) n FROM ${SCHEMA_NEW}.processo_andamento`);
  return { totalAntiga: Number(tOld.n), totalNova: Number(tNew.n), porOrigemAntiga: antiga, porOrigemNova: nova };
}

/**
 * Agrega por código cliente + nº interno (chave de negócio).
 * @param {import('mysql2/promise').Connection} conn
 * @param {string} schema
 */
async function contagensPorProcesso(conn, schema) {
  const [rows] = await conn.query(`
    SELECT c.codigo_cliente AS cod8, p.numero_interno AS ni, COUNT(*) AS n
    FROM ${schema}.processo_andamento a
    JOIN ${schema}.processo p ON p.id = a.processo_id
    JOIN ${schema}.cliente c ON c.pessoa_id = p.pessoa_id
    GROUP BY c.codigo_cliente, p.numero_interno
  `);
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const r of rows) {
    map.set(`${r.cod8}|${r.ni}`, Number(r.n));
  }
  return map;
}

/**
 * Chaves dedupe: DATE(movimento_em) + titulo normalizado (primeiros 500).
 * @param {import('mysql2/promise').Connection} conn
 * @param {string} schema
 */
async function chavesDedupe(conn, schema) {
  const [rows] = await conn.query(`
    SELECT c.codigo_cliente AS cod8, p.numero_interno AS ni,
           DATE(a.movimento_em) AS d, LEFT(TRIM(a.titulo), 500) AS titulo
    FROM ${schema}.processo_andamento a
    JOIN ${schema}.processo p ON p.id = a.processo_id
    JOIN ${schema}.cliente c ON c.pessoa_id = p.pessoa_id
  `);
  /** @type {Set<string>} */
  const set = new Set();
  for (const r of rows) {
    const d = r.d ? String(r.d).slice(0, 10) : '_null_';
    const tit = String(r.titulo || 'Andamento').replace(/\s+/g, ' ').trim().toUpperCase();
    set.add(`${r.cod8}|${r.ni}|${d}|${tit}`);
  }
  return set;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const conn = await conectarMysqlVilareal();

  try {
    if (!(await existeSchema(conn, SCHEMA_OLD))) {
      console.error(
        `Schema "${SCHEMA_OLD}" não existe. Restaure o backup em vilareal_old antes de comparar.`
      );
      process.exit(1);
    }

    console.log('\n=== Comparação histórico ANTIGO (planilha) vs NOVO (txt) ===\n');

    const global = await resumoGlobal(conn);
    console.log(`Total andamentos ANTIGA (${SCHEMA_OLD}): ${global.totalAntiga}`);
    for (const r of global.porOrigemAntiga) {
      console.log(`  ${String(r.origem).padEnd(32)} ${r.n}`);
    }
    console.log(`\nTotal andamentos NOVA (${SCHEMA_NEW}): ${global.totalNova}`);
    for (const r of global.porOrigemNova) {
      console.log(`  ${String(r.origem).padEnd(32)} ${r.n}`);
    }
    console.log(`\nDiferença (nova − antiga): ${global.totalNova - global.totalAntiga}`);

    console.log('\nA agregar por processo (cod8 + nº interno)…');
    const mapOld = await contagensPorProcesso(conn, SCHEMA_OLD);
    const mapNew = await contagensPorProcesso(conn, SCHEMA_NEW);

    let soAntiga = 0;
    let soNova = 0;
    let emAmbas = 0;
    let linhasSoAntiga = 0;
    let linhasSoNova = 0;
    let maiorGap = 0;
    /** @type {{ cod8: string, ni: number, antiga: number, nova: number, gap: number }[]} */
    const gaps = [];

    const keys = new Set([...mapOld.keys(), ...mapNew.keys()]);
    for (const k of keys) {
      const o = mapOld.get(k) || 0;
      const n = mapNew.get(k) || 0;
      if (o > 0 && n > 0) {
        emAmbas += 1;
        if (n !== o) gaps.push({ cod8: k.split('|')[0], ni: Number(k.split('|')[1]), antiga: o, nova: n, gap: n - o });
      } else if (o > 0) {
        soAntiga += 1;
        linhasSoAntiga += o;
      } else {
        soNova += 1;
        linhasSoNova += n;
      }
      if (Math.abs(n - o) > maiorGap) maiorGap = Math.abs(n - o);
    }
    gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    console.log('\n--- Por processo (cliente + nº interno) ---');
    console.log(`Processos só na ANTIGA: ${soAntiga} (${linhasSoAntiga} andamentos)`);
    console.log(`Processos só na NOVA:   ${soNova} (${linhasSoNova} andamentos)`);
    console.log(`Processos em ambas:     ${emAmbas}`);
    console.log(`Processos com contagem diferente: ${gaps.length}`);
    console.log('\nTop 15 maiores diferenças (nova − antiga):');
    for (const g of gaps.slice(0, 15)) {
      console.log(`  ${g.cod8} proc ${g.ni}: antiga=${g.antiga} nova=${g.nova} Δ=${g.gap >= 0 ? '+' : ''}${g.gap}`);
    }

    console.log('\nA calcular sobreposição por data+título (amostra completa, pode demorar)…');
    const keysOld = await chavesDedupe(conn, SCHEMA_OLD);
    const keysNew = await chavesDedupe(conn, SCHEMA_NEW);
    let emComum = 0;
    for (const k of keysOld) {
      if (keysNew.has(k)) emComum += 1;
    }
    const soAntigaChave = keysOld.size - emComum;
    const soNovaChave = keysNew.size - emComum;

    console.log('\n--- Chave data (dia) + título (normalizado) ---');
    console.log(`Chaves únicas ANTIGA: ${keysOld.size}`);
    console.log(`Chaves únicas NOVA:   ${keysNew.size}`);
    console.log(`Em comum:             ${emComum}`);
    console.log(`Só na ANTIGA:         ${soAntigaChave}`);
    console.log(`Só na NOVA:           ${soNovaChave}`);

    const payload = {
      geradoEm: new Date().toISOString(),
      schemaAntiga: SCHEMA_OLD,
      schemaNova: SCHEMA_NEW,
      global,
      porProcesso: {
        soAntiga,
        soNova,
        emAmbas,
        comContagemDiferente: gaps.length,
        linhasSoAntiga,
        linhasSoNova,
        topGaps: gaps.slice(0, 100),
      },
      dedupeDataTitulo: {
        chavesAntiga: keysOld.size,
        chavesNova: keysNew.size,
        emComum,
        soAntiga: soAntigaChave,
        soNova: soNovaChave,
      },
    };

    if (opts.relatorio) {
      fs.writeFileSync(opts.relatorio, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`\nRelatório JSON: ${opts.relatorio}`);
    }
    console.log('');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
