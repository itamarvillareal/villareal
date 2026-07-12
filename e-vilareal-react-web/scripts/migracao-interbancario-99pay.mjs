/**
 * Migra elos Itaú-only da planilha para par interbancário Itaú (1) ↔ 99 Pay (30).
 *
 * Uso:
 *   node scripts/migracao-interbancario-99pay.mjs
 *   node scripts/migracao-interbancario-99pay.mjs --executar
 *   node scripts/migracao-interbancario-99pay.mjs --elo=9457 --executar
 *   node scripts/migracao-interbancario-99pay.mjs --desde=2025-11-01 --out-dir=/tmp/mig-99pay
 */

import './lib/load-vilareal-import-env.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  login,
  conectarDb,
  desparearGrupo,
  parearGrupo,
} from './lib/carga-acerto-api.mjs';
import { lerElosContaCompensacao } from './lib/reconciliar-elos-compensacao.mjs';
import {
  CORTE_99PAY_EXTRATO,
  carregarMembrosElos,
  carregarPool99Pay,
  planejarMigracoes,
  resumoMigracao,
  linhasMigracaoParaCsv,
  eloNumerico,
} from './lib/migracao-interbancario-99pay.mjs';

function parseArgs(argv) {
  const out = {
    executar: false,
    baseUrl: 'http://localhost:8080',
    outDir: resolve('/tmp/mig-interbancario-99pay'),
    desde: CORTE_99PAY_EXTRATO,
    elo: null,
    limite: null,
  };
  for (const a of argv.slice(2)) {
    if (a === '--executar') out.executar = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--out-dir=')) out.outDir = resolve(a.slice(10));
    else if (a.startsWith('--desde=')) out.desde = a.slice(8);
    else if (a.startsWith('--elo=')) out.elo = a.slice(6).trim();
    else if (a.startsWith('--limite=')) out.limite = Number(a.slice(9));
    else {
      console.error(`Argumento desconhecido: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

async function prepararLancamento99Pay(ctx, db, pay99Id) {
  const [rows] = await db.query(
    `SELECT id, grupo_compensacao FROM financeiro_lancamento WHERE id = ? AND status = 'ATIVO'`,
    [pay99Id],
  );
  const g = String(rows[0]?.grupo_compensacao ?? '').trim();
  if (g && !eloNumerico(g)) {
    await desparearGrupo(ctx, g);
  }
}

async function executarMigracao(ctx, db, row) {
  const { elo, itauId, pay99Id } = row;
  if (!itauId || !pay99Id) return { ok: false, motivo: 'ids_incompletos' };

  try {
    await prepararLancamento99Pay(ctx, db, Number(pay99Id));
    await desparearGrupo(ctx, elo);
    await parearGrupo(ctx, elo, [Number(itauId), Number(pay99Id)]);
    return { ok: true, motivo: 'pareado_1_30' };
  } catch (e) {
    return { ok: false, motivo: String(e.message ?? e).slice(0, 200) };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  mkdirSync(args.outDir, { recursive: true });

  console.log('Carregando planilha e DB...');
  const { byElo: planByElo } = lerElosContaCompensacao();
  const db = await conectarDb();
  const sysByElo = await carregarMembrosElos(db);
  const pool99 = await carregarPool99Pay(db);
  console.log(`  Pool 99 Pay ATIVO: ${pool99.length} lançamentos`);

  let rows = planejarMigracoes(planByElo, sysByElo, pool99, {
    desde: args.desde,
    elo: args.elo,
    executar: args.executar,
  });

  const prontos = rows.filter((r) => r.status === 'PRONTO' || r.status === 'MIGRAR');
  if (args.limite != null && args.limite > 0) {
    const manter = new Set(prontos.slice(0, args.limite).map((r) => r.elo));
    rows = rows.map((r) =>
      (r.status === 'PRONTO' || r.status === 'MIGRAR') && !manter.has(r.elo)
        ? { ...r, status: 'IGNORAR', motivo: 'limite' }
        : r,
    );
  }

  const csvPath = resolve(args.outDir, 'migracao-interbancario-99pay.csv');
  writeFileSync(csvPath, linhasMigracaoParaCsv(rows));

  const resumo = resumoMigracao(rows);
  console.log('\nPlano:', resumo);

  const token = args.executar ? await login(args.baseUrl) : null;
  const ctx = {
    executar: args.executar,
    baseUrl: args.baseUrl,
    token,
    porRowId: new Map(),
  };

  const resultados = [];
  const fila = rows.filter((r) => r.status === 'PRONTO' || r.status === 'MIGRAR');

  if (args.executar && fila.length) {
    console.log(`\nExecutando ${fila.length} migrações...`);
    for (const row of fila) {
      const exec = await executarMigracao(ctx, db, row);
      resultados.push({ elo: row.elo, ...exec });
      const tag = exec.ok ? 'OK' : 'ERRO';
      console.log(`  [${tag}] elo ${row.elo} itau=${row.itauId} 99pay=${row.pay99Id} ${exec.motivo}`);
    }
  } else if (!args.executar && fila.length) {
    console.log(`\nDry-run: ${fila.length} elos prontos. Use --executar para aplicar.`);
    for (const row of fila.slice(0, 8)) {
      console.log(`  elo ${row.elo} itau=${row.itauId} 99pay=${row.pay99Id} (${row.motivo})`);
    }
  }

  await db.end();

  const jsonPath = resolve(args.outDir, 'resumo.json');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        desde: args.desde,
        executar: args.executar,
        pool99Pay: pool99.length,
        resumo,
        executados: resultados.length,
        ok: resultados.filter((r) => r.ok).length,
        erros: resultados.filter((r) => !r.ok),
        csv: csvPath,
      },
      null,
      2,
    ),
  );

  console.log(`\nCSV: ${csvPath}`);
  console.log(`JSON: ${jsonPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
