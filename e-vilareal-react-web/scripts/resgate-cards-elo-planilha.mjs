/**
 * Resgate de cards via padrão elo (bloco soma zero + linha E + Conta Compensação).
 *
 * Uso:
 *   node scripts/resgate-cards-elo-planilha.mjs
 *   node scripts/resgate-cards-elo-planilha.mjs --executar
 *   node scripts/resgate-cards-elo-planilha.mjs --out-dir=/tmp/resgate-elo
 */

import './lib/load-vilareal-import-env.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  carregarPlanilhaElo,
  mesclarCards,
  classificarCardNoDb,
  carregarLancamentosPorRowIdConta,
  carregarElosCompensacaoDb,
  cardParaCsvRow,
  linhasParaCsv,
} from './lib/resgate-cards-elo.mjs';
import {
  login,
  conectarDb,
  isLocalBackend,
  carregarLancamentosPorRowId,
  carregarMapaClientes,
  analisarConflitosGrupo,
  desparearGrupo,
  findLancById,
  parearGrupo,
  NUMERO_BANCO_CZ,
} from './lib/carga-acerto-api.mjs';

function parseArgs(argv) {
  const out = { executar: false, baseUrl: 'http://localhost:8080', outDir: null, preferirAba9: true };
  for (const a of argv.slice(2)) {
    if (a === '--executar') out.executar = true;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--out-dir=')) out.outDir = a.slice(10);
    else if (a === '--preferir-18') out.preferirAba9 = false;
    else {
      console.error(`Argumento desconhecido: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

async function executarCard(ctx, db, classificado) {
  const { grupoAlvo, ids19, rowIds, linhas } = classificado;
  if (!ids19?.length) return { ok: false, motivo: 'sem_ids19' };

  const conflito = analisarConflitosGrupo(ids19, ctx.porRowId, grupoAlvo, rowIds, {
    linhasCard: linhas,
    codigo: classificado.codigo,
  });

  if (conflito.status === 'FEITO') return { ok: true, motivo: 'ja_pareado' };

  if (conflito.status === 'DESPAREAR_LEGADO' && ctx.executar) {
    for (const g of conflito.grupos ?? []) await desparearGrupo(ctx, g);
  } else if (conflito.status === 'CONFLITO') {
    return { ok: false, motivo: `${conflito.motivo}:${(conflito.grupos ?? []).join('+')}` };
  }

  if (!ctx.executar) return { ok: true, motivo: `dry-run_${ids19.length}_lanc` };

  for (const id of ids19) {
    const r = findLancById(ctx.porRowId, id);
    const g = String(r?.grupo_compensacao ?? '').trim();
    if (g && g !== grupoAlvo) {
      return { ok: false, motivo: `pre_parear_id_${id}_em_${g}` };
    }
  }

  await parearGrupo(ctx, grupoAlvo, ids19);
  return { ok: true, motivo: `pareado_${ids19.length}` };
}

async function main() {
  const args = parseArgs(process.argv);
  const ts = Date.now();
  const outDir = args.outDir ? resolve(args.outDir) : resolve(`/tmp/resgate-elo-${ts}`);
  mkdirSync(outDir, { recursive: true });

  const { caminho, cards9, cards18, compByElo } = carregarPlanilhaElo();
  const cards = args.preferirAba9
    ? mesclarCards(cards9, cards18)
    : mesclarCards([], cards18);

  console.log(`Planilha: ${caminho}`);
  console.log(`Cards elo: aba9=${cards9.length} aba18=${cards18.length} mesclados=${cards.length}`);

  const db = isLocalBackend(args.baseUrl) ? await conectarDb() : null;
  const porRowId19 = db ? await carregarLancamentosPorRowIdConta(db, NUMERO_BANCO_CZ) : new Map();
  const porRowId9 = db ? await carregarLancamentosPorRowIdConta(db, 9) : new Map();
  const elosDb = db ? await carregarElosCompensacaoDb(db) : new Map();

  const classificados = cards.map((c) =>
    classificarCardNoDb(c, porRowId19, porRowId9, compByElo, elosDb),
  );

  const buckets = {
    todos: classificados,
    prontos: classificados.filter((c) => c.status === 'PRONTO'),
    conflito: classificados.filter((c) => ['CONFLITO', 'CONFLITO_SOMA', 'CONFLITO_VINCULO'].includes(c.status)),
    feito: classificados.filter((c) => c.status === 'FEITO'),
    ausente: classificados.filter((c) => c.status === 'AUSENTE_19' || c.status === 'MIGRAR_9'),
    outros: classificados.filter(
      (c) => !['PRONTO', 'CONFLITO', 'CONFLITO_SOMA', 'CONFLITO_VINCULO', 'FEITO', 'AUSENTE_19', 'MIGRAR_9'].includes(c.status),
    ),
  };

  const elosResgatados = new Set(classificados.map((c) => c.elo));
  const orfaos = [...compByElo.keys()].filter((elo) => {
    const soma = (compByElo.get(elo) ?? []).reduce((s, p) => s + p.cents, 0);
    return soma === 0 && !elosResgatados.has(elo);
  });

  for (const [nome, rows] of Object.entries({
    'cards-elo-planilha': buckets.todos,
    'cards-elo-prontos': buckets.prontos,
    'cards-elo-conflito': buckets.conflito,
    'cards-elo-feito': buckets.feito,
    'cards-elo-ausente': buckets.ausente,
    'cards-elo-outros': buckets.outros,
  })) {
    const path = resolve(outDir, `${nome}.csv`);
    writeFileSync(path, linhasParaCsv(rows.map(cardParaCsvRow)), 'utf8');
    console.log(`${nome}.csv → ${rows.length} linha(s)`);
  }

  writeFileSync(
    resolve(outDir, 'elos-orfaos-comp.csv'),
    linhasParaCsv(orfaos.map((elo) => ({ elo, qtd: compByElo.get(elo)?.length ?? 0 }))),
    'utf8',
  );
  console.log(`elos-orfaos-comp.csv → ${orfaos.length} elo(s)`);

  const resumo = {
    cardsTotal: classificados.length,
    prontos: buckets.prontos.length,
    conflito: buckets.conflito.length,
    feito: buckets.feito.length,
    ausente: buckets.ausente.length,
    outros: buckets.outros.length,
    exemplo5766: classificados.find((c) => c.elo === '5766') ?? null,
  };
  writeFileSync(resolve(outDir, 'resumo.json'), JSON.stringify(resumo, null, 2), 'utf8');
  console.log('Resumo:', JSON.stringify(resumo, null, 2));

  if (buckets.prontos.length && args.executar) {
    const token = await login(args.baseUrl);
    const ctx = {
      ...args,
      token,
      porRowId: porRowId19,
      db,
    };
    let ok = 0;
    let falha = 0;
    for (const c of buckets.prontos) {
      try {
        const r = await executarCard(ctx, db, c);
        console.log(`${c.grupoAlvo}: ${r.ok ? 'OK' : 'FALHA'} — ${r.motivo}`);
        if (r.ok) ok += 1;
        else falha += 1;
      } catch (e) {
        console.log(`${c.grupoAlvo}: FALHA — ${String(e.message ?? e).slice(0, 200)}`);
        falha += 1;
      }
    }
    console.log(`Execução: ${ok} ok, ${falha} falha(s)`);
  } else if (args.executar) {
    console.log('Nenhum card PRONTO para executar.');
  } else {
    console.log(`Dry-run. CSVs em ${outDir}`);
    console.log('Use --executar para parear cards PRONTOS.');
  }

  if (db) await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
