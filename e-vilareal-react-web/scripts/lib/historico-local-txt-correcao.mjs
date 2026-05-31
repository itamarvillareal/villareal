/**
 * Fase de correção dos txt de histórico local antes da importação:
 *
 * 1. Índice **14** declarado >> entradas válidas reais → actualizar índice para N real e
 *    renumerar ficheiros 15/16/17 para 0001..N (ordem pelo índice antigo).
 * 2. Índice **14** existe mas **nenhuma** entrada válida → eliminar ficheiro(s) de índice 14
 *    e remover ficheiros órfãos 15/16/17 desse processo.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  MEIO_FIXO,
  PREFIXOS,
  TIPO_DATA,
  TIPO_INDICE,
  TIPO_INFO,
  TIPO_USUARIO,
  formatCentenaPasta,
  formatCod8,
  formatIndice4,
  formatProcNomeArquivo,
  maxProcParaCliente,
  nomeArquivo,
  nomeArquivoIndice14PorProcesso,
  pastaNumeroClienteHistorico,
  parseIntStrict,
  readFirstExistingComCaminho,
  relPathsIndice14PorProcesso,
  relPathsIndiceOuDataTipo,
  inferirMaxIndicePorFicheirosTipo16,
  limparCacheLeituraHistoricoLocal,
  centenaPastaClienteHistorico,
  carregarContagensOpcional,
  SEGMENTO_MIL,
  iterPastasAnoMesSobPrefixo,
} from './historico-local-txt-paths.mjs';
import { entradaHistoricoValida, lerConteudoEntradaHistorico } from './historico-local-txt-entrada.mjs';

const TIPOS_ENTRADA = [TIPO_DATA, TIPO_INFO, TIPO_USUARIO];
/** Sufixo temporário na 1.ª passagem de rename (evita colisões). */
const TEMP_INDICE_BASE = 900000;
/**
 * Teto absoluto de índices a avaliar por processo. O índice é gravado com 4 dígitos
 * (0001..9999), logo nenhum processo legítimo passa disto. Acima deste valor o
 * `maxAvaliar` só pode vir de um nome de ficheiro corrompido (ex.: data no lugar do
 * índice) — abortamos com erro claro em vez de girar num laço efectivamente infinito.
 */
const LIMITE_INDICES_POR_PROCESSO = 10000;

/**
 * @param {string} base
 * @param {string} cod8
 * @param {number} codNum
 * @param {string} procStr
 */
export function lerIndice14Declarado(base, cod8, codNum, procStr) {
  const rels = relPathsIndice14PorProcesso(base, cod8, codNum, procStr);
  const hit = readFirstExistingComCaminho(base, rels);
  let valor = null;
  if (hit.texto != null) {
    const n = parseIntStrict(hit.texto);
    if (Number.isFinite(n) && n >= 0) valor = Math.trunc(n);
  }
  /** @type {string[]} */
  const pathsExistentes = [];
  for (const rel of rels) {
    const abs = path.join(base, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) pathsExistentes.push(abs);
  }
  return { valorDeclarado: valor, pathsIndice14: pathsExistentes, relsIndice14: rels };
}

/**
 * Descobre índices presentes no disco (pasta mil + árvore Ano).
 * @returns {number[]}
 */
/** Índices presentes na pasta mil (rápido). */
export function descobrirIndicesNaPastaMil(base, cod8, codNum, procStr) {
  const re = new RegExp(
    `^${cod8.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(15|16|17)\\.${MEIO_FIXO}\\.${procStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d{4})\\.txt$`
  );
  /** @type {Set<number>} */
  const indices = new Set();
  const cent = formatCentenaPasta(centenaPastaClienteHistorico(codNum));
  const pastaCliente = pastaNumeroClienteHistorico(codNum);
  const relDir = path.join(SEGMENTO_MIL, cent, pastaCliente);

  for (const pre of PREFIXOS) {
    const dirAbs = path.join(base, pre, relDir);
    if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) continue;
    let ents;
    try {
      ents = fs.readdirSync(dirAbs);
    } catch {
      continue;
    }
    for (const f of ents) {
      const m = f.match(re);
      if (m) {
        const n = Number.parseInt(m[2], 10);
        if (Number.isFinite(n) && n >= 1) indices.add(n);
      }
    }
  }
  return [...indices].sort((a, b) => a - b);
}

