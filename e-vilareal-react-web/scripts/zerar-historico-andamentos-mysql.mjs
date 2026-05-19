#!/usr/bin/env node
/**
 * Remove **todos** os registos de `processo_andamento` na base MySQL.
 * Use antes de reimportar o histórico exclusivamente a partir dos txt locais.
 *
 * Uso:
 *   node scripts/zerar-historico-andamentos-mysql.mjs
 *   node scripts/zerar-historico-andamentos-mysql.mjs --confirmar=ZERAR-HISTORICO
 *
 * Opções:
 *   --dry-run              Só mostra contagens (defeito sem --confirmar)
 *   --confirmar=ZERAR-HISTORICO   Executa DELETE
 *   --apenas-origens-import   Apaga só IMPORT_PLANILHA, IMPORT_TXT_LOCAL, etc. (não recomendado se o objectivo é só txt)
 *
 * MySQL: `VILAREAL_MYSQL_*` — porta defeito **3307** (`vilareal-db`) ou `VILAREAL_MYSQL_DOCKER=vilareal-db`.
 */

import './lib/load-vilareal-import-env.mjs';

import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { isOrigemImportPlanilha } from './lib/chaves-dedupe-andamento.mjs';

const CONFIRMAR_TOKEN = 'ZERAR-HISTORICO';

function parseArgs(argv) {
  const out = {
    dryRun: true,
    confirmar: null,
    apenasOrigensImport: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--apenas-origens-import') out.apenasOrigensImport = true;
    else if (a.startsWith('--confirmar=')) out.confirmar = a.slice(12);
  }
  if (out.confirmar === CONFIRMAR_TOKEN) out.dryRun = false;
  return out;
}

/** @param {import('mysql2/promise').Connection} conn */
async function contarPorOrigem(conn) {
  const [rows] = await conn.query(
    `SELECT origem, COUNT(*) AS n
     FROM processo_andamento
     GROUP BY origem
     ORDER BY n DESC`
  );
  return rows;
}

/** @param {import('mysql2/promise').Connection} conn */
async function contarTotal(conn) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM processo_andamento`);
  return Number(rows[0]?.n ?? 0);
}

/** @param {import('mysql2/promise').Connection} conn */
async function contarPrazosComAndamento(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM processo_prazo WHERE andamento_id IS NOT NULL`
  );
  return Number(rows[0]?.n ?? 0);
}

function isOrigemImportTxtLocal(origem) {
  const o = String(origem ?? '').trim();
  return o === 'IMPORT_TXT_LOCAL' || /^IMPORT_TXT_LOCAL_/.test(o);
}

function origemEhImportHistorico(origem) {
  return isOrigemImportPlanilha(origem) || isOrigemImportTxtLocal(origem);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const conn = await conectarMysqlVilareal();

  try {
    const total = await contarTotal(conn);
    const porOrigem = await contarPorOrigem(conn);
    const prazosLigados = await contarPrazosComAndamento(conn);

    console.log('');
    console.log('══════════════════════════════════════════════════════════');
    console.log('  ZERAR histórico — processo_andamento (MySQL)');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  Total de andamentos:           ${total}`);
    console.log(`  Prazos com andamento_id:     ${prazosLigados} (ficam NULL após apagar)`);
    console.log('');
    console.log('  Por origem:');
    for (const r of porOrigem) {
      console.log(`    ${String(r.origem).padEnd(28)} ${r.n}`);
    }
    console.log('');

    if (opts.apenasOrigensImport) {
      const alvo = porOrigem.filter((r) => origemEhImportHistorico(r.origem));
      const nAlvo = alvo.reduce((s, r) => s + Number(r.n), 0);
      console.log(`  Modo --apenas-origens-import: ${nAlvo} registo(s) a apagar`);
      if (opts.dryRun) {
        console.log('\n  Simulação. Para apagar: --confirmar=ZERAR-HISTORICO --apenas-origens-import\n');
        return;
      }
      const [res] = await conn.query(
        `DELETE FROM processo_andamento WHERE origem = 'IMPORT_PLANILHA'
           OR origem LIKE 'IMPORT_PLANILHA_%'
           OR origem = 'IMPORT_TXT_LOCAL'
           OR origem LIKE 'IMPORT_TXT_LOCAL_%'`
      );
      console.log(`  Apagados: ${res.affectedRows ?? 0} andamento(s) de importação.`);
      console.log(`  Restantes na tabela: ${await contarTotal(conn)}\n`);
      return;
    }

    if (opts.dryRun) {
      console.log('  **Simulação** — nada foi apagado.');
      console.log(`  Para apagar TODOS os ${total} andamento(s):`);
      console.log(`    node scripts/zerar-historico-andamentos-mysql.mjs --confirmar=${CONFIRMAR_TOKEN}\n`);
      return;
    }

    console.log('  A apagar TODOS os andamentos…');
    const [del] = await conn.query(`DELETE FROM processo_andamento`);
    const apagados = del.affectedRows ?? 0;
    const restantes = await contarTotal(conn);
    console.log(`  Apagados: ${apagados}`);
    console.log(`  Restantes: ${restantes}`);
    console.log('\n  Base pronta para importação exclusiva dos txt (IMPORT_TXT_LOCAL).\n');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
