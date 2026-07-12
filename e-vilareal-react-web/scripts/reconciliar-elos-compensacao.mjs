/**
 * Reconcilia elos da aba Conta Compensação (planilha) × grupo_compensacao (DB) até 2026.
 *
 * Uso:
 *   node scripts/reconciliar-elos-compensacao.mjs
 *   node scripts/reconciliar-elos-compensacao.mjs --out-dir=/tmp/reconciliacao-elos
 *   node scripts/reconciliar-elos-compensacao.mjs --corte=2026-12-31 --recente=2020-01-01
 */

import './lib/load-vilareal-import-env.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { conectarDb } from './lib/carga-acerto-api.mjs';
import {
  CORTE_PADRAO,
  RECENTE_PADRAO,
  lerElosContaCompensacao,
  lerElosDb,
  reconciliar,
  linhasParaCsv,
  priorizarGaps,
  analisarSoPlanilha,
  carregarBancosApiSemPlanilha,
  filtrarElosItauInterbancario99Pay,
} from './lib/reconciliar-elos-compensacao.mjs';
import { BANCOS_API_SEM_PLANILHA_COMP } from './lib/extrato-bancos-planilha-constantes.mjs';

function parseArgs(argv) {
  const out = {
    outDir: resolve('/tmp/reconciliacao-elos'),
    corte: CORTE_PADRAO,
    recente: RECENTE_PADRAO,
  };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--out-dir=')) out.outDir = resolve(a.slice(10));
    else if (a.startsWith('--corte=')) out.corte = a.slice(8);
    else if (a.startsWith('--recente=')) out.recente = a.slice(10);
    else {
      console.error(`Argumento desconhecido: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  mkdirSync(args.outDir, { recursive: true });

  console.log('Carregando planilha (Conta Compensação)...');
  const { byElo: planByElo, caminho, linhas: planLinhas } = lerElosContaCompensacao(undefined, args.corte);
  const bancosPlanilhaComp = new Set(planLinhas.map((l) => String(l.banco)).filter(Boolean));
  console.log(`  ${planByElo.size} elos até ${args.corte} | bancos comp: ${[...bancosPlanilhaComp].sort((a, b) => Number(a) - Number(b)).join(',')}`);

  console.log('Carregando DB (visão canônica: ATIVO, sem legado 9/17/18)...');
  const db = await conectarDb();
  const bancosApiSemPlanilha = await carregarBancosApiSemPlanilha(db, bancosPlanilhaComp);
  console.log(
    `  contas API sem planilha Comp: ${[...bancosApiSemPlanilha.entries()]
      .map(([n, nome]) => `${n}=${nome}`)
      .join(', ')}`,
  );
  const sysByElo = await lerElosDb(db, { corte: args.corte, canonico: true });
  console.log(`  ${sysByElo.size} elos no banco`);

  const { rows, resumo, intersecao, pctSemantico } = reconciliar(planByElo, sysByElo, {
    bancosPlanilhaComp,
    bancosApiSemPlanilha,
  });

  const headers = [
    'elo',
    'status',
    'subtipo',
    'dataMax',
    'somaPlan',
    'qtdPlan',
    'somaSys',
    'qtdSys',
    'diffAbs',
    'bancosPlan',
    'bancosSys',
    'ativoSys',
    'aposentadoSys',
    'rowIdsPlan',
    'idsDb',
  ];
  const mainPath = resolve(args.outDir, 'reconciliar-elos-compensacao.csv');
  writeFileSync(mainPath, linhasParaCsv(rows, headers));

  const gaps = rows.filter((r) => r.status === 'GAP');
  const gapsPrioridade = priorizarGaps(gaps);
  const gapHeaders = [...headers, 'prioridade', 'ano'];
  const gapsPath = resolve(args.outDir, 'elos-gaps-prioridade.csv');
  writeFileSync(gapsPath, linhasParaCsv(gapsPrioridade, gapHeaders));

  const gapsRecentes = gapsPrioridade.filter((r) => r.dataMax >= args.recente);
  const gapsRecentesPath = resolve(args.outDir, `elos-gaps-prioridade-${args.recente.slice(0, 4)}.csv`);
  writeFileSync(gapsRecentesPath, linhasParaCsv(gapsRecentes, gapHeaders));

  const itau99 = filtrarElosItauInterbancario99Pay(rows);
  const itau99Path = resolve(args.outDir, 'elos-itau-interbancario-99pay.csv');
  writeFileSync(itau99Path, linhasParaCsv(itau99, headers));

  const itau99Resumo = itau99.reduce((acc, r) => {
    const k = r.subtipo || r.status;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  console.log('Cruzando elos só planilha (2020+) com histórico carga/resgate...');
  const soPlanilhaElos = new Set(rows.filter((r) => r.status === 'SO_PLANILHA').map((r) => r.elo));
  const planSoPlanilha = new Map([...planByElo].filter(([e]) => soPlanilhaElos.has(e)));
  const soPlanilhaRows = await analisarSoPlanilha(db, planSoPlanilha, {
    recente: args.recente,
    caminhoPlanilha: caminho,
  });
  await db.end();

  const soPlanPath = resolve(args.outDir, 'elos-so-planilha-cruzamento.csv');
  writeFileSync(
    soPlanPath,
    linhasParaCsv(soPlanilhaRows, [
      'elo',
      'dataMax',
      'somaPlan',
      'qtdPlan',
      'rowIds',
      'temCardManual',
      'qtdRowIdDb',
      'motivo',
      'detalhes',
    ]),
  );

  const resumoPath = resolve(args.outDir, 'resumo.json');
  const resumoJson = {
    geradoEm: new Date().toISOString(),
    planilha: caminho,
    corte: args.corte,
    recente: args.recente,
    modoDb: 'canonico_ATIVO_sem_legado_9_17_18',
    bancosPlanilhaComp: [...bancosPlanilhaComp].sort((a, b) => Number(a) - Number(b)),
    bancosApiSemPlanilhaComp: Object.fromEntries(bancosApiSemPlanilha),
    bancosApiSemPlanilhaExplicitos: BANCOS_API_SEM_PLANILHA_COMP,
    planilhaElos: planByElo.size,
    sistemaElos: sysByElo.size,
    intersecao,
    pctSemantico: `${pctSemantico}%`,
    resumo,
    gaps: gaps.length,
    gapsRecentes: gapsRecentes.length,
    itauInterbancario99Pay: itau99.length,
    itauInterbancario99PayResumo: itau99Resumo,
    soPlanilhaRecente: soPlanilhaRows.length,
    arquivos: {
      principal: mainPath,
      gapsPrioridade: gapsPath,
      gapsRecentes: gapsRecentesPath,
      soPlanilha: soPlanPath,
      itauInterbancario99Pay: itau99Path,
    },
    motivosSoPlanilha: soPlanilhaRows.reduce((acc, r) => {
      acc[r.motivo] = (acc[r.motivo] ?? 0) + 1;
      return acc;
    }, {}),
  };
  writeFileSync(resumoPath, JSON.stringify(resumoJson, null, 2));

  console.log('\n--- Resumo ---');
  console.log(`Interseção: ${intersecao} elos | batem semanticamente: ${pctSemantico}%`);
  console.log(`BATE: ${resumo.BATE} | ESTRUTURAL: ${resumo.ESTRUTURAL} | GAP: ${resumo.GAP}`);
  console.log(`SO_PLANILHA: ${resumo.SO_PLANILHA} | SO_SISTEMA: ${resumo.SO_SISTEMA} | API_NOVA_CONTA: ${resumo.API_NOVA_CONTA ?? 0}`);
  console.log(`PENDENTE_INTERBANCARIO (Itaú→99Pay): ${resumo.PENDENTE_INTERBANCARIO ?? 0}`);
  console.log(`Elos Itaú interbancário 99Pay (CSV): ${itau99.length}`, itau99Resumo);
  console.log(`Gaps prioritários (${args.recente}+): ${gapsRecentes.length}`);
  console.log(`Só planilha cruzados (${args.recente}+): ${soPlanilhaRows.length}`);
  console.log(`\nArquivos em ${args.outDir}:`);
  console.log(`  ${mainPath}`);
  console.log(`  ${gapsPath}`);
  console.log(`  ${soPlanPath}`);
  console.log(`  ${resumoPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