/** Índices na pasta mil + árvore Ano (completo, mais lento). */
export function descobrirIndicesNoDisco(base, cod8, codNum, procStr) {
  const indices = new Set(descobrirIndicesNaPastaMil(base, cod8, codNum, procStr));
  const re = new RegExp(
    `^${cod8.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(15|16|17)\\.${MEIO_FIXO}\\.${procStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d{4})\\.txt$`
  );

  for (const pre of PREFIXOS) {
    for (const { dirAbs } of iterPastasAnoMesSobPrefixo(path.join(base, pre))) {
      let ents;
      try {
        ents = fs.readdirSync(dirAbs);
      } catch {
        continue;
      }
      for (const name of ents) {
        const m = name.match(re);
        if (m) {
          const n = Number.parseInt(m[2], 10);
          if (Number.isFinite(n) && n >= 1) indices.add(n);
        }
      }
    }
  }

  return [...indices].sort((a, b) => a - b);
}

/**
 * Todos os ficheiros físicos de um tipo/índice (HC, Inativos, mil e Ano).
 * @param {number} tipo — 15 | 16 | 17
 */
export function listarFicheirosAbsTipoIndice(base, cod8, codNum, procStr, indice, tipo) {
  const idx4 = formatIndice4(indice);
  const nome = nomeArquivo(cod8, tipo, procStr, idx4);
  /** @type {Set<string>} */
  const out = new Set();

  for (const rel of relPathsIndiceOuDataTipo(base, cod8, codNum, procStr, tipo, idx4)) {
    const abs = path.join(base, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) out.add(abs);
  }

  for (const pre of PREFIXOS) {
    for (const { dirAbs } of iterPastasAnoMesSobPrefixo(path.join(base, pre))) {
      const abs = path.join(dirAbs, nome);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) out.add(abs);
    }
  }

  return [...out];
}

function precisaRenumerar(indicesValidosOrdenados) {
  for (let i = 0; i < indicesValidosOrdenados.length; i += 1) {
    if (indicesValidosOrdenados[i] !== i + 1) return true;
  }
  return false;
}

function mkdirpForFile(abs) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}

/**
 * @param {string} base
 * @param {string[]} relsIndice14
 * @param {number} n
 * @param {boolean} dryRun
 */
function gravarIndice14(base, relsIndice14, n, dryRun) {
  const texto = String(n);
  for (const rel of relsIndice14) {
    const abs = path.join(base, rel);
    if (dryRun) continue;
    mkdirpForFile(abs);
    fs.writeFileSync(abs, texto, 'utf8');
  }
  if (!dryRun && relsIndice14.length) {
    const primary = path.join(base, relsIndice14[0]);
    if (!fs.existsSync(primary)) {
      mkdirpForFile(primary);
      fs.writeFileSync(primary, texto, 'utf8');
    }
  }
}

/**
 * @param {string[]} pathsAbs
 * @param {boolean} dryRun
 */
function eliminarFicheiros(pathsAbs, dryRun) {
  for (const abs of pathsAbs) {
    if (!fs.existsSync(abs)) continue;
    if (dryRun) continue;
    try {
      fs.unlinkSync(abs);
    } catch (e) {
      console.warn(`[corrigir] Falha ao eliminar ${abs}:`, e?.message || e);
    }
  }
}

/**
 * Renumerar entradas válidas: índice antigo → 1..N.
 * @param {number[]} indicesValidosOrdenados
 */
