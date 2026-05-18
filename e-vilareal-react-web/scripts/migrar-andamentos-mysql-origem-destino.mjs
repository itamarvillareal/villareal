#!/usr/bin/env node
/**
 * Migra `processo_andamento` entre duas instâncias MySQL (opção C),
 * remapeando `processo_id` pela chave de negócio código cliente (8) + nº interno.
 *
 * Caso típico (dev):
 *   origem  → vilareal-local-db (host 3306) — histórico já importado dos txt
 *   destino → vilareal-db (host 3307) — base usada pelo backend Docker :8081
 *
 * Uso:
 *   node scripts/migrar-andamentos-mysql-origem-destino.mjs --dry-run
 *   node scripts/migrar-andamentos-mysql-origem-destino.mjs --confirmar=MIGRAR-ANDAMENTOS
 *   node scripts/migrar-andamentos-mysql-origem-destino.mjs --confirmar=MIGRAR-ANDAMENTOS --zerar-destino
 *
 * Envs:
 *   VILAREAL_MYSQL_SOURCE_PORT (3306), VILAREAL_MYSQL_TARGET_PORT (3307)
 *   VILAREAL_MYSQL_* user/password/database
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import mysql from 'mysql2/promise';

const CONFIRMAR_TOKEN = 'MIGRAR-ANDAMENTOS';
const BATCH_DEFAULT = 400;

function parseArgs(argv) {
  const out = {
    dryRun: true,
    confirmar: null,
    zerarDestino: false,
    origens: ['IMPORT_TXT_LOCAL'],
    batchSize: BATCH_DEFAULT,
    cliente: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--zerar-destino') out.zerarDestino = true;
    else if (a.startsWith('--confirmar=')) out.confirmar = a.slice(12);
    else if (a.startsWith('--origem=')) out.origens = a.slice(9).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--batch=')) out.batchSize = Math.max(50, Math.trunc(Number(a.slice(8)) || BATCH_DEFAULT));
    else if (a.startsWith('--cliente=')) out.cliente = Math.trunc(Number(a.slice(10)));
  }
  if (out.confirmar === CONFIRMAR_TOKEN) out.dryRun = false;
  return out;
}

function credenciais(port) {
  return {
    host: process.env.VILAREAL_MYSQL_HOST || '127.0.0.1',
    port: Number(port),
    user: process.env.VILAREAL_MYSQL_USER || 'root',
    password: process.env.VILAREAL_MYSQL_PASSWORD ?? 'root',
    database: process.env.VILAREAL_MYSQL_DATABASE || 'vilareal',
    timezone: 'Z',
    multipleStatements: false,
  };
}

/** @param {string} cod8 @param {number} ni */
function chaveProcesso(cod8, ni) {
  return `${cod8}|${ni}`;
}

/** @param {import('mysql2/promise').Connection} conn */
async function carregarMapaProcessoDestino(conn) {
  const [rows] = await conn.query(`
    SELECT c.codigo_cliente AS cod8, p.numero_interno AS ni, p.id AS processo_id
    FROM processo p
    INNER JOIN cliente c ON c.pessoa_id = p.pessoa_id
  `);
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const r of rows) {
    map.set(chaveProcesso(String(r.cod8), Number(r.ni)), Number(r.processo_id));
  }
  return map;
}

/** @param {import('mysql2/promise').Connection} conn */
async function carregarUsuariosDestino(conn) {
  const [rows] = await conn.query(`SELECT id FROM usuarios`);
  return new Set(rows.map((r) => Number(r.id)));
}

