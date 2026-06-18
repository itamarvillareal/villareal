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
import { execFileSync } from 'node:child_process';

import {
  DEFAULT_BASE_HISTORICO_LOCAL,
  decodeHistoricoTextBuffer,
} from './lib/historico-local-txt-paths.mjs';
import { lerConteudoEntradaHistorico, entradaHistoricoValida } from './lib/historico-local-txt-entrada.mjs';
import { analisarInformacaoHistoricoParaReimport } from './lib/historico-informacao-import.mjs';

const RE_NOME_T15 = /^(\d{8})\.15\.1\.([^.]+)\.(\d{4})\.txt$/i;
const PREFIXOS_SCAN = ['HC', 'Historico de Consultas Inativos'];
/** Prefiltro por bytes no disco (texto latin1/utf8 >500 chars). */
const PREFILTRO_BYTES = 480;
const LOTE = 800;

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

function codNumDeCod8(cod8) {
  return Math.trunc(Number.parseInt(String(cod8), 10));
}

function procNumDeProcStr(procStr) {
  return Math.trunc(Number.parseInt(String(procStr), 10));
}

function clienteNoIntervalo(codNum, min, max) {
  return codNum >= min && codNum <= max;
}

/** @returns {string[]} */
function listarFicheirosTipo15(base) {
  /** @type {string[]} */
  const out = [];
  for (const pre of PREFIXOS_SCAN) {
    const root = path.join(base, pre);
    if (!fs.existsSync(root)) continue;
    try {
      const buf = execFileSync(
        'rg',
        ['--files', root, '-g', '*.15.1.*.txt'],
        { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }
      );
      for (const line of buf.split('\n')) {
        const p = line.trim();
        if (p) out.push(p);
      }
    } catch (err) {
      const stdout = err?.stdout ? String(err.stdout) : '';
      for (const line of stdout.split('\n')) {
        const p = line.trim();
        if (p) out.push(p);
      }
    }
  }
  return out;
}