function renumerarEntradas(base, cod8, codNum, procStr, indicesValidosOrdenados, dryRun) {
  const n = indicesValidosOrdenados.length;
  /** @type {{ tempIdx: number, oldIdx: number, newIdx: number, paths: string[] }[]} */
  const plano = [];

  for (let p = 0; p < n; p += 1) {
    const oldIdx = indicesValidosOrdenados[p];
    const newIdx = p + 1;
    if (oldIdx === newIdx) continue;

    const tempIdx = TEMP_INDICE_BASE + p;
    /** @type {string[]} */
    const paths = [];
    for (const tipo of TIPOS_ENTRADA) {
      paths.push(...listarFicheirosAbsTipoIndice(base, cod8, codNum, procStr, oldIdx, tipo));
    }
    if (paths.length) plano.push({ tempIdx, oldIdx, newIdx, paths });
  }

  for (const step of plano) {
    for (const abs of step.paths) {
      const tipo = Number(path.basename(abs).split('.')[1]);
      const tempName = nomeArquivo(cod8, tipo, procStr, formatIndice4(step.tempIdx));
      const tempAbs = path.join(path.dirname(abs), tempName);
      if (dryRun) continue;
      if (abs === tempAbs) continue;
      try {
        fs.renameSync(abs, tempAbs);
      } catch (e) {
        throw new Error(`rename temp ${abs} → ${tempAbs}: ${e?.message || e}`);
      }
    }
  }

  for (const step of plano) {
    for (const abs of step.paths) {
      const tipo = Number(path.basename(abs).split('.')[1]);
      const tempName = nomeArquivo(cod8, tipo, procStr, formatIndice4(step.tempIdx));
      const tempAbs = path.join(path.dirname(abs), tempName);
      const finalName = nomeArquivo(cod8, tipo, procStr, formatIndice4(step.newIdx));
      const finalAbs = path.join(path.dirname(abs), finalName);
      if (dryRun) continue;
      const src = fs.existsSync(tempAbs) ? tempAbs : abs;
      if (src === finalAbs) continue;
      try {
        if (fs.existsSync(finalAbs)) fs.unlinkSync(finalAbs);
        fs.renameSync(src, finalAbs);
      } catch (e) {
        throw new Error(`rename final ${src} → ${finalAbs}: ${e?.message || e}`);
      }
    }
  }
}

/**
 * @param {Set<number>} indicesPermitidos
 * @returns {{ apagar: { abs: string, motivo: string }[] }}
 */
function planejarLimpezaForaDoConjunto(base, cod8, codNum, procStr, indicesPermitidos) {
  /** @type {{ abs: string, motivo: string }[]} */
  const apagar = [];
  const todosNoDisco = descobrirIndicesNoDisco(base, cod8, codNum, procStr);
  for (const idx of todosNoDisco) {
    if (indicesPermitidos.has(idx)) continue;
    for (const tipo of TIPOS_ENTRADA) {
      for (const abs of listarFicheirosAbsTipoIndice(base, cod8, codNum, procStr, idx, tipo)) {
        apagar.push({ abs, motivo: `indice_${idx}_fora_do_conjunto_valido` });
      }
    }
  }
  return { apagar };
}

/**
 * @param {number[]} indicesValidosOrdenados
 */
function planejarRenumeracao(base, cod8, codNum, procStr, indicesValidosOrdenados) {
  const n = indicesValidosOrdenados.length;
  /** @type {{ de: string, para: string, indiceAntigo: number, indiceNovo: number, tipo: number }[]} */
  const renumerar = [];

  for (let p = 0; p < n; p += 1) {
    const oldIdx = indicesValidosOrdenados[p];
    const newIdx = p + 1;
    if (oldIdx === newIdx) continue;

    for (const tipo of TIPOS_ENTRADA) {
      for (const abs of listarFicheirosAbsTipoIndice(base, cod8, codNum, procStr, oldIdx, tipo)) {
        const finalName = nomeArquivo(cod8, tipo, procStr, formatIndice4(newIdx));
        const para = path.join(path.dirname(abs), finalName);
        renumerar.push({ de: abs, para, indiceAntigo: oldIdx, indiceNovo: newIdx, tipo });
      }
    }
  }
  return { renumerar };
}

