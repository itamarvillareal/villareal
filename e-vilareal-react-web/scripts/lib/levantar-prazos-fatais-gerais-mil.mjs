/**
 * Levantamento de prazos fatais em `Gerais/{1000|2000}/{Centena}/{Unidade}/` (regra VB).
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  caminhoClienteAlinhaSubpastaVb,
  deduplicarPrazosFataisGeraisMil,
  iterarPrazosFataisGeraisMil,
} from './gerais-145-1-prazo-fatal-mil.mjs';
import {
  parseDataPrazoFatalTxt,
  parseNomeArquivo145_1,
} from './gerais-145-1-prazo-fatal.mjs';
import { parseDataCabecalhoProcessoIso } from './datas-legado-vb.mjs';
import { readOneLineFile } from './historico-local-txt-paths.mjs';

const MILHARES = ['1000', '2000'];

/**
 * @param {string} baseGerais
 * @param {{ clienteFiltro?: number | null }} [opts]
 */
export function levantarPrazosFataisGeraisMil(baseGerais, opts = {}) {
  const clienteFiltro = opts.clienteFiltro ?? null;

  let ficheirosTxt = 0;
  let nomeInvalido = 0;
  let dataInvalida = 0;
  let dataValida = 0;
  let pastaIgnorada = 0;

  if (fs.existsSync(baseGerais)) {
    for (const milhar of MILHARES) {
      const baseMil = path.join(baseGerais, milhar);
      if (!fs.existsSync(baseMil)) continue;
      let centenas;
      try {
        centenas = fs.readdirSync(baseMil, { withFileTypes: true }).filter((d) => d.isDirectory());
      } catch {
        continue;
      }
      for (const cent of centenas) {
        const dirCent = path.join(baseMil, cent.name);
        let unidades;
        try {
          unidades = fs.readdirSync(dirCent, { withFileTypes: true }).filter((d) => d.isDirectory());
        } catch {
          continue;
        }
        for (const unid of unidades) {
          const codNum = Number.parseInt(unid.name, 10);
          if (!Number.isFinite(codNum) || codNum < 1) continue;
          if (clienteFiltro != null && codNum !== clienteFiltro) continue;
          if (!caminhoClienteAlinhaSubpastaVb(codNum, milhar, cent.name, unid.name)) {
            pastaIgnorada += 1;
            continue;
          }
          const dirUnid = path.join(dirCent, unid.name);
          let files;
          try {
            files = fs.readdirSync(dirUnid).filter((f) => /\.145\.1\./i.test(f) && f.endsWith('.txt'));
          } catch {
            continue;
          }
          for (const f of files) {
            ficheirosTxt += 1;
            const parsed = parseNomeArquivo145_1(f);
            if (!parsed || parsed.codNum !== codNum) {
              nomeInvalido += 1;
              continue;
            }
            try {
              const raw = readOneLineFile(path.join(dirUnid, f));
              const iso = parseDataCabecalhoProcessoIso(raw) ?? parseDataPrazoFatalTxt(raw);
              if (iso) dataValida += 1;
              else dataInvalida += 1;
            } catch {
              dataInvalida += 1;
            }
          }
        }
      }
    }
  }

  const brutos = [];
  for (const e of iterarPrazosFataisGeraisMil(baseGerais, { clienteFiltro })) {
    brutos.push(e);
  }
  const registos = deduplicarPrazosFataisGeraisMil(brutos);

  return {
    registos,
    stats: {
      ficheirosTxt,
      dataValida,
      dataInvalida,
      nomeInvalido,
      pastasIgnoradasSubpasta: pastaIgnorada,
      registosUnicos: registos.length,
      duplicadosDescartados: Math.max(0, brutos.length - registos.length),
      fonte: 'Gerais/{Milhar}/{Centena}/{Unidade}',
    },
  };
}
