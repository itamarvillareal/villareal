#!/usr/bin/env node
/**
 * Remove duplicados em `agenda_evento` (mesmo utilizador + dia + compromisso equivalente).
 *
 * Uso:
 *   node scripts/deduplicar-agenda-eventos.mjs
 *   node scripts/deduplicar-agenda-eventos.mjs --login=itamar
 *   node scripts/deduplicar-agenda-eventos.mjs --executar --confirmar=APAGAR-DUPLICADOS-AGENDA
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  agruparEquivalentesAgenda,
  dataEventoIso,
  escolherKeeperAgenda,
} from './lib/chaves-dedupe-agenda.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

const CONFIRMAR_TOKEN = 'APAGAR-DUPLICADOS-AGENDA';
const LOGINS_PADRAO = ['itamar', 'karla.pedroza', 'ana.luisa'];

function parseArgs(argv) {
  const out = {
    dryRun: true,
    executar: false,
    confirmar: '',
    relatorio: '',
    logins: [...LOGINS_PADRAO],
    verbose: false,
  };
  for (const raw of argv) {
    if (raw === '--executar') {
      out.executar = true;
      out.dryRun = false;
    } else if (raw === '--dry-run') out.dryRun = true;
    else if (raw === '--verbose' || raw === '-v') out.verbose = true;
    else if (raw.startsWith('--confirmar=')) out.confirmar = raw.slice('--confirmar='.length);
    else if (raw.startsWith('--relatorio=')) out.relatorio = raw.slice('--relatorio='.length);
    else if (raw.startsWith('--login=')) out.logins = [raw.slice('--login='.length).trim()];
  }
  if (!out.relatorio) {
    out.relatorio = path.join(
      'tmp',
      `relatorio-dedupe-agenda-${out.dryRun ? 'dry-run' : 'exec'}-${Date.now()}.json`
    );
  }
  return out;
}

/**
 * @param {import('mysql2/promise').Connection} conn
 * @param {string[]} logins
 */
async function carregarEventos(conn, logins) {
  const ph = logins.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT e.id, e.usuario_id, u.login, e.data_evento, e.hora_evento, e.descricao,
            e.status_curto, e.origem, e.processo_ref, e.created_at
     FROM agenda_evento e
     INNER JOIN usuarios u ON u.id = e.usuario_id
     WHERE LOWER(TRIM(u.login)) IN (${ph})
     ORDER BY e.usuario_id, e.data_evento, e.id`,
    logins.map((l) => l.toLowerCase())
  );
  return rows;
}

/**
 * @param {object[]} rows
 */
function montarPlano(rows) {
  /** @type {Map<string, object[]>} */
  const porDia = new Map();
  for (const r of rows) {
    const k = `${r.usuario_id}|${dataEventoIso(r.data_evento)}`;
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k).push(r);
  }

  /** @type {object[]} */
  const grupos = [];
  const idsRemover = new Set();

  for (const [chaveDia, lista] of porDia) {
    for (const cluster of agruparEquivalentesAgenda(lista)) {
      const keeper = escolherKeeperAgenda(cluster);
      const remover = cluster.filter((r) => r.id !== keeper.id);
      for (const r of remover) idsRemover.add(Number(r.id));
      grupos.push({
        chaveDia,
        login: keeper.login,
        dataEvento: dataEventoIso(keeper.data_evento),
        manter: {
          id: keeper.id,
          hora: keeper.hora_evento,
          status: keeper.status_curto,
          origem: keeper.origem,
          descricao: String(keeper.descricao ?? '').slice(0, 120),
        },
        remover: remover.map((r) => ({
          id: r.id,
          hora: r.hora_evento,
          status: r.status_curto,
          origem: r.origem,
        })),
        total: cluster.length,
      });
    }
  }

  return { grupos, idsRemover: [...idsRemover].sort((a, b) => a - b) };
}

/**
 * @param {import('mysql2/promise').Connection} conn
 * @param {number[]} ids
 */
async function apagarIds(conn, ids) {
  if (!ids.length) return 0;
  let apagados = 0;
  const batch = 500;
  for (let i = 0; i < ids.length; i += batch) {
    const slice = ids.slice(i, i + batch);
    const ph = slice.map(() => '?').join(',');
    const [res] = await conn.query(`DELETE FROM agenda_evento WHERE id IN (${ph})`, slice);
    apagados += Number(res.affectedRows ?? 0);
  }
  return apagados;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.executar && opts.confirmar !== CONFIRMAR_TOKEN) {
    console.error(`Para executar DELETE: --executar --confirmar=${CONFIRMAR_TOKEN}`);
    process.exit(1);
  }

  const conn = await conectarMysqlVilareal();
  const inicio = Date.now();

  try {
    const rows = await carregarEventos(conn, opts.logins);
    const { grupos, idsRemover } = montarPlano(rows);

    const stats = {
      eventosLidos: rows.length,
      gruposDuplicados: grupos.length,
      idsRemover: idsRemover.length,
      porLogin: {},
    };
    for (const g of grupos) {
      stats.porLogin[g.login] = (stats.porLogin[g.login] ?? 0) + (g.total - 1);
    }

    console.log(`\n[dedupe-agenda] Modo: ${opts.dryRun ? 'DRY-RUN' : 'EXECUÇÃO'}`);
    console.log(`Utilizadores: ${opts.logins.join(', ')}`);
    console.log(`Eventos lidos: ${stats.eventosLidos}`);
    console.log(`Grupos duplicados: ${stats.gruposDuplicados}`);
    console.log(`Registos a apagar: ${stats.idsRemover}`);
    if (Object.keys(stats.porLogin).length) {
      console.log('Extras por login:', stats.porLogin);
    }

    if (opts.verbose && grupos.length) {
      console.log('\nAmostra (até 8 grupos):');
      for (const g of grupos.slice(0, 8)) {
        console.log(
          `  ${g.login} ${g.dataEvento}: manter #${g.manter.id}, apagar ${g.remover.map((r) => r.id).join(', ')}`
        );
      }
    }

    let apagados = 0;
    if (!opts.dryRun && idsRemover.length) {
      await conn.beginTransaction();
      try {
        apagados = await apagarIds(conn, idsRemover);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      }
      console.log(`\nApagados na base: ${apagados}`);
    }

    const payload = {
      geradoEm: new Date().toISOString(),
      modo: opts.dryRun ? 'dry-run' : 'executar',
      logins: opts.logins,
      stats: { ...stats, apagados },
      grupos: opts.verbose ? grupos : grupos.slice(0, 200),
    };

    const absRel = path.resolve(opts.relatorio);
    fs.mkdirSync(path.dirname(absRel), { recursive: true });
    fs.writeFileSync(absRel, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Relatório: ${absRel}`);
    console.log(`Duração: ${((Date.now() - inicio) / 1000).toFixed(1)}s\n`);

    process.exit(apagados < idsRemover && !opts.dryRun ? 2 : 0);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
