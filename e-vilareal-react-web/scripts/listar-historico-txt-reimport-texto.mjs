#!/usr/bin/env node
/**
 * Lista entradas de histórico (txt) que precisam reimportação por texto truncado (>500) ou separador legado.
 *
 * Uso:
 *   node scripts/listar-historico-txt-reimport-texto.mjs
 *   node scripts/listar-historico-txt-reimport-texto.mjs --cliente-min=400 --cliente-max=500
 *   node scripts/listar-historico-txt-reimport-texto.mjs --saida=/tmp/reimport-historico.json
 *
 * Saídas (por defeito em /tmp):
 *   reimport-historico-texto.json       — relatório completo
 *   reimport-historico-processos.txt    — uma linha por processo: cliente,processo,indices,qtd
 *   reimport-historico-comandos.sh      — comandos sugeridos por cliente (substituir-andamentos)
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';
import { analisarInformacaoHistoricoParaReimport } from './lib/historico-informacao-import.mjs';
import { coletarEntradasHistoricoLocal } from './lib/historico-local-txt-iterar.mjs';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    clienteMin: 1,
    clienteMax: 999,
    clienteFiltro: null,
    saida: '/tmp/reimport-historico-texto.json',
  };
  for (const a of argv) {
    if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max='))
      out.clienteMax = Math.min(999, Number(a.slice('--cliente-max='.length)) || 999);
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) {
        out.clienteFiltro = Math.trunc(n);
        out.clienteMin = out.clienteFiltro;
        out.clienteMax = out.clienteFiltro;
      }
    } else if (a.startsWith('--saida=')) out.saida = path.resolve(a.slice(8));
  }
  return out;
}

function relAposBase(base, abs) {
  if (!abs) return null;
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  if (!abs.startsWith(prefix)) return abs;
  return abs.slice(prefix.length).split(path.sep).join('/');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  console.log(`[scan] base=${opts.base}`);
  console.log(`[scan] clientes ${opts.clienteMin}–${opts.clienteMax}`);

  const entradas = coletarEntradasHistoricoLocal({
    base: opts.base,
    clienteMin: opts.clienteMin,
    clienteMax: opts.clienteMax,
    filtroClienteCod: opts.clienteFiltro,
  });

  /** @type {Map<string, { codigoCliente8: string, codNum: number, numeroInterno: number, entradas: object[] }>} */
  const porProcesso = new Map();
  let totalAfetadas = 0;
  const contagemMotivos = { texto_maior_500: 0, separador_legado: 0, ambos: 0 };

  for (const e of entradas) {
    const analise = analisarInformacaoHistoricoParaReimport(e.informacao);
    if (!analise) continue;

    totalAfetadas += 1;
    const temTexto = analise.motivos.includes('texto_maior_500');
    const temSep = analise.motivos.includes('separador_legado');
    if (temTexto && temSep) contagemMotivos.ambos += 1;
    else if (temTexto) contagemMotivos.texto_maior_500 += 1;
    else if (temSep) contagemMotivos.separador_legado += 1;

    const chave = `${e.codNum}:${e.numeroInterno}`;
    if (!porProcesso.has(chave)) {
      porProcesso.set(chave, {
        codigoCliente8: e.codigoCliente8,
        codNum: e.codNum,
        numeroInterno: e.numeroInterno,
        entradas: [],
      });
    }
    porProcesso.get(chave).entradas.push({
      indice: e.indice,
      indice4: e.indice4,
      motivos: analise.motivos,
      tamanhoBruto: analise.tamanhoBruto,
      tamanhoNormalizado: analise.tamanhoNormalizado,
      perdaTituloAntigo: analise.perdaTituloAntigo,
      dataBruta: e.dataBruta,
      usuarioBruto: e.usuarioBruto,
      arquivoTipo15: relAposBase(opts.base, e.infoArquivoAbs),
    });
  }

  const processos = [...porProcesso.values()]
    .map((p) => ({
      ...p,
      qtdEntradas: p.entradas.length,
      indices: p.entradas.map((x) => x.indice).sort((a, b) => a - b),
      entradas: p.entradas.sort((a, b) => a.indice - b.indice),
    }))
    .sort((a, b) => a.codNum - b.codNum || a.numeroInterno - b.numeroInterno);

  const clientesUnicos = new Set(processos.map((p) => p.codNum));

  const relatorio = {
    geradoEm: new Date().toISOString(),
    base: opts.base,
    clientesMinMax: [opts.clienteMin, opts.clienteMax],
    entradasLidas: entradas.length,
    entradasAfetadas: totalAfetadas,
    processosAfetados: processos.length,
    clientesAfetados: clientesUnicos.size,
    contagemMotivos,
    processos,
  };

  fs.writeFileSync(opts.saida, `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8');

  const dirSaida = path.dirname(opts.saida);
  const stem = path.basename(opts.saida, path.extname(opts.saida)).replace(/-texto$/, '');
  const pathProcessos = path.join(dirSaida, `${stem}-processos.txt`);
  const pathComandos = path.join(dirSaida, `${stem}-comandos.sh`);

  const linhasProcessos = processos.map(
    (p) =>
      `${p.codNum},${p.numeroInterno},${p.qtdEntradas},"${p.indices.join(',')}"`
  );
  fs.writeFileSync(
    pathProcessos,
    [
      '# cliente,numero_interno,qtd_entradas_afetadas,indices',
      ...linhasProcessos,
      '',
    ].join('\n'),
    'utf8'
  );

  const clientesOrdenados = [...clientesUnicos].sort((a, b) => a - b);
  const linhasCmd = [
    '#!/bin/bash',
    '# Reimportação cirúrgica — um cliente de cada vez (--substituir-andamentos só nesse cliente)',
    '# Ajuste login/senha antes de executar.',
    'set -euo pipefail',
    '',
    ...clientesOrdenados.map((cod) => {
      const procs = processos.filter((p) => p.codNum === cod);
      const procList = procs.map((p) => p.numeroInterno).join(',');
      return [
        `echo "=== Cliente ${cod} (${procs.length} processo(s), ${procs.reduce((s, p) => s + p.qtdEntradas, 0)} entradas) ==="`,
        `# Processos: ${procList}`,
        `node scripts/import-historico-local-txt.mjs --cliente=${cod} --sem-corrigir --login=SEU_LOGIN --substituir-andamentos --nao-limpar-import`,
        '',
      ].join('\n');
    }),
  ];
  fs.writeFileSync(pathComandos, `${linhasCmd.join('\n')}\n`, 'utf8');
  try {
    fs.chmodSync(pathComandos, 0o755);
  } catch {
    /* windows */
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n======== RESUMO ========');
  console.log(`Entradas lidas:        ${entradas.length}`);
  console.log(`Entradas a reimportar: ${totalAfetadas}`);
  console.log(`Processos afetados:    ${processos.length}`);
  console.log(`Clientes afetados:     ${clientesUnicos.size}`);
  console.log(`Motivos:`);
  console.log(`  texto > 500 chars:   ${contagemMotivos.texto_maior_500}`);
  console.log(`  separador legado:    ${contagemMotivos.separador_legado}`);
  console.log(`  ambos:               ${contagemMotivos.ambos}`);
  console.log(`Tempo:                 ${elapsed}s`);
  console.log(`\nJSON:      ${opts.saida}`);
  console.log(`Processos: ${pathProcessos}`);
  console.log(`Comandos:  ${pathComandos}`);

  if (processos.length > 0 && processos.length <= 30) {
    console.log('\n--- Processos ---');
    for (const p of processos) {
      console.log(
        `  cliente ${p.codNum} proc ${p.numeroInterno}: ${p.qtdEntradas} entrada(s) idx [${p.indices.join(', ')}]`
      );
    }
  } else if (processos.length > 30) {
    console.log('\n--- Primeiros 20 processos ---');
    for (const p of processos.slice(0, 20)) {
      console.log(
        `  cliente ${p.codNum} proc ${p.numeroInterno}: ${p.qtdEntradas} entrada(s) idx [${p.indices.join(', ')}]`
      );
    }
    console.log(`  … e mais ${processos.length - 20} processo(s) — ver JSON`);
  }
}

main();
