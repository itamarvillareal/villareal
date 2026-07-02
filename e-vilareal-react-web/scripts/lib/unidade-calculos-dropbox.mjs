/**
 * Unidade do processo — ficheiros `0.88.*` em `Calculos/{Milhar}/{Centena}/{Cliente}/`.
 *
 * Nome VB: `00000NNN.0.88.1.<proc>.txt` (conteúdo = texto da unidade, ex. «Unidade 602 R»).
 */

import fs from 'node:fs';
import path from 'node:path';
import { milharPastaCalculo } from './calculos-dropbox-txt.mjs';
import {
  centenaPastaClienteHistorico,
  pastaNumeroClienteHistorico,
  readOneLineFile,
} from './historico-local-txt-paths.mjs';

export const PASTA_CALCULOS = 'Calculos';
export const LIMITE_UNIDADE = 32;

export const DEFAULT_BASE_CALCULOS = path.join(
  process.env.HOME || '',
  'Dropbox',
  'Banco de Dados',
  PASTA_CALCULOS
);

const MILHARES_CALCULOS = ['1000', '2000'];

/**
 * Resolve `--base` para a pasta `Calculos` (não a raiz «Banco de Dados»).
 * @param {string} [baseArg]
 */
export function resolverBaseCalculosUnidade(baseArg) {
  if (!baseArg) return DEFAULT_BASE_CALCULOS;
  const norm = path.resolve(baseArg);
  const baseName = path.basename(norm);
  if (baseName === PASTA_CALCULOS) return norm;
  if (baseName === 'Banco de Dados') return path.join(norm, PASTA_CALCULOS);
  return norm;
}

/**
 * Ex.: `00000299.0.88.1.12.txt` → cliente 299, processo 12.
 * Regra: 8 dígitos iniciais = código; segmento após o último ponto antes de `.txt` = proc;
 * o meio deve conter `0.88.`.
 *
 * @param {string} fileName
 * @returns {{ cod8: string, codNum: number, numeroInterno: number, tipoMeio: string } | null}
 */
export function parseNomeArquivoUnidadeCalculos(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  if (!/\.0\.88\./i.test(base)) return null;
  const parts = base.split('.');
  if (parts.length < 4) return null;
  const codRaw = parts[0];
  if (!/^\d{8}$/.test(codRaw)) return null;
  const procRaw = parts[parts.length - 1];
  const numeroInterno = Number.parseInt(procRaw, 10);
  if (!Number.isFinite(numeroInterno) || numeroInterno < 1) return null;
  const tipoMeio = parts.slice(1, -1).join('.');
  if (!tipoMeio.includes('0.88.')) return null;
  const codNum = Number.parseInt(codRaw, 10);
  if (!Number.isFinite(codNum) || codNum < 1) return null;
  return { cod8: codRaw, codNum, numeroInterno, tipoMeio };
}

/**
 * @param {string | null | undefined} texto
 * @returns {string | null}
 */
export function normalizarUnidadeCondoIdQuadraLote(texto) {
  if (texto == null) return null;
  const semPrefixo = String(texto)
    .trim()
    .replace(/^Unidade\s+/i, '')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!semPrefixo) return null;
  const m = /^QD(\d+)-?LT(\d+)$/.exec(semPrefixo);
  if (!m) return null;
  const quadra = Number.parseInt(m[1], 10);
  const lote = Number.parseInt(m[2], 10);
  if (!Number.isFinite(quadra) || !Number.isFinite(lote)) return null;
  return `QD${String(quadra).padStart(2, '0')}-LT${String(lote).padStart(2, '0')}`;
}

/**
 * @param {string | null | undefined} texto
 * @returns {string | null}
 */
export function normalizarUnidadeTxt(texto) {
  if (texto == null) return null;
  const s = String(texto).trim();
  if (!s) return null;
  const condo = normalizarUnidadeCondoIdQuadraLote(s);
  const canon = condo ?? s;
  const chars = [...canon];
  return chars.length <= LIMITE_UNIDADE ? canon : chars.slice(0, LIMITE_UNIDADE).join('');
}

/**
 * @param {number} codNum
 * @param {string} milhar
 * @param {string} centena
 * @param {string} pastaCliente
 */
export function caminhoClienteAlinhaSubpastaCalculos(codNum, milhar, centena, pastaCliente) {
  return (
    milharPastaCalculo(codNum) === milhar &&
    String(centenaPastaClienteHistorico(codNum)) === String(centena) &&
    pastaNumeroClienteHistorico(codNum) === String(pastaCliente)
  );
}

/**
 * @param {string} baseCalculos raiz `.../Banco de Dados/Calculos`
 * @param {{ clienteFiltro?: number | null }} [opts]
 * @yields {{
 *   cod8: string,
 *   codNum: number,
 *   numeroInterno: number,
 *   unidade: string | null,
 *   tipoMeio: string,
 *   arquivo: string,
 *   relPath: string,
 *   milhar: string,
 *   centena: string,
 *   pastaCliente: string,
 * }}
 */