/** @param {import('mysql2/promise').Connection} conn @param {string[]} origens */
async function contarOrigem(conn, origens, clienteFiltro) {
  const placeholders = origens.map(() => '?').join(',');
  const params = [];
  let joinCliente = '';
  if (clienteFiltro != null) {
    joinCliente = `
      INNER JOIN processo p ON p.id = a.processo_id
      INNER JOIN cliente c ON c.pessoa_id = p.pessoa_id AND c.codigo_cliente = ?
    `;
    params.push(String(clienteFiltro).padStart(8, '0'));
  }
  params.push(...origens);
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM processo_andamento a ${joinCliente}
     WHERE a.origem IN (${placeholders})`,
    params
  );
  return Number(rows[0].n);
}

/** @param {import('mysql2/promise').Connection} conn */
async function zerarAndamentosDestino(conn, origens) {
  if (origens.length === 0) {
    const [r] = await conn.query(`DELETE FROM processo_andamento`);
    return r.affectedRows ?? 0;
  }
  const placeholders = origens.map(() => '?').join(',');
  const [r] = await conn.query(`DELETE FROM processo_andamento WHERE origem IN (${placeholders})`, origens);
  return r.affectedRows ?? 0;
}

/**
 * @param {import('mysql2/promise').Connection} src
 * @param {string[]} origens
 * @param {number | null} clienteFiltro
 */
async function* iterarAndamentosOrigem(src, origens, clienteFiltro) {
  const placeholders = origens.map(() => '?').join(',');
  const params = [...origens];
  let filtroClienteSql = '';
  if (clienteFiltro != null) {
    filtroClienteSql = ` AND c.codigo_cliente = ? `;
    params.push(String(clienteFiltro).padStart(8, '0'));
  }

  let lastId = 0;
  const pageSize = 5000;
  for (;;) {
    const pageParams = [lastId, ...params];
    const [rows] = await src.query(
      `
      SELECT a.id, c.codigo_cliente AS cod8, p.numero_interno AS ni,
             a.movimento_em, a.titulo, a.detalhe, a.origem, a.origem_automatica,
             a.usuario_id, a.importacao_id
      FROM processo_andamento a
      INNER JOIN processo p ON p.id = a.processo_id
      INNER JOIN cliente c ON c.pessoa_id = p.pessoa_id
      WHERE a.id > ? AND a.origem IN (${placeholders}) ${filtroClienteSql}
      ORDER BY a.id ASC
      LIMIT ${pageSize}
      `,
      pageParams
    );
    if (rows.length === 0) break;
    for (const r of rows) yield r;
    lastId = Number(rows[rows.length - 1].id);
    if (rows.length < pageSize) break;
  }
}

/**
 * @param {import('mysql2/promise').Connection} dest
 * @param {object[]} batch
 */
async function inserirLote(dest, batch) {
  if (batch.length === 0) return 0;
  const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?)').join(',');
  const vals = [];
  for (const r of batch) {
    vals.push(
      r.processo_id,
      r.movimento_em,
      r.titulo,
      r.detalhe,
      r.origem,
      r.origem_automatica,
      r.usuario_id,
      r.importacao_id
    );
  }
  const [res] = await dest.query(
    `INSERT INTO processo_andamento
      (processo_id, movimento_em, titulo, detalhe, origem, origem_automatica, usuario_id, importacao_id)
     VALUES ${placeholders}`,
    vals
  );
  return res.affectedRows ?? batch.length;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const portOrigem = Number(process.env.VILAREAL_MYSQL_SOURCE_PORT || '3306');
  const portDestino = Number(process.env.VILAREAL_MYSQL_TARGET_PORT || '3307');

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  Migração processo_andamento (origem → destino)');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Origem:  ${portOrigem} (${opts.dryRun ? 'dry-run' : 'EXECUÇÃO'})`);
  console.log(`  Destino: ${portDestino}`);
  console.log(`  Origens: ${opts.origens.join(', ')}`);
  if (opts.cliente != null) console.log(`  Filtro cliente: ${opts.cliente}`);
  console.log('');

  const src = await mysql.createConnection(credenciais(portOrigem));
  const dest = await mysql.createConnection(credenciais(portDestino));

  try {
    const totalOrigem = await contarOrigem(src, opts.origens, opts.cliente);
    const totalDestinoAntes = await contarOrigem(dest, opts.origens, opts.cliente);
    console.log(`  Andamentos na origem:  ${totalOrigem}`);
    console.log(`  Andamentos no destino (antes): ${totalDestinoAntes}`);

    const mapaProcesso = await carregarMapaProcessoDestino(dest);
    const usuariosDest = await carregarUsuariosDestino(dest);
    console.log(`  Processos no destino (chaves): ${mapaProcesso.size}`);
    console.log(`  Usuários no destino: ${usuariosDest.size}\n`);

    const stats = {
      lidos: 0,
      inseridos: 0,
      orfaos: 0,
      usuarioNull: 0,
      amostraOrfaos: [],
    };

    /** @type {object[]} */
    let batch = [];

    for await (const row of iterarAndamentosOrigem(src, opts.origens, opts.cliente)) {
      stats.lidos += 1;
      const cod8 = String(row.cod8);
      const ni = Number(row.ni);
      const pid = mapaProcesso.get(chaveProcesso(cod8, ni));
      if (!pid) {
        stats.orfaos += 1;
        if (stats.amostraOrfaos.length < 15) {
          stats.amostraOrfaos.push({ cod8, ni, titulo: String(row.titulo || '').slice(0, 60) });
        }
        continue;
      }

      let uid = row.usuario_id != null ? Number(row.usuario_id) : null;
      if (uid != null && !usuariosDest.has(uid)) {
        uid = null;
        stats.usuarioNull += 1;
      }

      batch.push({
        processo_id: pid,
        movimento_em: row.movimento_em,
        titulo: row.titulo,
        detalhe: row.detalhe,
        origem: row.origem,
        origem_automatica: row.origem_automatica ? 1 : 0,
        usuario_id: uid,
        importacao_id: row.importacao_id,
      });

      if (batch.length >= opts.batchSize) {
        if (!opts.dryRun) {
          stats.inseridos += await inserirLote(dest, batch);
        } else {
          stats.inseridos += batch.length;
        }
        batch = [];
        if (stats.lidos % 20000 === 0) {
          console.log(`  … ${stats.lidos} lidos, ${stats.inseridos} a inserir/inseridos`);
        }
      }
    }

    if (batch.length > 0) {
      if (!opts.dryRun) {
        stats.inseridos += await inserirLote(dest, batch);
      } else {
        stats.inseridos += batch.length;
      }
    }

    console.log('\n── Resumo ──');
    console.log(`  Lidos na origem:     ${stats.lidos}`);
    console.log(`  ${opts.dryRun ? 'Simulados' : 'Inseridos'} no destino: ${stats.inseridos}`);
    console.log(`  Órfãos (sem processo no destino): ${stats.orfaos}`);
    console.log(`  usuario_id ignorado (FK): ${stats.usuarioNull}`);
    if (stats.amostraOrfaos.length > 0) {
      console.log('  Amostra órfãos:', JSON.stringify(stats.amostraOrfaos, null, 2));
    }

    if (opts.dryRun) {
      console.log('\n  Dry-run: nada gravado. Use:');
      console.log(`    node scripts/migrar-andamentos-mysql-origem-destino.mjs --confirmar=${CONFIRMAR_TOKEN} --zerar-destino\n`);
      return;
    }

    const totalDestinoDepois = await contarOrigem(dest, opts.origens, opts.cliente);
    console.log(`  Andamentos no destino (depois): ${totalDestinoDepois}`);

    if (opts.cliente == null) {
      const cod728 = '00000728';
      const [[c728]] = await dest.query(
        `
        SELECT COUNT(*) AS n
        FROM processo_andamento a
        INNER JOIN processo p ON p.id = a.processo_id
        INNER JOIN cliente c ON c.pessoa_id = p.pessoa_id
        WHERE c.codigo_cliente = ? AND p.numero_interno = 239
        `,
        [cod728]
      );
      console.log(`  Verificação 728/239 no destino: ${c728.n} andamento(s)`);
    }

    console.log('\n  Migração concluída. Recarregue Processos (API :8081).\n');
  } finally {
    await src.end();
    await dest.end();
  }
}

async function runWithZerar() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.zerarDestino || opts.dryRun) {
    return main();
  }

  const portDestino = Number(process.env.VILAREAL_MYSQL_TARGET_PORT || '3307');
  const dest = await mysql.createConnection(credenciais(portDestino));
  try {
    const antes = await contarOrigem(dest, opts.origens, opts.cliente);
    console.log(`[zerar-destino] Apagando ${antes} andamento(s) no destino (origens: ${opts.origens.join(', ')})…`);
    const apagados = await zerarAndamentosDestino(dest, opts.origens);
    console.log(`[zerar-destino] Removidos: ${apagados}\n`);
  } finally {
    await dest.end();
  }
  return main();
}

runWithZerar().catch((e) => {
  console.error(e);
  process.exit(1);
});