/** @returns {Set<string>} */
function listarFicheirosComSeparador(base) {
  const set = new Set();
  for (const pre of PREFIXOS_SCAN) {
    const root = path.join(base, pre);
    if (!fs.existsSync(root)) continue;
    try {
      const buf = execFileSync(
        'rg',
        ['-l', '--fixed-strings', '8*&*@&#(*@&93837942', root, '-g', '*.15.1.*.txt'],
        { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
      );
      for (const line of buf.split('\n')) {
        const p = line.trim();
        if (p) set.add(p);
      }
    } catch (err) {
      const stdout = err?.stdout ? String(err.stdout) : '';
      for (const line of stdout.split('\n')) {
        const p = line.trim();
        if (p) set.add(p);
      }
    }
  }
  return set;
}

/**
 * @param {string} abs
 * @param {Set<string>} comSeparador
 */
function analisarFicheiroTipo15(abs, comSeparador) {
  const nome = path.basename(abs);
  const m = RE_NOME_T15.exec(nome);
  if (!m) return null;

  const cod8 = m[1];
  const procStr = m[2];
  const idx4 = m[3];
  const codNum = codNumDeCod8(cod8);
  const indice = Math.trunc(Number.parseInt(idx4, 10));
  const numeroInterno = procNumDeProcStr(procStr);
  if (!Number.isFinite(codNum) || codNum < 1) return null;
  if (!Number.isFinite(indice) || indice < 1) return null;
  if (!Number.isFinite(numeroInterno) || numeroInterno < 1) return null;

  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;

  const forcarLeitura = comSeparador.has(abs);
  if (!forcarLeitura && stat.size < PREFILTRO_BYTES) return null;

  let texto;
  try {
    texto = decodeHistoricoTextBuffer(fs.readFileSync(abs));
  } catch {
    return null;
  }

  const analise = analisarInformacaoHistoricoParaReimport(texto);
  if (!analise) return null;

  return {
    chave: `${cod8}|${procStr}|${idx4}`,
    codigoCliente8: cod8,
    codNum,
    numeroInterno,
    procStr,
    indice,
    indice4: idx4,
    analise,
    arquivoTipo15: abs,
    tamanhoFicheiro: stat.size,
  };
}

/**
 * @param {string} base
 * @param {object} cand
 */
function validarEntradaImportavel(base, cand) {
  const c = lerConteudoEntradaHistorico(base, cand.codigoCliente8, cand.codNum, cand.procStr, cand.indice);
  if (!entradaHistoricoValida(c)) {
    return { importavel: false, motivo: c.motivoInvalido ?? 'invalido' };
  }
  const analise = analisarInformacaoHistoricoParaReimport(c.infoTrim);
  if (!analise) {
    return { importavel: false, motivo: 'nao_precisa_reimport_canonical' };
  }
  return {
    importavel: true,
    dataBruta: c.dataTrim,
    usuarioBruto: c.userTrim,
    arquivoTipo15Canonico: c.infoArquivoAbs,
    analise,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  console.log(`[scan] base=${opts.base}`);
  console.log(`[scan] clientes ${opts.clienteMin}–${opts.clienteMax}`);
  console.log('[scan] a indexar ficheiros tipo 15…');

  const ficheiros = listarFicheirosTipo15(opts.base);
  console.log(`[scan] ficheiros tipo 15 encontrados: ${ficheiros.length}`);

  console.log('[scan] a procurar separador legado…');
  const comSeparador = listarFicheirosComSeparador(opts.base);
  console.log(`[scan] ficheiros com separador (bruto): ${comSeparador.size}`);

  /** @type {Map<string, object>} */
  const candidatos = new Map();
  let lidos = 0;
  let analisados = 0;

  for (let i = 0; i < ficheiros.length; i += LOTE) {
    const lote = ficheiros.slice(i, i + LOTE);
    for (const abs of lote) {
      analisados += 1;
      const r = analisarFicheiroTipo15(abs, comSeparador);
      if (!r) continue;
      if (!clienteNoIntervalo(r.codNum, opts.clienteMin, opts.clienteMax)) continue;
      lidos += 1;
      const prev = candidatos.get(r.chave);
      if (!prev || r.analise.tamanhoNormalizado > prev.analise.tamanhoNormalizado) {
        candidatos.set(r.chave, r);
      }
    }
    if ((i + LOTE) % 8000 === 0 || i + LOTE >= ficheiros.length) {
      process.stdout.write(
        `\r[scan] analisados ${Math.min(i + LOTE, ficheiros.length)}/${ficheiros.length} — candidatos ${candidatos.size}`
      );
    }
  }
  console.log(`\n[scan] candidatos únicos (pré-validação): ${candidatos.size}`);

  console.log('[scan] a validar entradas importáveis (mesma regra do importador)…');
  /** @type {Map<string, { codigoCliente8: string, codNum: number, numeroInterno: number, entradas: object[] }>} */
  const porProcesso = new Map();
  let totalAfetadas = 0;
  let descartadas = 0;
  const contagemMotivos = { texto_maior_500: 0, separador_legado: 0, ambos: 0 };

  for (const cand of candidatos.values()) {
    const val = validarEntradaImportavel(opts.base, cand);
    if (!val.importavel) {
      descartadas += 1;
      continue;
    }

    totalAfetadas += 1;
    const analise = val.analise;
    const temTexto = analise.motivos.includes('texto_maior_500');
    const temSep = analise.motivos.includes('separador_legado');
    if (temTexto && temSep) contagemMotivos.ambos += 1;
    else if (temTexto) contagemMotivos.texto_maior_500 += 1;
    else if (temSep) contagemMotivos.separador_legado += 1;

    const chaveProc = `${cand.codNum}:${cand.numeroInterno}`;
    if (!porProcesso.has(chaveProc)) {
      porProcesso.set(chaveProc, {
        codigoCliente8: cand.codigoCliente8,
        codNum: cand.codNum,
        numeroInterno: cand.numeroInterno,
        entradas: [],
      });
    }
    porProcesso.get(chaveProc).entradas.push({
      indice: cand.indice,
      indice4: cand.indice4,
      motivos: analise.motivos,
      tamanhoBruto: analise.tamanhoBruto,
      tamanhoNormalizado: analise.tamanhoNormalizado,
      perdaTituloAntigo: analise.perdaTituloAntigo,
      dataBruta: val.dataBruta,
      usuarioBruto: val.usuarioBruto,
      arquivoTipo15: relAposBase(opts.base, val.arquivoTipo15Canonico),
      arquivoTipo15Detectado: relAposBase(opts.base, cand.arquivoTipo15),
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
    ficheirosTipo15Analisados: analisados,
    ficheirosLidosConteudo: lidos,
    candidatosPreValidacao: candidatos.size,
    candidatosDescartados: descartadas,
    entradasAfetadas: totalAfetadas,
    processosAfetados: processos.length,
    clientesAfetados: clientesUnicos.size,
    contagemMotivos,
    criterios: {
      texto_maior_500: 'informação normalizada > 500 caracteres (truncada no import antigo)',
      separador_legado: 'contém 8*&*@&#(*@&93837942',
    },
    processos,
  };

  fs.writeFileSync(opts.saida, `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8');

  const dirSaida = path.dirname(opts.saida);
  const stem = path.basename(opts.saida, path.extname(opts.saida)).replace(/-texto$/, '');
  const pathProcessos = path.join(dirSaida, `${stem}-processos.txt`);
  const pathComandos = path.join(dirSaida, `${stem}-comandos.sh`);
  const pathIndices = path.join(dirSaida, `${stem}-entradas.tsv`);

  const linhasProcessos = processos.map(
    (p) => `${p.codNum},${p.numeroInterno},${p.qtdEntradas},"${p.indices.join(',')}"`
  );
  fs.writeFileSync(
    pathProcessos,
    ['# cliente,numero_interno,qtd_entradas_afetadas,indices', ...linhasProcessos, ''].join('\n'),
    'utf8'
  );

  const linhasTsv = [
    'cliente\tprocesso\tindice\tmotivos\ttamanho\tperda_500\tarquivo_tipo15\tdata\tusuario',
    ...processos.flatMap((p) =>
      p.entradas.map((e) =>
        [
          p.codNum,
          p.numeroInterno,
          e.indice,
          e.motivos.join('+'),
          e.tamanhoNormalizado,
          e.perdaTituloAntigo,
          e.arquivoTipo15 ?? '',
          e.dataBruta ?? '',
          e.usuarioBruto ?? '',
        ].join('\t')
      )
    ),
  ];
  fs.writeFileSync(pathIndices, `${linhasTsv.join('\n')}\n`, 'utf8');

  const clientesOrdenados = [...clientesUnicos].sort((a, b) => a - b);
  const linhasCmd = [
    '#!/bin/bash',
    '# Reimportação cirúrgica — um cliente de cada vez (--substituir-andamentos só nesse cliente)',
    '# export VILAREAL_IMPORT_SENHA=… antes de executar',
    'set -euo pipefail',
    'cd "$(dirname "$0")/../e-vilareal-react-web" 2>/dev/null || cd "$(dirname "$0")/.." || true',
    '',
    ...clientesOrdenados.flatMap((cod) => {
      const procs = processos.filter((p) => p.codNum === cod);
      const procList = procs.map((p) => p.numeroInterno).join(',');
      const qtd = procs.reduce((s, p) => s + p.qtdEntradas, 0);
      return [
        `echo "=== Cliente ${cod} (${procs.length} processo(s), ${qtd} entradas) ==="`,
        `# Processos: ${procList}`,
        `node scripts/import-historico-local-txt.mjs --cliente=${cod} --sem-corrigir --login=SEU_LOGIN --substituir-andamentos --nao-limpar-import`,
        '',
      ];
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
  console.log(`Ficheiros tipo 15:     ${ficheiros.length}`);
  console.log(`Entradas a reimportar: ${totalAfetadas}`);
  console.log(`Processos afetados:    ${processos.length}`);
  console.log(`Clientes afetados:    ${clientesUnicos.size}`);
  console.log(`Descartadas (inválidas): ${descartadas}`);
  console.log(`Motivos:`);
  console.log(`  texto > 500 chars:   ${contagemMotivos.texto_maior_500}`);
  console.log(`  separador legado:    ${contagemMotivos.separador_legado}`);
  console.log(`  ambos:               ${contagemMotivos.ambos}`);
  console.log(`Tempo:                 ${elapsed}s`);
  console.log(`\nJSON:      ${opts.saida}`);
  console.log(`Processos: ${pathProcessos}`);
  console.log(`Entradas:  ${pathIndices}`);
  console.log(`Comandos:  ${pathComandos}`);

  if (processos.length > 0 && processos.length <= 30) {
    console.log('\n--- Processos ---');
    for (const p of processos) {
      console.log(
        `  cliente ${p.codNum} proc ${p.numeroInterno}: ${p.qtdEntradas} entrada(s) idx [${p.indices.join(', ')}]`
      );
    }
  } else if (processos.length > 30) {
    console.log('\n--- Primeiros 25 processos ---');
    for (const p of processos.slice(0, 25)) {
      console.log(
        `  cliente ${p.codNum} proc ${p.numeroInterno}: ${p.qtdEntradas} entrada(s) idx [${p.indices.join(', ')}]`
      );
    }
    console.log(`  … e mais ${processos.length - 25} processo(s) — ver ficheiros em /tmp`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
