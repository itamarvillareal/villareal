/**
 * Vínculo processo → imóvel (número da planilha) em ficheiros txt.
 *
 * **Escopo obrigatório:** apenas a pasta `Banco de Dados/Proc/` (não varre HC, Gerais, etc.).
 * Varredura recursiva com `fs.Dirent` (`readdir` + `withFileTypes: true`).
 *
 * Caminho típico: `Proc/1000/<centena>/<nº cliente>/<cod8>.0.89.1.<proc>.txt`
 *   — também pastas legadas sob `Proc/0/…` quando existirem.
 *
 * Regras do nome:
 *   - Cliente: primeiros 8 dígitos (`00000149`)
 *   - Proc: segmento entre o 4.º e o 5.º ponto (`00000149.0.89.1.127` → `127`)
 *   - Tipo fixo: `0.89.1`
 *
 * Conteúdo (uma linha): número do imóvel no cadastro (col. A) → gravado em
 * `imovel.numero_planilha` + `imovel.processo_id` (mesmo campo «Imóvel» na tela Processos).
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import { readOneLineFile, SEGMENTO_MIL } from './historico-local-txt-paths.mjs';

export { resolverBaseBancoDados };

export const TIPO_IMOVEL_VINCULO = '0.89.1';
export const PASTA_PROC = 'Proc';

/**
 * Raiz `…/Banco de Dados/Proc` (única pasta permitida para estes scripts).
 * @param {string} [candidato] — pasta `Proc` ou raiz `Banco de Dados` (acrescenta `Proc`)
 * @returns {string}
 */
export function resolverBaseProc(candidato) {
  if (candidato == null || String(candidato).trim() === '') {
    return path.join(resolverBaseBancoDados(), PASTA_PROC);
  }
  return validarRaizProc(candidato);
}

/**
 * Garante que o caminho resolve para `…/Banco de Dados/Proc`.
 * @param {string} candidato
 * @returns {string}
 */
export function validarRaizProc(candidato) {
  const resolved = path.resolve(String(candidato).trim());
  const baseProc =
    path.basename(resolved) === PASTA_PROC
      ? resolved
      : path.join(resolved, PASTA_PROC);

  if (path.basename(baseProc) !== PASTA_PROC) {
    throw new Error(
      `Este script só executa em «Banco de Dados/Proc». Caminho inválido: ${candidato}`
    );
  }

  const parentName = path.basename(path.dirname(baseProc));
  const banco = path.resolve(resolverBaseBancoDados());
  const procEsperado = path.join(banco, PASTA_PROC);
  if (path.resolve(baseProc) !== procEsperado && parentName !== 'Banco de Dados') {
    throw new Error(
      `Pasta Proc deve ficar em «…/Banco de Dados/Proc». Recebido: ${baseProc}`
    );
  }

  return baseProc;
}

export function defaultBaseProcMil() {
  return path.join(resolverBaseProc(), SEGMENTO_MIL);
}

/** @deprecated Use {@link resolverBaseProc} */
export function defaultBaseProcRaiz() {
  return resolverBaseProc();
}

/**
 * @param {string} fileName
 * @returns {{ cod8: string, codNum: number, numeroInterno: number } | null}
 */
export function parseNomeArquivoImovelVinculo0891(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split('.');
  if (parts.length !== 5) return null;

  const codRaw = parts[0];
  if (!/^\d{8}$/.test(codRaw)) return null;

  const tipoMeio = `${parts[1]}.${parts[2]}.${parts[3]}`;
  if (tipoMeio !== TIPO_IMOVEL_VINCULO) return null;

  const procRaw = parts[4];
  const numeroInterno = Number.parseInt(procRaw, 10);
  if (!Number.isFinite(numeroInterno) || numeroInterno < 1) return null;

  const codNum = Number.parseInt(codRaw, 10);
  return { cod8: codRaw, codNum, numeroInterno };
}

/**
 * @param {string | null | undefined} textoBruto
 * @returns {{ numeroPlanilha: number | null, aviso: string | null }}
 */
/** Máximo plausível para col. A da planilha de imóveis (evita `401.309.0151.001` → int overflow). */
export const MAX_NUMERO_PLANILHA_IMOVEL = 999_999;

