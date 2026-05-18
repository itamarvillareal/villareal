#!/usr/bin/env node
/**
 * Zera colunas de `processo` com relação directa a ficheiros txt semânticos (VB).
 *
 * **Por defeito** só estas 5 colunas (1 ficheiro txt = 1 campo API):
 *   papel_cliente, audiencia_data, audiencia_hora, audiencia_tipo, aviso_audiencia
 *
 * Não apaga histórico (`processo_andamento`) nem outros campos do processo, salvo flags explícitas.
 *
 * Uso:
 *   VILAREAL_MYSQL_PORT=3307 node scripts/zerar-campos-processo-import-txt.mjs
 *   VILAREAL_MYSQL_PORT=3307 node scripts/zerar-campos-processo-import-txt.mjs --confirmar=ZERAR-TXT-PROCESSO
 *
 * Opções:
 *   --confirmar=ZERAR-TXT-PROCESSO
 *   --incluir-cabecalho-txt        Também zera CNJ, fase, competência, etc. (tipos 3.1–148.1)
 *   --incluir-historico-txt         DELETE andamentos IMPORT_TXT_LOCAL (cuidado: apaga histórico importado)
 *   --incluir-partes                DELETE processo_parte
 *   --incluir-ativo                 UPDATE processo SET ativo = 1
 *   --zerar-tabela-prazos           DELETE processo_prazo
 */

import './lib/load-vilareal-import-env.mjs';

import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import {
  COLUNAS_PROCESSO_TXT_CABECALHO,
  COLUNAS_PROCESSO_TXT_SEMANTICO,
  sqlZerarColunasProcesso,
} from './lib/campos-processo-txt-api.mjs';

const CONFIRMAR_TOKEN = 'ZERAR-TXT-PROCESSO';

function parseArgs(argv) {
  const out = {
    dryRun: true,
    confirmar: null,
    incluirCabecalhoTxt: false,
    incluirHistoricoTxt: false,
    incluirPartes: false,
    incluirAtivo: false,
    zerarTabelaPrazos: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--incluir-cabecalho-txt') out.incluirCabecalhoTxt = true;
    else if (a === '--incluir-historico-txt') out.incluirHistoricoTxt = true;
    else if (a === '--incluir-partes') out.incluirPartes = true;
    else if (a === '--incluir-ativo') out.incluirAtivo = true;
    else if (a === '--zerar-tabela-prazos') out.zerarTabelaPrazos = true;
    else if (a.startsWith('--confirmar=')) out.confirmar = a.slice(12);
  }
  if (out.confirmar === CONFIRMAR_TOKEN) out.dryRun = false;
  return out;
}

function colunasAlvo(opts) {
  const cols = [...COLUNAS_PROCESSO_TXT_SEMANTICO];
  if (opts.incluirCabecalhoTxt) cols.push(...COLUNAS_PROCESSO_TXT_CABECALHO);
  return [...new Set(cols)];
}

/** @param {import('mysql2/promise').Connection} conn */
async function contarProcessos(conn) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM processo`);
  return Number(rows[0]?.n ?? 0);
}

/** @param {import('mysql2/promise').Connection} conn */
async function contarAndamentosTxt(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM processo_andamento
     WHERE origem = 'IMPORT_TXT_LOCAL' OR origem LIKE 'IMPORT_TXT_LOCAL_%'`
  );
  return Number(rows[0]?.n ?? 0);
}

/** @param {import('mysql2/promise').Connection} conn @param {string[]} colunas */
async function amostraPreenchidos(conn, colunas) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const col of colunas) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM processo WHERE \`${col}\` IS NOT NULL`
    );
    out[col] = Number(rows[0]?.n ?? 0);
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const colunas = colunasAlvo(opts);
  const conn = await conectarMysqlVilareal();

  try {
    const nProc = await contarProcessos(conn);
    const nAndTxt = await contarAndamentosTxt(conn);
    const preenchidos = await amostraPreenchidos(conn, colunas);

    console.log('');
    console.log('══════════════════════════════════════════════════════════');
    console.log('  ZERAR campos processo ← txt (relação directa)');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  Processos na base:           ${nProc}`);
    console.log(`  Andamentos IMPORT_TXT_LOCAL: ${nAndTxt} (só apaga com --incluir-historico-txt)`);
    console.log('');
    console.log(`  Colunas a zerar (${colunas.length}):`);
    for (const c of colunas) {
      console.log(`    • ${c}${preenchidos[c] ? ` (${preenchidos[c]} com valor)` : ''}`);
    }
    console.log('');

    if (opts.dryRun) {
      console.log('  **Simulação** — nada foi alterado.');
      console.log(
        `  Executar: VILAREAL_MYSQL_PORT=3307 node scripts/zerar-campos-processo-import-txt.mjs --confirmar=${CONFIRMAR_TOKEN}\n`
      );
      return;
    }

    console.log('  A zerar colunas…');
    const [upd] = await conn.query(sqlZerarColunasProcesso(colunas));
    console.log(`  Processos actualizados: ${upd.affectedRows ?? 0}`);

    if (opts.incluirHistoricoTxt) {
      const [delAnd] = await conn.query(
        `DELETE FROM processo_andamento
         WHERE origem = 'IMPORT_TXT_LOCAL' OR origem LIKE 'IMPORT_TXT_LOCAL_%'`
      );
      console.log(`  Andamentos IMPORT_TXT_LOCAL apagados: ${delAnd.affectedRows ?? 0}`);
    }

    if (opts.zerarTabelaPrazos) {
      const [delP] = await conn.query(`DELETE FROM processo_prazo`);
      console.log(`  processo_prazo apagados: ${delP.affectedRows ?? 0}`);
    }

    if (opts.incluirPartes) {
      await conn.query(`DELETE FROM processo_parte_advogado`);
      const [delPartes] = await conn.query(`DELETE FROM processo_parte`);
      console.log(`  processo_parte apagadas: ${delPartes.affectedRows ?? 0}`);
    }

    if (opts.incluirAtivo) {
      const [updAtivo] = await conn.query(`UPDATE processo SET ativo = 1`);
      console.log(`  Processos reactivados: ${updAtivo.affectedRows ?? 0}`);
    }

    console.log('\n  Concluído.\n');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
