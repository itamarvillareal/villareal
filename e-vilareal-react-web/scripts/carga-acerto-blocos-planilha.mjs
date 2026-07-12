/**
 * Backfill de cards de acerto — todos os códigos numéricos da planilha (Etapa 5e).
 *
 * Uso:
 *   node scripts/carga-acerto-blocos-planilha.mjs
 *   node scripts/carga-acerto-blocos-planilha.mjs --codigo=728
 *   node scripts/carga-acerto-blocos-planilha.mjs --todos-numericos
 *   node scripts/carga-acerto-blocos-planilha.mjs --onda=1
 *   node scripts/carga-acerto-blocos-planilha.mjs --relatorio=csv --executar
 *   node scripts/carga-acerto-blocos-planilha.mjs --ate-linha-excel=6812 --forcar-auto --migrar-18 --executar
 */

import './lib/load-vilareal-import-env.mjs';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  lerLinhasPlanilha,
  montarBlocosZerados,
  listarCodigosNumericos,
  gerarJobsCardsAuto,
  assertBlocosCompletosNoRecorte,
  codigosDaOnda,
} from './lib/planilha-blocos-acerto.mjs';
import {
  login,
  conectarDb,
  isLocalBackend,
  carregarLancamentosPorRowId,
  carregarMapaClientes,
  resolverLancamento,
  analisarConflitosGrupo,
  renomearGrupoLegado,
  desparearGrupo,
  desparearGrupoSeSubconjunto,
  findLancById,
  atualizarLancamento,
  parearGrupo,
  migrarConta18ParaCz,
  garantirPessoaEscritorio,
  unificarVinculoEscritorio,
  brl,
  round2,
} from './lib/carga-acerto-api.mjs';

function parseArgs(argv) {
  const out = {
    executar: false,
    baseUrl: 'http://localhost:8080',
    codigo: null,
    todosNumericos: false,
    onda: null,
    relatorio: null,
    ateLinhaExcel: null,
    forcarAuto: false,
    migrar18: null,
  };
  for (const a of argv.slice(2)) {
    if (a === '--executar') out.executar = true;
    else if (a === '--todos-numericos') out.todosNumericos = true;
    else if (a === '--forcar-auto') out.forcarAuto = true;
    else if (a === '--migrar-18') out.migrar18 = true;
    else if (a === '--sem-migrar-18') out.migrar18 = false;
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--codigo=')) out.codigo = a.slice(9).trim();
    else if (a.startsWith('--onda=')) out.onda = Number(a.slice(7));
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12).trim();
    else if (a.startsWith('--ate-linha-excel=')) out.ateLinhaExcel = Number(a.slice(18));
    else {
      console.error(`Argumento desconhecido: ${a}`);
      process.exit(1);
    }
  }
  if (!out.codigo && !out.todosNumericos && out.onda == null) out.todosNumericos = true;
  if (out.migrar18 == null && out.ateLinhaExcel != null) out.migrar18 = true;
  return out;
}

function tituloJob(info) {
  return (
    info.linhasCliente?.find((l) => l.comentario)?.comentario ||
    info.linhasCard?.find((l) => l.comentario)?.comentario ||
    `Bloco ${info.startRowId}`
  );
}