/**
 * Analisa um processo e devolve o plano de alterações (sem modificar ficheiros).
 * @returns {object}
 */
/**
 * @param {string} base
 * @param {number} codNum
 * @param {number} procNum
 * @param {{ modoRapido?: boolean }} [opts]
 */
export function analisarProcessoHistorico(base, codNum, procNum, opts = {}) {
  const modoRapido = opts.modoRapido !== false;
  const cod8 = formatCod8(codNum);
  const procStr = formatProcNomeArquivo(procNum);
  if (!procStr) {
    return {
      cod8,
      procNum,
      procStr: null,
      tipoAcao: 'ignorado',
      descricaoAcao: 'número de processo inválido',
    };
  }

  const { valorDeclarado, pathsIndice14, relsIndice14 } = lerIndice14Declarado(
    base,
    cod8,
    codNum,
    procStr
  );
  const indicesMil = descobrirIndicesNaPastaMil(base, cod8, codNum, procStr);
  const maxMil = indicesMil.length ? Math.max(...indicesMil) : 0;
  const inferido16 = inferirMaxIndicePorFicheirosTipo16(base, cod8, codNum, procStr) ?? 0;
  const maxDeclarado =
    valorDeclarado != null && Number.isFinite(valorDeclarado) && valorDeclarado >= 1
      ? valorDeclarado
      : 0;
  const tetoFicheiros = Math.max(maxMil, inferido16);
  let maxAvaliar = tetoFicheiros;
  if (maxDeclarado > 0 && maxDeclarado <= tetoFicheiros + 100) {
    maxAvaliar = Math.max(maxAvaliar, maxDeclarado);
  }

  // Teto de segurança proporcional aos ficheiros realmente presentes no disco.
  // Avaliar cada índice faz uma varredura completa da árvore Ano/aaaa/mm, então um
  // maxAvaliar corrompido (ex.: sufixo de índice inválido) travaria o processo.
  // Preferimos abortar apontando o registo problemático a girar para sempre.
  const tetoSeguranca = Math.max(LIMITE_INDICES_POR_PROCESSO, tetoFicheiros + 100);
  if (maxAvaliar > tetoSeguranca) {
    throw new Error(
      `[corrigir] índice fora do intervalo esperado para cliente ${cod8} proc ${procStr}: ` +
        `maxAvaliar=${maxAvaliar} (índice 14 declarado=${maxDeclarado}, maxMil=${maxMil}, ` +
        `inferido16=${inferido16}). Provável nome de ficheiro corrompido (sufixo de índice ` +
        `que não segue o formato 0001..9999). Verifique a pasta deste processo no Dropbox.`
    );
  }

  /** @type {number[]} */
  const indicesParaAvaliar = [];
  for (let i = 1; i <= maxAvaliar; i += 1) indicesParaAvaliar.push(i);

  /** @type {number[]} */
  const indicesValidos = [];
  /** @type {{ indice: number, motivo: string }[]} */
  const invalidosDetalhe = [];

  for (const idx of indicesParaAvaliar) {
    const c = lerConteudoEntradaHistorico(base, cod8, codNum, procStr, idx);
    if (entradaHistoricoValida(c)) indicesValidos.push(idx);
    else if (c.dataTrim || c.infoTrim) {
      invalidosDetalhe.push({ indice: idx, motivo: c.motivoInvalido || 'parcial' });
    }
  }

  const nReal = indicesValidos.length;
  const plano = {
    cod8,
    codNum,
    procNum,
    procStr,
    indiceDeclarado: valorDeclarado,
    indicesNoDisco: indicesMil.length,
    entradasValidas: nReal,
    invalidos: invalidosDetalhe.length,
    invalidosDetalhe,
    indicesValidosLista: [...indicesValidos],
    tipoAcao: 'ok',
    descricaoAcao: 'sem alteração',
    indiceNovo: null,
    atualizarIndice14: /** @type {{ abs: string, valorNovo: string }[]} */ ([]),
    eliminarIndice14: /** @type {string[]} */ ([]),
    renumerar: /** @type {object[]} */ ([]),
    apagar: /** @type {{ abs: string, motivo: string }[]} */ ([]),
  };

  if (nReal === 0) {
    if (pathsIndice14.length > 0 || valorDeclarado != null) {
      plano.tipoAcao = 'eliminar_indice';
      plano.descricaoAcao = 'eliminar índice 14 e ficheiros 15/16/17 (sem histórico válido)';
      plano.eliminarIndice14 = [...pathsIndice14];
      if (!modoRapido) {
        const indicesDiscoFull = descobrirIndicesNoDisco(base, cod8, codNum, procStr);
        for (const idx of indicesDiscoFull) {
          for (const tipo of TIPOS_ENTRADA) {
            for (const abs of listarFicheirosAbsTipoIndice(base, cod8, codNum, procStr, idx, tipo)) {
              plano.apagar.push({ abs, motivo: 'sem_entrada_valida' });
            }
          }
        }
      }
    }
    return plano;
  }

  const conjuntoValido = new Set(indicesValidos);
  const renum = precisaRenumerar(indicesValidos);
  const indiceDesatualizado = valorDeclarado == null || valorDeclarado !== nReal;
  plano.indiceNovo = nReal;

  if (!modoRapido) {
    const limpeza = planejarLimpezaForaDoConjunto(base, cod8, codNum, procStr, conjuntoValido);
    plano.apagar.push(...limpeza.apagar);

    for (const inv of invalidosDetalhe) {
      for (const tipo of TIPOS_ENTRADA) {
        for (const abs of listarFicheirosAbsTipoIndice(base, cod8, codNum, procStr, inv.indice, tipo)) {
          if (!plano.apagar.some((a) => a.abs === abs)) {
            plano.apagar.push({ abs, motivo: inv.motivo });
          }
        }
      }
    }
  }

  if (renum || indiceDesatualizado) {
    plano.tipoAcao = 'corrigir';
    const partes = [];
    if (indiceDesatualizado) partes.push(`índice 14: ${valorDeclarado ?? '?'} → ${nReal}`);
    if (renum) partes.push(`renumerar ${nReal} entrada(s) para 0001..${formatIndice4(nReal)}`);
    plano.descricaoAcao = partes.join('; ');

    if (indiceDesatualizado) {
      const rels = relsIndice14.length ? relsIndice14 : relPathsIndice14PorProcesso(base, cod8, codNum, procStr);
      const alvo = pathsIndice14.length ? pathsIndice14 : [path.join(base, rels[0])];
      plano.atualizarIndice14 = alvo.map((abs) => ({ abs, valorNovo: String(nReal) }));
    }

    if (renum) {
      if (modoRapido) {
        plano.precisaRenumerar = true;
        plano.renumerar = [];
      } else {
        plano.renumerar = planejarRenumeracao(base, cod8, codNum, procStr, indicesValidos).renumerar;
      }
    }
  }

  return plano;
}

