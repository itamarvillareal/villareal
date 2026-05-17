/**
 * Formatação do relatório de análise (pré-aprovação) da correção de histórico local.
 */

/**
 * @param {string} base
 * @param {string} abs
 */
export function relAposBase(base, abs) {
  if (!abs) return '';
  const norm = abs.split(/[/\\]/).join('/');
  const b = base.split(/[/\\]/).join('/').replace(/\/$/, '');
  if (norm.startsWith(b + '/')) return norm.slice(b.length + 1);
  return norm;
}

/**
 * @param {object} resultado
 * @param {object} [opts]
 */
export function imprimirRelatorioAnaliseCorrecao(resultado, opts = {}) {
  const limiteRenumerarPorProcesso = opts.limiteRenumerarPorProcesso ?? 8;
  const limiteApagarPorProcesso = opts.limiteApagarPorProcesso ?? 8;
  const limiteProcessosDetalhe = opts.limiteProcessosDetalhe ?? 200;

  const { base, stats, processos, dryRun } = resultado;

  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  RELATÓRIO DE ANÁLISE — correção histórico local (sem alterações)');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Base:     ${base}`);
  console.log(`  Modo:     ${dryRun ? 'SIMULAÇÃO — nenhum ficheiro foi modificado' : 'APLICAÇÃO (alterações gravadas)'}`);
  console.log('──────────────────────────────────────────────────────────────────');
  console.log(`  Clientes com histórico (mil):  ${stats.clientesComHistorico ?? '—'}`);
  console.log(`  Processos analisados:        ${stats.processosAnalisados}`);
  console.log(`  Sem alteração necessária:    ${stats.semAlteracao}`);
  console.log(`  Índice 14 a actualizar:      ${stats.indiceAtualizar}`);
  console.log(`  Índice 14 a eliminar:        ${stats.indiceEliminar}`);
  console.log(`  Processos com renumeração:  ${stats.comRenumeracao}`);
  console.log(`  Ficheiros a renomear:        ${stats.ficheirosRenomear}`);
  console.log(`  Ficheiros a apagar:          ${stats.ficheirosApagar}`);
  console.log('──────────────────────────────────────────────────────────────────');

  const comMudanca = processos.filter((p) => p.tipoAcao !== 'ok' && p.tipoAcao !== 'nenhum');
  if (!comMudanca.length) {
    console.log('\n  Nenhuma alteração prevista no intervalo analisado.\n');
    console.log('══════════════════════════════════════════════════════════════════\n');
    return;
  }

  console.log(`\n  Processos com alterações previstas: ${comMudanca.length}\n`);

  let mostrados = 0;
  for (const p of comMudanca) {
    if (mostrados >= limiteProcessosDetalhe) {
      console.log(`  … e mais ${comMudanca.length - limiteProcessosDetalhe} processo(s) (use --relatorio= para JSON completo).`);
      break;
    }
    mostrados += 1;

    console.log(`  ▶ Cliente ${p.cod8}  |  Processo ${p.procStr} (${p.procNum})`);
    console.log(`    Acção: ${p.descricaoAcao}`);
    if (p.indiceDeclarado != null) {
      console.log(
        `    Índice 14 declarado: ${p.indiceDeclarado}  →  entradas válidas: ${p.entradasValidas}` +
          (p.indiceNovo != null ? `  (novo índice: ${p.indiceNovo})` : '')
      );
    }
    console.log(
      `    Ficheiros no disco (índices distintos): ${p.indicesNoDisco}  |  Inválidos/parciais: ${p.invalidos}`
    );

    if (p.atualizarIndice14?.length) {
      console.log('    Escrever índice 14:');
      for (const g of p.atualizarIndice14) {
        console.log(`      • ${relAposBase(base, g.abs)}  →  conteúdo "${g.valorNovo}"`);
      }
    }
    if (p.eliminarIndice14?.length) {
      console.log('    Apagar índice 14:');
      for (const e of p.eliminarIndice14) {
        console.log(`      • ${relAposBase(base, e)}`);
      }
    }

    if (p.renumerar?.length) {
      const extra = p.renumerar.length > limiteRenumerarPorProcesso ? p.renumerar.length - limiteRenumerarPorProcesso : 0;
      console.log(`    Renomear (${p.renumerar.length} ficheiro(s)):`);
      for (const r of p.renumerar.slice(0, limiteRenumerarPorProcesso)) {
        console.log(`      • [${r.tipo}] índice ${r.indiceAntigo} → ${r.indiceNovo}`);
        console.log(`        de:   ${relAposBase(base, r.de)}`);
        console.log(`        para: ${relAposBase(base, r.para)}`);
      }
      if (extra) console.log(`      … +${extra} rename(s)`);
    }

    if (p.apagar?.length) {
      const extra = p.apagar.length > limiteApagarPorProcesso ? p.apagar.length - limiteApagarPorProcesso : 0;
      console.log(`    Apagar (${p.apagar.length} ficheiro(s) órfãos/inválidos):`);
      for (const a of p.apagar.slice(0, limiteApagarPorProcesso)) {
        console.log(`      • ${relAposBase(base, a.abs)}  (${a.motivo})`);
      }
      if (extra) console.log(`      … +${extra} ficheiro(s)`);
    }

    if (p.indicesValidosLista?.length && p.renumerar?.length) {
      const amostra = p.indicesValidosLista.slice(0, 12).join(', ');
      const mais = p.indicesValidosLista.length > 12 ? ` … +${p.indicesValidosLista.length - 12}` : '';
      console.log(`    Ordem das entradas válidas (índices actuais): ${amostra}${mais}`);
    }
    console.log('');
  }

  console.log('──────────────────────────────────────────────────────────────────');
  if (dryRun) {
    console.log('  Para APLICAR estas alterações nos ficheiros:');
    console.log('    node scripts/corrigir-historico-local-txt.mjs --aplicar [mesmas opções]');
    console.log('  ou no import:');
    console.log('    node scripts/import-historico-local-txt.mjs --aplicar-correcao …');
  }
  console.log('══════════════════════════════════════════════════════════════════\n');
}