export function* iterarUnidadesCalculosDropbox(baseCalculos, opts = {}) {
  if (!fs.existsSync(baseCalculos)) return;

  const filtroCliente = opts.clienteFiltro ?? null;

  for (const milhar of MILHARES_CALCULOS) {
    const baseMil = path.join(baseCalculos, milhar);
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
      let pastasCliente;
      try {
        pastasCliente = fs
          .readdirSync(dirCent, { withFileTypes: true })
          .filter((d) => d.isDirectory());
      } catch {
        continue;
      }

      for (const pasta of pastasCliente) {
        const codNum = Number.parseInt(pasta.name, 10);
        if (!Number.isFinite(codNum) || codNum < 1) continue;
        if (filtroCliente != null && codNum !== filtroCliente) continue;
        if (!caminhoClienteAlinhaSubpastaCalculos(codNum, milhar, cent.name, pasta.name)) {
          continue;
        }

        const dirCli = path.join(dirCent, pasta.name);
        let files;
        try {
          files = fs.readdirSync(dirCli).filter((f) => /\.0\.88\./i.test(f) && f.endsWith('.txt'));
        } catch {
          continue;
        }

        for (const f of files) {
          const parsed = parseNomeArquivoUnidadeCalculos(f);
          if (!parsed || parsed.codNum !== codNum) continue;
          const abs = path.join(dirCli, f);
          const raw = readOneLineFile(abs);
          yield {
            cod8: parsed.cod8,
            codNum: parsed.codNum,
            numeroInterno: parsed.numeroInterno,
            unidade: normalizarUnidadeTxt(raw),
            tipoMeio: parsed.tipoMeio,
            arquivo: abs,
            relPath: path.relative(baseCalculos, abs),
            milhar,
            centena: cent.name,
            pastaCliente: pasta.name,
          };
        }
      }
    }
  }
}

/**
 * Preferência: `0.88.1` (canónico VB); senão outro `0.88.*`; empate → ficheiro com texto não vazio.
 *
 * @param {ReturnType<typeof iterarUnidadesCalculosDropbox> extends Generator<infer T> ? T[] : never} brutos
 */
export function deduplicarUnidadesCalculos(brutos) {
  /** @type {Map<string, (typeof brutos)[number]>} */
  const porChave = new Map();

  for (const reg of brutos) {
    const chave = `${reg.cod8}:${reg.numeroInterno}`;
    const existente = porChave.get(chave);
    if (!existente) {
      porChave.set(chave, reg);
      continue;
    }
    const score = (r) => {
      let s = 0;
      if (r.tipoMeio === '0.88.1') s += 100;
      else if (r.tipoMeio.startsWith('0.88.')) s += 50;
      if (r.unidade) s += 10;
      return s;
    };
    if (score(reg) > score(existente)) {
      porChave.set(chave, reg);
    }
  }

  return [...porChave.values()].sort((a, b) => {
    if (a.codNum !== b.codNum) return a.codNum - b.codNum;
    return a.numeroInterno - b.numeroInterno;
  });
}

/**
 * @param {string} baseCalculos
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function levantarUnidadesCalculosDropbox(baseCalculos, opts = {}) {
  let ficheirosTxt = 0;
  let nomeInvalido = 0;
  let textoVazio = 0;
  let textoValido = 0;
  let pastaIgnorada = 0;

  if (fs.existsSync(baseCalculos)) {
    for (const milhar of MILHARES_CALCULOS) {
      const baseMil = path.join(baseCalculos, milhar);
      if (!fs.existsSync(baseMil)) continue;
      let centenas;
      try {
        centenas = fs.readdirSync(baseMil, { withFileTypes: true }).filter((d) => d.isDirectory());
      } catch {
        continue;
      }
      for (const cent of centenas) {
        const dirCent = path.join(baseMil, cent.name);
        let pastasCliente;
        try {
          pastasCliente = fs.readdirSync(dirCent, { withFileTypes: true }).filter((d) => d.isDirectory());
        } catch {
          continue;
        }
        for (const pasta of pastasCliente) {
          const codNum = Number.parseInt(pasta.name, 10);
          if (!Number.isFinite(codNum) || codNum < 1) continue;
          if (opts.clienteFiltro != null && codNum !== opts.clienteFiltro) continue;
          if (!caminhoClienteAlinhaSubpastaCalculos(codNum, milhar, cent.name, pasta.name)) {
            pastaIgnorada += 1;
            continue;
          }
          const dirCli = path.join(dirCent, pasta.name);
          let files;
          try {
            files = fs.readdirSync(dirCli).filter((f) => /\.0\.88\./i.test(f) && f.endsWith('.txt'));
          } catch {
            continue;
          }
          for (const f of files) {
            ficheirosTxt += 1;
            const parsed = parseNomeArquivoUnidadeCalculos(f);
            if (!parsed || parsed.codNum !== codNum) {
              nomeInvalido += 1;
              continue;
            }
            try {
              const raw = readOneLineFile(path.join(dirCli, f));
              const norm = normalizarUnidadeTxt(raw);
              if (norm) textoValido += 1;
              else textoVazio += 1;
            } catch {
              textoVazio += 1;
            }
          }
        }
      }
    }
  }

  const brutos = [];
  for (const e of iterarUnidadesCalculosDropbox(baseCalculos, opts)) {
    brutos.push(e);
  }
  const registos = deduplicarUnidadesCalculos(brutos);

  return {
    registos,
    stats: {
      ficheirosTxt,
      textoValido,
      textoVazio,
      nomeInvalido,
      pastasIgnoradasSubpasta: pastaIgnorada,
      registosUnicos: registos.length,
      duplicadosDescartados: Math.max(0, brutos.length - registos.length),
      fonte: 'Calculos/{Milhar}/{Centena}/{Cliente}',
    },
  };
}
