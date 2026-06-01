/**
 * Prazo fatal 145.1 — caminho canónico VB: `Gerais/{Milhar}/{Centena}/{Unidade}/`.
 * Não usar `Gerais/145.1/aaaa/mm/` (histórico mensal) na sincronização para a API.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseDataCabecalhoProcessoIso } from './datas-legado-vb.mjs';
import {
  parseDataPrazoFatalTxt,
  parseNomeArquivo145_1,
} from './gerais-145-1-prazo-fatal.mjs';
import { subpastaClienteVb } from './historico-local-txt-paths.mjs';

export const DEFAULT_BASE_GERAIS = path.join(
  process.env.HOME || '',
  'Dropbox',
  'Banco de Dados',
  'Gerais'
);

const MILHARES_GERAIS = ['1000', '2000'];

/**
 * Resolve `--base` para a pasta `Gerais` (não a árvore mensal `145.1`).
 * @param {string} [baseArg]
 */
export function resolverBaseGeraisPrazoFatal(baseArg) {
  if (!baseArg) return DEFAULT_BASE_GERAIS;
  const norm = path.resolve(baseArg);
  const baseName = path.basename(norm);
  if (baseName === '145.1') {
    return path.dirname(norm);
  }
  return norm;
}

/**
 * @param {number} codNum
 * @param {string} milhar
 * @param {string} centena
 * @param {string} unidade
 */
export function caminhoClienteAlinhaSubpastaVb(codNum, milhar, centena, unidade) {
  const esp = subpastaClienteVb(codNum);
  return (
    esp.milhar === milhar &&
    esp.centena === String(centena) &&
    esp.unidade === String(unidade)
  );
}

/**
 * @param {string} baseGerais raiz `.../Banco de Dados/Gerais`
 * @param {{ clienteFiltro?: number | null }} [opts]
 * @yields {{
 *   cod8: string,
 *   codNum: number,
 *   numeroInterno: number,
 *   prazoFatalIso: string,
 *   arquivo: string,
 *   relPath: string,
 *   milhar: string,
 *   centena: string,
 *   unidade: string,
 * }}
 */
export function* iterarPrazosFataisGeraisMil(baseGerais, opts = {}) {
  if (!fs.existsSync(baseGerais)) return;

  const filtroCliente = opts.clienteFiltro ?? null;

  for (const milhar of MILHARES_GERAIS) {
    const baseMil = path.join(baseGerais, milhar);
    if (!fs.existsSync(baseMil)) continue;

    let centenas;
    try {
      centenas = fs
        .readdirSync(baseMil, { withFileTypes: true })
        .filter((d) => d.isDirectory());
    } catch {
      continue;
    }

    for (const cent of centenas) {
      const dirCent = path.join(baseMil, cent.name);
      let unidades;
      try {
        unidades = fs
          .readdirSync(dirCent, { withFileTypes: true })
          .filter((d) => d.isDirectory());
      } catch {
        continue;
      }

      for (const unid of unidades) {
        const codNum = Number.parseInt(unid.name, 10);
        if (!Number.isFinite(codNum) || codNum < 1) continue;
        if (filtroCliente != null && codNum !== filtroCliente) continue;
        if (!caminhoClienteAlinhaSubpastaVb(codNum, milhar, cent.name, unid.name)) continue;

        const dirUnid = path.join(dirCent, unid.name);
        let files;
        try {
          files = fs.readdirSync(dirUnid).filter((f) => /\.145\.1\./i.test(f) && f.endsWith('.txt'));
        } catch {
          continue;
        }

        for (const f of files) {
          const parsed = parseNomeArquivo145_1(f);
          if (!parsed || parsed.codNum !== codNum) continue;

          const abs = path.join(dirUnid, f);
          let raw;
          try {
            raw = fs.readFileSync(abs, 'utf8');
          } catch {
            continue;
          }

          const prazoFatalIso =
            parseDataCabecalhoProcessoIso(raw) ?? parseDataPrazoFatalTxt(raw);
          if (!prazoFatalIso) continue;

          yield {
            cod8: parsed.cod8,
            codNum: parsed.codNum,
            numeroInterno: parsed.numeroInterno,
            prazoFatalIso,
            arquivo: abs,
            relPath: path.relative(baseGerais, abs),
            milhar,
            centena: cent.name,
            unidade: unid.name,
          };
        }
      }
    }
  }
}

/**
 * Um registo por par cliente+processo (caminho canónico é único).
 * @param {Iterable<ReturnType<typeof iterarPrazosFataisGeraisMil> extends Generator<infer T> ? T : never>} entradas
 */
export function deduplicarPrazosFataisGeraisMil(entradas) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const e of entradas) {
    const key = `${e.cod8}|${e.numeroInterno}`;
    if (!map.has(key)) map.set(key, e);
  }
  return [...map.values()].sort(
    (a, b) => a.codNum - b.codNum || a.numeroInterno - b.numeroInterno
  );
}
