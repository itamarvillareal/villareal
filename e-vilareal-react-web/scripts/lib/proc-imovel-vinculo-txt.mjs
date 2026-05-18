/**
 * Vínculo processo → imóvel (número da planilha) em ficheiros txt (Dropbox «Banco de Dados»).
 *
 * Caminho: `Proc/1000/<centena>/<nº cliente>/<cod8>.0.89.1.<proc>.txt`
 *   — também pastas legadas sob `Proc/0/…` quando existirem.
 *
 * Regras do nome:
 *   - Cliente: primeiros 8 dígitos (`00000149`)
 *   - Proc: segmento entre o 4.º e o 5.º ponto (`00000149.0.89.1.127` → `127`)
 *   - Tipo fixo: `0.89.1`
 *
 * Conteúdo (uma linha): número do imóvel no cadastro (col. A da planilha de imóveis).
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import { readOneLineFile, SEGMENTO_MIL } from './historico-local-txt-paths.mjs';

export { resolverBaseBancoDados };

export const TIPO_IMOVEL_VINCULO = '0.89.1';
export const PASTA_PROC = 'Proc';

export function defaultBaseProcMil() {
  return path.join(resolverBaseBancoDados(), PASTA_PROC, SEGMENTO_MIL);
}

export function defaultBaseProcRaiz() {
  return path.join(resolverBaseBancoDados(), PASTA_PROC);
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
 * @param {string} dir
 * @param {{ clienteFiltro?: number | null, origem?: string }} [opts]
 */
function* iterarTxtImovelVinculoEmDiretorio(dir, opts = {}) {
  if (!fs.existsSync(dir)) return;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* iterarTxtImovelVinculoEmDiretorio(abs, opts);
      continue;
    }
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.txt')) continue;

    const parsed = parseNomeArquivoImovelVinculo0891(ent.name);
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
      relAposBanco: path
        .relative(resolverBaseBancoDados(), abs)
        .split(path.sep)
        .join('/'),
      origem: opts.origem ?? 'Proc',
      mtimeMs,
    };
  }
}

/**
 * Árvore `Proc/1000/<cent>/<cliente>/` e outras pastas sob `Proc/` (ex.: `Proc/0/…`).
 * @param {string} baseRaizProc — pasta `Proc` (pai de `1000`)
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function* iterarVinculosImovelProc(baseRaizProc, opts = {}) {
  const mil = path.join(baseRaizProc, SEGMENTO_MIL);
  yield* iterarTxtImovelVinculoEmDiretorio(mil, { ...opts, origem: 'Proc/1000' });

  let top;
  try {
    top = fs.readdirSync(baseRaizProc, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of top) {
    if (!ent.isDirectory() || ent.name === SEGMENTO_MIL) continue;
    const legado = path.join(baseRaizProc, ent.name);
    yield* iterarTxtImovelVinculoEmDiretorio(legado, {
      ...opts,
      origem: `Proc/${ent.name}`,
    });
  }
}

/**
 * @param {string} baseRaizProc
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function levantarVinculosImovelProc(baseRaizProc, opts = {}) {
  /** @type {Map<string, object>} */
  const map = new Map();

  for (const row of iterarVinculosImovelProc(baseRaizProc, opts)) {
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