function relAposBase(base, abs) {
  const norm = abs.split(/[/\\]/).join('/');
  const b = base.split(/[/\\]/).join('/').replace(/\/$/, '');
  if (norm.startsWith(b + '/')) return norm.slice(b.length + 1);
  return norm;
}

/**
 * Lista processos com ficheiros na pasta mil (índice 14 ou 15/16/17) — evita varrer 1..999 à toa.
 * @returns {number[]}
 */
export function listarProcessosHistoricoCliente(base, codNum) {
  const cod8 = formatCod8(codNum);
  const cent = formatCentenaPasta(centenaPastaClienteHistorico(codNum));
  const pastaCliente = pastaNumeroClienteHistorico(codNum);
  const relDir = path.join(SEGMENTO_MIL, cent, pastaCliente);
  const esc = cod8.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re14 = new RegExp(`^${esc}\\.${TIPO_INDICE}\\.${MEIO_FIXO}\\.(\\d+)\\.txt$`);
  const reEnt = new RegExp(`^${esc}\\.(15|16|17)\\.${MEIO_FIXO}\\.(\\d+)\\.\\d{4}\\.txt$`);
  /** @type {Set<number>} */
  const procs = new Set();

  for (const pre of PREFIXOS) {
    const dirAbs = path.join(base, pre, relDir);
    if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) continue;
    let ents;
    try {
      ents = fs.readdirSync(dirAbs);
    } catch {
      continue;
    }
    for (const f of ents) {
      let m = f.match(re14);
      if (m) {
        const n = Number.parseInt(m[1], 10);
        if (Number.isFinite(n) && n >= 1) procs.add(n);
        continue;
      }
      m = f.match(reEnt);
      if (m) {
        const n = Number.parseInt(m[2], 10);
        if (Number.isFinite(n) && n >= 1) procs.add(n);
      }
    }
  }
  return [...procs].sort((a, b) => a - b);
}