export function parseNumeroPlanilhaImovelTxt(textoBruto) {
  const raw = textoBruto == null ? '' : String(textoBruto).trim();
  if (!raw) return { numeroPlanilha: null, aviso: 'vazio' };

  if (/^\d{1,7}$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    if (n >= 1 && n <= MAX_NUMERO_PLANILHA_IMOVEL) {
      return { numeroPlanilha: n, aviso: null };
    }
  }

  if (/^\d[\d.\s-]+$/.test(raw) && raw.includes('.')) {
    return { numeroPlanilha: null, aviso: `formato_pontuado:${raw.slice(0, 40)}` };
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return { numeroPlanilha: null, aviso: `nao_numerico:${raw.slice(0, 40)}` };

  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1 || n > MAX_NUMERO_PLANILHA_IMOVEL) {
    return { numeroPlanilha: null, aviso: `numero_invalido:${raw.slice(0, 40)}` };
  }
  return { numeroPlanilha: n, aviso: null };
}

/**
 * Varre recursivamente com `fs.Dirent` e devolve apenas `*.0.89.1.*.txt`.
 * @param {string} dir
 * @param {{ clienteFiltro?: number | null, origem?: string, raizProc?: string }} [opts]
 */
export function* iterarTxt0891ComDirent(dir, opts = {}) {
  if (!fs.existsSync(dir)) return;

  /** @type {import('node:fs').Dirent[]} */
  let dirents;
  try {
    dirents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const raizBanco = resolverBaseBancoDados();

  for (const dirent of dirents) {
    const abs = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* iterarTxt0891ComDirent(abs, opts);
      continue;
    }
    if (!dirent.isFile() || !dirent.name.toLowerCase().endsWith('.txt')) continue;

    const parsed = parseNomeArquivoImovelVinculo0891(dirent.name);
    if (!parsed) continue;
    if (opts.clienteFiltro != null && parsed.codNum !== opts.clienteFiltro) continue;

    const texto = readOneLineFile(abs);
    const { numeroPlanilha, aviso } = parseNumeroPlanilhaImovelTxt(texto);
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(abs).mtimeMs;
    } catch {
      /* ignore */
    }

    yield {
      ...parsed,
      texto,
      numeroPlanilha,
      avisoConteudo: aviso,
      arquivo: abs,
      relAposBanco: path.relative(raizBanco, abs).split(path.sep).join('/'),
      relAposProc: path
        .relative(opts.raizProc ?? dir, abs)
        .split(path.sep)
        .join('/'),
      origem: opts.origem ?? PASTA_PROC,
      mtimeMs,
    };
  }
}

/**
 * Árvore `Proc/1000/<cent>/<cliente>/` e outras pastas sob `Proc/` (ex.: `Proc/0/…`).
 * @param {string} baseRaizProc — pasta `Proc` (pai de `1000`); use {@link resolverBaseProc}
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function* iterarVinculosImovelProc(baseRaizProc, opts = {}) {
  const raiz = validarRaizProc(baseRaizProc);
  const walkOpts = { ...opts, raizProc: raiz };

  const mil = path.join(raiz, SEGMENTO_MIL);
  yield* iterarTxt0891ComDirent(mil, { ...walkOpts, origem: 'Proc/1000' });

  /** @type {import('node:fs').Dirent[]} */
  let top;
  try {
    top = fs.readdirSync(raiz, { withFileTypes: true });
  } catch {
    return;
  }

  for (const dirent of top) {
    if (!dirent.isDirectory() || dirent.name === SEGMENTO_MIL) continue;
    const legado = path.join(raiz, dirent.name);
    yield* iterarTxt0891ComDirent(legado, {
      ...walkOpts,
      origem: `Proc/${dirent.name}`,
    });
  }
}

/**
 * @param {string} baseRaizProc
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function levantarVinculosImovelProc(baseRaizProc, opts = {}) {
  const raiz = validarRaizProc(baseRaizProc);
  /** @type {Map<string, object>} */
  const map = new Map();

  for (const row of iterarVinculosImovelProc(raiz, opts)) {
    const key = `${row.cod8}|${row.numeroInterno}`;
    const prev = map.get(key);
    if (!prev || (row.mtimeMs ?? 0) >= (prev.mtimeMs ?? 0)) {
      map.set(key, row);
    }
  }

  return [...map.values()].sort(
    (a, b) => a.codNum - b.codNum || a.numeroInterno - b.numeroInterno
  );
}