async function processarJob(ctx, db, mapaClientes, job) {
  const { codigo, tipo, grupoAlvo, linhasCard, startRowId } = job;
  const titulo = tituloJob(job);
  const row = {
    codigo,
    rowId: startRowId,
    tipo,
    grupoAlvo,
    qtdLanc: linhasCard.length,
    titulo: titulo.slice(0, 80),
    status: '',
    motivo: '',
  };

  if (tipo === 'MISTO') {
    row.status = 'MISTO';
    row.motivo = job.motivo ?? 'multi_cliente';
    ctx.stats.misto += 1;
    return row;
  }
  if (tipo === 'ERRO') {
    row.status = 'ERRO';
    row.motivo = job.motivo ?? `somaCliente=${brl(job.somaCliente)}`;
    ctx.stats.erros += 1;
    return row;
  }

  let clienteId = mapaClientes.get(codigo) ?? mapaClientes.get(codigo.padStart(7, '0'));
  let usarEscritorio = false;
  if (!clienteId) {
    if (tipo === 'ESPELHO') {
      const escritorioId = await garantirPessoaEscritorio(db, ctx);
      if (!escritorioId && ctx.executar) {
        row.status = 'AUSENTE';
        row.motivo = 'pessoa_escritorio_nao_encontrada';
        ctx.stats.ausente += 1;
        return row;
      }
      usarEscritorio = true;
    } else {
      row.status = 'AUSENTE';
      row.motivo = 'cliente_id_nao_encontrado';
      ctx.stats.ausente += 1;
      return row;
    }
  }

  ctx.codigoJob = codigo;
  const ids = [];
  let soma = 0;
  const rowIds = [];

  for (const linha of linhasCard) {
    const ehCliente = linha.ref01 === codigo;
    const refNumericaOutra =
      linha.ref01 && linha.ref01 !== codigo && /^\d+$/.test(String(linha.ref01));
    const clienteIdLinha = refNumericaOutra
      ? (mapaClientes.get(linha.ref01) ?? mapaClientes.get(String(linha.ref01).padStart(7, '0')))
      : clienteId;
    const res = resolverLancamento(ctx.porRowId, linha, ids);
    if (res.status !== 'OK') {
      row.status = res.status;
      row.motivo = res.erro;
      ctx.stats[res.status === 'AUSENTE' ? 'ausente' : 'erros'] += 1;
      return row;
    }
    const { lanc, signed } = res;
    rowIds.push(linha.rowId);
    const linhaUpdate = ehCliente || refNumericaOutra ? linha : null;
    const vincularCliente = !ehCliente && !refNumericaOutra && !usarEscritorio;
    if (usarEscritorio) {
      const escritorioId = await garantirPessoaEscritorio(db, ctx);
      if (escritorioId && (await unificarVinculoEscritorio(ctx, db, [lanc.id]))) {
        ctx.stats.refs += 1;
      }
    } else if (
      clienteIdLinha &&
      (await atualizarLancamento(ctx, db, lanc.id, linhaUpdate, clienteIdLinha, {
        vincularCliente,
      }))
    ) {
      ctx.stats.refs += 1;
    }
    ids.push(lanc.id);
    soma = round2(soma + signed);
  }

  if (Math.abs(soma) >= 0.005) {
    row.status = 'ERRO';
    row.motivo = `soma=${brl(soma)}`;
    ctx.stats.erros += 1;
    return row;
  }

  const conflito = analisarConflitosGrupo(ids, ctx.porRowId, grupoAlvo, rowIds, {
    linhasCard: job.linhasCard,
    codigo,
  });
  if (conflito.status === 'FEITO') {
    row.status = 'FEITO';
    row.motivo = 'ja_pareado';
    ctx.stats.pulados += 1;
    return row;
  }

  if (conflito.status === 'DESPAREAR_LEGADO') {
    if (!ctx.executar) {
      row.status = tipo;
      row.motivo = `desparearia_${conflito.grupos.join('+')}_e_parearia`;
      ctx.stats.ok += tipo === 'OK' ? 1 : 0;
      ctx.stats.espelho += tipo === 'ESPELHO' ? 1 : 0;
      return row;
    }
    for (const g of conflito.grupos) {
      await desparearGrupo(ctx, g);
    }
  } else if (conflito.status === 'RENOMEAVEL') {
    const legado = conflito.grupos[0];
    const renomeado = await renomearGrupoLegado(ctx, db, legado, grupoAlvo, ids);
    if (renomeado) {
      row.status = 'FEITO';
      row.motivo = `renomeado_${legado}`;
      ctx.stats.renomeados += 1;
      return row;
    }
    if (ctx.executar) {
      for (const g of conflito.grupos) {
        if (g !== grupoAlvo) await desparearGrupo(ctx, g);
      }
    } else {
      row.status = 'OK';
      row.motivo = `desparearia_${conflito.grupos.join('+')}_e_parearia`;
      ctx.stats.ok += tipo === 'OK' ? 1 : 0;
      ctx.stats.espelho += tipo === 'ESPELHO' ? 1 : 0;
      return row;
    }
  } else if (conflito.status === 'CONFLITO') {
    row.status = 'CONFLITO';
    row.motivo = `${conflito.motivo}:${(conflito.grupos ?? []).join('+')}`;
    ctx.stats.conflitos += 1;
    return row;
  }

  if (!ctx.executar) {
    row.status = tipo;
    row.motivo = `dry-run_${ids.length}_lanc`;
    ctx.stats.ok += tipo === 'OK' ? 1 : 0;
    ctx.stats.espelho += tipo === 'ESPELHO' ? 1 : 0;
    return row;
  }

  if (tipo === 'ESPELHO') {
    await desparearGrupoSeSubconjunto(ctx, db, ids);
    await unificarVinculoEscritorio(ctx, db, ids);
  }

  for (const id of ids) {
    const r = findLancById(ctx.porRowId, id);
    const g = String(r?.grupo_compensacao ?? '').trim();
    if (g && g !== grupoAlvo) {
      row.status = 'CONFLITO';
      row.motivo = `pre_parear_id_${id}_em_${g}`;
      ctx.stats.conflitos += 1;
      return row;
    }
  }

  await parearGrupo(ctx, grupoAlvo, ids);
  row.status = 'PAREADO';
  row.motivo = `${ids.length}_lanc`;
  ctx.stats.pareados += 1;
  ctx.stats.ok += tipo === 'OK' ? 1 : 0;
  ctx.stats.espelho += tipo === 'ESPELHO' ? 1 : 0;
  return row;
}