/**
 * Varre clientes/processos e gera plano de correção (análise).
 */
export function executarAnaliseHistoricoLocal(opts) {
  const base = opts.base;
  const clienteMin = opts.clienteMin ?? 1;
  const clienteMax = opts.clienteMax ?? 999;
  const verbose = opts.verbose === true;

  const stats = {
    clientesComHistorico: 0,
    processosAnalisados: 0,
    semAlteracao: 0,
    indiceAtualizar: 0,
    indiceEliminar: 0,
    comRenumeracao: 0,
    ficheirosRenomear: 0,
    ficheirosApagar: 0,
  };
  /** @type {object[]} */
  const processos = [];

  const codLo = opts.filtroClienteCod != null ? opts.filtroClienteCod : clienteMin;
  const codHi = opts.filtroClienteCod != null ? opts.filtroClienteCod : clienteMax;
  const lista =
    Array.isArray(opts.clientesLista) && opts.clientesLista.length
      ? [...new Set(opts.clientesLista.map((c) => Math.trunc(Number(c))).filter((c) => c >= 1 && c <= 999))].sort(
          (a, b) => a - b
        )
      : null;

  const codigos = lista ?? [];
  if (!lista) {
    for (let cod = codLo; cod <= codHi; cod += 1) codigos.push(cod);
  }

  for (const cod of codigos) {
    const procsAlvo = listarProcessosHistoricoCliente(base, cod);
    if (!procsAlvo.length) continue;
    stats.clientesComHistorico += 1;

    if (verbose) {
      console.error(`[análise] cliente ${cod}/${codHi} — ${procsAlvo.length} processo(s)`);
    }
    limparCacheLeituraHistoricoLocal();

    for (const proc of procsAlvo) {
      if (opts.filtroProcesso != null && proc !== opts.filtroProcesso) continue;

      stats.processosAnalisados += 1;
      const plano = analisarProcessoHistorico(base, cod, proc, { modoRapido: opts.modoRapido });
      processos.push(plano);

      if (plano.tipoAcao === 'ok' || plano.tipoAcao === 'nenhum') stats.semAlteracao += 1;
      else if (plano.tipoAcao === 'eliminar_indice') stats.indiceEliminar += 1;
      else if (plano.tipoAcao === 'corrigir') {
        if (plano.atualizarIndice14?.length) stats.indiceAtualizar += 1;
        if (plano.renumerar?.length || plano.precisaRenumerar) stats.comRenumeracao += 1;
      }
      stats.ficheirosRenomear +=
        plano.renumerar?.length ?? (plano.precisaRenumerar ? (plano.entradasValidas ?? 0) * 3 : 0);
      stats.ficheirosApagar += plano.apagar?.length ?? 0;
    }
  }

  return {
    base,
    dryRun: opts.dryRun !== false,
    stats,
    processos,
  };
}

/**
 * Aplica o plano de um processo (alterações reais em disco).
 */