/**
 * @param {object} resultado
 */
export function gerarResumoConsolidado(resultado) {
  const { stats, processos } = resultado;
  const comMudanca = processos.filter((p) => p.tipoAcao !== 'ok' && p.tipoAcao !== 'nenhum');
  const porAcao = { corrigir: 0, eliminar_indice: 0 };
  /** @type {Map<number, { eliminar: number, corrigir: number, procs: object[] }>} */
  const porCliente = new Map();

  for (const p of comMudanca) {
    porAcao[p.tipoAcao] = (porAcao[p.tipoAcao] || 0) + 1;
    const cod = p.codNum;
    if (!porCliente.has(cod)) porCliente.set(cod, { eliminar: 0, corrigir: 0, procs: [] });
    const row = porCliente.get(cod);
    if (p.tipoAcao === 'eliminar_indice') row.eliminar += 1;
    else if (p.tipoAcao === 'corrigir') row.corrigir += 1;
    row.procs.push({
      proc: p.procStr,
      acao: p.tipoAcao,
      indiceDeclarado: p.indiceDeclarado,
      entradasValidas: p.entradasValidas,
      indiceNovo: p.indiceNovo,
      renumerar: p.renumerar?.length ?? 0,
      apagar: p.apagar?.length ?? 0,
    });
  }

  const clientesComAlteracao = [...porCliente.entries()]
    .map(([cod, v]) => ({
      cod,
      cod8: processos.find((p) => p.codNum === cod)?.cod8,
      total: v.eliminar + v.corrigir,
      eliminar: v.eliminar,
      corrigir: v.corrigir,
      procs: v.procs,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    stats,
    totalComAlteracao: comMudanca.length,
    porAcao,
    clientesComAlteracao,
    clientesComAlteracaoCount: clientesComAlteracao.length,
  };
}

/**
 * Resumo executivo (após análise global).
 * @param {object} resultado
 * @param {object} [opts]
 */
export function imprimirResumoConsolidado(resultado, opts = {}) {
  const limiteClientes = opts.limiteClientes ?? 40;
  const resumo = gerarResumoConsolidado(resultado);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  RESUMO CONSOLIDADO — correção histórico local (todos os clientes) ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`  Clientes com ficheiros na pasta mil:     ${resumo.stats.clientesComHistorico ?? 0}`);
  console.log(`  Processos analisados:                  ${resumo.stats.processosAnalisados}`);
  console.log(`  Sem alteração:                         ${resumo.stats.semAlteracao}`);
  console.log(`  Com alteração prevista:                ${resumo.totalComAlteracao}`);
  console.log(`    → corrigir (índice e/ou renumeração):  ${resumo.porAcao.corrigir ?? 0}`);
  console.log(`    → eliminar índice 14 (sem válidos):    ${resumo.porAcao.eliminar_indice ?? 0}`);
  console.log(`  Processos com renumeração:             ${resumo.stats.comRenumeracao}`);
  console.log(`  Ficheiros a renomear (total):          ${resumo.stats.ficheirosRenomear}`);
  console.log(`  Ficheiros a apagar (total):            ${resumo.stats.ficheirosApagar}`);
  console.log('');

  if (!resumo.clientesComAlteracao.length) {
    console.log('  Nenhuma correção necessária em todo o universo analisado.\n');
    return resumo;
  }

  console.log(`  Clientes com pelo menos 1 processo a corrigir: ${resumo.clientesComAlteracaoCount}`);
  console.log(`  (top ${Math.min(limiteClientes, resumo.clientesComAlteracao.length)} por volume de processos)\n`);

  let n = 0;
  for (const c of resumo.clientesComAlteracao) {
    if (n >= limiteClientes) {
      console.log(`  … e mais ${resumo.clientesComAlteracao.length - limiteClientes} cliente(s).`);
      break;
    }
    n += 1;
    console.log(
      `  • Cliente ${c.cod} (${c.cod8}): ${c.total} processo(s) — corrigir: ${c.corrigir}, eliminar índice: ${c.eliminar}`
    );
    for (const p of c.procs.slice(0, 5)) {
      const extra =
        p.acao === 'corrigir'
          ? `decl=${p.indiceDeclarado} → válidas=${p.entradasValidas}${p.indiceNovo != null ? ` (novo=${p.indiceNovo})` : ''}`
          : `decl=${p.indiceDeclarado}, válidas=0`;
      console.log(`      proc ${p.proc}: ${p.acao} (${extra})`);
    }
    if (c.procs.length > 5) console.log(`      … +${c.procs.length - 5} processo(s)`);
  }
  console.log('');
  return resumo;
}