function filtrarCodigos(args, todosCodigos) {
  if (args.codigo) return [args.codigo];
  if (args.onda != null && !Number.isNaN(args.onda)) {
    return codigosDaOnda(args.onda, todosCodigos);
  }
  return todosCodigos;
}

async function main() {
  const args = parseArgs(process.argv);
  const { caminho, linhas, ateLinhaExcel } = lerLinhasPlanilha(undefined, {
    ateLinhaExcel: args.ateLinhaExcel,
    validarSomaZero: args.ateLinhaExcel != null,
  });
  const montagem = montarBlocosZerados(linhas);
  const blocos = assertBlocosCompletosNoRecorte(montagem, { ateLinhaExcel: args.ateLinhaExcel });
  const todosCodigos = listarCodigosNumericos(blocos);
  const codigos = filtrarCodigos(args, todosCodigos);
  const rowIdsAlvo = new Set(linhas.map((l) => l.rowId));
  const linhasPorRowId = new Map(linhas.map((l) => [l.rowId, l]));

  console.log(`Planilha: ${caminho}`);
  if (args.ateLinhaExcel != null) {
    console.log(`Recorte até linha Excel ${args.ateLinhaExcel} · ${linhas.length} lançamentos · rowId máx ${linhas.at(-1)?.rowId}`);
  }
  console.log(`${blocos.length} blocos zerados · ${todosCodigos.length} códigos numéricos`);
  console.log(`Processando ${codigos.length} código(s): ${codigos.slice(0, 15).join(', ')}${codigos.length > 15 ? '…' : ''}`);

  const db = isLocalBackend(args.baseUrl) ? await conectarDb() : null;
  const token = await login(args.baseUrl);
  const mapaClientes = await carregarMapaClientes(db);
  const ctx = {
    ...args,
    token,
    porRowId: null,
    codigoJob: null,
    stats: {
      refs: 0,
      pareados: 0,
      pulados: 0,
      renomeados: 0,
      conflitos: 0,
      ausente: 0,
      erros: 0,
      misto: 0,
      ok: 0,
      espelho: 0,
    },
  };
  ctx.porRowId = await carregarLancamentosPorRowId(ctx, db);

  if (args.migrar18) {
    console.log(`\n== Migrar conta 18 → CONTA ZERO (${rowIdsAlvo.size} rowIds no recorte) ==`);
    const migStats = await migrarConta18ParaCz(ctx, db, rowIdsAlvo, { linhasPorRowId, mapaClientes });
    console.log('Migração 18→19:', migStats);
    if (ctx.executar && migStats.migrados > 0) {
      ctx.porRowId = await carregarLancamentosPorRowId(ctx, db);
    }
  }

  const jobs = gerarJobsCardsAuto(blocos, {
    codigo: args.codigo,
    codigos: args.codigo ? null : codigos,
    forcarAuto: args.forcarAuto,
  });
  console.log(`${jobs.length} job(s) de card${args.forcarAuto ? ' (--forcar-auto)' : ''}`);

  const linhasRelatorio = [];
  for (const job of jobs) {
    let row;
    try {
      row = await processarJob(ctx, db, mapaClientes, job);
    } catch (e) {
      row = {
        codigo: job.codigo,
        rowId: job.startRowId,
        tipo: job.tipo,
        grupoAlvo: job.grupoAlvo,
        qtdLanc: job.linhasCard?.length ?? 0,
        titulo: tituloJob(job).slice(0, 80),
        status: 'ERRO',
        motivo: String(e.message ?? e).slice(0, 200),
      };
      ctx.stats.erros += 1;
    }
    linhasRelatorio.push(row);
    if (!args.relatorio) {
      console.log(
        `[${row.status}] ${row.grupoAlvo ?? '—'} · ${row.codigo} · ${row.tipo} · ${row.motivo}`,
      );
    }
  }

  if (args.relatorio === 'csv') {
    const header = 'codigo,rowId,tipo,grupoAlvo,qtdLanc,status,motivo,titulo\n';
    const body = linhasRelatorio
      .map((r) =>
        [r.codigo, r.rowId, r.tipo, r.grupoAlvo, r.qtdLanc, r.status, r.motivo, `"${(r.titulo ?? '').replace(/"/g, '""')}"`].join(
          ',',
        ),
      )
      .join('\n');
    const suffix = args.ateLinhaExcel != null ? `-ate${args.ateLinhaExcel}` : '';
    const outPath = resolve(process.cwd(), `carga-acerto-blocos${suffix}-${Date.now()}.csv`);
    writeFileSync(outPath, header + body, 'utf8');
    console.log(`Relatório CSV: ${outPath} (${linhasRelatorio.length} linhas)`);
  }

  const porStatus = {};
  for (const r of linhasRelatorio) {
    porStatus[r.status] = (porStatus[r.status] ?? 0) + 1;
  }
  console.log('\nPor status:', porStatus);
  console.log('Resumo:', ctx.stats);
  if (!args.executar) console.log('Use --executar para aplicar.');

  if (db) await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