export function aplicarPlanoProcessoHistorico(base, plano) {
  if (plano.tipoAcao === 'ignorado' || plano.tipoAcao === 'ok' || plano.tipoAcao === 'nenhum') {
    return plano;
  }

  if (plano.tipoAcao === 'eliminar_indice') {
    for (const rel of plano.eliminarIndice14 || []) {
      const abs = path.isAbsolute(rel) ? rel : path.join(base, rel);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
    for (const { abs } of plano.apagar || []) {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
    return plano;
  }

  if (plano.tipoAcao === 'corrigir') {
    for (const { abs, valorNovo } of plano.atualizarIndice14 || []) {
      mkdirpForFile(abs);
      fs.writeFileSync(abs, valorNovo, 'utf8');
    }
    if (
      plano.indicesValidosLista?.length &&
      (plano.renumerar?.length || plano.precisaRenumerar)
    ) {
      renumerarEntradas(
        base,
        plano.cod8,
        plano.procNum,
        plano.procStr,
        plano.indicesValidosLista,
        false
      );
    }
    for (const { abs } of plano.apagar || []) {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
  }

  return plano;
}

/**
 * Remove ficheiros 15/16/17 cujo índice não está no conjunto permitido.
 */
function limparFicheirosForaDoConjunto(base, cod8, codNum, procStr, indicesPermitidos, dryRun) {
  const { apagar } = planejarLimpezaForaDoConjunto(base, cod8, codNum, procStr, indicesPermitidos);
  eliminarFicheiros(
    apagar.map((a) => a.abs),
    dryRun
  );
}

/**
 * Corrige um processo (cliente + nº interno).
 * @returns {object} relatório
 */
export function corrigirProcessoHistorico(base, codNum, procNum, opts = {}) {
  const dryRun = opts.dryRun === true;
  const verbose = opts.verbose === true;
  const plano = analisarProcessoHistorico(base, codNum, procNum, { modoRapido: false });
  if (dryRun) {
    return {
      ...plano,
      acao: plano.tipoAcao,
      indiceAntigo: plano.indiceDeclarado,
      reenumerou: (plano.renumerar?.length ?? 0) > 0,
    };
  }
  aplicarPlanoProcessoHistorico(base, plano);
  if (verbose && plano.tipoAcao !== 'ok') {
    console.log(`[corrigir] ${plano.cod8} proc ${plano.procStr}: ${plano.descricaoAcao}`);
  }
  return {
    ...plano,
    acao: plano.tipoAcao,
    indiceAntigo: plano.indiceDeclarado,
    reenumerou: (plano.renumerar?.length ?? 0) > 0,
  };
}

/**
 * Varre clientes/processos e aplica correção.
 * @param {object} opts
 */
export function executarCorrecaoHistoricoLocal(opts) {
  const aplicar = opts.dryRun === false;
  const analise = executarAnaliseHistoricoLocal({
    ...opts,
    dryRun: true,
    modoRapido: !aplicar,
  });
  if (opts.dryRun !== false) {
    return {
      stats: {
        processosAnalisados: analise.stats.processosAnalisados,
        semAlteracao: analise.stats.semAlteracao,
        indiceCorrigido: analise.stats.indiceAtualizar + analise.stats.indiceEliminar,
        indiceEliminado: analise.stats.indiceEliminar,
        renumerados: analise.stats.comRenumeracao,
      },
      amostras: analise.processos.filter((p) => p.tipoAcao !== 'ok').slice(0, 50),
      dryRun: true,
      analise,
    };
  }

  for (const plano of analise.processos) {
    if (plano.tipoAcao !== 'ok' && plano.tipoAcao !== 'nenhum') {
      aplicarPlanoProcessoHistorico(opts.base, plano);
    }
  }

  return {
    stats: {
      processosAnalisados: analise.stats.processosAnalisados,
      semAlteracao: analise.stats.semAlteracao,
      indiceCorrigido: analise.stats.indiceAtualizar,
      indiceEliminado: analise.stats.indiceEliminar,
      renumerados: analise.stats.comRenumeracao,
    },
    amostras: analise.processos.filter((p) => p.tipoAcao !== 'ok').slice(0, 50),
    dryRun: false,
    analise,
  };
}
